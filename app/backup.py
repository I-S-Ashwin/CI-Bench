"""Create a consistent SQLite snapshot; restore to a new path to avoid overwrites."""
import argparse
import sqlite3
from contextlib import closing
from pathlib import Path

def main():
    p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('destination');a=p.parse_args()
    src,dst=Path(a.source).resolve(),Path(a.destination).resolve()
    if not src.is_file():p.error('Source database does not exist')
    if dst.exists():p.error('Destination already exists; choose a new filename')
    dst.parent.mkdir(parents=True,exist_ok=True)
    with closing(sqlite3.connect(f'{src.as_uri()}?mode=ro',uri=True)) as s,closing(sqlite3.connect(dst)) as d:
        s.backup(d)
        if d.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise RuntimeError('Integrity check failed')
    print(f'Verified snapshot: {dst}')

if __name__=='__main__':main()
