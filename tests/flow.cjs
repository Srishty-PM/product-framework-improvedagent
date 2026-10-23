const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {JSDOM} = require(process.env.JSDOM_TEST_PATH || 'jsdom');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const workspace=fs.readFileSync(path.join(root,'document-workspace.js'),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
async function app(){
 const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window, ctx=dom.getInternalVMContext();
 w.TextDecoder=TextDecoder;w.AbortController=AbortController;w.confirm=()=>true;
 vm.runInContext(inline,ctx);vm.runInContext(workspace,ctx);
 await tick();
 return {w,d:w.document,run:s=>vm.runInContext(s,ctx),close:()=>dom.window.close()};
}
function input(a,id,value){a.d.getElementById(id).value=value;a.d.getElementById(id).dispatchEvent(new a.w.Event('input',{bubbles:true}));}
function change(a,id,value){a.d.getElementById(id).value=value;a.d.getElementById(id).dispatchEvent(new a.w.Event('change',{bubbles:true}));}
function prepare(a,engine='evidence'){
 input(a,'problemInput','Improve product discovery for mobile marketplace shoppers.');
 change(a,'engineMode',engine);
 if(engine==='cloud'){input(a,'apiKeyInput','sk-ant-fixture-not-real');a.d.getElementById('cloudConsent').checked=true;a.run('updateRunBtn()');}
}
function sse(events){
 const wire=events.map(e=>`event: ${e.type}\r\ndata: ${JSON.stringify(e)}\r\n\r\n`).join('');
 const bytes=new TextEncoder().encode(wire);let offset=0;
 return new Response(new ReadableStream({pull(controller){if(offset>=bytes.length){controller.close();return;}const next=Math.min(bytes.length,offset+7);controller.enqueue(bytes.slice(offset,next));offset=next;}}),{headers:{'content-type':'text/event-stream'}});
}
function stageEvents(ids,reason='end_turn'){
 const events=[{type:'message_start',message:{}}];
 for(const id of ids){const text=`<<<STAGE:${id}>>>\n## Draft ${id}\nProposed approach; evidence is TBD. Café.\n<<<END:${id}>>>\n`;for(let n=0;n<text.length;n+=13)events.push({type:'content_block_delta',delta:{type:'text_delta',text:text.slice(n,n+13)}});}
 events.push({type:'message_delta',delta:{stop_reason:reason}},{type:'message_stop'});return events;
}
(async()=>{
 let a=await app();prepare(a);
 assert.equal(a.d.getElementById('runBtn').disabled,false);
 await a.run('runFramework()');assert.equal(a.run('completedSteps.length'),10);
 assert.equal(a.d.querySelectorAll('.feedback-bar').length,0,'automatic runs must not show Continue controls');
 assert.equal(a.d.querySelector('#header-segments').getAttribute('aria-expanded'),'true');
 a.run('generatePRD();generatePrototype()');
 assert.match(a.w.prdStore,/Improve product discovery/);assert.match(a.w.protoHtmlStore,/sandbox="allow-scripts"/);
 a.d.querySelector('#content-segments button').click();input(a,'problemInput',a.d.getElementById('problemInput').value); // explicitly changing brief invalidates drafts
 await a.run('runFramework()');
 a.d.querySelector('#content-segments button').click();
 const editor=a.d.querySelector('#content-segments textarea');editor.value='Changed audience: returning mobile shoppers only.';
 a.d.querySelectorAll('#content-segments button')[1].click();
 assert.equal(a.run('completedSteps.length'),1);assert.equal(a.run('status'),'idle');assert.equal(a.d.getElementById('prdBtn').disabled,true);
 await a.run('runFramework(true)');assert.equal(a.run('completedSteps.length'),10);assert.match(a.run('results.segments'),/returning mobile/);
 a.run('invalidateRun()');a.d.getElementById('autoRun').checked=false;
 const guided=a.run('runFramework()');await tick();assert.equal(a.run('pausedStep'),'segments');
 a.run("continueStep('metrics',false)");await tick();assert.equal(a.run('pausedStep'),'segments','old steps must not advance current pause');
 a.run("continueStep('segments',false)");await tick();assert.equal(a.run('pausedStep'),'painpoints');
 a.run('stopFramework()');await guided;assert.equal(a.run('completedSteps.length'),2);assert.equal(a.run('status'),'idle');
 a.d.getElementById('autoRun').checked=true;await a.run('runFramework(true)');assert.equal(a.run('status'),'done');a.close();
 a=await app();prepare(a,'cloud');const requests=[];
 const ids=Array.from(a.run('STEPS.map(s=>s.id)'));
 a.w.fetch=async(url,options)=>{const body=JSON.parse(options.body);requests.push(body);assert.equal(url,'https://api.anthropic.com/v1/messages');return sse(stageEvents(ids));};
 await a.run('runFramework()');assert.equal(a.run('status'),'done');assert.equal(requests.length,1,'Fast run should use one request for all ten stages');assert.equal(requests[0].stream,true);assert.equal(a.run('completedSteps.length'),10);assert.match(a.run('results.metrics'),/Café/);
 a.run('invalidateRun()');let attempt=0;
 a.w.fetch=async()=>{attempt++;return sse(stageEvents(attempt===1?ids.slice(0,3):ids.slice(3),attempt===1?'max_tokens':'end_turn'));};
 await a.run('runFramework()');assert.equal(a.run('status'),'error');assert.equal(a.run('completedSteps.length'),3);assert.equal(a.d.getElementById('prdBtn').disabled,true);
 await a.run('runFramework(true)');assert.equal(a.run('status'),'done');assert.equal(a.run('completedSteps.length'),10);
 a.run('invalidateRun()');
 a.w.fetch=async()=>sse([{type:'content_block_delta',delta:{type:'text_delta',text:'<<<STAGE:segments>>>Unsupported claim [D99:L1]<<<END:segments>>>'}},{type:'message_delta',delta:{stop_reason:'end_turn'}},{type:'message_stop'}]);
 await a.run('runFramework()');assert.equal(a.run('status'),'error');assert.equal(a.run('completedSteps.length'),0);assert.match(a.d.getElementById('errorBanner').textContent,/nonexistent source/);
 a.run('invalidateRun()');
 a.w.fetch=async()=>sse([{type:'content_block_delta',delta:{type:'text_delta',text:'<<<STAGE:segments>>>Partial content'}}]);
 await a.run('runFramework()');assert.equal(a.run('status'),'error');assert.equal(a.run('completedSteps.length'),0);
 // A stopped guided run cannot resume its old loop after a new run has started.
 a.run('invalidateRun()');change(a,'engineMode','evidence');a.d.getElementById('autoRun').checked=false;
 const old=a.run('runFramework()');await tick();a.run('stopFramework()');a.d.getElementById('autoRun').checked=true;await a.run('runFramework(true)');await old;assert.equal(a.run('status'),'done');assert.equal(a.run('completedSteps.length'),10);
 a.close();
 a=await app();prepare(a,'cloud');change(a,'runSpeed','detailed');
 input(a,'sourceName','Test evidence');input(a,'pasteInput','Hypothesis: clearer labels improve conversion.\nAudience: mobile shoppers.');a.run('addPastedSource()');a.d.getElementById('acceptEvidence').checked=true;a.d.getElementById('cloudConsent').checked=true;a.run('updateRunBtn()');
 let calls=0,readings=0;
 a.w.fetch=async(url,opt)=>{calls++;if(JSON.parse(opt.body).messages[0].content.includes('FULL-TEXT EXCERPT'))readings++;return new Response(JSON.stringify({content:[{type:'text',text:'Documented hypothesis [D1:L1]. Unknown values are TBD.'}],stop_reason:'end_turn'}),{headers:{'content-type':'application/json'}});};
 await a.run('runFramework()');assert.equal(calls,11);assert.equal(readings,1);
 input(a,'problemInput','Improve product discovery for returning shoppers.');await a.run('runFramework()');assert.equal(calls,21);assert.equal(readings,1,'unchanged documents must be read only once per page/model');
 a.run('clearWorkspace()');assert.equal(a.run('learnedCache'),null);a.close();
 console.log('PASS: ten-stage workbook; guided review; edits invalidate downstream outputs; resume; stale-loop cancellation; one-request streaming; CRLF/chunk/Unicode parsing; truncated and disconnected streams; invalid citations; document reuse; memory clearing. API responses simulated; no paid requests.');
})().catch(e=>{console.error(e);process.exitCode=1;});
