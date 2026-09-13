@echo off
cd /d "%~dp0"
echo CI-BENCH local demonstration
echo Open http://127.0.0.1:8765 after the server starts.
echo Keep this window open. Press Ctrl+C to stop the server.
python -m app.server
pause
