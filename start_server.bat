@echo off
rem Change directory to the location of this script
cd /d "%~dp0"

rem Start the Node.js server on port 8000
node server.js

rem Keep the window open after the server stops
pause
