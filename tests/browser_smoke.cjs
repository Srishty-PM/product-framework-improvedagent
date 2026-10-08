const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let server;
(async()=>{
 const {spawn}=require('node:child_process');
 server=spawn('python3',[path.join(__dirname,'../offline_server.py')],{stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error('Local server exited: '+code)));});
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:JSON.parse(process.env.CHROMIUM_ARGS||'[]')}: {})});const page=await browser.newPage();const errors=[];const external=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=route.request().url();if(u.startsWith('http')&&!u.startsWith('http://127.0.0.1:8765')){external.push(u);return route.abort();}return route.continue();});
 await page.goto('http://127.0.0.1:8765');
 await page.locator('#problemInput').fill('Improve product discovery through clearer Marketplace PLP labels.');
 await page.locator('#sourceName').fill('PLP test');
 await page.locator('#pasteInput').fill('Hypothesis: removing the badge improves Marketplace product CTR.\nAudience: eligible web shoppers.\nControl: 50% with badge. Variant: 50% without badge.\nMetric: unique product clicks / eligible impressions.\nResult: control CTR 4%; treatment CTR 4.2%.\nGuardrail: PDP exits.\nLearning: outcome inconclusive; sample size and CI missing.\n<img src="https://example.com/leak" onerror="alert(1)">');
 await page.locator('#addPasteBtn').click();assert.equal(await page.locator('#runBtn').isEnabled(),false);
 await page.locator('#evidenceCards summary').click();assert.match(await page.locator('#evidenceCards').innerText(),/\[D1:L/);
 await page.locator('#acceptEvidence').check();await page.locator('#runBtn').click();
 await page.waitForFunction(()=>status==='done');assert.equal(await page.evaluate(()=>completedSteps.length),10);
 assert.match(await page.locator('#result-prioritisation').innerText(),/TBD/);
 assert.equal(await page.locator('#result-hypothesis img').count(),0);
 await page.locator('#prdBtn').click();assert.match(await page.locator('.prd-preview').innerText(),/Source register/i);
 await page.locator('#protoBtn').click();assert.equal(await page.locator('iframe').count(),1);
 const outer=page.frames().find(x=>x.parentFrame()===page.mainFrame());await outer.waitForSelector('iframe');
 const inner=page.frames().find(x=>x.parentFrame()===outer);await inner.waitForSelector('nav');
 await inner.locator('button',{hasText:'Decision'}).click();assert.equal(await inner.locator('#decision').isVisible(),true);
 const downloadPromise=page.waitForEvent('download');await page.getByText('Save workspace to file',{exact:true}).click();const download=await downloadPromise;const tmp=await download.path();const data=JSON.parse(fs.readFileSync(tmp,'utf8'));assert.equal(data.sources.length,1);assert.equal(data.schema,'pia-workspace-v1');
 page.on('dialog',d=>d.accept());await page.getByText('Clear workspace',{exact:true}).click();assert.equal(await page.locator('#sourceList details').count(),0);assert.equal(await page.locator('#prdBtn').isEnabled(),false);
 await page.locator('#importWorkspace').setInputFiles({name:'workspace.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.waitForFunction(()=>sources.length===1);assert.equal(await page.locator('#sourceList details').count(),1);assert.equal(await page.locator('#acceptEvidence').isChecked(),false);
 // Guided run: stop releases pause and keeps deliverables locked; restarting completes cleanly.
 await page.locator('#acceptEvidence').check();await page.locator('#autoRun').uncheck();await page.locator('#runBtn').click();await page.waitForFunction(()=>completedSteps.length===1);await page.getByRole('button',{name:'■ Stop'}).click();assert.equal(await page.locator('#prdBtn').isEnabled(),false);
 await page.locator('#autoRun').check();await page.locator('#runBtn').click();await page.waitForFunction(()=>status==='done');
 // Local AI contract: full document ingestion precedes the ten defined stages, with guidance + references.
 const prompts=[];
 await page.route('**/api/analyse',route=>{const input=route.request().postDataJSON();prompts.push(input.prompt);return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:'Documented hypothesis [D1:L1]. Sample size is TBD.'})});});
 await page.locator('#sourceRole').selectOption('guidance');await page.locator('#sourceName').fill('My framework');await page.locator('#pasteInput').fill('Require evidence, implications and open questions for each step.');await page.locator('#addPasteBtn').click();
 await page.locator('#engineMode').selectOption('ollama');await page.locator('#localModel').fill('fixture:latest');await page.locator('#acceptEvidence').check();await page.locator('#runBtn').click();await page.waitForFunction(()=>status==='done');
 assert.equal(prompts.length,11);assert.match(prompts[0],/FULL-TEXT EXCERPT/);assert.match(prompts[0],/CI missing/);assert.match(prompts[1],/Require evidence, implications/);assert.match(prompts[1],/LEARNINGS FROM FULL DOCUMENT/);assert.equal(await page.evaluate(()=>completedSteps.length),10);
 // Reject nonexistent references instead of accepting a fabricated source.
 assert.equal(await page.evaluate(()=>{try{validateReferences('False claim [D9:L99]');return false}catch{return true}}),true);
 await page.locator('#engineMode').selectOption('evidence');await page.locator('#acceptEvidence').check();await page.locator('#runBtn').click();await page.waitForFunction(()=>status==='done');
 // Malicious prototype: downloaded sandbox wrapper blocks requests and frame navigation.
 await page.evaluate(()=>{const frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-scripts');frame.srcdoc=protectPrototype('<html><body><img src="https://example.com/image-leak"><script>fetch("https://example.com/fetch-leak").catch(()=>{});setTimeout(()=>location.href="https://example.com/nav-leak",100)<\/script></body></html>');document.body.append(frame);});
 await page.waitForTimeout(350);
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 // Uploaded DOCX + CSV are read by the local launcher before running.
 const uploads=await browser.newPage();await uploads.goto('http://127.0.0.1:8765');await uploads.locator('#uploadTab').click();
 await uploads.locator('#documentFiles').setInputFiles([
   {name:'study.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from("UEsDBBQAAAAAAIlmSF1pkMYNCQEAAAkBAAARAAAAd29yZC9kb2N1bWVudC54bWw8dzpkb2N1bWVudCB4bWxuczp3PSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvd29yZHByb2Nlc3NpbmdtbC8yMDA2L21haW4iPjx3OmJvZHk+PHc6cD48dzpyPjx3OnQ+SHlwb3RoZXNpczogY2xlYXJlciBjaGVja291dCBsYWJlbHMgaW1wcm92ZSBjb252ZXJzaW9uLjwvdzp0PjwvdzpyPjwvdzpwPjx3OnA+PHc6cj48dzp0Pkd1YXJkcmFpbDogY3VzdG9tZXIgY29tcGxhaW50cy48L3c6dD48L3c6cj48L3c6cD48L3c6Ym9keT48L3c6ZG9jdW1lbnQ+UEsBAhQDFAAAAAAAiWZIXWmQxg0JAQAACQEAABEAAAAAAAAAAAAAAIABAAAAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAABAAEAPwAAADgBAAAAAA==",'base64')},
   {name:'results.csv',mimeType:'text/csv',buffer:Buffer.from('Metric,Control,Treatment\nCTR,4.0%,4.2%')}
 ]);
 await uploads.waitForFunction(()=>sources.length===2&&!intakeBusy);assert.match(await uploads.locator('#evidenceCards').textContent(),/clearer checkout labels/);
 await uploads.locator('#problemInput').fill('Improve checkout conversion');assert.equal(await uploads.locator('#runBtn').isEnabled(),false);await uploads.locator('#acceptEvidence').check();await uploads.locator('#runBtn').click();await uploads.waitForFunction(()=>status==='done');assert.equal(await uploads.evaluate(()=>completedSteps.length),10);await uploads.close();
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(__dirname,'../../agent-mobile.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(__dirname,'../../agent-preview.png')});
 await browser.close();server.kill();console.log('PASS: full offline workflow, DOCX/CSV upload, local AI contract, evidence review, source references, PRD/prototype, save/reopen, stop/restart, injection isolation, zero external requests, mobile layout.');
})().catch(e=>{server?.kill();console.error(e);process.exit(1)});
