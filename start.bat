@echo off
title InteLog MIS - Starting...
color 0A
setlocal EnableDelayedExpansion

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo.
echo  ============================================================
echo   InteLog MIS v2.0 - Dedan Kimathi University of Technology
echo  ============================================================
echo.

:: 1. FIND PYTHON
echo [1/5] Locating Python...
set "PY="
if exist "C:\Python314\python.exe"  set "PY=C:\Python314\python.exe"
if not defined PY if exist "C:\Python313\python.exe"  set "PY=C:\Python313\python.exe"
if not defined PY if exist "C:\Python312\python.exe"  set "PY=C:\Python312\python.exe"
if not defined PY if exist "C:\Python311\python.exe"  set "PY=C:\Python311\python.exe"
if not defined PY if exist "C:\Windows\py.exe"        set "PY=C:\Windows\py.exe"
if not defined PY (
    where python >nul 2>nul
    if not errorlevel 1 set "PY=python"
)
if not defined PY (
    echo   ERROR: Python not found.
    pause & exit /b 1
)
set "PYVER="
for /f "tokens=*" %%v in ('"!PY!" --version') do set "PYVER=%%v"
echo   Found: !PYVER!

:: 2. FIND NPM
echo.
echo [2/5] Locating Node.js / npm...
set "NPM="
if exist "C:\Program Files\nodejs\npm.cmd"  set "NPM=C:\Program Files\nodejs\npm.cmd"
if not defined NPM if exist "C:\ProgramData\chocolatey\bin\npm.cmd"  set "NPM=C:\ProgramData\chocolatey\bin\npm.cmd"
if not defined NPM (
    where npm >nul 2>nul
    if not errorlevel 1 set "NPM=npm"
)
set "HAVE_FE=0"
if not defined NPM (
    echo   WARNING: npm not found - frontend skipped.
    goto :check_py_pkg
)
set "NODEVER="
for /f "tokens=*" %%v in ('node --version') do set "NODEVER=%%v"
echo   Found: Node !NODEVER!
if not exist "%ROOT%\frontend\node_modules\.bin\vite.cmd" (
    echo   Running npm install...
    pushd "%ROOT%\frontend"
    "!NPM!" install
    if errorlevel 1 ( echo   ERROR: npm install failed. & popd & pause & exit /b 1 )
    popd
)
set "HAVE_FE=1"

:: 3. PYTHON PACKAGES
:: Sentinel file .pkg_ok skips the slow package import check on repeat runs.
:: Delete it from the project folder to force a fresh check.
:check_py_pkg
echo.
echo [3/5] Checking Python packages...
set "SENTINEL=%ROOT%\.pkg_ok"
if exist "!SENTINEL!" (
    echo   Packages OK - cached.
    goto :pg_start
)
"!PY!" -c "import uvicorn,fastapi,sqlalchemy,psycopg,dotenv,pydantic_settings,torch,transformers" >nul 2>nul
if errorlevel 1 (
    echo   Installing from requirements.txt - first run only...
    "!PY!" -m pip install -r "%ROOT%\backend\requirements.txt"
    if errorlevel 1 ( echo   ERROR: pip install failed. & pause & exit /b 1 )
)
echo.> "!SENTINEL!"
echo   Packages OK.

:: 4. POSTGRESQL
:pg_start
echo.
echo [4/5] Starting PostgreSQL...
set "PG_DONE=0"
for %%s in (postgresql-x64-18 postgresql-x64-17 postgresql-x64-16 postgresql-x64-15 postgresql-14 postgresql-13 postgresql) do (
    if "!PG_DONE!"=="0" (
        sc query "%%s" >nul 2>nul
        if not errorlevel 1 (
            net start "%%s" >nul 2>nul
            set "PG_DONE=1"
            echo   Service %%s is running.
        )
    )
)
if "!PG_DONE!"=="0" echo   WARNING: No PostgreSQL service found.

:: 5. CLEAR PORTS AND LAUNCH
echo.
echo [5/5] Launching services...
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    if not "%%p"=="" if not "%%p"=="0"  taskkill /PID %%p /T /F >nul 2>nul
)
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    if not "%%p"=="" if not "%%p"=="0"  taskkill /PID %%p /T /F >nul 2>nul
)

:: WRITE AND LAUNCH BACKEND
echo   Starting backend...
set "BE=%TEMP%\intelog_backend.bat"
(
    echo @echo off
    echo title InteLog - BACKEND
    echo color 0A
    echo cd /d "!ROOT!"
    echo echo.
    echo echo   InteLog Backend   http://localhost:8000
    echo echo   Press Ctrl+C to stop.
    echo echo.
    echo !PY! -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
    echo pause
) > "!BE!"
start "InteLog - BACKEND" cmd /k "!BE!"

:: Single PowerShell process polls backend in tight loop - no 90-spawn overhead
echo   Waiting for backend...
powershell -NoProfile -Command "for($i=0;$i -lt 60;$i++){Start-Sleep -Milliseconds 800;try{$t=New-Object Net.Sockets.TcpClient;$t.Connect('127.0.0.1',8000);$t.Close();exit 0}catch{}};exit 1" >nul 2>nul
if not errorlevel 1 goto :be_up
echo   WARNING: Backend slow - check InteLog-BACKEND window.
goto :launch_fe

:be_up
echo   Backend is UP.
:: AI model warms in background - startup does NOT wait for it
start "" /B powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 3;try{$null=Invoke-WebRequest 'http://localhost:8000/assess/warmup' -UseBasicParsing -TimeoutSec 120}catch{}"

:: WRITE AND LAUNCH FRONTEND
:launch_fe
if not "!HAVE_FE!"=="1" goto :summary
set "FE=%TEMP%\intelog_frontend.bat"
(
    echo @echo off
    echo title InteLog - FRONTEND
    echo color 0B
    echo cd /d "!ROOT!\frontend"
    echo echo.
    echo echo   InteLog Frontend  http://localhost:5173
    echo echo   Press Ctrl+C to stop.
    echo echo.
    echo "!NPM!" run dev
    echo pause
) > "!FE!"
echo.
echo   Starting frontend...
start "InteLog - FRONTEND" cmd /k "!FE!"

:: Single PowerShell process polls frontend
echo   Waiting for frontend...
powershell -NoProfile -Command "for($i=0;$i -lt 40;$i++){Start-Sleep -Milliseconds 800;try{$t=New-Object Net.Sockets.TcpClient;$t.Connect('127.0.0.1',5173);$t.Close();exit 0}catch{}};exit 1" >nul 2>nul
if not errorlevel 1 ( echo   Frontend is UP. ) else ( echo   Frontend slow - check InteLog-FRONTEND window. )

:summary
echo.
echo  ============================================================
echo   InteLog MIS is RUNNING
echo   Backend  :  http://localhost:8000
if "!HAVE_FE!"=="1" echo   Frontend :  http://localhost:5173
echo   Run stop.bat to shut down.
echo  ============================================================
echo.
set "URL=http://localhost:8000/docs"
if "!HAVE_FE!"=="1" set "URL=http://localhost:5173"
start "" "!URL!"
echo.
pause
endlocal
