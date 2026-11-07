@echo off
cd /d "%~dp0"
start "" http://127.0.0.1:8795/
"C:\Users\gamit\AppData\Local\Programs\Python\Python311\python.exe" server.py
pause
