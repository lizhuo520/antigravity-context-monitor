@echo off
chcp 65001 >nul
title Antigravity 监控 - 一键还原官方原生
cd /d "%~dp0"

echo ======================================================
echo    Antigravity Context Monitor - 原生补丁还原
echo ======================================================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js (https://nodejs.org)。
    pause
    exit /b 1
)

echo [提示] 正在剥离原生内嵌挂件补丁...
echo.
node scripts\restore-native.js

echo.
pause
