# Windows: Python Launcher (py) — use this folder as cwd
Set-Location $PSScriptRoot
py -3.10 -m pip install --no-deps -r requirements.txt -q
py -3.10 app.py