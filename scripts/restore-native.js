import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
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

  const externalBin = 'C:\\Users\\Lizhuo\\.gemini\antigravity\\scratch\\antigravity-chinese\\node_modules\\.bin\\asar.cmd';
  if (fs.existsSync(externalBin)) return `"${externalBin}"`;

  return 'npx -y @electron/asar@3.2.14';
}

function sleep(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (_) {
    const start = Date.now();
    while (Date.now() - start < ms) {}
  }
}

export function restoreNative() {
  console.log('======================================================');
  console.log('🔄 Antigravity 原生补丁还原器 (纯净卸载)');
  console.log('======================================================\n');

  const asarPath = findAsarPath();
  if (!asarPath) {
    console.error('❌ 未找到 Antigravity 客户端的 app.asar 路径。');
    process.exit(1);
  }

  const resourcesDir = path.dirname(asarPath);
  const backupPath = path.join(resourcesDir, 'app.asar.monitor-bak');
  const tempExtractDir = path.join(os.tmpdir(), `antigravity-restore-monitor-${Date.now()}`);
  const tempNewAsar = path.join(resourcesDir, 'app.asar.new');
  const swapOldAsar = path.join(resourcesDir, 'app.asar.swap-old');
  const asarBin = findAsarBin();

  console.log(`[1/4] 定位目标文件: ${asarPath}`);

  // 解构 ASAR
  console.log('[2/4] 正在解构资源包 (ASAR)...');
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

  // 剥离监控补丁代码，保护其他补丁（如汉化）不受破坏
  console.log('[3/4] 正在剥离原生挂件注入逻辑（保留汉化等其他补丁）...');
  let preloadContent = fs.readFileSync(preloadPath, 'utf-8');

  if (preloadContent.includes(INJECTION_START)) {
    const regex = new RegExp(`\\n?${INJECTION_START}[\\s\\S]*?${INJECTION_END}\\n?`, 'g');
    preloadContent = preloadContent.replace(regex, '');
    fs.writeFileSync(preloadPath, preloadContent, 'utf-8');
  } else {
    console.log('ℹ️ 未在 preload.js 中检测到监控注入标记，无需修改。');
  }

  // 打包并原子替换
  console.log('[4/4] 正在重构打包并应用纯净版本...');
  if (fs.existsSync(tempNewAsar)) fs.rmSync(tempNewAsar, { force: true });

  try {
    execSync(`${asarBin} pack "${tempExtractDir}" "${tempNewAsar}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ 打包 app.asar.new 失败:', err.message);
    if (fs.existsSync(tempExtractDir)) fs.rmSync(tempExtractDir, { recursive: true, force: true });
    process.exit(1);
  }

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
        sleep(300);
      } else {
        break;
      }
    }
  }

  if (fs.existsSync(tempExtractDir)) {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
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
      console.log('✨ [无损预还原已就绪] 纯净包已预构建为: app.asar.staged');
      console.log('✨ 已挂载后台静默守候：当您稍后重启/关闭 Antigravity 客户端时，');
      console.log('✨ 系统将在 0.3 秒内瞬间自动完成原子替换！');
      console.log('✨ 挂件补丁将被干净剥离还原。');
      console.log('======================================================\n');
      return;
    }

    console.error('⚠️ 还原失败，原文件未受损坏。');
    if (fs.existsSync(tempNewAsar)) fs.rmSync(tempNewAsar, { force: true });
    console.error('❌ 错误:', lastErr ? lastErr.message : '未知');
    process.exit(1);
  }

  if (fs.existsSync(swapOldAsar)) {
    try { fs.rmSync(swapOldAsar, { force: true }); } catch (_) {}
  }

  console.log('\n======================================================');
  console.log('✅ 原生内嵌补丁已干净剥离还原！');
  console.log('🔄 重启 Antigravity 客户端后挂件将不再自动加载。');
  console.log('======================================================\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  restoreNative();
}
