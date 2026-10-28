const RICE_FIXTURE="| Solution | Reach (1-10) | Impact (1-10) | Confidence (0-1) | Effort (1-10) | RICE Score |\n|---|---|---|---|---|---|\n| Personalisation engine | 9 | 9 | 0.4 | 8 | 999 |\n| Guided discovery | 8 | 7 | 0.5 | 2 | 1 |\n\nAssumptions for a shared next-quarter audience and delivery team:\n- Personalisation engine: broad potential reach (9), strong possible impact (9), low confidence (0.4) without validated data, and high effort (8) for modelling. Validate data readiness and adoption.\n- Guided discovery: broad reach (8), useful impact (7), moderate confidence (0.5) from a simple mechanism, and low effort (2) using existing UI. Validate shopper demand and delivery estimates.";
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const root=path.resolve(__dirname,'..');
let server,browser;
(async()=>{
 server=http.createServer((req,res)=>{
  const filename=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if(!filename.startsWith(root+'/')){res.writeHead(403);return res.end();}
  try{res.setHeader('Content-Type',filename.endsWith('.html')?'text/html':'application/javascript');res.end(fs.readFileSync(filename));}catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(8767,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:JSON.parse(process.env.CHROMIUM_ARGS||'[]')}:{})});
 const context=await browser.newContext({acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage(),errors=[],external=[],requests=[];
 let failure=null;let prototypeLimits=0;
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await context.route('**/*',async route=>{
  const url=route.request().url();if(url.startsWith('http://127.0.0.1:8767'))return route.continue();
  if(url==='https://api.anthropic.com/v1/messages'){
   const body=route.request().postDataJSON(),prompt=body.messages[0].content;
   const kind=prompt.includes('ONLY output raw HTML')?'prototype':prompt.startsWith('You are a senior PM writing a PRD')?'prd':'analysis';requests.push({kind,prompt});
   if(failure===kind){failure=null;return route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error:{message:'Rate limit fixture'}})});}
   if(body.stream&&kind==='analysis'){
    const ids=prompt.match(/Use exactly these IDs in this order: ([\w, ]+)\./)[1].split(', ');
    const events=ids.map(id=>({type:'content_block_delta',delta:{type:'text_delta',text:`<<<STAGE:${id}>>>\n## ${id}\n${id==='prioritisation'?RICE_FIXTURE:'Proposed approach for returning shoppers. Assumptions and targets remain TBD.'}\n<<<END:${id}>>>\n`}}));
    events.push({type:'message_delta',delta:{stop_reason:'end_turn'}},{type:'message_stop'});
    return route.fulfill({status:200,contentType:'text/event-stream',body:events.map(e=>`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('')});
   }
   if(kind==='prototype'&&prototypeLimits>0){prototypeLimits--;return route.fulfill({status:200,contentType:'text/event-stream',body:'event: content_block_delta\ndata: '+JSON.stringify({type:'content_block_delta',delta:{type:'text_delta',text:'<!DOCTYPE html><html><body>UNFINISHED_PROTOTYPE'}})+'\n\nevent: message_delta\ndata: '+JSON.stringify({type:'message_delta',delta:{stop_reason:'max_tokens'}})+'\n\nevent: message_stop\ndata: '+JSON.stringify({type:'message_stop'})+'\n\n'});}
   const proto='<!DOCTYPE html><html><body><h1>Product discovery</h1><button onclick="document.getElementById(\'detail\').hidden=false">Explore products</button><section id="detail" hidden>Recommended products</section><img src="https://example.com/leak"><script>fetch("https://example.com/leak-data").catch(()=>{})</script></body></html>';
   const text=kind==='prototype'?proto:'# Product Requirements Document\n## Overview\nExplore products for returning shoppers.\n## Functional Requirements\nGiven an eligible shopper, when they select Explore products, show recommended products.\n## Open Questions\nSuccess targets are TBD.';
   if(kind==='prototype'&&body.stream){const events=[{type:'content_block_delta',delta:{type:'text_delta',text}},{type:'message_delta',delta:{stop_reason:'end_turn'}},{type:'message_stop'}];return route.fulfill({status:200,contentType:'text/event-stream',body:events.map(e=>`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('')});}
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:[{type:'text',text}],stop_reason:'end_turn'})});
  }
  external.push(url);return route.abort();
 });
 await page.goto('http://127.0.0.1:8767');
 assert.equal(await page.locator('input[type=file],#pasteInput,#evidenceIntake,#engineMode').count(),0);
 await page.locator('#problemInput').fill('Improve discovery for returning marketplace shoppers.');
 // Actual clipboard paste into the password field, rather than setting its value through JavaScript.
 const key='sk-ant-browser-fixture-only-not-real';
 await page.evaluate(text=>navigator.clipboard.writeText(text),key);
 await page.locator('#apiKeyInput').focus();await page.keyboard.press('Control+V');assert.equal(await page.locator('#apiKeyInput').inputValue(),key);
 assert.equal(await page.locator('#runBtn').isEnabled(),false);assert.equal(requests.length,0);
 await page.locator('#cloudConsent').check();await page.locator('#runBtn').click();
 await page.waitForFunction(()=>status==='done'&&!pipelineBusy&&!!window.prdStore);
 assert.deepEqual(requests.map(r=>r.kind),['analysis','prototype','prd']);
 assert.equal(await page.evaluate(()=>completedSteps.length),10);
 assert.match(await page.locator('#doneBanner').innerText(),/12 \/ 12/);
 const rice=await page.locator('#result-prioritisation').innerText();
 assert.match(rice,/Indicative prioritisation/);assert.match(rice,/14.00/);assert.doesNotMatch(rice,/TBD/);
 assert.match(requests[1].prompt,/Highest provisional score.*Guided discovery/);
 assert.match(requests[2].prompt,/Highest provisional score.*Guided discovery/);
 assert.match(requests[2].prompt,/PROTOTYPE UI SUMMARY[\s\S]*Product discovery/);
 assert.equal(await page.locator('#protoFrame').getAttribute('sandbox'),'allow-scripts');
 const outer=page.frames().find(f=>f.parentFrame()===page.mainFrame());await outer.waitForSelector('iframe');
 const inner=page.frames().find(f=>f.parentFrame()===outer);await inner.waitForSelector('button');
 await inner.getByRole('button',{name:'Explore products'}).click();assert.equal(await inner.locator('#detail').isVisible(),true);
 await page.evaluate(()=>{const frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-scripts');frame.srcdoc=protectPrototype('<html><body><script>location.href="https://example.com/leak-nav"<'+ '/script></body></html>');document.body.append(frame);});
 await page.waitForTimeout(150);assert.deepEqual(external,[]);
 let event=page.waitForEvent('download');await page.getByRole('button',{name:'↓ Download HTML',exact:true}).click();const prototype=await event;
 assert.match(fs.readFileSync(await prototype.path(),'utf8'),/sandbox="allow-scripts"/);
 event=page.waitForEvent('download');await page.getByRole('button',{name:'↓ Download .md',exact:true}).click();const prd=await event;
 assert.match(fs.readFileSync(await prd.path(),'utf8'),/Product Requirements Document/);
 assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
 // A clipped prototype stream is automatically retried with a smaller scope; analysis is not repeated.
 prototypeLimits=1;const recoveryStart=requests.length;await page.locator('#runBtn').click();await page.waitForFunction(()=>status==='done'&&!pipelineBusy&&!!window.prdStore);
 assert.deepEqual(requests.slice(recoveryStart).map(r=>r.kind),['analysis','prototype','prototype','prd']);
 assert.doesNotMatch(await page.evaluate(()=>window.protoHtmlStore),/UNFINISHED_PROTOTYPE/);
 // Failed PRD: preserve the prototype and rerun only the missing PRD.
 failure='prd';await page.locator('#runBtn').click();await page.waitForFunction(()=>status==='done'&&!pipelineBusy&&!window.prdStore&&!!window.protoHtmlStore);
 const before=requests.length;await page.locator('#resumeDeliverables').click();await page.waitForFunction(()=>!pipelineBusy&&!!window.prdStore);
 assert.deepEqual(requests.slice(before).map(r=>r.kind),['prd']);
 // A changed brief clears old generated outputs immediately.
 await page.locator('#problemInput').fill('Help shoppers compare trustworthy marketplace sellers.');
 assert.equal(await page.evaluate(()=>window.protoHtmlStore||window.prdStore),'');assert.equal(await page.locator('#prdBtn').isEnabled(),false);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(root,'../problem-mobile.png')});
 await page.setViewportSize({width:1280,height:1000});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(root,'../problem-desktop.png')});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await browser.close();server.close();
 console.log('PASS: real browser problem → analysis → interactive prototype → PRD; clipboard paste; both downloads; consent; error recovery without repeating analysis; no upload UI; sandboxed prototype; no external leaks; mobile layout. Claude responses simulated.');
})().catch(async e=>{console.error(e);await browser?.close();server?.close();process.exitCode=1;});
