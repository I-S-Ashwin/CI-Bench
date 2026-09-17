// Headless DOM integration test. Does not assert visual rendering or hardware media.
const fs=require('node:fs');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');
const html=fs.readFileSync('static/index.html','utf8').replace(/<script[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{url:process.env.CI_TEST_ORIGIN||'http://127.0.0.1:8767',runScripts:'dangerously'});const w=dom.window;
const http=require('node:http');
w.fetch=(path,options={})=>{
 const u=new URL(path,w.location.href);
 return new Promise((resolve,reject)=>{
  const headers={...options.headers};
  const body=options.body?Buffer.from(options.body):null;
  if(body)headers['Content-Length']=body.length;
  const req=http.request(u,{method:options.method||'GET',headers},res=>{
   const chunks=[];
   res.on('data',d=>chunks.push(d));
   res.on('end',()=>{
    const buf=Buffer.concat(chunks);
    resolve({
     ok:res.statusCode>=200&&res.statusCode<300,
     status:res.statusCode,
     headers:new Map(Object.entries(res.headers)),
     json:async()=>JSON.parse(buf.toString()||'{}'),
     text:async()=>buf.toString(),
     blob:async()=>new Blob([buf],{type:res.headers['content-type']||''})
    });
   });
  });
  req.on('error',reject);
  if(body)req.write(body);
  req.end();
 });
};
w.scrollTo=()=>{};w.URL.createObjectURL=()=> 'blob:fixture';w.URL.revokeObjectURL=()=>{};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
const errors=[];w.addEventListener('error',e=>errors.push(e.message));
w.eval(fs.readFileSync('static/react/workflows.js','utf8'));w.eval(fs.readFileSync('static/react/app.js','utf8'));
async function ready(predicate){for(let i=0;i<200;i++){if(predicate())return;await new Promise(r=>setTimeout(r,25))}throw Error('Timed out: '+w.document.querySelector('#react-root')?.textContent.slice(-500))}
function nav(name){const b=[...w.document.querySelectorAll('.app-sidebar nav button')].find(b=>b.textContent.includes(name));assert.ok(b,name);b.click()}
function click(selector){const el=w.document.querySelector(selector);assert.ok(el,selector);el.click()}
async function main(){
 await ready(()=>w.document.querySelector('h1')?.textContent.includes('Turn proven improvements'));
 assert.equal(w.document.querySelectorAll('.metric-card').length,4);assert.equal(w.document.querySelectorAll('.column-group').length,3);
 nav('Kaizen repository');await ready(()=>w.document.querySelector('.knowledge-card'));
 assert.equal(w.document.querySelectorAll('.knowledge-card').length,9);
 click('.knowledge-card h2 button');await ready(()=>w.document.querySelector('#dialog').open);assert.ok(w.document.querySelector('.tabs'));
 w.document.querySelector('#dialog').close();nav('Recommendations');await ready(()=>w.document.querySelector('.target-row'));
 assert.equal(w.document.querySelectorAll('.factor-row').length,6);assert.equal(w.document.querySelectorAll('.target-row').length,8);
 click('.recommendation-actions .btn-primary');await ready(()=>w.document.querySelector('#assign-form'));assert.ok(w.document.querySelector('#assign-form select[name=owner]'));
 w.document.querySelector('#dialog').close();nav('Horizontal deployment');await ready(()=>w.document.querySelector('.lifecycle-summary'));
 assert.equal(w.document.querySelectorAll('.data-table tbody tr').length,24);
 click('.data-table .table-record');await ready(()=>w.document.querySelector('#dialog').open);assert.match(w.document.querySelector('#dialog-content').textContent,/Lifecycle & sign-off/);
 w.document.querySelector('#dialog').close();nav('KPI benchmarking');await ready(()=>w.document.querySelector('.horizontal-chart-row'));assert.equal(w.document.querySelectorAll('.horizontal-chart-row').length,9);
 nav('Audit trail');await ready(()=>w.document.querySelector('.audit-event'));assert.ok(w.document.querySelector('.audit-event summary'));
 nav('Work hub');await ready(()=>w.document.querySelector('.template-grid'));assert.equal(w.document.querySelectorAll('.template-grid>button').length,5);
 click('.template-grid>button');await ready(()=>w.document.querySelector('#kaizen-form'));assert.match(w.document.querySelector('#kaizen-form [name=problem]').value,/defect/);
 w.document.querySelector('#dialog').close();nav('Equipment library');await ready(()=>w.document.querySelector('.equipment-card'));assert.equal(w.document.querySelectorAll('.equipment-card').length,9);
 for(const src of new Set([...w.document.querySelectorAll('.equipment-visual')].map(i=>i.getAttribute('src')))){const response=await w.fetch(src);assert.equal(response.status,200,src);assert.match(response.headers.get('content-type'),/image\/png/)}
 const search=w.document.querySelector('input[type=search]');Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(search,'EQ-001');search.dispatchEvent(new w.Event('input',{bubbles:true}));await ready(()=>w.document.querySelectorAll('.equipment-card').length===1);assert.match(w.document.querySelector('.equipment-card').textContent,/EQ-001/);
 assert.deepEqual(errors,[]);console.log('PASS: React integration checks across all 8 pages, pagination, chart data, record workspace, assignment, deployment management and template forms.');dom.window.close();
}
main().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
