import base64
import io
import json
import zipfile
import unittest
from unittest.mock import patch
import test_demo
from app import server

class CollaborationTests(unittest.TestCase):
    setUpClass=classmethod(test_demo.DemoTests.setUpClass.__func__)
    tearDownClass=classmethod(test_demo.DemoTests.tearDownClass.__func__)
    req=test_demo.DemoTests.req
    login=test_demo.DemoTests.login
    def draft(self):
        data={'title':'Collaboration test','problem':'Welding failure','root':'Worn pins','change':'Replace pins','plant':'Plant A','shop':'Welding','equipment':'Welding fixture','kpi':'Scrap Rate','baseline':4.8,'evidence':'Synthetic'}
        code,k=self.req('kaizens','POST',data,self.login(1));self.assertEqual(code,201);return k
    def post(self,name,data,user=1):return self.req('collab/'+name,'POST',data,self.login(user))
    def upload(self,k,**changes):
        data={'entity_kind':'kaizens','entity_id':k['id'],'name':'demo.png','content':base64.b64encode(b'\x89PNG\r\n\x1a\nfixture').decode(),'title':'Before','category':'Before','acknowledge_unscanned':True};data.update(changes)
        with patch('app.collaboration.shutil.which',return_value=None):return self.post('media',data)
    def test_revision_preserves_original(self):
        before=next(k for k in server.store.all('kaizens') if k['id']==1)
        code,r=self.post('revision',{'id':1},5);self.assertEqual(code,201);self.assertEqual(r['status'],'Draft');self.assertEqual(r['revision_of'],1)
        after=next(k for k in server.store.all('kaizens') if k['id']==1);self.assertEqual(before,after)
    def test_revision_not_owner(self):self.assertEqual(self.post('revision',{'id':1},1)[0],403)
    def test_media_persistence_and_hash(self):
        k=self.draft();code,m=self.upload(k);self.assertEqual(code,201,m);self.assertEqual(len(m['sha256']),64);self.assertTrue((server.store.path.parent/'evidence'/m['key']).exists())
    def test_upload_requires_acknowledgement(self):self.assertEqual(self.upload(self.draft(),acknowledge_unscanned=False)[0],400)
    def test_mismatched_file(self):self.assertEqual(self.upload(self.draft(),name='bad.mp4')[0],400)
    def test_disallowed_executable(self):self.assertEqual(self.upload(self.draft(),name='bad.exe')[0],400)
    def test_approved_evidence_frozen(self):
        with patch('app.collaboration.shutil.which',return_value=None):
            code,_=self.post('media',{'entity_kind':'kaizens','entity_id':1,'name':'a.png','content':'abc','title':'test','category':'Before'},5)
        self.assertEqual(code,400)
    def test_private_record_denied(self):
        k=self.draft();self.assertEqual(self.req(f'collab/record?kind=kaizens&id={k["id"]}',token=self.login(8))[0],403)
    def test_private_media_denied(self):
        k=self.draft();_,m=self.upload(k);self.assertEqual(self.req(f'collab/file?id={m["id"]}',token=self.login(8))[0],403)
    def test_reply_wrong_parent(self):
        k,k2=self.draft(),self.draft();_,c=self.post('comment',{'entity_kind':'kaizens','entity_id':k['id'],'text':'Question'})
        self.assertEqual(self.post('comment',{'entity_kind':'kaizens','entity_id':k2['id'],'text':'Reply','parent_id':c['id']})[0],400)
    def test_mentions_and_resolve(self):
        k=self.draft();code,c=self.post('comment',{'entity_kind':'kaizens','entity_id':k['id'],'text':'Please review','mentions':[2]});self.assertEqual(code,201)
        _,notes=self.req('collab/notifications',token=self.login(2));self.assertTrue(any(n['entity_id']==k['id'] for n in notes))
        self.assertEqual(self.post('resolve',{'id':c['id'],'resolved':True})[1]['resolved'],True)
    def test_read_notification_ownership(self):
        k=self.draft();self.post('comment',{'entity_kind':'kaizens','entity_id':k['id'],'text':'Review','mentions':[2]});_,notes=self.req('collab/notifications',token=self.login(2));n=next(n for n in notes if isinstance(n['id'],int));self.assertEqual(self.post('read',{'id':n['id']},1)[0],403)
    def test_task_access_and_update(self):
        k=self.draft();code,t=self.post('task',{'entity_kind':'kaizens','entity_id':k['id'],'title':'Check tooling','assignee':'Reviewer 02','due':'2026-09-20'});self.assertEqual(code,200,t)
        self.assertEqual(self.req('collab/task','PATCH',{'id':t['id'],'status':'Done'},self.login(2))[1]['progress'],100)
        self.assertEqual(self.req('collab/task','PATCH',{'id':t['id'],'progress':101},self.login(2))[0],400)
    def test_private_task_not_leaked(self):
        k=self.draft();self.post('task',{'entity_kind':'kaizens','entity_id':k['id'],'title':'Private task','assignee':'Contributor 01','due':'2026-09-20'})
        _,w=self.req('collab/workspace',token=self.login(8));self.assertFalse(any(t['entity_id']==k['id'] and t['entity_kind']=='kaizens' for t in w['tasks']))
    def test_observation_and_independent_verification(self):
        k=self.draft();d={'entity_kind':'kaizens','entity_id':k['id'],'baseline':4.8,'post':2.1,'unit':'%','window':'30 days','start':'2026-09-01','end':'2026-09-30','source':'Synthetic log','evidence':'Measured demo'}
        code,o=self.post('observation',d);self.assertEqual(code,201,o);self.assertEqual(o['improvement'],56.25)
        self.assertEqual(self.post('verify-observation',{'id':o['id'],'comment':'checked'},3)[1]['status'],'Verified')
    def test_observation_bad_dates(self):
        k=self.draft();d={'entity_kind':'kaizens','entity_id':k['id'],'baseline':4.8,'post':2.1,'unit':'%','window':'30 days','start':'2026-09-01','end':'2026-09-02','source':'Synthetic','evidence':'test'};self.assertEqual(self.post('observation',d)[0],400)
    def test_bookmark_collection(self):self.assertEqual(self.post('bookmark',{'id':1,'collection':'Welding'})[1]['collection'],'Welding')
    def test_translation(self):
        k=self.draft();self.assertEqual(self.post('translation',{'entity_kind':'kaizens','entity_id':k['id'],'language':'ta','title':'தமிழ்','text':'மாதிரி'})[0],201)
    def test_feedback(self):self.assertEqual(self.post('feedback',{'id':1,'site_id':7,'decision':'Rejected','reason':'Tooling unavailable'})[0],201)
    def test_transcript_assistance(self):
        code,d=self.post('transcript-draft',{'transcript':'Welding problem causes scrap. The cause is worn pins. Replace locating pins.'});self.assertEqual(code,200);self.assertIn('worn pins',d['root'])
    def test_pack_and_qr(self):
        import urllib.request
        k=self.draft();self.upload(k);token=self.login(1)
        for path in [f'collab/pack?kind=kaizens&id={k["id"]}','collab/qr?id=1']:
            with urllib.request.urlopen(urllib.request.Request(self.base+path,headers={'Authorization':'Bearer '+token})) as r:
                body=r.read();self.assertEqual(r.status,200)
                if 'pack' in path:
                    with zipfile.ZipFile(io.BytesIO(body)) as z:self.assertIn('record-and-history.json',z.namelist())
                else:self.assertIn(b'<svg',body)
    def test_archive_restores_media(self):
        from app.archive import backup,restore
        from pathlib import Path
        k=self.draft();_,m=self.upload(k)
        archive=Path(self.tmp.name)/'full-backup.zip';restored=Path(self.tmp.name)/'restored'
        backup(server.store.path,archive);restore(archive,restored)
        self.assertEqual((restored/'evidence'/m['key']).read_bytes(),(server.store.path.parent/'evidence'/m['key']).read_bytes())
    def test_archive_rejects_traversal(self):
        from app.archive import restore
        from pathlib import Path
        bad=Path(self.tmp.name)/'bad.zip'
        with zipfile.ZipFile(bad,'w') as z:z.writestr('../outside.txt','bad')
        with self.assertRaises(ValueError):restore(bad,Path(self.tmp.name)/'bad-output')
    def test_revision_copies_evidence(self):
        k=self.draft();_,m=self.upload(k)
        for action,user in [('submit',1),('review',2),('approve',3)]:self.assertEqual(self.req(f'kaizens/{k["id"]}/{action}','POST',{'comment':'Checked'},self.login(user))[0],200)
        code,r=self.post('revision',{'id':k['id']});self.assertEqual(code,201)
        _,detail=self.req(f'collab/record?kind=kaizens&id={r["id"]}',token=self.login(1));self.assertEqual(detail['media'][0]['key'],m['key']);self.assertEqual(detail['media'][0]['copied_from'],m['id'])
    def test_caption_tracks(self):
        k=self.draft();code,m=self.upload(k,name='video.webm',content=base64.b64encode(b'\x1a\x45\xdf\xa3fixture').decode());self.assertEqual(code,201)
        code,m=self.post('caption',{'id':m['id'],'language':'ta','vtt':'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nTest captions','transcript':'Local transcript'});self.assertEqual(code,200);self.assertIn('ta',m['captions'])
    def test_scanner_rejects_infected_file(self):
        from types import SimpleNamespace
        k=self.draft();payload={'entity_kind':'kaizens','entity_id':k['id'],'name':'demo.png','content':base64.b64encode(b'\x89PNG\r\n\x1a\nfixture').decode(),'title':'Before','category':'Before'}
        with patch('app.collaboration.shutil.which',return_value='clamscan'),patch('app.collaboration.subprocess.run',return_value=SimpleNamespace(returncode=1)):
            self.assertEqual(self.post('media',payload)[0],400)
