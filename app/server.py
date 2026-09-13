import argparse
import json
import mimetypes
import secrets
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from app.store import Store, now
from app.domain import STATES, KPI, similarity, recommend, improvement
from app.collaboration import route as collaboration_route, can_read, notify, uid_for

ROOT=Path(__file__).resolve().parent.parent
SESSIONS={}
LOCK=threading.RLock()
store=None

class Handler(BaseHTTPRequestHandler):
    def reply(self,status,data):
        body=json.dumps(data).encode(); self.send_response(status)
        self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body))); self.send_header('Cache-Control','no-store'); self.send_header('X-Content-Type-Options','nosniff'); self.end_headers(); self.wfile.write(body)
    def do_GET(self): self.handle_request()
    def do_POST(self): self.handle_request()
    def do_PATCH(self): self.handle_request()
    def handle_request(self):
        try:
            with LOCK: self.route()
        except PermissionError as e: self.reply(403,{'error':str(e)})
        except StopIteration: self.reply(404,{'error':'Record not found'})
        except (ValueError,KeyError,TypeError,IndexError) as e: self.reply(400,{'error':str(e)})
        except Exception:
            import traceback; traceback.print_exc(); self.reply(500,{'error':'Unexpected server error; see local server log.'})
    def route(self):
        parsed=urlparse(self.path); path=parsed.path; q={k:v[0] for k,v in parse_qs(parsed.query).items()}
        if not path.startswith('/api/'):
            if self.command!='GET': return self.reply(405,{'error':'Method not allowed'})
            file=(ROOT/'static'/('index.html' if path=='/' else path.lstrip('/'))).resolve()
            if not file.is_relative_to(ROOT/'static') or not file.is_file(): return self.reply(404,{'error':'Not found'})
            content=file.read_bytes(); self.send_response(200); self.send_header('Content-Type',mimetypes.guess_type(file)[0] or 'application/octet-stream'); self.send_header('Content-Length',str(len(content))); self.send_header('X-Content-Type-Options','nosniff'); self.send_header('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; frame-src 'self' blob:; frame-ancestors 'none'"); self.end_headers(); self.wfile.write(content); return
        data={}
        if self.command in ('POST','PATCH'):
            origin=self.headers.get('Origin')
            if origin and urlparse(origin).netloc!=self.headers.get('Host'): raise PermissionError('Cross-origin writes are blocked')
            size=int(self.headers.get('Content-Length','0'))
            if size<0 or size>(34*1024*1024 if path=='/api/v1/collab/media' else 100000): raise ValueError('Request too large')
            data=json.loads(self.rfile.read(size) or b'{}')
            if not isinstance(data,dict): raise ValueError('JSON object required')
        if path=='/api/v1/health': return self.reply(200,{'status':'ok','mode':'local synthetic demo','schema':1})
        if path=='/api/v1/demo-users' and self.command=='GET': return self.reply(200,store.all('users'))
        if path=='/api/v1/session' and self.command=='POST':
            user=next((x for x in store.all('users') if x['id']==int(data['user_id'])),None)
            if not user: raise ValueError('Unknown demo persona')
            token=secrets.token_urlsafe(32); SESSIONS[token]=user; return self.reply(200,{'token':token,'user':user})
        user=SESSIONS.get(self.headers.get('Authorization','').removeprefix('Bearer '))
        if not user: return self.reply(401,{'error':'Choose a demo persona to sign in'})
        if collaboration_route(self,store,path,q,data,user):return
        role=user['role']; actor=user['name']
        def allow(*roles):
            if role not in roles: raise PermissionError(f'{role} cannot perform this action')
        def required(*fields):
            for f in fields:
                if data.get(f) is None or not str(data[f]).strip(): raise ValueError(f'{f} is required')
        ks=store.all('kaizens'); hd=store.all('hd'); sites=store.all('sites')
        if self.command=='GET':
            if path=='/api/v1/meta': return self.reply(200,{'sites':sites,'kpis':KPI,'states':STATES,'user':user})
            if path=='/api/v1/kaizens': return self.reply(200,[k for k in ks if k['status']=='Approved' or k['owner']==actor or role in ('Reviewer','Shop Head','OpEx Lead')])
            if path=='/api/v1/search':
                query=q.get('q','')[:500]; found=[{**k,'score':round(similarity(query,k['title']+' '+k['problem']+' '+k['change'])*100)} for k in ks if k['status']=='Approved' and (not q.get('plant') or k['plant']==q['plant'])]; return self.reply(200,sorted(found,key=lambda k:k['score'],reverse=True)[:20])
            if path.startswith('/api/v1/recommendations/'):
                k=next(k for k in ks if k['id']==int(path.split('/')[-1]) and k['status']=='Approved'); return self.reply(200,recommend(k,sites,hd))
            if path=='/api/v1/hd': return self.reply(200,hd)
            if path=='/api/v1/benchmark':
                name=q.get('kpi','Scrap Rate')
                if name not in KPI: raise ValueError('Unknown KPI')
                unit,direction=KPI[name]; rows=[]
                for s in sites:
                    idx=s['id']-1; value=s['scrap'] if name=='Scrap Rate' else (88-idx*1.3 if direction=='higher' else 12+idx*2)
                    rows.append({**s,'value':round(value,2),'unit':unit,'kpi':name,'window':'30 days','direction':direction})
                best=min(r['value'] for r in rows) if direction=='lower' else max(r['value'] for r in rows)
                return self.reply(200,{'rows':rows,'benchmark':best,'source':'Synthetic fixed 30-day observation window'})
            if path=='/api/v1/notifications': return self.reply(200,[{'id':h['id'],'text':h['title'],'detail':f"{h['status']} · {h['plant']} · due {h['due']}"} for h in hd if h['status'] not in ('Closed','Rejected')])
            if path=='/api/v1/audit':
                allow('Auditor','OpEx Lead'); return self.reply(200,store.audit())
        if path=='/api/v1/kaizens' and self.command=='POST':
            allow('Contributor','OpEx Lead'); required('title','problem','root','change','plant','shop','equipment','baseline','kpi','evidence')
            if not any(s['plant']==data['plant'] and s['shop']==data['shop'] and s['equipment']==data['equipment'] for s in sites): raise ValueError('Plant, shop and equipment must match master data')
            if data['kpi'] not in KPI: raise ValueError('Unknown KPI')
            baseline=float(data['baseline']); improvement(baseline,baseline,KPI[data['kpi']][1])
            record={k:str(data.get(k,''))[:4000] for k in ('title','problem','root','change','plant','shop','equipment','kpi','evidence','lessons')}
            record.update(baseline=baseline,unit=KPI[data['kpi']][0],window='30 days',owner=actor,status='Draft',created=now())
            return self.reply(201,store.save('kaizens',record,actor))
        if path.startswith('/api/v1/kaizens/') and self.command=='PATCH':
            k=next(k for k in ks if k['id']==int(path.split('/')[-1]))
            if k['owner']!=actor: raise PermissionError('Only owner can edit')
            if k['status'] not in ('Draft','Returned'): raise ValueError('Only drafts and returned records can be edited')
            required('title','problem','root','change','evidence')
            for field in ('title','problem','root','change','evidence','lessons'):
                if field in data:k[field]=str(data[field])[:4000]
            for field in ('plant','shop','equipment','kpi','window'):
                if field in data:k[field]=str(data[field])[:100]
            if not any(s['plant']==k['plant'] and s['shop']==k['shop'] and s['equipment']==k['equipment'] for s in sites):raise ValueError('Invalid manufacturing context')
            if k['kpi'] not in KPI:raise ValueError('Invalid KPI')
            if k['window'] not in ('7 days','30 days','90 days'):raise ValueError('Use 7 days, 30 days or 90 days')
            k['baseline']=float(data.get('baseline',k['baseline']));improvement(k['baseline'],k['baseline'],KPI[k['kpi']][1]);k['unit']=KPI[k['kpi']][0]
            return self.reply(200,store.save('kaizens',k,actor,'edit'))
        if path.startswith('/api/v1/kaizens/') and self.command=='POST':
            parts=path.split('/'); k=next((k for k in ks if k['id']==int(parts[4])),None)
            if not k: return self.reply(404,{'error':'Kaizen not found'})
            action=parts[5]; required('comment')
            if action=='submit':
                if k['owner']!=actor: raise PermissionError('Only owner can submit')
                if k['status'] not in ('Draft','Returned'): raise ValueError('Only draft or returned records can be submitted')
                k['status']='Submitted'
            elif action=='review':
                allow('Reviewer','OpEx Lead')
                if k['status']!='Submitted': raise ValueError('Record must be submitted')
                k['status']='Reviewed'
            elif action in ('approve','reject','return'):
                allow('Shop Head','OpEx Lead')
                if k['owner']==actor: raise PermissionError('Independent approver required')
                if k['status']!='Reviewed': raise ValueError('Review required before decision')
                k['status']={'approve':'Approved','reject':'Rejected','return':'Returned'}[action]
            else: raise ValueError('Unknown action')
            k['decision_comment']=data['comment']; saved=store.save('kaizens',k,actor,action)
            recipients=uid_for(store,k['owner'])+[u['id'] for u in store.all('users') if (action=='submit' and u['role'] in ('Reviewer','OpEx Lead')) or (action=='review' and u['role'] in ('Shop Head','OpEx Lead'))]
            notify(store,recipients,actor,f'Kaizen {k["id"]}: {k["status"]}','kaizens',k['id'])
            return self.reply(200,saved)
        if path=='/api/v1/hd' and self.command=='POST':
            allow('Plant Coordinator','OpEx Lead'); required('kaizen_id','plant','shop','owner','due')
            from datetime import date
            date.fromisoformat(data['due'])
            k=next(k for k in ks if k['id']==int(data['kaizen_id']) and k['status']=='Approved')
            if not any(s['plant']==data['plant'] and s['shop']==data['shop'] for s in sites): raise ValueError('Invalid target')
            if any(h['kaizen_id']==k['id'] and h['plant']==data['plant'] and h['shop']==data['shop'] and h['status']!='Rejected' for h in hd): raise ValueError('Deployment already exists for this target')
            record={key:data[key] for key in ('plant','shop','owner','due')}; record.update(kaizen_id=k['id'],title=k['title'],status='Suggested',baseline=k['baseline'],kpi=k['kpi'],unit=k['unit'],window=k['window'],history=[{'status':'Suggested','actor':actor,'time':now(),'comment':'Assigned for assessment'}])
            saved=store.save('hd',record,actor,'assign');notify(store,uid_for(store,record['owner']),actor,'Deployment assigned: '+record['title'],'hd',saved['id']);return self.reply(201,saved)
        if path.startswith('/api/v1/hd/') and self.command=='PATCH':
            h=next(h for h in hd if h['id']==int(path.split('/')[-1])); required('status','comment')
            target=data['status']; allow('Plant Coordinator','Shop Head','OpEx Lead')
            if target not in STATES[h['status']]: raise ValueError('Invalid state transition')
            if target=='Validated':
                allow('Shop Head','OpEx Lead'); required('baseline','post','unit','window','evidence')
                if data['unit']!=h['unit'] or data['window']!=h['window']: raise ValueError('KPI unit and observation window must match')
                h['baseline']=float(data['baseline']); h['post']=float(data['post']); h['improvement']=improvement(h['baseline'],h['post'],KPI[h['kpi']][1]); h['evidence']=data['evidence']; h['validated_by']=actor
            if target=='Closed': required('lessons'); h['lessons']=data['lessons']
            h['status']=target; h['history'].append({'status':target,'actor':actor,'time':now(),'comment':data['comment']}); return self.reply(200,store.save('hd',h,actor,'transition'))
        self.reply(404,{'error':'Endpoint not found'})

def main():
    global store
    parser=argparse.ArgumentParser(); parser.add_argument('--port',type=int,default=8765); parser.add_argument('--db',default=str(ROOT/'data/demo.sqlite3')); args=parser.parse_args()
    store=Store(args.db); server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    print(f'CI-BENCH local demo: http://127.0.0.1:{args.port}',flush=True); server.serve_forever()

if __name__=='__main__': main()
