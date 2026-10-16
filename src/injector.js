import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDevToolsPortFile() {
  const platform = os.platform();
  const home = os.homedir();
  if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Antigravity', 'DevToolsActivePort');
  } else if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Antigravity', 'DevToolsActivePort');
  } else {
    return path.join(home, '.config', 'Antigravity', 'DevToolsActivePort');
  }
}

export async function injectWidget() {
  const portFile = getDevToolsPortFile();
  if (!fs.existsSync(portFile)) {
    console.error('❌ 未找到 DevToolsActivePort 文件，请确认 Antigravity 客户端已启动。');
    console.error(`   检查路径: ${portFile}`);
    process.exit(1);
  }

  const port = parseInt(fs.readFileSync(portFile, 'utf-8').split('\n')[0].trim(), 10);
  console.log(`🔍 正在连接 Antigravity 调试端口: 127.0.0.1:${port}...`);

  let targets = [];
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json`);
    targets = await res.json();
  } catch (err) {
    console.error(`❌ 无法访问 http://127.0.0.1:${port}/json:`, err.message);
    process.exit(1);
  }

  const page = targets.find(t => t.type === 'page' && t.url && t.url.includes('/c/'));
  if (!page) {
    console.log('⚠️ 未检测到处于激活状态的会话页面 (/c/...)，请在 Antigravity 中打开任意对话。');
    process.exit(0);
  }

  const widgetPath = path.join(__dirname, 'widget.js');
  const widgetCode = fs.readFileSync(widgetPath, 'utf-8');

  console.log(`🔌 正在向会话页面 [${page.title || page.url}] 注入监控挂件...`);

  const ws = new WebSocket(page.webSocketDebuggerUrl);

  const timeout = setTimeout(() => {
    console.error('❌ WebSocket 连接超时。');
    process.exit(1);
  }, 4000);

  return new Promise((resolve, reject) => {
    ws.onopen = () => {
      clearTimeout(timeout);
      let msgId = 1;

      function evalScript(code) {
        return new Promise((res, rej) => {
          const id = msgId++;
          const t = setTimeout(() => rej(new Error('执行超时')), 3000);
          const onMsg = (evt) => {
            try {
              const data = JSON.parse(evt.data);
              if (data.id === id) {
                clearTimeout(t);
                ws.removeEventListener('message', onMsg);
                res(data.result?.result?.value);
              }
            } catch (e) { rej(e); }
          };
          ws.addEventListener('message', onMsg);
          ws.send(JSON.stringify({
            id,
            method: 'Runtime.evaluate',
            params: { expression: code, returnByValue: true }
          }));
        });
      }

      evalScript(widgetCode)
        .then(() => new Promise(r => setTimeout(r, 600)))
        .then(() => {
          return evalScript(`({
            mounted: !!document.getElementById('agy-capsule-monitor-widget'),
            pillSpeed: document.getElementById('agy-text-speed')?.innerText,
            pillCache: document.getElementById('agy-text-cache')?.innerText,
            pillPct: document.getElementById('agy-text-pct')?.innerText
          })`);
        })
        .then((state) => {
          if (state && state.mounted) {
            console.log('✅ 监控挂件已成功注入并激活！');
            console.log(`   ⏱ 胶囊1: ${state.pillSpeed}`);
            console.log(`   🗄 胶囊2: ${state.pillCache}`);
            console.log(`   ⭕ 胶囊3: ${state.pillPct}`);
          } else {
            console.log('⚠️ 挂件注入成功，等待首次渲染数据...');
          }
          ws.close();
          resolve();
        })
        .catch(err => {
          console.error('❌ 注入失败:', err);
          ws.close();
          reject(err);
        });
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      console.error('❌ WebSocket 连接出错:', err);
      reject(err);
    };
  });
}

// 直接运行脚本时执行注入
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  injectWidget().catch(() => process.exit(1));
}
