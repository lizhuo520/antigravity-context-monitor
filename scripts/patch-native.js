import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const INJECTION_START = '// --- Antigravity Context Monitor Native Injection Start ---';
const INJECTION_END = '// --- Antigravity Context Monitor Native Injection End ---';

function findAsarPath() {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const candidates = [
    path.join(localAppData, 'Programs', 'antigravity', 'resources', 'app.asar'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'antigravity', 'resources', 'app.asar'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'antigravity', 'resources', 'app.asar')
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function findAsarBin() {
  const localBin = path.join(projectRoot, 'node_modules', '.bin', os.platform() === 'win32' ? 'asar.cmd' : 'asar');
  if (fs.existsSync(localBin)) return `"${localBin}"`;

  const externalBin = 'C:\\Users\\Lizhuo\\.gemini\\antigravity\\scratch\\antigravity-chinese\\node_modules\\.bin\\asar.cmd';
  if (fs.existsSync(externalBin)) return `"${externalBin}"`;

  return 'npx -y @electron/asar@3.2.14';
}

function isProcessRunning() {
  try {
    const stdout = execSync('tasklist /FI "IMAGENAME eq Antigravity.exe" /NH', { encoding: 'utf-8', windowsHide: true });
    return stdout.toLowerCase().includes('antigravity.exe');
  } catch (_) {
    return false;
  }
}

function sleep(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (_) {
    const start = Date.now();
    while (Date.now() - start < ms) {}
  }
}

function applyStagedWhenUnlocked() {
  const asarPath = findAsarPath();
  if (!asarPath) process.exit(0);
  const resourcesDir = path.dirname(asarPath);
  const stagedAsar = path.join(resourcesDir, 'app.asar.staged');
  const swapOldAsar = path.join(resourcesDir, 'app.asar.swap-old');

  let ticks = 0;
  const maxTicks = 144000; // 最多守候 12 小时
  const timer = setInterval(() => {
    ticks++;
    if (ticks > maxTicks || !fs.existsSync(stagedAsar)) {
      clearInterval(timer);
      process.exit(0);
    }
    if (!isProcessRunning()) {
      clearInterval(timer);
      let swapped = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          if (!swapped && fs.existsSync(asarPath)) {
            if (fs.existsSync(swapOldAsar)) fs.rmSync(swapOldAsar, { force: true });
            fs.renameSync(asarPath, swapOldAsar);
            swapped = true;
          }
          fs.renameSync(stagedAsar, asarPath);
          if (fs.existsSync(swapOldAsar)) {
            try { fs.rmSync(swapOldAsar, { force: true }); } catch (_) {}
          }
          break;
        } catch (_) {
          if (attempt < 9) {
            sleep(150);
          } else if (swapped && !fs.existsSync(asarPath) && fs.existsSync(swapOldAsar)) {
            try { fs.renameSync(swapOldAsar, asarPath); } catch (_) {}
          }
        }
      }
      process.exit(0);
    }
  }, 300);
}

export function patchNative() {
  console.log('======================================================');
  console.log('🚀 Antigravity 原生内嵌注入器 (路线 A · 零后台守护)');
  console.log('======================================================\n');

  const asarPath = findAsarPath();
  if (!asarPath) {
    console.error('❌ 未找到 Antigravity 客户端的 app.asar 路径。');
    process.exit(1);
  }

  const resourcesDir = path.dirname(asarPath);
  const backupPath = path.join(resourcesDir, 'app.asar.monitor-bak');
  const tempExtractDir = path.join(os.tmpdir(), `antigravity-native-monitor-${Date.now()}`);
  const tempNewAsar = path.join(resourcesDir, 'app.asar.new');
  const swapOldAsar = path.join(resourcesDir, 'app.asar.swap-old');
  const asarBin = findAsarBin();

  console.log(`[1/5] 定位目标文件: ${asarPath}`);

  // 1. 创建独立安全备份（若不存在）
  if (!fs.existsSync(backupPath)) {
    console.log(`[2/5] 首次应用，正在创建安全备份: ${backupPath}...`);
    fs.copyFileSync(asarPath, backupPath);
  } else {
    console.log(`[2/5] 发现已有安全备份 (${backupPath})，保持基线完整。`);
  }

  // 2. 解构 ASAR
  console.log('[3/5] 正在解构资源包 (ASAR)...');
  if (fs.existsSync(tempExtractDir)) {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  }

  try {
    execSync(`${asarBin} extract "${asarPath}" "${tempExtractDir}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ 解包 app.asar 失败:', err.message);
    process.exit(1);
  }

  const preloadPath = path.join(tempExtractDir, 'dist', 'preload.js');
  if (!fs.existsSync(preloadPath)) {
    console.error(`❌ 未在资源包内找到 dist/preload.js: ${preloadPath}`);
    if (fs.existsSync(tempExtractDir)) fs.rmSync(tempExtractDir, { recursive: true, force: true });
    process.exit(1);
  }

  // 3. 准备微创注入代码
  console.log('[4/5] 正在向 dist/preload.js 注入原生挂件引导逻辑...');
  const widgetPath = path.join(projectRoot, 'src', 'widget.js');
  if (!fs.existsSync(widgetPath)) {
    console.error(`❌ 未找到挂件源码: ${widgetPath}`);
    if (fs.existsSync(tempExtractDir)) fs.rmSync(tempExtractDir, { recursive: true, force: true });
    process.exit(1);
  }
  const widgetCode = fs.readFileSync(widgetPath, 'utf-8');

  let preloadContent = fs.readFileSync(preloadPath, 'utf-8');

  // 若已有旧版本注入，先行剥离
  if (preloadContent.includes(INJECTION_START)) {
    const regex = new RegExp(`\\n?${INJECTION_START}[\\s\\S]*?${INJECTION_END}\\n?`, 'g');
    preloadContent = preloadContent.replace(regex, '');
  }

  const nativeInjectionScript = `
${INJECTION_START}
(() => {
  try {
    const { webFrame } = require('electron');
    const WIDGET_CODE = ${JSON.stringify(widgetCode)};
    const inject = () => {
      try {
        if (window.__agyMonitorNativeInjected) return;
        window.__agyMonitorNativeInjected = true;
        if (webFrame && typeof webFrame.executeJavaScript === 'function') {
          webFrame.executeJavaScript(WIDGET_CODE);
        } else {
          const s = document.createElement('script');
          s.id = 'agy-context-monitor-native-loader';
          s.textContent = WIDGET_CODE;
          (document.head || document.documentElement).appendChild(s);
        }
      } catch (_) {}
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject, { once: true });
    } else {
      inject();
    }
  } catch (err) {}
})();
${INJECTION_END}
`;

  preloadContent += '\n' + nativeInjectionScript;
  fs.writeFileSync(preloadPath, preloadContent, 'utf-8');

  // 4. 重构打包
  console.log('[5/5] 正在重构打包并应用原生补丁...');
  if (fs.existsSync(tempNewAsar)) fs.rmSync(tempNewAsar, { force: true });

  try {
    execSync(`${asarBin} pack "${tempExtractDir}" "${tempNewAsar}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ 打包 app.asar.new 失败:', err.message);
    if (fs.existsSync(tempExtractDir)) fs.rmSync(tempExtractDir, { recursive: true, force: true });
    process.exit(1);
  }

  // 清理临时解包目录
  if (fs.existsSync(tempExtractDir)) {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  }

  // 双阶段原子替换架构
  let replaced = false;
  let isSwapped = false;
  let lastErr = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      if (!isSwapped && fs.existsSync(asarPath)) {
        if (fs.existsSync(swapOldAsar)) fs.rmSync(swapOldAsar, { force: true });
        fs.renameSync(asarPath, swapOldAsar);
        isSwapped = true;
      }
      fs.renameSync(tempNewAsar, asarPath);
      replaced = true;
      break;
    } catch (err) {
      lastErr = err;
      if (err.code === 'EPERM' || err.code === 'EBUSY') {
        sleep(200);
      } else {
        break;
      }
    }
  }

  if (!replaced) {
    if (isSwapped && fs.existsSync(swapOldAsar)) {
      try {
        if (fs.existsSync(asarPath)) fs.rmSync(asarPath, { force: true });
        fs.renameSync(swapOldAsar, asarPath);
      } catch (_) {}
    }

    const isLocked = lastErr && (lastErr.code === 'EBUSY' || lastErr.code === 'EPERM');
    if (isLocked && fs.existsSync(tempNewAsar)) {
      const stagedAsar = path.join(resourcesDir, 'app.asar.staged');
      if (fs.existsSync(stagedAsar)) fs.rmSync(stagedAsar, { force: true });
      fs.renameSync(tempNewAsar, stagedAsar);

      try {
        const vbsPath = path.join(__dirname, 'apply-staged.vbs');
        execSync(`powershell -NoProfile -Command "Start-Process wscript.exe -ArgumentList '\\"${vbsPath}\\"'"`, { windowsHide: true });
      } catch (_) {}

      console.log('\n======================================================');
      console.log('✨ [无损预注入已就绪] 补丁包已成功预构建为: app.asar.staged');
      console.log('✨ 已挂载后台静默守候：当您稍后重启/关闭 Antigravity 客户端时，');
      console.log('✨ 系统将在 0.3 秒内瞬间自动完成原子替换！');
      console.log('✨ 下次启动 Antigravity 时，监控挂件即刻原生生效！');
      console.log('======================================================\n');
      return;
    }

    console.error('⚠️ [安全回滚] 替换失败，原文件未受损坏。');
    if (fs.existsSync(tempNewAsar)) fs.rmSync(tempNewAsar, { force: true });
    console.error('❌ 错误信息:', lastErr ? lastErr.message : '未知');
    process.exit(1);
  }

  if (fs.existsSync(swapOldAsar)) {
    try { fs.rmSync(swapOldAsar, { force: true }); } catch (_) {}
  }

  console.log('\n======================================================');
  console.log('🎉 恭喜！原生内嵌补丁安装成功！');
  console.log('⚡ 运行机制: Electron 客户端原生加载，0 后台进程，0 计划任务');
  console.log('🔄 生效方式: 重启 Antigravity 客户端即可体验极致无感启动！');
  console.log('======================================================\n');
}

if (process.argv.includes('apply-staged')) {
  applyStagedWhenUnlocked();
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  patchNative();
}
