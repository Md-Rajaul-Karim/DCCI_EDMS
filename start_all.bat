@echo off
title Launch DCCI EDMS System
echo Launching DCCI EDMS Backend and Frontend...
start "DCCI EDMS API (.NET)" cmd /c "%~dp0run_backend.bat"
timeout /t 3 /nobreak >nul
start "DCCI EDMS React UI" cmd /c "%~dp0run_frontend.bat"
echo System started!
echo API URL: http://localhost:5162/swagger
echo Frontend UI: http://localhost:3000
