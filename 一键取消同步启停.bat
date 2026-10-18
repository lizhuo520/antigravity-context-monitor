@echo off
chcp 65001 >nul
title Antigravity 监控 - 取消同步启停
cd /d "%~dp0"

echo ======================================================
echo    Antigravity Context Monitor - 取消同步启停
echo ======================================================
echo.

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "TARGET_VBS=%STARTUP_DIR%\AntigravityContextMonitor.vbs"

if exist "%TARGET_VBS%" (
    echo [1/2] 正在清理开机自启项...
    del /f /q "%TARGET_VBS%"
    echo 已删除: %TARGET_VBS%
) else (
    echo [1/2] 未检测到开机自启项。
)

echo [2/2] 正在停止后台运行中的监控守护进程...
powershell -NoProfile -Command "Unregister-ScheduledTask -TaskName 'AntigravityContextMonitor' -Confirm:$false -ErrorAction SilentlyContinue" >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object CommandLine -like '*daemon.js*' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"

echo.
echo ======================================================
echo  ✅ 已成功取消同步启停并停止后台守护进程！
echo ======================================================
echo.
pause
