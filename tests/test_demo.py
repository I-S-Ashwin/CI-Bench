import json
import sqlite3
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from contextlib import closing
from pathlib import Path
from http.server import ThreadingHTTPServer
from app import server
from app.store import Store
from app.domain import improvement, similarity, recommend

class DemoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();server.store=Store(Path(cls.tmp.name)/'test.db')
        cls.http=ThreadingHTTPServer(('127.0.0.1',0),server.Handler);threading.Thread(target=cls.http.serve_forever,daemon=True).start();cls.base=f'http://127.0.0.1:{cls.http.server_port}/api/v1/'
    @classmethod
    def tearDownClass(cls): cls.http.shutdown();cls.http.server_close();cls.tmp.cleanup()
    def req(self,path,method='GET',data=None,token=None):
        r=urllib.request.Request(self.base+path,method=method,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json',**({'Authorization':'Bearer '+token} if token else {})})
        try:
            with urllib.request.urlopen(r) as response:return response.status,json.load(response)
        except urllib.error.HTTPError as e:
            with e:return e.code,json.load(e)
    def login(self,id): return self.req('session','POST',{'user_id':id})[1]['token']
    def test_unauthenticated(self): self.assertEqual(self.req('kaizens')[0],401)
    def test_audit_role_denied(self): self.assertEqual(self.req('audit',token=self.login(1))[0],403)
    def test_lower_kpi(self):self.assertEqual(improvement(4.8,2.1,'lower'),56.25)
    def test_higher_kpi(self):self.assertEqual(improvement(80,88,'higher'),10)
    def test_zero_baseline(self):
        with self.assertRaises(ValueError):improvement(0,1,'lower')
    def test_nonfinite(self):
        with self.assertRaises(ValueError):improvement(1,float('nan'),'lower')
    def test_negative(self):
        with self.assertRaises(ValueError):improvement(2,-1,'lower')
    def test_retrieval(self):
        code,rows=self.req('search?q=welding%20fixture%20misalignment',token=self.login(5));self.assertEqual(code,200);self.assertTrue(all(k['shop']=='Welding' for k in rows[:5]))
    def test_recommendation(self):
        _,rows=self.req('recommendations/1',token=self.login(5));self.assertEqual(rows[0]['shop'],'Welding');self.assertGreater(rows[0]['score'],rows[-1]['score']);self.assertEqual(len(rows[0]['factors']),6)
    def test_benchmark(self):
        _,data=self.req('benchmark',token=self.login(5));self.assertEqual(data['benchmark'],2.1);self.assertEqual(len(data['rows']),9)
    def test_invalid_transition(self):self.assertEqual(self.req('hd/1','PATCH',{'status':'Closed','comment':'skip'},self.login(5))[0],400)
    def test_unit_mismatch(self):
        data={'status':'Validated','comment':'test','baseline':4.8,'post':2.1,'unit':'min','window':'30 days','evidence':'test'}
        self.assertEqual(self.req('hd/5','PATCH',data,self.login(5))[0],400)
    def test_window_mismatch(self):
        data={'status':'Validated','comment':'test','baseline':4.8,'post':2.1,'unit':'%','window':'7 days','evidence':'test'}
        self.assertEqual(self.req('hd/5','PATCH',data,self.login(5))[0],400)
    def test_append_only_audit(self):
        with server.store.connect() as c:
            with self.assertRaises(sqlite3.IntegrityError):c.execute('DELETE FROM audit')
    def test_full_workflow(self):
        owner,reviewer,approver,coordinator=[self.login(i) for i in [1,2,3,4]]
        data={'title':'Test welding jig reuse','problem':'Fixture misalignment causes welding scrap','root':'Worn pins','change':'Replace locating pins','plant':'Plant A','shop':'Welding','equipment':'Welding fixture','kpi':'Scrap Rate','baseline':4.8,'evidence':'Synthetic observation log'}
        code,k=self.req('kaizens','POST',data,owner);self.assertEqual(code,201);kid=k['id']
        for action,t in [('submit',owner),('review',reviewer)]:self.assertEqual(self.req(f'kaizens/{kid}/{action}','POST',{'comment':'Checked'},t)[0],200)
        self.assertEqual(self.req(f'kaizens/{kid}/approve','POST',{'comment':'Attempt'},owner)[0],403)
        self.assertEqual(self.req(f'kaizens/{kid}/approve','POST',{'comment':'Independent approval'},approver)[0],200)
        code,h=self.req('hd','POST',{'kaizen_id':kid,'plant':'Plant C','shop':'Welding','owner':'Plant Coordinator 04','due':'2026-10-20'},coordinator);self.assertEqual(code,201)
        for state in ['Review','Feasibility','Planned','Implemented','Validated','Closed']:
            payload={'status':state,'comment':'Verified demo transition','baseline':4.8,'post':2.1,'unit':'%','window':'30 days','evidence':'Synthetic 30-day measurements','lessons':'Verify fixture compatibility'}
            code,out=self.req(f'hd/{h["id"]}','PATCH',payload,approver if state=='Validated' else coordinator);self.assertEqual(code,200,out)
        self.assertEqual(out['improvement'],56.25);self.assertEqual(len(out['history']),7)
        self.assertTrue(any(a['entity']==f'hd/{h["id"]}' and a['action']=='transition' for a in server.store.audit()))
    def test_missing_metadata(self):self.assertEqual(self.req('kaizens','POST',{'title':'Incomplete'},self.login(1))[0],400)
    def test_unknown_record(self):self.assertEqual(self.req('recommendations/999999',token=self.login(5))[0],404)
    def test_approved_edit_blocked(self):
        self.assertEqual(self.req('kaizens/1','PATCH',{'title':'Changed'},self.login(5))[0],400)
    def test_draft_edit(self):
        token=self.login(1)
        data={'title':'Editable draft','problem':'Welding issue','root':'Worn pins','change':'Replace pins','plant':'Plant A','shop':'Welding','equipment':'Welding fixture','kpi':'Scrap Rate','baseline':4.8,'evidence':'Synthetic'}
        _,record=self.req('kaizens','POST',data,token)
        data['title']='Corrected draft'
        self.assertEqual(self.req(f'kaizens/{record["id"]}','PATCH',data,self.login(5))[0],403)
        code,out=self.req(f'kaizens/{record["id"]}','PATCH',data,token)
        self.assertEqual(code,200);self.assertEqual(out['title'],'Corrected draft')
    def test_backup_restore(self):
        target=Path(self.tmp.name)/'backup.db'
        with server.store.connect() as src,closing(sqlite3.connect(target)) as dst:src.backup(dst)
        restored=Store(target);self.assertEqual(len(restored.all('kaizens')),len(server.store.all('kaizens')));self.assertEqual(restored.audit(),server.store.audit())

if __name__=='__main__':unittest.main(verbosity=2)
