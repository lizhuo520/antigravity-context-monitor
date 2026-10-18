@echo off
chcp 65001 >nul
title Antigravity 监控 - 配置同步启停
cd /d "%~dp0"

echo ======================================================
echo    Antigravity Context Monitor - 配置同步启停
echo ======================================================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js (https://nodejs.org)。
    pause
    exit /b 1
)

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "TARGET_VBS=%STARTUP_DIR%\AntigravityContextMonitor.vbs"

echo [1/3] 正在配置 Windows 开机静默同步服务...
(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo Set fso = CreateObject^("Scripting.FileSystemObject"^)
    echo projectDir = "%~dp0"
    echo nodeExe = "C:\Program Files\nodejs\node.exe"
    echo If Not fso.FileExists^(nodeExe^) Then nodeExe = "node"
    echo WshShell.CurrentDirectory = projectDir
    echo WshShell.Run """" ^& nodeExe ^& """ """ ^& projectDir ^& "src\daemon.js"" --silent", 0, False
) > "%TARGET_VBS%"

echo [2/3] 已写入开机自启项: %TARGET_VBS%
powershell -NoProfile -Command "$a = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument '\"%~dp0scripts\run-silent.vbs\"' -WorkingDirectory '%~dp0'; $t = New-ScheduledTaskTrigger -AtLogOn; Register-ScheduledTask -TaskName 'AntigravityContextMonitor' -Action $a -Trigger $t -Force" >nul 2>&1

echo [3/3] 正在启动后台监控守护进程...
powershell -NoProfile -Command "Start-ScheduledTask -TaskName 'AntigravityContextMonitor' -ErrorAction SilentlyContinue" >nul 2>&1
wscript.exe "%~dp0scripts\run-silent.vbs"

echo.
echo ======================================================
echo  ✅ 配置成功！
echo  从现在起，只要启动 Antigravity，监控挂件便会自动注入；
echo  Antigravity 退出后，监控服务将自动转入低功耗待命，完全同步！
echo ======================================================
echo.
pause
