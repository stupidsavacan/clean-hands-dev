@echo off
rem CLEAN HANDS: start every local check server (8795-8798) in this one window. Close the window to stop them.
cd /d "%~dp0"
set PY=python
if exist "C:\Users\gamit\AppData\Local\Programs\Python\Python311\python.exe" set PY="C:\Users\gamit\AppData\Local\Programs\Python\Python311\python.exe"
start "" http://127.0.0.1:8795/club
%PY% tools\dev-servers.py
pause
