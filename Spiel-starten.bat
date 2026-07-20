@echo off
setlocal
title Insel der Ruinen - Webapp

cd /d "%~dp0"

echo ==============================================
echo   Insel der Ruinen - Webapp starten
echo ==============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo FEHLER: Node.js wurde nicht gefunden.
  echo Bitte installiere zuerst Node.js von https://nodejs.org/
  echo.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo FEHLER: npm wurde nicht gefunden.
  echo Bitte installiere Node.js erneut und aktiviere npm.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Die benoetigten Pakete werden einmalig installiert ...
  call npm install
  if errorlevel 1 (
    echo.
    echo FEHLER: Die Pakete konnten nicht installiert werden.
    pause
    exit /b 1
  )
  echo.
)

echo Die Webapp wird gestartet.
echo Der Browser oeffnet gleich http://localhost:5173/
echo.
echo Zum Beenden dieses Fenster anklicken und Strg+C druecken.
echo.

start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:5173/'"

call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort

echo.
echo Der Webserver wurde beendet.
pause

