@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0MAKE-FINAL-RELEASE-v1.2.1.ps1"
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" echo FAILED: %ERR%
exit /b %ERR%
