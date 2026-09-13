"""Back up/restore SQLite plus referenced immutable media. No overwrite."""
import argparse
import hashlib
import json
import sqlite3
import tempfile
import zipfile
from contextlib import closing
from pathlib import Path

def backup(source,destination):
    source,destination=Path(source).resolve(),Path(destination).resolve()
    if not source.is_file() or destination.exists():raise ValueError('Source must exist and destination must be new')
    destination.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        snapshot=Path(td)/'demo.sqlite3'
        with closing(sqlite3.connect(source)) as src,closing(sqlite3.connect(snapshot)) as dst:src.backup(dst)
        with closing(sqlite3.connect(snapshot)) as c:media=[json.loads(r[0]) for r in c.execute("SELECT data FROM records WHERE kind='media'")]
        with zipfile.ZipFile(destination,'x',zipfile.ZIP_DEFLATED) as z:
            z.write(snapshot,'demo.sqlite3')
            for m in {m['key']:m for m in media}.values():
                file=source.parent/'evidence'/m['key']
                if hashlib.sha256(file.read_bytes()).hexdigest()!=m['sha256']:raise ValueError('Evidence hash mismatch')
                z.write(file,'evidence/'+m['key'])

def restore(source,destination):
    source,destination=Path(source).resolve(),Path(destination).resolve()
    if destination.exists():raise ValueError('Restore directory must be new')
    with zipfile.ZipFile(source) as z:
        for info in z.infolist():
            if info.filename!='demo.sqlite3' and not (info.filename.startswith('evidence/') and len(info.filename)==49 and all(ch in '0123456789abcdef' for ch in info.filename[9:])):raise ValueError('Invalid archive path')
            if info.file_size>100*1024*1024:raise ValueError('Archive entry is too large')
        if sum(i.file_size for i in z.infolist())>1024*1024*1024:raise ValueError('Archive is too large')
        destination.mkdir(parents=True)
        for info in z.infolist():
            output=destination/info.filename;output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(z.read(info))
    with closing(sqlite3.connect(destination/'demo.sqlite3')) as c:
        if c.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('Database integrity check failed')
        for (raw,) in c.execute("SELECT data FROM records WHERE kind='media'"):
            m=json.loads(raw)
            if hashlib.sha256((destination/'evidence'/m['key']).read_bytes()).hexdigest()!=m['sha256']:raise ValueError('Restored media hash mismatch')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('mode',choices=['backup','restore']);p.add_argument('source');p.add_argument('destination');a=p.parse_args()
    (backup if a.mode=='backup' else restore)(a.source,a.destination);print('Verified '+a.mode+' complete')
