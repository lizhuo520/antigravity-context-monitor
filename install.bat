@echo off
chcp 65001 >nul
title Antigravity Context Monitor Injector

echo ======================================================
echo    Antigravity Context & Session Monitor Injector
echo ======================================================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js (https://nodejs.org)。
    pause
    exit /b 1
)

echo [1/2] 正在注入监控组件到 Antigravity 客户端...
node src/injector.js

echo.
echo ======================================================
echo  注入完成！若需保持自动常驻注入，可运行: npm run daemon
echo ======================================================
echo.
pause
