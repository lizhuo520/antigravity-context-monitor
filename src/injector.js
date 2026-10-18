import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getDevToolsPortFile() {
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

export function isAntigravityProcessRunning() {
  try {
    const portFile = getDevToolsPortFile();
    if (fs.existsSync(portFile)) return true;
  } catch (_) {}
  return false;
}

export async function injectWidget(options = {}) {
  const { silent = false, isCli = false } = options;
  const portFile = getDevToolsPortFile();

  if (!fs.existsSync(portFile)) {
    if (!silent) {
      console.error('❌ 未找到 DevToolsActivePort 文件，请确认 Antigravity 客户端已启动。');
      console.error(`   检查路径: ${portFile}`);
    }
    if (isCli) process.exit(1);
    return { success: false, reason: 'port_file_not_found' };
  }

  let port;
  try {
    port = parseInt(fs.readFileSync(portFile, 'utf-8').split('\n')[0].trim(), 10);
  } catch (err) {
    if (!silent) console.error('❌ 无法读取 DevToolsActivePort:', err.message);
    if (isCli) process.exit(1);
    return { success: false, reason: 'invalid_port', error: err.message };
  }

  if (!silent) console.log(`🔍 正在连接 Antigravity 调试端口: 127.0.0.1:${port}...`);

  let targets = [];
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json`);
    targets = await res.json();
  } catch (err) {
    if (!silent) console.error(`❌ 无法访问 http://127.0.0.1:${port}/json:`, err.message);
    if (isCli) process.exit(1);
    return { success: false, reason: 'cannot_connect_port', error: err.message };
  }

  const pages = targets.filter(t => t.type === 'page' && t.url && t.url.includes('/c/'));
  if (pages.length === 0) {
    if (!silent) console.log('⚠️ 未检测到处于激活状态的会话页面 (/c/...)，请在 Antigravity 中打开任意对话。');
    if (isCli) process.exit(0);
    return { success: false, reason: 'no_session_page' };
  }

  const widgetPath = path.join(__dirname, 'widget.js');
  const widgetCode = fs.readFileSync(widgetPath, 'utf-8');

  let anyInjected = false;

  for (const page of pages) {
    try {
      await new Promise((resolve, reject) => {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket 连接超时'));
        }, 3000);

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
            .then(() => new Promise(r => setTimeout(r, 400)))
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
                anyInjected = true;
                if (!silent) {
                  console.log(`✅ 监控挂件已成功注入 [${page.title || page.url}]！`);
                  console.log(`   ⏱ 胶囊1: ${state.pillSpeed}`);
                  console.log(`   🗄 胶囊2: ${state.pillCache}`);
                  console.log(`   ⭕ 胶囊3: ${state.pillPct}`);
                }
              }
              ws.close();
              resolve();
            })
            .catch(err => {
              if (!silent) console.error(`❌ 注入页面 [${page.title || page.url}] 失败:`, err.message);
              ws.close();
              resolve(); // 继续注入下一个页面
            });
        };

        ws.onerror = (err) => {
          clearTimeout(timeout);
          ws.close();
          resolve();
        };
      });
    } catch (_) {}
  }

  return { success: anyInjected };
}

// 直接以 CLI 运行时
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  injectWidget({ isCli: true }).catch(() => process.exit(1));
}
