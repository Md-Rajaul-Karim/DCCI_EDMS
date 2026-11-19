@echo off
title DCCI EDMS - Backend API (.NET 8)
cd /d "%~dp0\edms_api"
echo Starting DCCI EDMS Backend API on http://0.0.0.0:5162 (Accessible via localhost and Office LAN) ...
dotnet run --urls "http://0.0.0.0:5162"
pause
