@echo off
title InteLog MIS v2.0 - Startup
color 0A
setlocal EnableDelayedExpansion

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo.
echo  ============================================================
echo   InteLog MIS v2.0
echo   Dedan Kimathi University of Technology
echo  ============================================================
echo.

:: ── 1. Locate Python ─────────────────────────────────────────────────────
echo [1/5] Checking Python...
set "PY_CMD="

if exist "C:\Python314\python.exe" ( set "PY_CMD=C:\Python314\python.exe" & goto :py_found )
if exist "C:\Python313\python.exe" ( set "PY_CMD=C:\Python313\python.exe" & goto :py_found )
if exist "C:\Python312\python.exe" ( set "PY_CMD=C:\Python312\python.exe" & goto :py_found )
if exist "C:\Python311\python.exe" ( set "PY_CMD=C:\Python311\python.exe" & goto :py_found )
if exist "C:\Windows\py.exe"       ( set "PY_CMD=C:\Windows\py.exe"       & goto :py_found )
python --version >nul 2>&1 && ( set "PY_CMD=python" & goto :py_found )
py     --version >nul 2>&1 && ( set "PY_CMD=py"     & goto :py_found )

echo   ERROR: Python not found. Install Python 3.11+ from https://www.python.org/
pause & exit /b 1

:py_found
for /f "tokens=*" %%v in ('"!PY_CMD!" --version 2^>^&1') do echo   Found: %%v
echo.

:: ── 2. Locate Node.js ────────────────────────────────────────────────────
echo [2/5] Checking Node.js...
set "NPM_CMD="

if exist "C:\Program Files\nodejs\npm.cmd" (
    set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
    for /f "tokens=*" %%v in ('"C:\Program Files\nodejs\node.exe" --version 2^>^&1') do echo   Found: Node %%v
    goto :node_found
)
if exist "C:\ProgramData\chocolatey\bin\npm.cmd" (
    set "NPM_CMD=C:\ProgramData\chocolatey\bin\npm.cmd"
    goto :node_found
)
where npm >nul 2>&1 && ( set "NPM_CMD=npm" & goto :node_found )

echo   WARNING: Node.js not found. Frontend will not start.
echo   Install from https://nodejs.org/ then re-run start.bat.
set "FRONTEND_READY=0"
goto :node_checked

:node_found
:: ── 3. Check / install frontend packages ─────────────────────────────────
echo [3/5] Checking frontend packages...
set "FRONTEND_READY=0"
if not exist "%ROOT%\frontend\package.json" ( echo   No frontend. Skipping. & goto :node_checked )
if not exist "%ROOT%\frontend\node_modules\.bin\vite.cmd" (
    echo   Running npm install (first time — may take a minute^)...
    pushd "%ROOT%\frontend"
    "!NPM_CMD!" install --silent
    if errorlevel 1 ( echo   ERROR: npm install failed. & popd & pause & exit /b 1 )
    popd
    echo   Packages installed.
) else (
    echo   Frontend packages OK.
)
set "FRONTEND_READY=1"
echo.

:node_checked

:: ── 4. Start PostgreSQL ───────────────────────────────────────────────────
echo [4/5] Starting PostgreSQL...
set "PG_STARTED=0"
call :try_pg "postgresql-x64-18"
call :try_pg "postgresql-x64-17"
call :try_pg "postgresql-x64-16"
call :try_pg "postgresql-x64-15"
call :try_pg "postgresql-14"
call :try_pg "postgresql-13"
call :try_pg "postgresql"
if "!PG_STARTED!"=="0" (
    echo   WARNING: No PostgreSQL service found. Make sure it is running.
)
echo.

:: ── 5. Kill orphans then launch ───────────────────────────────────────────
echo [5/5] Launching services...
echo   Clearing any previous instances...

:: Kill by port 8000
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr " :8000 " ^| findstr "LISTENING"') do (
    if "%%a" NEQ "" if "%%a" NEQ "0" ( taskkill /PID %%a /T /F >nul 2>&1 )
)
:: Kill by port 5173
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr " :5173 " ^| findstr "LISTENING"') do (
    if "%%a" NEQ "" if "%%a" NEQ "0" ( taskkill /PID %%a /T /F >nul 2>&1 )
)
:: Kill orphaned uvicorn workers
taskkill /FI "IMAGENAME eq uvicorn.exe" /T /F >nul 2>&1
timeout /t 2 /nobreak >nul

:: ── Launch Backend ────────────────────────────────────────────────────────
echo   Starting Backend  (http://localhost:8000^)...
start "InteLog - Backend" /D "%ROOT%" "%COMSPEC%" /k ""!PY_CMD!" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

:: Wait for backend to actually respond (up to 30 s) instead of blind sleep
echo   Waiting for backend...
set "BE_READY=0"
for /l %%i in (1,1,30) do (
    if "!BE_READY!"=="0" (
        timeout /t 1 /nobreak >nul
        curl -s --max-time 1 http://localhost:8000/health >nul 2>&1
        if not errorlevel 1 ( set "BE_READY=1" )
    )
)
if "!BE_READY!"=="1" (
    echo   Backend ready.
) else (
    echo   WARNING: Backend did not respond in 30 s. Check the Backend window for errors.
)

:: ── Launch Frontend ───────────────────────────────────────────────────────
if "!FRONTEND_READY!"=="1" (
    echo   Starting Frontend (http://localhost:5173^)...
    start "InteLog - Frontend" /D "%ROOT%\frontend" "%COMSPEC%" /k ""!NPM_CMD!" run dev"
    :: Wait for Vite to bind
    set "FE_READY=0"
    for /l %%i in (1,1,20) do (
        if "!FE_READY!"=="0" (
            timeout /t 1 /nobreak >nul
            curl -s --max-time 1 http://localhost:5173/ >nul 2>&1
            if not errorlevel 1 ( set "FE_READY=1" )
        )
    )
    if "!FE_READY!"=="1" ( echo   Frontend ready. ) else ( echo   WARNING: Frontend slow to start. )
) else (
    echo   Frontend skipped.
)
echo.

:: ── Summary ──────────────────────────────────────────────────────────────
echo  ============================================================
echo   InteLog MIS is running!
echo.
echo   Backend API  :  http://localhost:8000
echo   API Docs     :  http://localhost:8000/docs
if "!FRONTEND_READY!"=="1" echo   Frontend App :  http://localhost:5173
echo.
echo   Admin login  :  admin@mis.local  /  Admin@123
echo   Run stop.bat to shut everything down cleanly.
echo  ============================================================
echo.

:: ── Open browser ─────────────────────────────────────────────────────────
set "BROWSER_URL=http://localhost:8000/docs"
if "!FRONTEND_READY!"=="1" set "BROWSER_URL=http://localhost:5173"
echo   Opening browser at !BROWSER_URL!...
%SystemRoot%\System32\cmd.exe /c start "" "!BROWSER_URL!"

endlocal
goto :eof

:try_pg
if "!PG_STARTED!"=="1" goto :eof
sc query %1 >nul 2>&1
if errorlevel 1 goto :eof
net start %1 >nul 2>&1
set "PG_STARTED=1"
echo   PostgreSQL service %1 started (or already running^).
goto :eof
