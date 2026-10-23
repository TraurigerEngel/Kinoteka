@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0FREEZE-CANONICAL-DATA.ps1" %*
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" echo CANONICAL DATA FREEZE FAILED. Error code: %ERR%
exit /b %ERR%
