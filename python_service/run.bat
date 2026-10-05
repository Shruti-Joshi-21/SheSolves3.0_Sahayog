@echo off
cd /d "%~dp0"
py -3.10 -m pip install --no-deps -r requirements.txt -q
py -3.10 app.py