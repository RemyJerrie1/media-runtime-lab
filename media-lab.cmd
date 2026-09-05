@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0media-lab.ps1" %*
exit /b %ERRORLEVEL%
