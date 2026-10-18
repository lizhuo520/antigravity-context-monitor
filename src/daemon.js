import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { injectWidget, getDevToolsPortFile } from './injector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFile = path.join(__dirname, '..', 'daemon.log');

const exitWithApp = process.argv.includes('--exit-with-app') || process.argv.includes('--sync');
const isSilent = process.argv.includes('--silent');

// 生产级防崩守卫：捕获所有未知异常与异步拒绝
process.on('uncaughtException', (err) => {
  log(`[ERROR] UncaughtException: ${err.message}`);
});
process.on('unhandledRejection', (reason) => {
  log(`[WARN] UnhandledRejection: ${reason}`);
});

function log(...args) {
  const line = `[${new Date().toLocaleString()}] ${args.join(' ')}`;
  if (!isSilent) {
    console.log(line);
  }
  try {
    fs.appendFileSync(logFile, line + '\n', 'utf-8');
  } catch (_) {}
}

// 快速检测 Antigravity 是否处于运行且可通信状态
async function checkAntigravityState() {
  const portFile = getDevToolsPortFile();
  if (!fs.existsSync(portFile)) {
    // 端口文件不存在，检查底层进程是否正在启动
    return checkProcessAlive();
  }

  try {
    const port = parseInt(fs.readFileSync(portFile, 'utf-8').split('\n')[0].trim(), 10);
    if (isNaN(port)) return checkProcessAlive();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`http://127.0.0.1:${port}/json`, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const targets = await res.json();
      return { isRunning: true, port, targets };
    }
  } catch (_) {}

  return checkProcessAlive();
}

function checkProcessAlive() {
  try {
    const stdout = execSync('tasklist /FI "IMAGENAME eq Antigravity.exe" /NH', { encoding: 'utf-8', windowsHide: true });
    if (stdout.includes('Antigravity.exe')) {
      return { isRunning: true, port: null, targets: [] };
    }
  } catch (_) {}
  return { isRunning: false, port: null, targets: [] };
}

let hasStarted = false;
let wasRunning = false;
let startupAttempts = 0;
const injectedPages = new Set();
let lastHealthCheck = 0;

log('🚀 Antigravity 监控守护进程已启动...');
log(`⚡ 运行模式: ${exitWithApp ? '[伴生同步模式 (与客户端同生同灭)]' : '[开机静默守护模式 (持续待命监测)]'}`);

async function loop() {
  try {
    const state = await checkAntigravityState();

    if (state.isRunning) {
      hasStarted = true;
      startupAttempts = 0;

      if (!wasRunning) {
        log('🟢 检测到 Antigravity 客户端已启动！准备检测并注入会话...');
        wasRunning = true;
        injectedPages.clear();
      }

      // 发现端口与目标页面
      if (state.port && state.targets && state.targets.length > 0) {
        const sessionPages = state.targets.filter(t => t.type === 'page' && t.url && t.url.includes('/c/'));
        const now = Date.now();
        const needHealthCheck = (now - lastHealthCheck) > 12000; // 每 12 秒做一次探活复查

        for (const page of sessionPages) {
          const pageKey = page.id || page.url;
          if (!injectedPages.has(pageKey) || needHealthCheck) {
            try {
              const res = await injectWidget({ silent: injectedPages.has(pageKey) });
              if (res && res.success) {
                if (!injectedPages.has(pageKey)) {
                  log(`✅ 成功向会话窗口 [${page.title || page.url}] 注入监控挂件！`);
                  injectedPages.add(pageKey);
                }
              }
            } catch (err) {
              log(`⚠️ 注入窗口 [${page.title || page.url}] 异常: ${err.message}`);
            }
          }
        }

        if (needHealthCheck) {
          lastHealthCheck = now;
        }
      }
    } else {
      // 客户端未运行
      if (wasRunning) {
        log('🔴 检测到 Antigravity 客户端已关闭。');
        wasRunning = false;
        injectedPages.clear();

        if (exitWithApp) {
          log('🛑 伴生模式触发：监控守护进程同步彻底退出 (0 残留)。');
          process.exit(0);
        } else {
          log('💤 进入低功耗待命休眠状态 (0% CPU)，静候下次客户端打开...');
        }
      } else if (exitWithApp && !hasStarted) {
        startupAttempts++;
        if (startupAttempts >= 15) { // 30 秒超时
          log('⚠️ 超时未检测到 Antigravity 启动，伴生守护进程自动退出。');
          process.exit(0);
        }
      }
    }
  } catch (loopErr) {
    log(`[WARN] 守护循环发生临时异常: ${loopErr.message}`);
  }

  const delay = wasRunning ? 2500 : 2000;
  setTimeout(loop, delay);
}

loop();
