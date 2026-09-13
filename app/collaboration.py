"""Local collaboration, evidence and governed revision services."""
import base64
import hashlib
import io
import json
import math
import os
import re
import secrets
import shutil
import subprocess
import sys
import zipfile
from datetime import date
from pathlib import Path
from app.store import now
from app.domain import KPI, improvement

WRITE_ROLES={'Contributor','Reviewer','Shop Head','Plant Coordinator','OpEx Lead'}
REVIEW_ROLES={'Reviewer','Shop Head','OpEx Lead','Auditor'}
MAX_FILE=24*1024*1024
TEMPLATES=[{'name':n,'problem':p,'root':'Document the verified cause and investigation.','change':c,'evidence':'Record observation dates, source, and before/after evidence.'} for n,p,c in [
 ('Quality','Describe the defect, frequency, and affected process.','Describe the error-proofing or process correction.'),
 ('Safety','Describe the observed hazard without including personal information.','Describe the reviewed engineering or procedural control.'),
 ('Maintenance','Describe the failure mode and downtime.','Describe preventive maintenance and verification.'),
 ('Energy','Describe energy consumption per unit and measurement conditions.','Describe the energy-saving change and operating constraints.'),
 ('Delivery','Describe delay, lead time, and affected operation.','Describe flow or scheduling improvements.')]]

def record(store,kind,id):return next(x for x in store.all(kind) if x['id']==int(id))
def can_read(k,user):return k['status']=='Approved' or k['owner']==user['name'] or user['role'] in REVIEW_ROLES
def parent(store,kind,id,user,write=False):
    if kind not in ('kaizens','hd'):raise ValueError('Invalid record type')
    k=record(store,kind,id)
    if kind=='kaizens' and not can_read(k,user):raise PermissionError('Record is private until approved')
    if write and user['role'] not in WRITE_ROLES:raise PermissionError('Read-only role')
    return k
def own(k,user):
    if k['owner']!=user['name'] and user['role']!='OpEx Lead':raise PermissionError('Only the owner or OpEx can update this work')
def required(d,*keys):
    for key in keys:
        if d.get(key) is None or not str(d[key]).strip():raise ValueError(f'{key} is required')
def bounded(value,limit=8000):
    if not isinstance(value,str) or len(value)>limit:raise ValueError(f'Text must be at most {limit} characters')
    return value
def related(store,kind,entity_kind,entity_id):return [x for x in store.all(kind) if x.get('entity_kind')==entity_kind and x.get('entity_id')==int(entity_id)]
def notify(store,users,actor,text,kind,id,category='updates'):
    for uid in set(users):
        store.save('notifications',{'user_id':uid,'actor':actor,'text':text,'entity_kind':kind,'entity_id':id,'category':category,'read':False,'created':now()},actor,'notify')
def uid_for(store,name):return [u['id'] for u in store.all('users') if u['name']==name]
def file_type(name,content):
    ext=Path(name).suffix.lower()
    rules={'.png':('image/png',content.startswith(b'\x89PNG\r\n\x1a\n')),'.jpg':('image/jpeg',content.startswith(b'\xff\xd8\xff')),'.jpeg':('image/jpeg',content.startswith(b'\xff\xd8\xff')),'.webp':('image/webp',content[:4]==b'RIFF' and content[8:12]==b'WEBP'),'.pdf':('application/pdf',content.startswith(b'%PDF-')),'.mp4':('video/mp4',content[4:8]==b'ftyp'),'.webm':('video/webm',content.startswith(b'\x1a\x45\xdf\xa3')),'.vtt':('text/vtt',content.startswith(b'WEBVTT'))}
    if ext not in rules or not rules[ext][1]:raise ValueError('Unsupported or mismatched file. Use PNG, JPEG, WebP, PDF, MP4, WebM, or WebVTT.')
    return rules[ext][0]

def binary(handler,body,mime,name=None):
    handler.send_response(200);handler.send_header('Content-Type',mime);handler.send_header('Content-Length',str(len(body)));handler.send_header('Cache-Control','no-store');handler.send_header('X-Content-Type-Options','nosniff')
    if name:handler.send_header('Content-Disposition',f'attachment; filename="{name}"')
    handler.end_headers();handler.wfile.write(body)

def route(h,store,path,q,d,user):
    """Return True when a collaboration endpoint handled the request."""
    if not path.startswith('/api/v1/collab'):return False
    action=path.removeprefix('/api/v1/collab').strip('/');method=h.command;actor=user['name']
    def reply(value,status=200):h.reply(status,value);return True
    if action=='workspace' and method=='GET':
        visible=[k for k in store.all('kaizens') if can_read(k,user)]
        return reply({'users':store.all('users'),'templates':TEMPLATES,'kaizens':visible,'tasks':[t for t in store.all('tasks') if t['entity_kind']=='hd' or any(k['id']==t['entity_id'] for k in visible)],'bookmarks':[b for b in store.all('bookmarks') if b['user_id']==user['id']], 'preferences':next((p for p in store.all('preferences') if p['id']==user['id']),{'id':user['id'],'mentions':True,'updates':True,'reminders':True}),'media_count':len([m for m in store.all('media') if any(k['id']==m['entity_id'] for k in visible) and m['entity_kind']=='kaizens'])})
    if action=='record' and method=='GET':
        kind=q.get('kind','kaizens');id=int(q['id']);k=parent(store,kind,id,user)
        with store.connect() as c:versions=[dict(zip(['time','actor','action','snapshot'],r)) for r in c.execute('SELECT time,actor,action,detail FROM audit WHERE entity=? ORDER BY id DESC',(f'{kind}/{id}',))]
        return reply({'record':k,'media':related(store,'media',kind,id),'comments':related(store,'comments',kind,id),'tasks':related(store,'tasks',kind,id),'translations':related(store,'translations',kind,id),'observations':related(store,'observations',kind,id),'versions':versions})
    if action=='revision' and method=='POST':
        k=parent(store,'kaizens',d['id'],user,True);own(k,user)
        if k['status']!='Approved':raise ValueError('Only approved records need a revision')
        existing=next((x for x in store.all('kaizens') if x.get('revision_of')==k['id'] and x['status'] in ('Draft','Returned','Submitted','Reviewed')),None)
        if existing:return reply(existing)
        revised={**k,'id':None,'status':'Draft','owner':actor,'revision_of':k['id'],'revision':k.get('revision',1)+1,'created':now()}
        revised.pop('decision_comment',None);revised.pop('post',None)
        saved=store.save('kaizens',revised,actor,'create_revision')
        for entity in ('media','translations'):
            for item in related(store,entity,'kaizens',k['id']):
                copied={**item,'id':None,'entity_id':saved['id'],'owner':actor,'copied_from':item['id'],'created':now()}
                store.save(entity,copied,actor,'copy_revision_evidence')
        return reply(saved,201)
    if action=='media' and method=='POST':
        required(d,'entity_kind','entity_id','name','content','title','category')
        k=parent(store,d['entity_kind'],d['entity_id'],user,True)
        if d['entity_kind']=='kaizens':
            own(k,user)
            if k['status'] not in ('Draft','Returned'):raise ValueError('Add evidence to a draft revision to preserve approved evidence')
        else:
            own(k,user)
            if k['status'] in ('Validated','Closed','Rejected'):raise ValueError('Evidence is frozen after validation or rejection')
        if d['category'] not in ('Before','After','Root Cause','Implementation','Validation'):raise ValueError('Invalid evidence category')
        raw=base64.b64decode(d['content'],validate=True)
        if not raw or len(raw)>MAX_FILE:raise ValueError('File must be between 1 byte and 24 MB')
        name=Path(d['name'].replace('\\','/')).name[:150];mime=file_type(name,raw)
        folder=store.path.parent/'evidence';folder.mkdir(exist_ok=True);key=secrets.token_hex(20);file=folder/key;file.write_bytes(raw)
        scan='Not scanned — local demo only'
        scanner=shutil.which('clamscan')
        if scanner:
            try:
                result=subprocess.run([scanner,'--no-summary',str(file)],capture_output=True,timeout=60)
                if result.returncode!=0:raise ValueError('Upload rejected: malware scanner did not return a clean result')
                scan='ClamAV clean'
            except Exception:
                file.unlink(missing_ok=True);raise
        elif d.get('acknowledge_unscanned') is not True:
            file.unlink(missing_ok=True);raise ValueError('No malware scanner configured. Explicitly acknowledge local-demo unscanned storage or configure ClamAV.')
        m={'entity_kind':d['entity_kind'],'entity_id':int(d['entity_id']),'name':name,'key':key,'mime':mime,'size':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'title':bounded(d['title'],200),'description':bounded(d.get('description','')),'category':d['category'],'owner':actor,'created':now(),'scan':scan,'transcript':bounded(d.get('transcript',''),40000),'language':bounded(d.get('language','en'),30)}
        try:return reply(store.save('media',m,actor,'upload'),201)
        except Exception:file.unlink(missing_ok=True);raise
    if action=='file' and method=='GET':
        m=record(store,'media',q['id']);parent(store,m['entity_kind'],m['entity_id'],user)
        binary(h,(store.path.parent/'evidence'/m['key']).read_bytes(),m['mime']);return True
    if action=='caption' and method=='POST':
        m=record(store,'media',d['id']);k=parent(store,m['entity_kind'],m['entity_id'],user,True);own(k,user)
        if k['status'] in ('Approved','Submitted','Reviewed','Validated','Closed','Rejected'):raise ValueError('Captions are frozen with approved evidence; create a revision')
        if not m['mime'].startswith('video/'):raise ValueError('Select a video')
        required(d,'language','vtt');vtt=bounded(d['vtt'],50000)
        if not vtt.startswith('WEBVTT') or '-->' not in vtt:raise ValueError('WebVTT captions with timestamps are required')
        captions=m.get('captions',{});captions[bounded(d['language'],30)]=vtt;m['captions']=captions;m['transcript']=bounded(d.get('transcript',m.get('transcript','')),40000)
        return reply(store.save('media',m,actor,'captions'))
    if action=='comment' and method=='POST':
        required(d,'entity_kind','entity_id','text');k=parent(store,d['entity_kind'],d['entity_id'],user,True)
        pid=int(d.get('parent_id') or 0);mid=int(d.get('media_id') or 0)
        if pid:
            p=record(store,'comments',pid)
            if (p['entity_kind'],p['entity_id'])!=(d['entity_kind'],int(d['entity_id'])):raise ValueError('Reply belongs to a different record')
        if mid:
            m=record(store,'media',mid)
            if (m['entity_kind'],m['entity_id'])!=(d['entity_kind'],int(d['entity_id'])):raise ValueError('Evidence belongs to a different record')
        second=float(d.get('second') or 0)
        if not math.isfinite(second) or second<0:raise ValueError('Timestamp must be non-negative')
        mentions=d.get('mentions',[])
        if not isinstance(mentions,list) or any(not isinstance(i,int) or not any(u['id']==i for u in store.all('users')) for i in mentions):raise ValueError('Invalid mention users')
        if d['entity_kind']=='kaizens' and any(not can_read(k,record(store,'users',i)) for i in mentions):raise ValueError('Mentioned user cannot access this draft')
        comment=store.save('comments',{'entity_kind':d['entity_kind'],'entity_id':int(d['entity_id']),'text':bounded(d['text']),'parent_id':pid,'media_id':mid,'second':second,'mentions':mentions,'owner':actor,'created':now(),'resolved':False},actor,'comment')
        notify(store,mentions,actor,f'{actor} mentioned you: '+d['text'][:100],d['entity_kind'],int(d['entity_id']),'mentions')
        return reply(comment,201)
    if action=='resolve' and method=='POST':
        c=record(store,'comments',d['id']);k=parent(store,c['entity_kind'],c['entity_id'],user,True)
        if c['owner']!=actor and k['owner']!=actor and user['role']!='OpEx Lead':raise PermissionError('Only discussion or record owner may resolve')
        c['resolved']=bool(d.get('resolved',True));return reply(store.save('comments',c,actor,'resolve'))
    if action=='task' and method in ('POST','PATCH'):
        if method=='POST':
            required(d,'entity_kind','entity_id','title','assignee','due');k=parent(store,d['entity_kind'],d['entity_id'],user,True);own(k,user)
            t={'entity_kind':d['entity_kind'],'entity_id':int(d['entity_id']),'owner':actor,'created':now(),'status':'Open','progress':0}
        else:
            t=record(store,'tasks',d['id']);k=parent(store,t['entity_kind'],t['entity_id'],user,True)
            if actor not in (t['owner'],t['assignee'],k['owner']) and user['role']!='OpEx Lead':raise PermissionError('Only assigned team can update task')
        for key in ('title','assignee','due','priority','blockers','milestone','checklist','status'):
            if key in d:t[key]=bounded(d[key],4000)
        if not uid_for(store,t['assignee']):raise ValueError('Choose an existing assignee')
        assigned=next(u for u in store.all('users') if u['name']==t['assignee'])
        if assigned['role'] not in WRITE_ROLES or (t['entity_kind']=='kaizens' and not can_read(k,assigned)):raise ValueError('Assignee must be able to work on the record')
        date.fromisoformat(t['due'])
        if t.get('priority','Normal') not in ('Low','Normal','High','Critical'):raise ValueError('Invalid priority')
        if t['status'] not in ('Open','In progress','Blocked','Done'):raise ValueError('Invalid task status')
        t['progress']=int(d.get('progress',t['progress']))
        if not 0<=t['progress']<=100:raise ValueError('Progress must be between 0 and 100')
        if t['status']=='Done':t['progress']=100
        t['updated']=now();saved=store.save('tasks',t,actor,'task_update')
        notify(store,uid_for(store,t['assignee']),actor,'Task: '+t['title'],t['entity_kind'],t['entity_id'])
        return reply(saved)
    if action=='plan' and method=='POST':
        k=parent(store,'hd',d['id'],user,True);own(k,user)
        if k['status'] in ('Closed','Rejected'):raise ValueError('Terminal deployment cannot be edited')
        required(d,'comment')
        if d.get('due'):date.fromisoformat(d['due']);k['due']=d['due']
        for key in ('blockers','milestones','feasibility','cost','safety','skills','tooling','downtime'):
            if key in d:k[key]=bounded(d[key],4000)
        k.setdefault('history',[]).append({'time':now(),'actor':actor,'status':k['status'],'comment':'Plan update: '+bounded(d['comment'])})
        return reply(store.save('hd',k,actor,'plan_update'))
    if action=='bookmark' and method=='POST':
        k=parent(store,'kaizens',d['id'],user);collection=bounded(d.get('collection','Saved'),100).strip() or 'Saved'
        existing=next((b for b in store.all('bookmarks') if b['user_id']==user['id'] and b['kaizen_id']==k['id'] and b['collection']==collection),{})
        return reply(store.save('bookmarks',{**existing,'user_id':user['id'],'kaizen_id':k['id'],'collection':collection,'active':bool(d.get('active',True))},actor,'bookmark'))
    if action=='feedback' and method=='POST':
        parent(store,'kaizens',d['id'],user,True);record(store,'sites',d['site_id']);required(d,'decision','reason')
        if d['decision'] not in ('Accepted','Rejected','Needs assessment'):raise ValueError('Invalid feedback')
        return reply(store.save('feedback',{'kaizen_id':int(d['id']),'site_id':int(d['site_id']),'decision':d['decision'],'reason':bounded(d['reason']),'owner':actor,'created':now()},actor,'feedback'),201)
    if action=='translation' and method=='POST':
        k=parent(store,d['entity_kind'],d['entity_id'],user,True);own(k,user)
        if k['status'] not in ('Draft','Returned'):raise ValueError('Translations must be reviewed with a draft revision')
        required(d,'language','title','text')
        return reply(store.save('translations',{'entity_kind':d['entity_kind'],'entity_id':int(d['entity_id']),'language':bounded(d['language'],30),'title':bounded(d['title'],200),'text':bounded(d['text'],20000),'owner':actor,'created':now(),'method':'Human supplied'},actor,'translation'),201)
    if action=='observation' and method=='POST':
        k=parent(store,d['entity_kind'],d['entity_id'],user,True);own(k,user)
        if k['status'] in ('Approved','Submitted','Reviewed','Validated','Closed','Rejected'):raise ValueError('Use a draft revision or an unvalidated deployment for new observations')
        required(d,'baseline','post','unit','window','start','end','source','evidence')
        if d['unit']!=k['unit'] or d['window']!=k['window']:raise ValueError('Unit and window must match record')
        start,end=date.fromisoformat(d['start']),date.fromisoformat(d['end'])
        if end<start:raise ValueError('End date precedes start')
        expected=re.fullmatch(r'(\d+) days',k['window'])
        if expected and (end-start).days+1!=int(expected[1]):raise ValueError('Observation dates must span the stated window inclusively')
        result=improvement(float(d['baseline']),float(d['post']),KPI[k['kpi']][1])
        fields={key:d[key] for key in ('entity_kind','unit','window','start','end','source','evidence')}
        fields.update(entity_id=int(d['entity_id']),baseline=float(d['baseline']),post=float(d['post']),improvement=result,owner=actor,created=now(),status='Provisional')
        return reply(store.save('observations',fields,actor,'observation'),201)
    if action=='verify-observation' and method=='POST':
        o=record(store,'observations',d['id']);parent(store,o['entity_kind'],o['entity_id'],user,True)
        if user['role'] not in ('Shop Head','OpEx Lead') or o['owner']==actor:raise PermissionError('Independent Shop Head or OpEx validator required')
        required(d,'comment');o.update(status='Verified',validated_by=actor,validation_comment=bounded(d['comment']),validated_at=now());return reply(store.save('observations',o,actor,'verify_observation'))
    if action=='preferences' and method=='POST':
        return reply(store.save('preferences',{'id':user['id'],**{key:bool(d.get(key,True)) for key in ('mentions','updates','reminders')}},actor,'preferences'))
    if action=='notifications' and method=='GET':
        prefs=next((p for p in store.all('preferences') if p['id']==user['id']),{})
        notes=[]
        for n in store.all('notifications'):
            if n['user_id']!=user['id'] or not prefs.get(n['category'],True):continue
            try:parent(store,n['entity_kind'],n['entity_id'],user)
            except (PermissionError,StopIteration):continue
            notes.append(n)
        if prefs.get('reminders',True):
            for t in store.all('tasks'):
                if t['assignee']!=actor or t['status']=='Done':continue
                days=(date.fromisoformat(t['due'])-date.today()).days
                if days<=3:notes.append({'id':f'task-{t["id"]}','text':('OVERDUE: ' if days<0 else 'Due soon: ')+t['title'],'read':False,'category':'reminders','entity_kind':t['entity_kind'],'entity_id':t['entity_id'],'created':t['due']})
                if days<0 and user['role']=='OpEx Lead':pass
            for k in store.all('kaizens'):
                if k['status']=='Submitted' and user['role'] in ('Reviewer','OpEx Lead') or k['status']=='Reviewed' and user['role'] in ('Shop Head','OpEx Lead'):
                    notes.append({'id':f'review-{k["id"]}','text':'Review queue: '+k['title'],'read':False,'category':'reminders','entity_kind':'kaizens','entity_id':k['id'],'created':k['created']})
            if user['role']=='OpEx Lead':
                for t in store.all('tasks'):
                    if t['status']!='Done' and date.fromisoformat(t['due'])<date.today():notes.append({'id':f'escalation-{t["id"]}','text':'Escalated overdue task: '+t['title'],'read':False,'category':'reminders','entity_kind':t['entity_kind'],'entity_id':t['entity_id'],'created':t['due']})
        return reply(list(reversed(notes)))
    if action=='read' and method=='POST':
        n=record(store,'notifications',d['id'])
        if n['user_id']!=user['id']:raise PermissionError('Not your notification')
        n['read']=True;return reply(store.save('notifications',n,actor,'read'))
    if action=='transcript-draft' and method=='POST':
        if user['role'] not in ('Contributor','OpEx Lead'):raise PermissionError('Contributor or OpEx required')
        required(d,'transcript');text=bounded(d['transcript'],40000)
        sentences=[s.strip() for s in re.split(r'[.!?\n]+',text) if len(s.strip())>8]
        def choose(words,default):return next((s for s in sentences if any(re.search(r'\b'+re.escape(w)+r'\b',s.lower()) for w in words)),default)
        return reply({'title':sentences[0][:140] if sentences else 'Video-derived improvement draft','problem':choose(['problem','scrap','failure','issue'],'Review transcript and describe the problem.'),'root':choose(['cause','because','worn'],'Author must verify root cause.'),'change':choose(['replace','install','change','introduced'],'Author must verify the countermeasure.'),'evidence':'Author-supplied transcript:\n'+text[:3500],'method':'Local extractive assistance; no automatic transcription or translation. Review every field.'})
    if action=='qr' and method=='GET':
        site=record(store,'sites',q['id']);sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'vendor'))
        import qrcode
        import qrcode.image.svg
        # Explicit configured origin only; never derive a public link from request Host.
        origin=os.environ.get('CI_PUBLIC_URL','http://127.0.0.1:8765').rstrip('/')
        if not re.match(r'^https?://[a-zA-Z0-9.:-]+$',origin):raise ValueError('CI_PUBLIC_URL must be an origin without path or query')
        img=qrcode.make(f'{origin}/?equipment={site["id"]}',image_factory=qrcode.image.svg.SvgPathImage);out=io.BytesIO();img.save(out);binary(h,out.getvalue(),'image/svg+xml',f'equipment-{site["id"]}.svg');return True
    if action=='pack' and method=='GET':
        kind=q.get('kind','kaizens');id=int(q['id']);k=parent(store,kind,id,user);files=related(store,'media',kind,id)
        pack={'record':k,**{name:related(store,name,kind,id) for name in ('comments','tasks','observations','translations')},'media':files}
        with store.connect() as c:pack['audit']=[{'time':r[0],'actor':r[1],'action':r[2],'snapshot':json.loads(r[3])} for r in c.execute('SELECT time,actor,action,detail FROM audit WHERE entity=?',(f'{kind}/{id}',))]
        out=io.BytesIO()
        with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
            z.writestr('record-and-history.json',json.dumps(pack,ensure_ascii=False,indent=2));z.writestr('README.txt','CI-BENCH evidence pack. Synthetic/local demo. Check media scan labels. Attachments and approvals are not certification.\n')
            for m in files:z.write(store.path.parent/'evidence'/m['key'],f'evidence/{m["id"]}-{m["name"]}')
        binary(h,out.getvalue(),'application/zip',f'{kind}-{id}-evidence.zip');return True
    raise ValueError('Unknown collaboration endpoint')
