// Bundle the existing audited workflow controllers outside the React-managed tree.
// The React root owns all primary pages; the compatibility layer owns #dialog.
const fs=require('node:fs');
let base=fs.readFileSync('static/app.js','utf8').replace('}}init();','}}');
let collaboration=fs.readFileSync('static/collaboration.js','utf8');
collaboration=collaboration.replace(/if\(new URLSearchParams\(location.search\)\.has\('equipment'\)\)\{const wait=setInterval\([\s\S]*?\},100\)\}/,'');
const adapter=`
render=async()=>{};
refresh=async()=>{[meta,kaizens,deployments]=await Promise.all([api('meta'),api('kaizens'),api('hd')]);window.dispatchEvent(new Event('ci-data-changed'))};
window.CIBridge={
 sync(data,auth){meta=data.meta;kaizens=data.kaizens;deployments=data.hd;token=auth;cx.workspace=data.workspace;},
 open:(kind,id,tab='Evidence')=>recordWorkspace(kind,id,tab),
 create:()=>newKaizen(),
 inbox:()=>inbox().catch(e=>toast(e.message)),
 template(index){const t=cx.workspace.templates[index];newKaizen();for(const key of ['problem','root','change','evidence'])$('#kaizen-form').elements[key].value=t[key];cx.dirty=true},
 transcript(){modal('Create a draft from a video transcript','<p>Paste an author-supplied transcript. Verify every proposed field before saving.</p>'+form('transcript-draft',area('Transcript','transcript'),'Suggest draft fields'))},
 feedback(id,site){modal('Recommendation feedback',form('feedback','<input type="hidden" name="id" value="'+id+'"><input type="hidden" name="site_id" value="'+site+'">'+pick('Decision','decision',['Accepted','Rejected','Needs assessment'])+area('Reason','reason')))},
 assign(id,site){const s=meta.sites.find(s=>s.id===site);modal('Assign horizontal deployment','<p>'+esc(s.plant)+' / '+esc(s.shop)+' · Begin a human feasibility assessment.</p><form id="assign-form" data-id="'+id+'" data-site="'+site+'"><div class="form-grid"><label>Accountable owner<select name="owner">'+options(cx.workspace.users.filter(u=>['Plant Coordinator','OpEx Lead'].includes(u.role)).map(u=>u.name),meta.user.name)+'</select></label><label>Due date<input type="date" name="due" required></label></div><div class="modal-actions"><button class="primary">Create assignment</button></div></form>')}
};
navigate=async(p)=>{page=p;window.dispatchEvent(new CustomEvent('ci-navigate',{detail:{page:p}}))};
`;
fs.mkdirSync('static/react',{recursive:true});
fs.writeFileSync('static/react/workflows.js',base+'\n'+collaboration+'\n'+adapter);
