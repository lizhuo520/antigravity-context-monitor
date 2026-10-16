import { injectWidget } from './injector.js';

console.log('🚀 Antigravity 监控后台守护进程已启动...');
console.log('   正在持续监测 Antigravity 会话并自动注入挂件，按 Ctrl+C 可退出。');

let lastInjectedUrl = '';

async function loop() {
  try {
    await injectWidget();
  } catch (e) {
    // 忽略未启动或非会话页的轮询错误
  }
  setTimeout(loop, 5000);
}

loop();
