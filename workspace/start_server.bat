@echo off
TITLE SOFTI AI ANALYZER - Professional Server
SETLOCAL EnableDelayedExpansion

echo ===================================================
echo    SOFTI AI ANALYZER - SETUP & STARTUP SCRIPT
echo ===================================================
echo.

:: Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install it from https://nodejs.org/
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
:: Using tsx to run the server directly if it's a full-stack app, 
:: or serving the dist folder if it's a static app.
:: Based on our server.ts setup, we run the server.ts
call npx tsx server.ts
echo.
echo [WARNING] Server stopped or crashed. Restarting in 5 seconds...
timeout /t 5
goto run_server
