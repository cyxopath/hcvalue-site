@echo off
title HC Values - Stop All
cd /d "%~dp0"

echo.
echo  ====================================================
echo    HC Values ^| Stopping All Services
echo  ====================================================
echo.

:: ── Kill Node.js server (by port 8000) ────────────────────────────────────
echo  [*] Stopping Node.js server (port 8000)...
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":8000 "') do (
    taskkill /F /PID %%p >nul 2>&1
)
:: Also kill by window title in case port scan missed it
taskkill /F /FI "WINDOWTITLE eq HC-Values-Server*" >nul 2>&1
echo  [+] Server stopped.

:: ── Kill Cloudflare Tunnel ─────────────────────────────────────────────────
echo  [*] Stopping Cloudflare Tunnel...
taskkill /F /IM cloudflared.exe >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq HC-Values-Tunnel*" >nul 2>&1
echo  [+] Tunnel stopped.

echo.
echo  [+] All HC Values services have been shut down.
echo.
timeout /t 3 /nobreak >nul
exit
