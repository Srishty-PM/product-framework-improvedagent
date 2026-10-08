#!/usr/bin/env python3
"""Loopback-only document extraction and optional local Ollama inference.
No cloud integration, document writes, telemetry or shell/code execution.
"""
from __future__ import annotations
import argparse
import base64
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'vendor'))
MAX_FILE = 10 * 1024 * 1024
MAX_TEXT = 200000
MAX_BODY = 15 * 1024 * 1024
CSP = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; frame-src 'self' about:; font-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"


def bounded_text(text):
    if len(text) > MAX_TEXT:
        raise ValueError('Extracted text exceeds 200,000 characters. Split the document; nothing was truncated.')
    if not text.strip():
        raise ValueError('No readable text found. Scanned PDFs require a text/OCR version.')
    return text.strip()


def safe_xml(data):
    if b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():
        raise ValueError('XML entities are not supported.')
    return ET.fromstring(data)


def office_archive(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    entries = z.infolist()
    if len(entries) > 2000 or sum(x.file_size for x in entries) > 40 * 1024 * 1024:
        z.close()
        raise ValueError('Office document expands beyond the safe extraction limit.')
    for entry in entries:
        if entry.flag_bits & 1:
            z.close()
            raise ValueError('Encrypted Office documents are not supported.')
    return z


def extract_document(name, data):
    if not isinstance(name, str) or not isinstance(data, str):
        raise ValueError('File name and base64 data are required.')
    raw = base64.b64decode(data, validate=True)
    if len(raw) > MAX_FILE:
        raise ValueError('File exceeds 10 MB.')
    ext = Path(name).suffix.lower()
    if ext == '.pdf':
        try:
            from pypdf import PdfReader
        except ImportError:
            raise ValueError('PDF parser unavailable. Use the offline download with the bundled parser, or paste exported text.') from None
        reader = PdfReader(io.BytesIO(raw))
        if reader.is_encrypted:
            raise ValueError('Encrypted PDFs are not supported. Use a decrypted text export.')
        if len(reader.pages) > 100:
            raise ValueError('Maximum 100 PDF pages. Split the file.')
        parts = []
        total = 0
        for i, page in enumerate(reader.pages, 1):
            # pypdf never executes PDF JavaScript, attachments or active content.
            content = page.get_contents()
            if content and len(content.get_data()) > 10 * 1024 * 1024:
                raise ValueError('PDF page content exceeds the safe extraction limit.')
            text = page.extract_text() or ''
            total += len(text)
            if total > MAX_TEXT:
                raise ValueError('PDF text exceeds 200,000 characters. Split the file.')
            if text.strip():
                parts.append(f'--- Page {i} ---\n{text}')
        return bounded_text('\n\n'.join(parts))
    if ext == '.docx':
        with office_archive(raw) as z:
            xml = safe_xml(z.read('word/document.xml'))
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            paragraphs = []
            for paragraph in xml.findall('.//w:p', ns):
                text = ''.join(node.text or '' for node in paragraph.findall('.//w:t', ns))
                if text.strip():
                    paragraphs.append(text)
            return bounded_text('\n'.join(paragraphs))
    if ext == '.xlsx':
        with office_archive(raw) as z:
            ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            strings = []
            if 'xl/sharedStrings.xml' in z.namelist():
                shared = safe_xml(z.read('xl/sharedStrings.xml'))
                strings = [''.join(t.text or '' for t in x.findall('.//s:t', ns)) for x in shared]
            sheets = sorted(n for n in z.namelist() if re.fullmatch(r'xl/worksheets/sheet\d+\.xml', n))
            if len(sheets) > 50:
                raise ValueError('Maximum 50 worksheets. Split the workbook.')
            parts = []
            for sheet in sheets:
                tree = safe_xml(z.read(sheet))
                parts.append('--- '+sheet+' ---')
                for row in tree.findall('.//s:row', ns):
                    cells = []
                    for cell in row.findall('s:c', ns):
                        v = cell.find('s:v', ns)
                        value = v.text if v is not None and v.text is not None else ''
                        if cell.get('t') == 's':
                            value = strings[int(value)]
                        elif cell.get('t') == 'inlineStr':
                            value = ''.join(t.text or '' for t in cell.findall('.//s:t', ns))
                        formula = cell.find('s:f', ns)
                        if formula is not None:
                            value += ' [cached formula value; not recalculated]'
                        if value:
                            cells.append(f'{cell.get("r", "cell")}: {value}')
                    if cells:
                        parts.append(' | '.join(cells))
            return bounded_text('\n'.join(parts))
    raise ValueError('Unsupported extraction format. Use PDF, DOCX or XLSX.')


def run_extractor(payload):
    # A malformed document cannot keep the server busy indefinitely. No files are written.
    try:
        proc = subprocess.run([sys.executable, str(Path(__file__).resolve()), '--extract'],
                              input=json.dumps(payload), text=True, capture_output=True, timeout=25)
    except subprocess.TimeoutExpired:
        raise ValueError('Extraction timed out. Split the file or paste a text export.') from None
    if proc.returncode or not proc.stdout:
        raise ValueError('Extraction failed within the resource limits. Use a text export.')
    result = json.loads(proc.stdout)
    if 'error' in result:
        raise ValueError(result['error'])
    return result


def generate_local(payload):
    model = payload.get('model', '')
    prompt = payload.get('prompt', '')
    tokens = payload.get('max_tokens', 1800)
    if not isinstance(model, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._:/-]{0,149}', model):
        raise ValueError('Enter the exact name of an already installed local Ollama model.')
    if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 120000:
        raise ValueError('Local AI prompt exceeds the context limit. Reduce documents or prior drafts.')
    if not isinstance(tokens, int) or not 1 <= tokens <= 8000:
        raise ValueError('Invalid output length.')
    request = urllib.request.Request('http://127.0.0.1:11435/api/generate', method='POST',
                                     data=json.dumps({'model': model, 'prompt': prompt, 'stream': False,
                                                      'options': {'num_predict': tokens, 'temperature': 0.2, 'num_ctx': 32768}}).encode(),
                                     headers={'Content-Type': 'application/json'})
    # Disable environment proxies. Ollama cloud model names are never allowed.
    # Only locally present weights are usable: verify /api/tags and reject remote/cloud models.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        with opener.open('http://127.0.0.1:11435/api/tags', timeout=5) as response:
            models = json.loads(response.read(1024 * 1024)).get('models', [])
        found = [m for m in models if m.get('name') == model or m.get('model') == model]
        if not found or any(m.get('remote_host') or m.get('remote_model') for m in found) or 'cloud' in model.lower():
            raise ValueError('Choose an installed local model. Cloud/remote models and automatic downloads are disabled.')
        # Positive local-weight requirement catches remote metadata even if renamed.
        if not any(isinstance(m.get('size'), int) and m['size'] > 0 and m.get('digest') for m in found):
            raise ValueError('Local model weights could not be verified. Choose an installed local model.')
        with opener.open(request, timeout=180) as response:
            data = json.loads(response.read(2 * 1024 * 1024))
    except (urllib.error.URLError, TimeoutError):
        raise ValueError('Cannot reach the local Ollama model. Start Ollama with an installed local model, or select the evidence workbook. No cloud fallback was used.') from None
    if data.get('error'):
        raise ValueError('Local model returned an error. Check its availability in Ollama.')
    if data.get('done_reason') == 'length':
        raise ValueError('Local model output reached its limit. Shorten the workspace or use the evidence workbook; partial output was not accepted.')
    if data.get('done') is not True:
        raise ValueError('Local model generation was incomplete. Partial output was not accepted.')
    text = data.get('response', '')
    if not isinstance(text, str) or not text.strip():
        raise ValueError('The local model returned no text.')
    return {'text': bounded_text(text)}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError('Local model redirects are disabled.')


class Handler(BaseHTTPRequestHandler):
    server_version = 'ProductIntelligenceLocal'

    def log_message(self, *args):
        pass  # No document metadata, prompts or request logs.

    def permitted(self):
        hosts = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
        origin = self.headers.get('Origin')
        return self.headers.get('Host') in hosts and (not origin or origin in {'http://'+h for h in hosts})

    def send(self, code, body, content_type='application/json'):
        content = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', CSP)
        self.send_header('Referrer-Policy', 'no-referrer')
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        if not self.permitted():
            return self.send(403, {'error': 'Local origin required.'})
        paths = {'/': 'index.html', '/index.html': 'index.html', '/offline.js': 'offline.js'}
        name = paths.get(self.path.split('?')[0])
        if name is None:
            return self.send(404, {'error': 'Not found.'})
        kind = 'text/html; charset=utf-8' if name.endswith('.html') else 'text/javascript; charset=utf-8'
        self.send(200, (ROOT / name).read_bytes(), kind)

    def do_POST(self):
        if not self.permitted() or self.headers.get('X-PIA-Request') != 'local':
            return self.send(403, {'error': 'Local browser requests only.'})
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            return self.send(415, {'error': 'JSON required.'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= MAX_BODY:
                return self.send(413, {'error': 'Request size limit exceeded.'})
            self.connection.settimeout(30)
            payload = json.loads(self.rfile.read(size))
            if not isinstance(payload, dict):
                raise ValueError('JSON object required.')
            if self.path == '/api/extract':
                result = run_extractor(payload)
            elif self.path == '/api/analyse':
                result = generate_local(payload)
            else:
                return self.send(404, {'error': 'Not found.'})
            self.send(200, result)
        except ValueError as exc:
            self.send(400, {'error': str(exc)[:500]})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            self.send(400, {'error': 'Could not process this input. Use a smaller document or text export.'})

    def do_OPTIONS(self):
        self.send(403, {'error': 'Cross-origin access is disabled.'})


def main():
    parser = argparse.ArgumentParser(description='Private Product Intelligence Agent')
    parser.add_argument('--open', action='store_true', help='Open the local app in your browser')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--extract', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.extract:
        try:
            if os.name == 'posix':
                import resource
                resource.setrlimit(resource.RLIMIT_AS, (768 * 1024 * 1024, 768 * 1024 * 1024))
                resource.setrlimit(resource.RLIMIT_CPU, (20, 20))
            payload = json.load(sys.stdin)
            print(json.dumps({'text': extract_document(payload.get('name'), payload.get('data'))}))
        except Exception as exc:
            error = str(exc) if isinstance(exc, ValueError) else 'Unreadable or unsupported document. Use a text export.'
            print(json.dumps({'error': error[:500]}))
        return
    if not 1024 <= args.port <= 65535:
        parser.error('Use a port from 1024 to 65535.')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    server.daemon_threads = True
    print(f'Open http://127.0.0.1:{args.port} in your browser. Keep this window open. Press Ctrl+C to stop.', flush=True)
    if args.open:
        import threading
        import webbrowser
        threading.Timer(0.5, lambda: webbrowser.open(f'http://127.0.0.1:{args.port}')).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
