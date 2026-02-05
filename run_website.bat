@echo off
title EasyJob Server
echo Starting web server...
cd /d "%~dp0"
start "" "http://127.0.0.1:8000/index.html"
python server.py
pause
