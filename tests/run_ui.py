"""Run React DOM checks with an isolated, short-lived API server and database."""
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen

ROOT=Path(__file__).resolve().parents[1]

def main():
    node=shutil.which('node')
    if not node:raise SystemExit('Node.js is required for UI tests. Install Node and run npm ci.')
    if not (ROOT/'node_modules/jsdom/package.json').is_file():raise SystemExit('UI dependencies are missing. Run npm ci first.')
    with socket.socket() as probe:
        probe.bind(('127.0.0.1',0));port=probe.getsockname()[1]
    origin=f'http://127.0.0.1:{port}'
    with tempfile.TemporaryDirectory(prefix='ci-bench-ui-') as temp:
        process=subprocess.Popen([sys.executable,'-m','app.server','--port',str(port),'--db',str(Path(temp)/'demo.sqlite3')],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        try:
            for _ in range(100):
                if process.poll() is not None:raise RuntimeError('Temporary API server exited before becoming ready')
                try:
                    with urlopen(origin+'/api/v1/health',timeout=1) as response:
                        if response.status==200:break
                except OSError:time.sleep(.1)
            else:raise RuntimeError('Temporary API server did not become ready')
            return subprocess.run([node,'tests/react-smoke.cjs'],cwd=ROOT,env={**os.environ,'CI_TEST_ORIGIN':origin},check=False).returncode
        finally:
            process.terminate()
            try:process.wait(timeout=5)
            except subprocess.TimeoutExpired:process.kill();process.wait()

if __name__=='__main__':raise SystemExit(main())
