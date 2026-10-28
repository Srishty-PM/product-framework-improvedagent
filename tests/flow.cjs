const RICE_FIXTURE="| Solution | Reach (1-10) | Impact (1-10) | Confidence (0-1) | Effort (1-10) | RICE Score |\n|---|---|---|---|---|---|\n| Personalisation engine | 9 | 9 | 0.4 | 8 | 999 |\n| Guided discovery | 8 | 7 | 0.5 | 2 | 1 |\n\nAssumptions for a shared next-quarter audience and delivery team:\n- Personalisation engine: broad potential reach (9), strong possible impact (9), low confidence (0.4) without validated data, and high effort (8) for modelling. Validate data readiness and adoption.\n- Guided discovery: broad reach (8), useful impact (7), moderate confidence (0.5) from a simple mechanism, and low effort (2) using existing UI. Validate shopper demand and delivery estimates.";
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM}=require(process.env.JSDOM_TEST_PATH||'jsdom');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const runner=fs.readFileSync(path.join(root,'framework-runner.js'),'utf8');
const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const tick=()=>new Promise(r=>setImmediate(r));
const proto='<!DOCTYPE html><html><body><h1>Discovery prototype</h1><button>Explore products</button></body></html>';
async function app(){
 const dom=new JSDOM(html,{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,ctx=dom.getInternalVMContext();
 w.TextDecoder=TextDecoder;w.AbortController=AbortController;w.confirm=()=>true;
 vm.runInContext(inline,ctx);vm.runInContext(runner,ctx);await tick();
 const a={w,d:w.document,run:s=>vm.runInContext(s,ctx),close:()=>dom.window.close(),requests:[],failure:null};
 a.w.fetch=async(url,opts)=>{
  const body=JSON.parse(opts.body),prompt=body.messages[0].content;
  const kind=prompt.includes('ONLY output raw HTML')?'prototype':prompt.startsWith('You are a senior PM writing a PRD')?'prd':'analysis';
  a.requests.push({kind,body});
  assert.equal(url,'https://api.anthropic.com/v1/messages');
  if(a.failure?.kind===kind){const f=a.failure;a.failure=null;if(f.abort)return await new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new w.DOMException('Aborted','AbortError'))));return new Response(JSON.stringify({error:{message:f.message||'Fixture provider error'}}),{status:f.status||429,headers:{'content-type':'application/json'}});}
  if(body.stream){
   const ids=prompt.match(/Use exactly these IDs in this order: ([\w, ]+)\./)[1].split(', ');
   return sse(ids);
  }
  const text=kind==='analysis'&&prompt.includes('Produce a useful provisional RICE ranking')?RICE_FIXTURE:kind==='prototype'?proto:kind==='prd'?'# Product Requirements Document\n## Overview\nDiscovery prototype and Explore products flow.\n## Functional Requirements\nGiven an eligible shopper, when they choose Explore products, then show matching products.\n## Open Questions\nTargets remain TBD; RICE is indicative.':'## Draft\nCandidate approach based on the problem statement. Assumptions and metrics TBD.';
  return new Response(JSON.stringify({content:[{type:'text',text}],stop_reason:'end_turn'}),{headers:{'content-type':'application/json'}});
 };
 input(a,'problemInput','Improve product discovery for mobile marketplace shoppers.');input(a,'apiKeyInput','sk-ant-fixture-only-not-real');a.d.getElementById('cloudConsent').checked=true;a.run('updateRunBtn()');
 return a;
}
function input(a,id,value){const el=a.d.getElementById(id);el.value=value;el.dispatchEvent(new a.w.Event('input',{bubbles:true}));}
function sse(ids,reason='end_turn'){
 const events=[];
 for(const id of ids){const text=`<<<STAGE:${id}>>>\n## ${id}\n${id==='prioritisation'?RICE_FIXTURE:'Proposed discovery approach; assumptions and targets TBD. Café.'}\n<<<END:${id}>>>\n`;events.push({type:'content_block_delta',delta:{type:'text_delta',text}});}
 events.push({type:'message_delta',delta:{stop_reason:reason}},{type:'message_stop'});
 const bytes=new TextEncoder().encode(events.map(e=>`event: ${e.type}\r\ndata: ${JSON.stringify(e)}\r\n\r\n`).join(''));let offset=0;
 return new Response(new ReadableStream({pull(c){if(offset>=bytes.length){c.close();return;}const end=Math.min(bytes.length,offset+11);c.enqueue(bytes.slice(offset,end));offset=end;}}),{headers:{'content-type':'text/event-stream'}});
}
(async()=>{
 let a=await app();
 assert.equal(a.d.querySelectorAll('input[type=file],#pasteInput,#evidenceIntake,#engineMode').length,0);
 assert.ok(!html.includes('document-workspace.js')&&!html.includes('browser-readers.js')&&!html.includes('cdn.jsdelivr'));
 a.d.getElementById('cloudConsent').checked=false;a.run('updateRunBtn()');await a.run('runFramework()');assert.equal(a.requests.length,0);
 a.d.getElementById('cloudConsent').checked=true;a.run('updateRunBtn()');await a.run('runFramework()');
 assert.equal(a.run('completedSteps.length'),10);assert.equal(a.run('status'),'done');
 assert.deepEqual(a.requests.map(r=>r.kind),['analysis','prototype','prd']);
 assert.match(a.w.protoHtmlStore,/sandbox="allow-scripts"/);assert.match(a.w.prdStore,/Product Requirements Document/);
 assert.match(a.requests[2].body.messages[0].content,/PROTOTYPE UI SUMMARY[\s\S]*Discovery prototype/);
 assert.match(a.d.getElementById('doneBanner').textContent,/12 \/ 12/);
 assert.match(a.run('results.prioritisation'),/Guided discovery \| 8 \| 7 \| 0.5 \| 2 \| 14.00/);
 assert.match(a.requests[1].body.messages[0].content,/Highest provisional score.*Guided discovery/);
 assert.match(a.requests[2].body.messages[0].content,/Indicative prioritisation/);
 assert.match(a.requests[0].body.system,/numeric provisional planning estimates/);
 assert.match(a.run('results.metrics'),/Café/);assert.equal(a.run('pipelineBusy||deliverableBusy'),false);
 assert.equal(a.w.localStorage.length+a.w.sessionStorage.length,0);
 // Calculator checks arithmetic, ordering, bounds, percent confidence and safe repeated editing.
 const calculated=a.run('prepareStageDraft(\"prioritisation\",'+JSON.stringify(RICE_FIXTURE)+')');
 assert.match(calculated,/Personalisation engine \| 9 \| 9 \| 0.4 \| 8 \| 4.05/);
 assert.ok(calculated.indexOf('| Guided discovery')<calculated.indexOf('| Personalisation engine'));
 assert.equal(a.run('prepareStageDraft(\"prioritisation\",'+JSON.stringify(calculated)+')'),calculated);
 for(const bad of [RICE_FIXTURE.replace('| 0.4 |','| TBD |'),RICE_FIXTURE.replace('| 0.4 |','| 4 |'),RICE_FIXTURE.replace('| 8 | 999 |','| 0 | 999 |')])assert.throws(()=>a.run('prepareStageDraft(\"prioritisation\",'+JSON.stringify(bad)+')'),/RICE/);
 assert.match(a.run('prepareStageDraft(\"prioritisation\",'+JSON.stringify(RICE_FIXTURE.replace('| 0.4 |','| 40% |'))+')'),/0.4 \| 8 \| 4.05/);
 // Editing the final stage clears generated deliverables; editing an early stage invalidates downstream decisions.
 a.d.querySelector('#content-metrics button').click();a.d.querySelector('#content-metrics textarea').value='New proposed success measures. Targets TBD.';
 [...a.d.querySelectorAll('#content-metrics button')].find(b=>b.textContent==='Apply draft changes').click();
 assert.equal(a.w.protoHtmlStore,'');assert.equal(a.w.prdStore,'');assert.equal(a.d.getElementById('prdBtn').disabled,true);
 await a.run('generateDeliverables()');assert.match(a.w.prdStore,/Product Requirements/);
 a.d.querySelector('#content-segments button').click();a.d.querySelector('#content-segments textarea').value='Returning mobile shoppers only.';
 [...a.d.querySelectorAll('#content-segments button')].find(b=>b.textContent==='Apply draft changes').click();
 assert.equal(a.run('completedSteps.length'),1);assert.equal(a.run('status'),'idle');assert.equal(a.w.prdStore,'');
 await a.run('runFramework(true)');assert.equal(a.run('completedSteps.length'),10);assert.match(a.run('results.segments'),/Returning mobile/);a.close();
 // Detailed mode performs 10 analysis requests, then prototype, then PRD.
 a=await app();a.d.getElementById('runSpeed').value='detailed';await a.run('runFramework()');assert.equal(a.requests.length,12);assert.deepEqual(a.requests.slice(-2).map(r=>r.kind),['prototype','prd']);a.close();
 // Guided mode carries feedback and only advances the current stage.
 a=await app();a.d.getElementById('autoRun').checked=false;const guided=a.run('runFramework()');await tick();assert.equal(a.run('pausedStep'),'segments');
 a.run("continueStep('metrics',false)");assert.equal(a.run('pausedStep'),'segments');
 a.run("openFeedback('segments')");input(a,'note-segments','Focus on returning shoppers.');a.run("continueStep('segments',true)");await tick();assert.equal(a.run('pausedStep'),'painpoints');
 assert.match(a.requests[1].body.messages[0].content,/Focus on returning shoppers/);
 a.run('stopFramework()');await guided;assert.equal(a.run('completedSteps.length'),2);a.d.getElementById('autoRun').checked=true;await a.run('runFramework(true)');assert.equal(a.run('status'),'done');assert.ok(a.w.prdStore);a.close();
 // A provider failure at either deliverable preserves analysis and completed outputs; resume retries only missing outputs.
 for(const kind of ['prototype','prd']){
  a=await app();a.failure={kind,status:429,message:'Rate limit fixture'};await a.run('runFramework()');
  assert.equal(a.run('completedSteps.length'),10);assert.equal(a.w.prdStore,'');
  assert.match(a.d.getElementById('runMessage').textContent,/generation failed/);
  assert.equal(!!a.w.protoHtmlStore,kind==='prd');const count=a.requests.length;
  await a.run('generateDeliverables()');assert.ok(a.w.prdStore);assert.equal(a.requests.length-count,kind==='prototype'?2:1);a.close();
 }
 // Cancellation during a deliverable cannot publish a stale response or strand the controls.
 a=await app();a.failure={kind:'prototype',abort:true};const pending=a.run('runFramework()');while(!a.run('deliverableBusy'))await tick();a.run('stopFramework()');await pending;
 assert.equal(a.run('completedSteps.length'),10);assert.equal(a.run('pipelineBusy||deliverableBusy'),false);assert.equal(a.w.protoHtmlStore,'');
 assert.doesNotMatch(a.d.getElementById('protoActions').textContent,/Building/);await a.run('generateDeliverables()');assert.ok(a.w.prdStore);a.close();
 // Interrupted stream keeps finished stages and never unlocks partial analysis.
 a=await app();const ids=Array.from(a.run('STEPS.map(s=>s.id)'));const fetch=a.w.fetch;let first=true;
 a.w.fetch=async(url,opts)=>{if(JSON.parse(opts.body).stream&&first){first=false;return sse(ids.slice(0,3),'max_tokens');}return fetch(url,opts);};
 await a.run('runFramework()');assert.equal(a.run('status'),'error');assert.equal(a.run('completedSteps.length'),3);assert.equal(a.w.protoHtmlStore,'');await a.run('runFramework(true)');assert.ok(a.w.prdStore);a.close();
 // Authentication failures are actionable and leave the brief editable.
 a=await app();a.failure={kind:'analysis',status:401,message:'Invalid API key fixture'};await a.run('runFramework()');assert.equal(a.run('status'),'error');assert.match(a.d.getElementById('errorBanner').textContent,/Invalid API key/);assert.equal(a.d.getElementById('apiKeyInput').disabled,false);a.close();
 console.log('PASS: problem → 10 stages → prototype → PRD; streaming; detailed/guided flows; feedback; edited-decision invalidation; auth/rate-limit failures; resume; cancellation; no upload UI or document dependencies. Numeric RICE estimates, arithmetic and downstream ranking verified. AI responses simulated.');
})().catch(e=>{console.error(e);process.exitCode=1;});
