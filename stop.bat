@echo off
title InteLog MIS - Shutdown
color 0C
setlocal EnableDelayedExpansion

echo.
echo  ============================================================
echo   InteLog MIS v2.0 - Stopping All Services
echo  ============================================================
echo.

:: ── 1. Kill by port 8000 (backend) ───────────────────────────────────────
echo [1/4] Stopping Backend (port 8000)...
set "FOUND=0"
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr " :8000 " ^| findstr "LISTENING"') do (
    if "%%a" NEQ "" if "%%a" NEQ "0" (
        taskkill /PID %%a /T /F >nul 2>&1
        set "FOUND=1"
        echo   Killed PID %%a on port 8000.
    )
)
if "!FOUND!"=="0" echo   Backend was not running.
echo.

:: ── 2. Kill by ports 5173-5175 (frontend/Vite) ───────────────────────────
echo [2/4] Stopping Frontend (ports 5173-5175)...
set "FOUND=0"
for %%p in (5173 5174 5175) do (
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr " :%%p " ^| findstr "LISTENING"') do (
        if "%%a" NEQ "" if "%%a" NEQ "0" (
            taskkill /PID %%a /T /F >nul 2>&1
            set "FOUND=1"
            echo   Killed PID %%a on port %%p.
        )
    )
)
if "!FOUND!"=="0" echo   Frontend was not running.
echo.

:: ── 3. Kill orphaned image-name processes ────────────────────────────────
echo [3/4] Killing orphaned processes...
taskkill /FI "IMAGENAME eq uvicorn.exe" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq InteLog - Backend"  /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq InteLog - Frontend" /T /F >nul 2>&1
echo   Done.
echo.

:: ── 4. Kill node.exe running vite (use PowerShell — wmic is deprecated) ──
echo [4/4] Sweeping node/vite processes...
powershell -NoProfile -Command "$procs = Get-WmiObject Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*vite*' }; foreach ($p in $procs) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host ('  Killed node/vite PID ' + $p.ProcessId) }; if (-not $procs) { Write-Host '  No orphaned node/vite processes found.' }"
echo.

echo  ============================================================
echo   All InteLog services stopped.
echo  ============================================================
echo.
pause
endlocal
