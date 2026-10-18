import fs from 'fs';
import { execSync } from 'child_process';
import { injectWidget, getDevToolsPortFile } from './injector.js';

const exitWithApp = process.argv.includes('--exit-with-app') || process.argv.includes('--sync');
const isSilent = process.argv.includes('--silent');

function log(...args) {
  if (!isSilent) {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}]`, ...args);
  }
}

function checkProcessRunning() {
  try {
    const stdout = execSync('tasklist /FI "IMAGENAME eq Antigravity.exe" /NH', { encoding: 'utf-8', windowsHide: true });
    return stdout.includes('Antigravity.exe');
  } catch (_) {
    return false;
  }
}

let hasStarted = false;
let wasRunning = false;
let injectionSuccess = false;
let startupAttempts = 0;

log('🚀 Antigravity 监控同步启停服务已启动...');
if (exitWithApp) {
  log('⚡ 运行模式: [伴生同步模式] - 与 Antigravity 进程严格同生共死');
} else {
  log('⚡ 运行模式: [开机静默守护模式] - 持续监测 Antigravity 生命周期');
}

async function loop() {
  const isRunning = checkProcessRunning();

  if (isRunning) {
    hasStarted = true;
    startupAttempts = 0;

    if (!wasRunning) {
      log('🟢 检测到 Antigravity 客户端已运行，准备注入监控挂件...');
      wasRunning = true;
      injectionSuccess = false;
    }

    try {
      const res = await injectWidget({ silent: injectionSuccess });
      if (res && res.success) {
        if (!injectionSuccess) {
          log('✅ 监控挂件已成功附加并注入会话窗口！');
          injectionSuccess = true;
        }
      }
    } catch (_) {}
  } else {
    // 进程未运行
    if (wasRunning) {
      // 从运行中变为关闭
      log('🔴 检测到 Antigravity 客户端已退出。');
      wasRunning = false;
      injectionSuccess = false;

      if (exitWithApp) {
        log('🛑 伴生模式触发：监控守护进程同步退出。');
        process.exit(0);
      } else {
        log('💤 进入低功耗待命状态 (0% CPU)，静候下次启动...');
      }
    } else if (exitWithApp && !hasStarted) {
      // 伴生模式下，启动前等待最多 30 秒
      startupAttempts++;
      if (startupAttempts >= 15) { // 15 * 2000ms = 30s
        log('⚠️ 超时未检测到 Antigravity 客户端启动，伴生守护进程自动退出。');
        process.exit(0);
      }
    }
  }

  const delay = isRunning ? 3000 : 2000;
  setTimeout(loop, delay);
}

loop();
