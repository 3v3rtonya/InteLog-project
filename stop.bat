@echo off
title InteLog MIS - Stopping...
color 0C
setlocal EnableDelayedExpansion

echo.
echo  ============================================================
echo   InteLog MIS  -  Shutting Down All Services
echo  ============================================================
echo.

echo [1/3] Stopping backend (port 8000)...
set "FOUND=0"
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    if not "%%p"=="" if not "%%p"=="0" (
        taskkill /PID %%p /T /F >nul 2>nul
        set "FOUND=1"
        echo   Killed PID %%p
    )
)
taskkill /FI "IMAGENAME eq uvicorn.exe" /T /F >nul 2>nul
if "!FOUND!"=="0"  echo   Backend was not running.
echo.

echo [2/3] Stopping frontend (ports 5173-5175)...
set "FOUND=0"
for %%port in (5173 5174 5175) do (
    for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":%%port " ^| findstr "LISTENING"') do (
        if not "%%p"=="" if not "%%p"=="0" (
            taskkill /PID %%p /T /F >nul 2>nul
            set "FOUND=1"
            echo   Killed PID %%p on port %%port
        )
    )
)
if "!FOUND!"=="0"  echo   Frontend was not running.
echo.

echo [3/3] Sweeping orphaned node/vite processes...
powershell -NoProfile -Command "$procs=Get-WmiObject Win32_Process|Where-Object{$_.Name -eq 'node.exe' -and $_.CommandLine -like '*vite*'};if($procs){foreach($p in $procs){Stop-Process -Id $p.ProcessId -Force -EA SilentlyContinue;Write-Host('  Killed node/vite PID '+$p.ProcessId)}}else{Write-Host '  None found.'}"
echo.

echo  ============================================================
echo   All services stopped.
echo  ============================================================
echo.
pause
endlocal
