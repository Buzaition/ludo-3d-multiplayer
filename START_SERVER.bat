@echo off
setlocal
cd /d "%~dp0"
title Ludo 3D Multiplayer Server

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not available in PATH.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules\express" (
  echo Installing dependencies for the first run...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"
echo.
echo Ludo 3D server is starting...
echo Open: http://localhost:3000
echo Press Ctrl+C to stop the server.
echo.
call npm start
pause
