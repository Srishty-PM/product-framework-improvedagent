import base64
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
import io
import json
from pathlib import Path
import sys
import threading
import unittest
import zipfile
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import offline_server as app


def encoded(data):
    return base64.b64encode(data).decode()


def office(path, xml):
    data = io.BytesIO()
    with zipfile.ZipFile(data, 'w') as z:
        z.writestr(path, xml)
    return encoded(data.getvalue())


class ExtractionTests(unittest.TestCase):
    def test_docx_text_and_table(self):
        data = office('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hypothesis: clearer labels improve CTR</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Control CTR 4.0%</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>')
        text = app.extract_document('test.docx', data)
        self.assertIn('Hypothesis:', text)
        self.assertIn('Control CTR 4.0%', text)
        self.assertEqual(app.run_extractor({'name':'test.docx','data':data})['text'], text)

    def test_xlsx_inline_and_formula(self):
        data = office('xl/worksheets/sheet1.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row><c r="A1" t="inlineStr"><is><t>Metric: CTR</t></is></c><c r="B1"><f>2+2</f><v>4</v></c></row></sheetData></worksheet>')
        text = app.extract_document('test.xlsx', data)
        self.assertIn('A1: Metric: CTR', text)
        self.assertIn('not recalculated', text)

    def test_pdf_with_text_and_blank(self):
        from pypdf import PdfWriter
        from pypdf.generic import NameObject, DictionaryObject, DecodedStreamObject
        writer = PdfWriter()
        page = writer.add_blank_page(width=400, height=400)
        font = DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica')})
        page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):font})})
        stream = DecodedStreamObject()
        stream.set_data(b'BT /F1 12 Tf 30 350 Td (Hypothesis: improve CTR) Tj ET')
        page[NameObject('/Contents')] = stream
        buf = io.BytesIO();writer.write(buf)
        self.assertIn('Hypothesis: improve CTR', app.extract_document('test.pdf', encoded(buf.getvalue())))
        writer = PdfWriter();writer.add_blank_page(width=10,height=10);buf=io.BytesIO();writer.write(buf)
        with self.assertRaisesRegex(ValueError,'No readable text'):
            app.extract_document('scan.pdf',encoded(buf.getvalue()))

    def test_xml_entities_and_corrupt_inputs(self):
        data = office('word/document.xml','<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e;</x>')
        with self.assertRaisesRegex(ValueError,'entities'):
            app.extract_document('malicious.docx',data)
        with self.assertRaises(ValueError):
            app.extract_document('x.pdf','not base64')
        with self.assertRaisesRegex(ValueError,'Unsupported'):
            app.extract_document('x.exe',encoded(b'hello'))

    def test_no_remote_model(self):
        with self.assertRaises(ValueError):
            app.generate_local({'model':'bad model','prompt':'test'})


class LocalModelTests(unittest.TestCase):
    def opener(self, model=None, response=None):
        requests=[]
        class Stub:
            def open(self, request, timeout=None):
                url=request if isinstance(request,str) else request.full_url
                requests.append(url)
                if url.endswith('/api/tags'):
                    return io.BytesIO(json.dumps({'models':[model or {'name':'fixture:latest','model':'fixture:latest','size':1000,'digest':'local-weights'}]}).encode())
                return io.BytesIO(json.dumps(response or {'response':'Documented observation [D1:L1]','done':True,'done_reason':'stop'}).encode())
        return Stub(), requests

    def test_only_local_verified_model(self):
        opener,requests=self.opener()
        with patch('urllib.request.build_opener',return_value=opener):
            text=app.generate_local({'model':'fixture:latest','prompt':'Read private evidence.'})['text']
        self.assertIn('[D1:L1]',text)
        self.assertEqual(requests,['http://127.0.0.1:11435/api/tags','http://127.0.0.1:11435/api/generate'])

    def test_remote_and_missing_models_rejected(self):
        cases=[{'name':'fixture:latest','size':1000,'digest':'weights','remote_host':'https://remote.example'},
               {'name':'fixture:latest','size':0,'digest':'empty'},
               {'name':'other:latest','size':1000,'digest':'weights'}]
        for model in cases:
            opener,requests=self.opener(model)
            with patch('urllib.request.build_opener',return_value=opener),self.assertRaises(ValueError):
                app.generate_local({'model':'fixture:latest','prompt':'private'})
            self.assertEqual(len(requests),1)

    def test_truncated_output_rejected(self):
        opener,_=self.opener(response={'response':'unfinished','done_reason':'length'})
        with patch('urllib.request.build_opener',return_value=opener),self.assertRaisesRegex(ValueError,'partial'):
            app.generate_local({'model':'fixture:latest','prompt':'private'})


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),app.Handler)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close()
    def request(self,path='/',method='GET',headers=None,body=None):
        conn=HTTPConnection('127.0.0.1',self.server.server_port,timeout=5)
        conn.request(method,path,body=body,headers=headers or {})
        response=conn.getresponse();status=response.status;h=dict(response.getheaders());data=response.read();conn.close();return status,h,data
    def test_static_and_protection(self):
        code,headers,_=self.request();self.assertEqual(code,200)
        self.assertIn("connect-src 'self'",headers['Content-Security-Policy'])
        self.assertEqual(headers['Cache-Control'],'no-store')
        self.assertEqual(self.request('/offline_server.py')[0],404)
        self.assertEqual(self.request('/../offline_server.py')[0],404)
        self.assertEqual(self.request(headers={'Host':'attacker.example'})[0],403)
        self.assertEqual(self.request(headers={'Origin':'https://attacker.example'})[0],403)
    def test_cross_origin_and_form_rejected(self):
        body='{}'
        self.assertEqual(self.request('/api/extract','POST',{'Content-Type':'application/json'},body)[0],403)
        self.assertEqual(self.request('/api/extract','POST',{'Content-Type':'text/plain','X-PIA-Request':'local'},body)[0],415)
        self.assertEqual(self.request('/api/extract','OPTIONS')[0],403)
        headers={'Content-Type':'application/json','X-PIA-Request':'local','Origin':'https://attacker.example'}
        self.assertEqual(self.request('/api/extract','POST',headers,body)[0],403)
    def test_bad_json_and_oversized_body(self):
        headers={'Content-Type':'application/json','X-PIA-Request':'local'}
        self.assertEqual(self.request('/api/extract','POST',headers,'bad')[0],400)
        headers['Content-Length']=str(app.MAX_BODY+1)
        self.assertEqual(self.request('/api/extract','POST',headers,'')[0],413)


if __name__ == '__main__':
    unittest.main()
