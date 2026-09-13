// DOM integration checks, not a visual/browser rendering test.
const fs=require('node:fs');const assert=require('node:assert/strict');
const {JSDOM}=require('../tmp/ui-test-runtime/node_modules/jsdom');
const html=fs.readFileSync('static/legacy.html','utf8').replace(/<script[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{url:'http://127.0.0.1:8767',runScripts:'dangerously'});const w=dom.window;
w.fetch=(path,opts)=>fetch(new URL(path,w.location.href),opts);w.URL.createObjectURL=()=> 'blob:fixture';w.URL.revokeObjectURL=()=>{};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
const errors=[];w.addEventListener('error',e=>errors.push(e.message));
w.eval(fs.readFileSync('static/app.js','utf8')+'\n'+fs.readFileSync('static/collaboration.js','utf8'));
async function ready(predicate){for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,30))}throw Error('UI condition timed out')}
function button(selector){const b=w.document.querySelector(selector);assert.ok(b,selector);b.click()}
async function main(){
 await ready(()=>w.document.querySelector('h1')?.textContent.includes('Improvement starts'));
 await w.navigate('Work hub');assert.match(w.document.querySelector('main').textContent,/Start with a reusable template/);
 button('[data-caction=template]');assert.ok(w.document.querySelector('#kaizen-form'));assert.match(w.document.querySelector('[name=problem]').value,/defect/);
 w.document.querySelector('#dialog').close();
 await w.recordWorkspace('kaizens',1);assert.match(w.document.querySelector('#record-content').textContent,/No attachments/);
 button('[data-caction=revision]');await ready(()=>w.document.querySelector('#dialog-content').textContent.includes('Revision 2'));
 button('[data-caction=edit]');assert.ok(w.document.querySelector('#edit-form [name=baseline]'));assert.ok(w.document.querySelector('#edit-form [name=equipment]'));
 await w.recordWorkspace('kaizens',121);button('[data-caction=upload]');assert.ok(w.document.querySelector('#evidence-file'));assert.ok(w.document.querySelector('[name=acknowledge_unscanned]'));
 await w.recordWorkspace('kaizens',121,'Discussion');button('[data-caction=comment]');assert.ok(w.document.querySelector('[name=mentions]'));
 const form=w.document.querySelector('[data-cform=comment]');form.elements.text.value='DOM integration comment';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await ready(()=>w.document.querySelector('.discussion')?.textContent.includes('DOM integration comment'));
 await w.recordWorkspace('kaizens',121,'Tasks');button('[data-caction=task]');assert.ok(w.document.querySelector('[name=checklist]'));
 await w.recordWorkspace('kaizens',121,'Measurements');button('[data-caction=observation]');assert.equal(w.document.querySelector('[name=baseline]').step,'any');
 await w.inbox();assert.ok(w.document.querySelector('[data-cform=preferences]'));
 w.document.querySelector('#dialog').close();await w.navigate('Equipment library');assert.equal(w.document.querySelectorAll('[data-caction=qr]').length,9);
 await w.navigate('Recommendations');assert.equal(w.document.querySelectorAll('[data-caction=feedback]').length,8);
 assert.deepEqual(errors,[]);console.log('PASS: 13 DOM integration checks; templates, revisions, editing, uploads, comments, tasks, measurements, inbox, equipment and feedback.');dom.window.close();
}
main().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
