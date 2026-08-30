@echo off
title HC Values - Cloudflare Tunnel Launcher
cd /d "%~dp0"

echo ===================================================
echo   HC Values - Cloudflare Tunnel Launcher
echo ===================================================
echo.

set "TOKEN_FILE=cloudflare_token.txt"
set "LOCAL_CONFIG=config.yml"
set "USER_CONFIG=%USERPROFILE%\.cloudflared\config.yml"
set "TOKEN="

if exist "%TOKEN_FILE%" (
    set /p TOKEN=<"%TOKEN_FILE%"
)

rem Check if local config exists
set "HAS_CONFIG=0"
if exist "%LOCAL_CONFIG%" set "HAS_CONFIG=1"
if exist "%USER_CONFIG%" set "HAS_CONFIG=1"

:menu
if "%HAS_CONFIG%"=="1" goto menu_with_config
if not "%TOKEN%"=="" goto menu_with_token
goto menu_no_config_no_token

:menu_with_config
echo [1] Start tunnel using local config.yml (hcvalue.xyz)
if not "%TOKEN%"=="" echo [2] Start tunnel using saved token
echo [3] Start a free Quick Tunnel (No domain required)
echo [4] Run local tunnel setup again
echo [5] Start a free Quick Tunnel for Maintenance (Port 8080)
echo.
set /p choice="Select an option (1, 2, 3, 4, or 5): "
if "%choice%"=="1" goto run_local_config
if "%choice%"=="2" goto check_saved_token
if "%choice%"=="3" goto run_quick_tunnel
if "%choice%"=="4" goto run_setup
if "%choice%"=="5" goto run_maintenance_tunnel
goto invalid_choice

:check_saved_token
if not "%TOKEN%"=="" goto run_saved_token
goto invalid_choice

:menu_with_token
echo [1] Start tunnel using saved token
echo [2] Start a free Quick Tunnel (No domain required)
echo [3] Setup a local secure tunnel for hcvalue.xyz
echo [5] Start a free Quick Tunnel for Maintenance (Port 8080)
echo.
set /p choice="Select an option (1, 2, 3, or 5): "
if "%choice%"=="1" goto run_saved_token
if "%choice%"=="2" goto run_quick_tunnel
if "%choice%"=="3" goto run_setup
if "%choice%"=="5" goto run_maintenance_tunnel
goto invalid_choice

:menu_no_config_no_token
echo [1] Setup a local secure tunnel for hcvalue.xyz (Recommended)
echo [2] Start a free Quick Tunnel (No domain required)
echo [3] Enter a Cloudflare Tunnel token
echo [5] Start a free Quick Tunnel for Maintenance (Port 8080)
echo.
set /p choice="Select an option (1, 2, 3, or 5): "
if "%choice%"=="1" goto run_setup
if "%choice%"=="2" goto run_quick_tunnel
if "%choice%"=="3" goto enter_token
if "%choice%"=="5" goto run_maintenance_tunnel
goto invalid_choice

:run_local_config
echo.
echo Starting Cloudflare Tunnel using local config.yml...
if exist "%LOCAL_CONFIG%" (
    cloudflared tunnel --config "%LOCAL_CONFIG%" run hcvalue-tunnel
) else (
    cloudflared tunnel run
)
goto end

:run_saved_token
echo.
echo Starting Cloudflare Tunnel using saved token...
cloudflared tunnel run --token %TOKEN%
goto end

:run_quick_tunnel
echo.
echo Starting free Cloudflare Quick Tunnel...
echo Copy the public URL generated below (looks like https://*.trycloudflare.com)
echo.
cloudflared tunnel --url http://localhost:8000
goto end

:run_maintenance_tunnel
echo.
echo Configuring tunnel for Maintenance Mode (hcvalue.xyz -> Port 8080)...
if exist "%LOCAL_CONFIG%" (
    powershell -NoProfile -Command "(Get-Content config.yml) -replace ':8000', ':8080' | Set-Content config-maintenance.yml"
    echo Starting Cloudflare Tunnel using local config-maintenance.yml...
    cloudflared tunnel --config config-maintenance.yml run hcvalue-tunnel
) else (
    echo No local config.yml found. Starting free Quick Tunnel...
    echo Copy the public URL generated below (looks like https://*.trycloudflare.com)
    echo.
    cloudflared tunnel --url http://localhost:8080
)
goto end

:run_setup
echo.
echo Running setup_tunnel.ps1 to configure your local tunnel...
powershell -NoProfile -ExecutionPolicy Bypass -File setup_tunnel.ps1
goto end

:enter_token
echo.
set /p TOKEN="Enter your Cloudflare Tunnel Token: "
if not "%TOKEN%"=="" (
    echo %TOKEN% > "%TOKEN_FILE%"
    echo Token saved.
    goto run_saved_token
)
echo No token entered.
goto menu

:invalid_choice
echo Invalid choice. Please try again.
echo.
goto menu

:end
pause
