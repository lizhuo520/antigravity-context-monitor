@echo off
chcp 65001 >nul
title 创建 Antigravity (带监控) 快捷方式
cd /d "%~dp0"

echo 正在桌面创建 [Antigravity (Monitor)] 伴生快捷方式...

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\make_shortcut.ps1"

echo.
echo ✅ 已在桌面生成快捷方式: Antigravity (Monitor).lnk
echo 双击此快捷方式即可同步启动 Antigravity 与监控挂件，关闭客户端时监控自动完全退出！
echo.
pause
