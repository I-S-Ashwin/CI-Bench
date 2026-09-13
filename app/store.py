import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

def now(): return datetime.now(timezone.utc).isoformat()

class Store:
    def __init__(self,path):
        self.path=Path(path); self.path.parent.mkdir(parents=True,exist_ok=True)
        with self.connect() as c:
            c.executescript('CREATE TABLE IF NOT EXISTS records(kind TEXT,id INTEGER,data TEXT,PRIMARY KEY(kind,id)); CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT,actor TEXT,action TEXT,entity TEXT,detail TEXT); CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT,"append only"); END; CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT,"append only"); END; PRAGMA user_version=1;')
        if not self.all('sites'): self.seed()
    @contextmanager
    def connect(self):
        c=sqlite3.connect(self.path,timeout=15)
        try:
            with c: yield c
        finally: c.close()
    def all(self,kind):
        with self.connect() as c: return [json.loads(r[0]) for r in c.execute('SELECT data FROM records WHERE kind=? ORDER BY id',(kind,))]
    def audit(self):
        with self.connect() as c: return [dict(zip(['id','time','actor','action','entity','detail'],r)) for r in c.execute('SELECT * FROM audit ORDER BY id DESC LIMIT 500')]
    def save(self,kind,data,actor='seed',action='create'):
        with self.connect() as c:
            c.execute('BEGIN IMMEDIATE')
            if not data.get('id'): data['id']=c.execute('SELECT coalesce(max(id),0)+1 FROM records WHERE kind=?',(kind,)).fetchone()[0]
            c.execute('INSERT OR REPLACE INTO records VALUES(?,?,?)',(kind,data['id'],json.dumps(data)))
            c.execute('INSERT INTO audit(time,actor,action,entity,detail) VALUES(?,?,?,?,?)',(now(),actor,action,f'{kind}/{data["id"]}',json.dumps(data)))
        return data
    def seed(self):
        cases=[('Welding','Welding fixture','Fixture alignment prevents welding scrap','Welding fixture misalignment causes scrap and repeated weld rejects','Locating pin wear allows component movement','Replace locating pins and add a daily jig alignment check'),('Machining','CNC spindle','Spindle monitoring reduces machining downtime','CNC spindle vibration causes downtime and bearing failure','Bearing wear is detected too late','Add vibration checks and planned bearing replacement'),('Assembly','Torque tool','Torque verification improves first-pass yield','Assembly torque variation causes rework and loose fasteners','Torque calibration drifts during shifts','Introduce shift-start torque verification')]
        for p in range(3):
            for s,(shop,equipment,title,problem,root,change) in enumerate(cases):
                self.save('sites',{'plant':f'Plant {chr(65+p)}','shop':shop,'equipment':equipment,'context':problem,'scrap':[2.1,3.4,4.8][p]+s*.1})
        roles=['Contributor','Reviewer','Shop Head','Plant Coordinator','OpEx Lead','Auditor','Executive Viewer']
        for i in range(20): self.save('users',{'name':f'{roles[i%7]} {i+1:02}','role':roles[i%7],'plant':f'Plant {chr(65+i%3)}'})
        for i in range(120):
            shop,equipment,title,problem,root,change=cases[i%3]
            self.save('kaizens',{'title':title+('' if i<3 else f' — cell {i//3+1:02}'),'problem':problem,'root':root,'change':change,'before':problem,'plant':f'Plant {chr(65+(i//3)%3)}','shop':shop,'equipment':equipment,'kpi':'Scrap Rate','baseline':4.8,'post':2.1,'unit':'%','window':'30 days','benefit':'Quality','owner':'OpEx Lead 05','status':'Approved','evidence':'Synthetic demonstration observation log; no real plant measurements.','lessons':'Check tooling compatibility before deployment.','created':now()})
        for i in range(24):
            state=['Suggested','Review','Feasibility','Planned','Implemented','Validated','Closed','Needs rework'][i%8]
            self.save('hd',{'kaizen_id':i+1,'title':self.all('kaizens')[i]['title'],'plant':f'Plant {chr(65+(i+1)%3)}','shop':cases[i%3][0],'owner':'Plant Coordinator 04','due':'2026-10-15','status':state,'baseline':4.8,'post':2.8 if state in ('Validated','Closed') else None,'improvement':41.67 if state in ('Validated','Closed') else None,'kpi':'Scrap Rate','unit':'%','window':'30 days','history':[{'status':state,'actor':'seed','time':now(),'comment':'Synthetic scenario'}]})
