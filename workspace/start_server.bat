@echo off
TITLE SOFTI AI ANALYZER - Professional Server
SETLOCAL EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%.."
set "LOG_DIR=%CD%\logs"
set "LOG_FILE=%LOG_DIR%\server.log"

echo ===================================================
echo    SOFTI AI ANALYZER - SETUP ^& STARTUP SCRIPT
echo ===================================================
echo.

:: Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install it from https://nodejs.org/
    pause
    exit /b
)

:: Check if .env exists in project root
if not exist ".env" (
    echo [ERROR] Missing .env file in project root.
    echo Create .env with VITE_GEMINI_API_KEY before starting the server.
    pause
    exit /b
)

:: Ensure log directory exists
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: Rotate log if larger than 5 MB
if exist "%LOG_FILE%" (
    powershell -NoProfile -Command "$f = Get-Item '%LOG_FILE%'; if ($f.Length -ge 5MB) { $ts = Get-Date -Format 'yyyyMMdd_HHmmss'; Rename-Item -Path '%LOG_FILE%' -NewName ('server_' + $ts + '.log') }"
)

powershell -NoProfile -Command "Add-Content -Path '%LOG_FILE%' -Value ('===== START ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' =====')"

:: Prevent duplicate server instances
powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($c) { exit 1 } else { exit 0 }"
if %errorlevel% neq 0 (
    echo [ERROR] Port 3000 is already in use.
    echo Close the existing process and run this script again.
    pause
    exit /b
)

:: Step 1: Install Dependencies
echo [1/3] Checking and installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b
)

:: Step 2: Build the Application
echo [2/3] Building the application for production...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed.
    pause
    exit /b
)

:: Step 3: Start the Server
echo [3/3] Starting SOFTI AI ANALYZER Server...
echo.
echo Server is running on http://localhost:3000
echo Keep this window open to maintain the connection with MT5.
echo.

:run_server
call npm run dev >> "%LOG_FILE%" 2>&1
echo.
echo [WARNING] Server stopped or crashed. Restarting in 5 seconds...
echo [INFO] Details in %LOG_FILE%
echo [WARNING] Server stopped or crashed. Restarting in 5 seconds...>> "%LOG_FILE%"
powershell -NoProfile -Command "Add-Content -Path '%LOG_FILE%' -Value ('===== RESTART ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' =====')"
ping 127.0.0.1 -n 6 >nul
goto run_server
