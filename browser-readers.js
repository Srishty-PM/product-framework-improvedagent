/* Pinned parsers read local bytes. No document is uploaded by these readers. */
let zipLibraryPromise;
let pdfLibraryPromise;
const PARSER_CDN = 'https://cdn.jsdelivr.net/npm/';
function loadZipLibrary() {
  if (!zipLibraryPromise) zipLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PARSER_CDN + 'jszip@3.10.2/dist/jszip.min.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => { zipLibraryPromise = null; reject(new Error('Cannot load the Word/Excel reader. Check your connection or paste the document text.')); };
    document.head.append(script);
  });
  return zipLibraryPromise;
}
function checkOfficeArchive(bytes) {
  // Bound expanded data before decompression. ZIP64 and encrypted archives are unsupported.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw new Error('Invalid Office archive. Export a DOCX/XLSX or paste the text.');
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true), expanded = 0;
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || count > 2000 || offset === 0xffffffff) throw new Error('Office archive is too complex or uses an unsupported ZIP format.');
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Invalid Office archive directory.');
    if (view.getUint16(offset + 8, true) & 1) throw new Error('Encrypted Office files are unsupported. Export readable text.');
    expanded += view.getUint32(offset + 24, true);
    if (expanded > 40 * 1024 * 1024) throw new Error('Expanded Office content exceeds 40 MB. Split the document.');
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
}
function parseOfficeXml(text) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Office XML with entity declarations is unsupported.');
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length) throw new Error('The Office document contains unreadable XML.');
  return xml;
}
const xmlTags = (node, name) => Array.from(node.getElementsByTagNameNS('*', name));
function checkExtractedLength(text) {
  if (text.length > MAX_TEXT) throw new Error('Extracted text exceeds 200,000 characters. Split the document. Nothing was truncated.');
  return text;
}
async function readBrowserDocument(file, extension) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (extension === 'pdf') return readPdfBytes(bytes);
  checkOfficeArchive(bytes);
  const Zip = await loadZipLibrary();
  const zip = await Zip.loadAsync(bytes);
  const xmlFile = async name => {
    const entry = zip.file(name);
    if (!entry) throw new Error('Missing Office content: ' + name);
    return parseOfficeXml(await entry.async('string'));
  };
  if (extension === 'docx') {
    const xml = await xmlFile('word/document.xml');
    // Includes table paragraphs. Headers, images, tracked deletions and embedded objects are omitted.
    return checkExtractedLength(xmlTags(xml, 'p').map(p => xmlTags(p, 't').map(t => t.textContent).join('')).join('\n'));
  }
  const workbook = await xmlFile('xl/workbook.xml');
  const relations = await xmlFile('xl/_rels/workbook.xml.rels');
  const rels = new Map(xmlTags(relations, 'Relationship').filter(r => r.getAttribute('TargetMode') !== 'External').map(r => [r.getAttribute('Id'), r.getAttribute('Target')]));
  const shared = zip.file('xl/sharedStrings.xml') ? xmlTags(await xmlFile('xl/sharedStrings.xml'), 'si').map(si => xmlTags(si, 't').map(t => t.textContent).join('')) : [];
  const sheets = xmlTags(workbook, 'sheet');
  if (sheets.length > 50) throw new Error('Workbook exceeds 50 sheets. Export the relevant sheets as CSV.');
  let result = '';
  for (const sheet of sheets) {
    const target = rels.get(sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
    if (!target) throw new Error('Missing worksheet relationship.');
    const entry = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
    if (entry.includes('..') || !entry.startsWith('xl/')) throw new Error('Unsupported worksheet path. Export CSV.');
    const xml = await xmlFile(entry);
    result += '\nSheet: ' + sheet.getAttribute('name') + '\n';
    for (const row of xmlTags(xml, 'row')) {
      result += xmlTags(row, 'c').map(cell => {
        const type = cell.getAttribute('t');
        const raw = xmlTags(cell, 'v')[0]?.textContent ?? '';
        let value = type === 's' ? shared[Number(raw)] ?? '' : type === 'inlineStr' ? xmlTags(cell, 't').map(t => t.textContent).join('') : raw;
        if (xmlTags(cell, 'f').length) value = value ? value + ' (cached formula value; not recalculated)' : 'TBD (formula has no cached result)';
        return (cell.getAttribute('r') || '?') + ': ' + value;
      }).join(' | ') + '\n';
      checkExtractedLength(result);
    }
  }
  return result;
}
async function readPdfBytes(bytes) {
  if (!pdfLibraryPromise) pdfLibraryPromise = import(PARSER_CDN + 'pdfjs-dist@6.4.299/build/pdf.mjs').catch(() => {
    pdfLibraryPromise = null;
    throw new Error('Cannot load the PDF reader. Check your connection or paste the document text.');
  });
  const pdfjs = await pdfLibraryPromise;
  pdfjs.GlobalWorkerOptions.workerSrc = PARSER_CDN + 'pdfjs-dist@6.4.299/build/pdf.worker.mjs';
  const task = pdfjs.getDocument({data: bytes, isEvalSupported: false, enableXfa: false, disableFontFace: true});
  task.onPassword = () => task.destroy();
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 100) throw new Error('PDF exceeds 100 pages. Split it into relevant experiments.');
    let text = '';
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const words = content.items.filter(item => typeof item.str === 'string').map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('');
      if (words.trim()) text += `Page ${n}\n${words}\n`;
      checkExtractedLength(text);
      page.cleanup();
    }
    if (!text.trim()) throw new Error('No readable PDF text. Supply an OCR/text version for scanned pages.');
    return text;
  } finally { await task.destroy(); }
}
