@echo off
title HC Values - Launcher
cd /d "%~dp0"

:: ─────────────────────────────────────────────────────────────────────────────
::  HC Values — One-Click Background Launcher
::  Starts Node.js server + Cloudflare Tunnel silently in the background.
::  Logs are saved to logs\server.log and logs\tunnel.log
:: ─────────────────────────────────────────────────────────────────────────────

:: Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

echo.
echo  ====================================================
echo    HC Values ^| Background Launcher
echo  ====================================================
echo.

:: ── Check Node.js ──────────────────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo  [!] ERROR: Node.js not found. Please install Node.js first.
    echo      https://nodejs.org
    pause
    exit /b 1
)

:: ── Check cloudflared ──────────────────────────────────────────────────────
where cloudflared >nul 2>&1
if errorlevel 1 (
    echo  [!] WARNING: cloudflared not found in PATH.
    echo      Tunnel will NOT be started.
    set "SKIP_TUNNEL=1"
) else (
    set "SKIP_TUNNEL=0"
)

:: ── Kill any existing instances to avoid port conflicts ────────────────────
echo  [*] Stopping any existing server processes...
taskkill /F /FI "WINDOWTITLE eq HC-Values-Server*" >nul 2>&1
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":8000 "') do (
    taskkill /F /PID %%p >nul 2>&1
)
taskkill /F /IM cloudflared.exe >nul 2>&1

timeout /t 1 /nobreak >nul

:: ── Start Node.js server in background (BELOW_NORMAL priority) ─────────────
echo  [*] Starting Node.js server on port 8000...
start "HC-Values-Server" /BELOWNORMAL /MIN cmd /c "node server.js >> logs\server.log 2>&1"

:: Wait briefly and check if the server launched
timeout /t 2 /nobreak >nul
netstat -aon 2>nul | findstr ":8000 " >nul 2>&1
if errorlevel 1 (
    echo  [!] WARNING: Server may not have started yet. Check logs\server.log
) else (
    echo  [+] Server started successfully on http://localhost:8000
)

:: ── Start Cloudflare Tunnel in background ──────────────────────────────────
if "%SKIP_TUNNEL%"=="1" goto skip_tunnel

if exist "config.yml" (
    echo  [*] Starting Cloudflare Tunnel using config.yml...
    start "HC-Values-Tunnel" /BELOWNORMAL /MIN cmd /c "cloudflared tunnel --config config.yml run hcvalue-tunnel >> logs\tunnel.log 2>&1"
    echo  [+] Tunnel started for hcvalue.xyz
) else if exist "cloudflare_token.txt" (
    set /p CF_TOKEN=<cloudflare_token.txt
    echo  [*] Starting Cloudflare Tunnel using saved token...
    start "HC-Values-Tunnel" /BELOWNORMAL /MIN cmd /c "cloudflared tunnel run --token %CF_TOKEN% >> logs\tunnel.log 2>&1"
    echo  [+] Tunnel started via token
) else (
    echo  [!] No config.yml or cloudflare_token.txt found.
    echo      Starting free Quick Tunnel instead...
    start "HC-Values-Tunnel" /BELOWNORMAL /MIN cmd /c "cloudflared tunnel --url http://localhost:8000 >> logs\tunnel.log 2>&1"
    echo  [+] Quick Tunnel started. Check logs\tunnel.log for the public URL.
)

:skip_tunnel

:: ── Done ───────────────────────────────────────────────────────────────────
echo.
echo  ====================================================
echo   Status
echo  ====================================================
echo   Server  : http://localhost:8000
echo   Logs    : %~dp0logs\
echo   Server  : logs\server.log
echo   Tunnel  : logs\tunnel.log
echo.
echo   Run stop_all.bat to shut everything down.
echo  ====================================================
echo.
echo  [*] Both services are running silently in the background.
echo  [*] This window will close in 5 seconds...
ping -n 6 127.0.0.1 >nul
exit /b 0
