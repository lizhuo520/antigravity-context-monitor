@echo off
chcp 65001 >nul
title Antigravity 监控 - 一键开启原生无感注入
cd /d "%~dp0"

echo ======================================================
echo    Antigravity Context Monitor - 原生内嵌注入 (方案 A)
echo ======================================================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js (https://nodejs.org)。
    pause
    exit /b 1
)

echo [提示] 正在执行 Electron 原生补丁注入...
echo.
node scripts\patch-native.js

echo.
pause
