const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const parserRoot = process.env.PARSER_TEST_ROOT || path.join(__dirname, 'node_modules');
const Zip = require(path.join(parserRoot, 'jszip'));
const root = path.resolve(__dirname, '..');
let server, browser;
const failures = [], leaks = [], prompts = [];
const PDF_FIXTURE = 'JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvbnRlbnRzIDcgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgNiAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNCAwIG9iago8PAovUGFnZU1vZGUgL1VzZU5vbmUgL1BhZ2VzIDYgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9BdXRob3IgKGFub255bW91cykgL0NyZWF0aW9uRGF0ZSAoRDoyMDI2MTAwODE0MzA1NCswMicwMCcpIC9DcmVhdG9yIChhbm9ueW1vdXMpIC9LZXl3b3JkcyAoKSAvTW9kRGF0ZSAoRDoyMDI2MTAwODE0MzA1NCswMicwMCcpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gXChvcGVuc291cmNlXCkpIAogIC9TdWJqZWN0ICh1bnNwZWNpZmllZCkgL1RpdGxlICh1bnRpdGxlZCkgL1RyYXBwZWQgL0ZhbHNlCj4+CmVuZG9iago2IDAgb2JqCjw8Ci9Db3VudCAxIC9LaWRzIFsgMyAwIFIgXSAvVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggMjA2Cj4+CnN0cmVhbQpHYXJXcVxJUUoxJi1VP0Q/U05qJ0tHWiE6VipzO2s7WWdXVz1pYzJVYUdxTThwUiVfSzVWI1BgKVNIbGFucWhSKiRaJSxUSE5DQyddS2p0WCVHPi87TXFqNlpbJkw6ZDwwLm0laiglUmc6UV0scEQrRmc7Y29wWCo6RXRmWk9ibUktIkAhTCpHOCNcT2hOYDAnKXMkIj5nTy5kRDtXL1QwUyc3YGhITV9gcipLNEdkYFkpUitqaypqQ1lmajEtLklvbUEvckQjVk4nRVh+PmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDgKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAwOTIgMDAwMDAgbiAKMDAwMDAwMDE5OSAwMDAwMCBuIAowMDAwMDAwNDAyIDAwMDAwIG4gCjAwMDAwMDA0NzAgMDAwMDAgbiAKMDAwMDAwMDczMSAwMDAwMCBuIAowMDAwMDAwNzkwIDAwMDAwIG4gCnRyYWlsZXIKPDwKL0lEIApbPGY3NWQ5MTdkMDZjYjZlZTRjYTE4ZWYwMWRhZTJmNDNiPjxmNzVkOTE3ZDA2Y2I2ZWU0Y2ExOGVmMDFkYWUyZjQzYj5dCiUgUmVwb3J0TGFiIGdlbmVyYXRlZCBQREYgZG9jdW1lbnQgLS0gZGlnZXN0IChvcGVuc291cmNlKQoKL0luZm8gNSAwIFIKL1Jvb3QgNCAwIFIKL1NpemUgOAo+PgpzdGFydHhyZWYKMTA4NgolJUVPRgo=';
const ENCRYPTED_PDF = 'JVBERi0xLjMKJeLjz9MKMSAwIG9iago8PAovUHJvZHVjZXIgPGM1ZmUxN2M4NWU+Cj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovQ291bnQgMQovS2lkcyBbIDQgMCBSIF0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9Db250ZW50cyA1IDAgUgovTWVkaWFCb3ggWyAwIDAgNTk1LjI3NTYgODQxLjg4OTggXQovUmVzb3VyY2VzIDw8Ci9Gb250IDYgMCBSCi9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+Ci9Sb3RhdGUgMAovVHJhbnMgPDwKPj4KL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgo+PgplbmRvYmoKNSAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0KL0xlbmd0aCAyMDYKPj4Kc3RyZWFtCuB7LttgYVRqI/b79kCjGpY1d/ltEMiGf3CwyxqF6psIwooP8/WIViqs1EqHx0zzzhslf5irhSF/v4mpAaBNkxfwYSXglksPtqsS8Szvor8WWXKLTjRBwoB+DvAkucYlShQG5zoP0Nkl1X4W6gFiSSRLVaUUT9cKRAO6Y/JbEJqKjKKB+GUHbq0TEbp+z1lRQxqd+5mZl61+jBL9yyiMkaKhS71X7A5A1hIBWsnoq+kSV/P2iORA2PFAdeECHLyQ41DhLC4aT/oKmhSrFddZCmVuZHN0cmVhbQplbmRvYmoKNiAwIG9iago8PAovRjEgNyAwIFIKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EKL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcKL05hbWUgL0YxCi9TdWJ0eXBlIC9UeXBlMQovVHlwZSAvRm9udAo+PgplbmRvYmoKOCAwIG9iago8PAovViAyCi9SIDMKL0xlbmd0aCAxMjgKL1AgNDI5NDk2NzI5MgovRmlsdGVyIC9TdGFuZGFyZAovTyA8Yzk0YmZlNjYwYTQ2YjNmOWQ3NWNiYzBkZDEwZDg1NTdjNjY3YzYxOWNkNjA3NjFhODdiNDZhOWFjMDg0ZTU2Nj4KL1UgPDc3Y2U3NDdhODU0MDdmZGUzOTRmZjcxOTdiZDAwNTRmMjhiZjRlNWU0ZTc1OGE0MTY0MDA0ZTU2ZmZmYTAxMDg+Cj4+CmVuZG9iagp4cmVmCjAgOQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA1OSAwMDAwMCBuIAowMDAwMDAwMTE4IDAwMDAwIG4gCjAwMDAwMDAxNjcgMDAwMDAgbiAKMDAwMDAwMDM2NiAwMDAwMCBuIAowMDAwMDAwNjYzIDAwMDAwIG4gCjAwMDAwMDA2OTQgMDAwMDAgbiAKMDAwMDAwMDgwMSAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDkKL1Jvb3QgMyAwIFIKL0luZm8gMSAwIFIKL0lEIFsgPDY1NjUzMzMzMzk2MjMzNjEzOTY0MzMzODM5MzM2NDMzMzI2MjY0MzA2MTYyMzQzOTM2NjI2NDM5MzY2NDY1MzU+IDw2NTY1MzMzMzM5NjIzMzYxMzk2NDMzMzgzOTMzNjQzMzMyNjI2NDMwNjE2MjM0MzkzNjYyNjQzOTM2NjQ2NTM1PiBdCi9FbmNyeXB0IDggMCBSCj4+CnN0YXJ0eHJlZgoxMDE2CiUlRU9GCg==';
const key = 'sk-ant-fixture-only-not-real';
let responseMode = 'normal';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function archive(entries) {
  const zip = new Zip();
  for (const [name, text] of Object.entries(entries)) zip.file(name, text);
  return zip.generateAsync({type:'nodebuffer'});
}
(async () => {
  server = http.createServer((req, res) => {
    const filename = path.join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!filename.startsWith(root + '/')) { res.writeHead(403); res.end(); return; }
    try { res.setHeader('Content-Type', filename.endsWith('.html') ? 'text/html' : 'application/javascript'); res.end(fs.readFileSync(filename)); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(8766, '127.0.0.1', r));
  browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE,args:JSON.parse(process.env.CHROMIUM_ARGS || '[]')} : {})});
  const context = await browser.newContext({acceptDownloads:true});
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1:8766')) return route.continue();
    if (url.startsWith('https://cdn.jsdelivr.net/npm/')) {
      const relative = url.split('/npm/')[1].replace(/@[^/]+\//, '/');
      return route.fulfill({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:fs.readFileSync(path.join(parserRoot, relative))});
    }
    if (url === 'https://api.anthropic.com/v1/messages') {
      const input = route.request().postDataJSON();
      assert.equal(input.model, 'claude-sonnet-4-6');
      assert.equal(route.request().headers()['x-api-key'], key);
      prompts.push(input.messages[0].content);
      if (responseMode === 'slow') await sleep(400);
      const text = input.messages[0].content.includes('ONLY output raw HTML') ? '<!DOCTYPE html><html><body><h1>Prototype fixture</h1><img src="https://example.com/image-leak"><script>fetch("https://example.com/fetch-leak").catch(()=>{});setTimeout(()=>location.href="https://example.com/nav-leak",20)</script></body></html>' : responseMode === 'bad-reference' ? 'Unsupported claim [D99:L1]' : 'Documented hypothesis [D1:L1]. Sample size and uncertainty are TBD. This is an unverified draft.';
      try { return await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:[{type:'text',text}],stop_reason:responseMode === 'truncated' ? 'max_tokens' : 'end_turn'})}); } catch { return; }
    }
    leaks.push(url); return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', e => failures.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto('http://127.0.0.1:8766');
  await page.locator('#problemInput').fill('Improve checkout conversion while protecting customer complaints.');
  const evidence = 'Hypothesis: clearer labels improve conversion.\n' + 'Audience: eligible web shoppers. '.repeat(950) + '\nLearning: FINAL_DOCUMENT_LINE. CI and sample size missing.\n<img src="https://example.com/leak" onerror="alert(1)">';
  await page.locator('#sourceName').fill('Checkout A/B test');
  await page.locator('#pasteInput').fill(evidence);
  await page.locator('#addPasteBtn').click();
  await page.locator('#sourceRole').selectOption('guidance');
  await page.locator('#sourceName').fill('My framework');
  await page.locator('#pasteInput').fill('For every stage include evidence, implications and open questions.');
  await page.locator('#addPasteBtn').click();
  await page.locator('#acceptEvidence').check();
  await page.locator('#apiKeyInput').fill(key);
  assert.equal(await page.locator('#runBtn').isEnabled(), false);
  assert.equal(prompts.length, 0);
  await page.locator('#cloudConsent').check();
  await page.locator('#runBtn').click();
  await page.waitForFunction(() => status === 'done');
  assert.equal(await page.evaluate(() => completedSteps.length), 10);
  const reading = prompts.filter(p => p.includes('FULL-TEXT EXCERPT'));
  assert.ok(reading.length >= 3);
  assert.ok(reading.some(p => p.includes('FINAL_DOCUMENT_LINE')));
  const stages = prompts.filter(p => p.includes('STAGE TASK:'));
  assert.equal(stages.length, 10);
  assert.ok(stages.every(p => p.includes('For every stage include evidence') && p.includes('LEARNINGS FROM FULL DOCUMENT')));
  assert.equal(await page.locator('#learnedEvidence').isVisible(), true);
  assert.equal(await page.locator('#result-hypothesis img').count(), 0);
  await page.locator('#prdBtn').click();
  await page.waitForFunction(() => !!window.prdStore);
  assert.match(await page.locator('.prd-preview').innerText(), /TBD/);
  await page.locator('#protoBtn').click();
  await page.waitForFunction(() => !!window.protoHtmlStore);
  await page.waitForTimeout(250);
  assert.match(await page.evaluate(() => protoHtmlStore), /sandbox="allow-scripts"/);
  const downloadEvent = page.waitForEvent('download');
  await page.getByText('Save workspace to file', {exact:true}).click();
  const downloaded = await downloadEvent;
  const saved = JSON.parse(fs.readFileSync(await downloaded.path(), 'utf8'));
  assert.equal(JSON.stringify(saved).includes(key), false);
  assert.equal(saved.sources.length, 2);
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  await page.getByText('Clear workspace', {exact:true}).click();
  await page.locator('#importWorkspace').setInputFiles({name:'workspace.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
  await page.waitForFunction(() => sources.length === 2);
  assert.equal(await page.locator('#acceptEvidence').isChecked(), false);
  assert.equal(await page.locator('#cloudConsent').isChecked(), false);
  // Guided runs and cancellation must not overwrite a subsequent run.
  await page.locator('#acceptEvidence').check(); await page.locator('#cloudConsent').check();
  responseMode = 'slow';
  await page.locator('#runBtn').click(); await page.waitForTimeout(50);
  await page.getByRole('button', {name:'■ Stop'}).click();
  responseMode = 'normal';
  await page.locator('#runBtn').click(); await page.waitForFunction(() => status === 'done');
  assert.equal(await page.locator('#errorBanner').isVisible(), false);
  responseMode = 'bad-reference';
  await page.locator('#runBtn').click(); await page.waitForFunction(() => status === 'error');
  assert.match(await page.locator('#errorBanner').innerText(), /nonexistent source/);
  responseMode = 'truncated';
  await page.locator('#runBtn').click(); await page.waitForFunction(() => status === 'error');
  assert.match(await page.locator('#errorBanner').innerText(), /incomplete output was not accepted/);
  responseMode = 'normal';
  await page.locator('#engineMode').selectOption('evidence');
  await page.locator('#autoRun').uncheck();
  const beforeWorkbook = prompts.length;
  await page.locator('#runBtn').click(); await page.waitForFunction(() => completedSteps.length === 1);
  await page.getByRole('button', {name:'■ Stop'}).click();
  await page.locator('#autoRun').check();
  await page.locator('#runBtn').click(); await page.waitForFunction(() => status === 'done');
  assert.equal(prompts.length, beforeWorkbook);
  // Real ZIP/XML and PDF.js parsers, served from their pinned npm distributions.
  const upload = await context.newPage(); upload.on('pageerror', e => failures.push(e.message));
  await upload.goto('http://127.0.0.1:8766'); await upload.locator('#uploadTab').click();
  const docx = await archive({'word/document.xml':'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hypothesis: clearer checkout labels.</w:t></w:r></w:p></w:body></w:document>'});
  const xlsx = await archive({
    'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Results" r:id="r1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml':'<sst><si><t>Guardrail: complaints</t></si></sst>',
    'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>'
  });
  await upload.locator('#documentFiles').setInputFiles([
    {name:'study.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:docx},
    {name:'results.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:xlsx},
    {name:'study.pdf',mimeType:'application/pdf',buffer:Buffer.from(PDF_FIXTURE, 'base64')},
    {name:'results.csv',mimeType:'text/csv',buffer:Buffer.from('Metric,Control,Treatment\nCTR,4%,4.2%')}
  ]);
  await upload.waitForFunction(() => !intakeBusy);
  assert.equal(await upload.evaluate(() => sources.length), 4, await upload.locator('#intakeMessage').innerText());
  const parsed = await upload.evaluate(() => sources.map(s => s.text));
  assert.match(parsed[0], /clearer checkout labels/);
  assert.match(parsed[1], /cached formula value; not recalculated/);
  assert.match(parsed[2], /Learning: inconclusive/);
  assert.match(parsed[3], /4.2%/);
  assert.equal(prompts.length, beforeWorkbook);
  await upload.locator('#documentFiles').setInputFiles({name:'bad.docx',mimeType:'application/zip',buffer:await archive({'word/document.xml':'<!DOCTYPE x [<!ENTITY leak SYSTEM "https://example.com/entity">]><x>&leak;</x>'})});
  await upload.waitForFunction(() => !intakeBusy);
  assert.match(await upload.locator('#intakeMessage').innerText(), /entity declarations/);
  await upload.locator('#documentFiles').setInputFiles({name:'encrypted.pdf',mimeType:'application/pdf',buffer:Buffer.from(ENCRYPTED_PDF, 'base64')});
  await upload.waitForFunction(() => !intakeBusy);
  assert.match(await upload.locator('#intakeMessage').innerText(), /Encrypted PDFs are unsupported/);
  await page.setViewportSize({width:390,height:844}); await page.evaluate(() => scrollTo(0,0));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({path:path.join(root, '../live-mobile.png')});
  await page.setViewportSize({width:1280,height:900}); await page.evaluate(() => scrollTo(0,0));
  await page.screenshot({path:path.join(root, '../live-preview.png')});
  assert.deepEqual(leaks, []); assert.deepEqual(failures, []);
  await browser.close(); server.close();
  console.log('PASS: real PDF/DOCX/XLSX/CSV readers; explicit cloud consent; complete document ingestion; ten stages; PRD/prototype; source validation; cancellation; guided workbook; export/import without keys; injection isolation; mobile layout. Claude responses simulated; no paid API requests.');
})().catch(async e => {console.error(e); await browser?.close(); server?.close(); process.exitCode=1;});
