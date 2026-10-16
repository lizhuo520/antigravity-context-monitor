/**
 * Antigravity Context & Session Monitor Widget
 * @author lizhuo520
 * @license MIT
 */
(() => {
  const REQUIRED_VERSION = '1.0M-interactive-three-cards-v15-release';
  const existingWidgets = document.querySelectorAll('#agy-model-context-widget, #agy-capsule-monitor-widget');
  if (window.__agyContextCircleVersion === REQUIRED_VERSION && existingWidgets.length === 1) {
    return;
  }

  // 清理历史残留挂件与定时器
  existingWidgets.forEach(el => el.remove());
  document.querySelectorAll('#agy-context-circle-container, #antigravity-context-monitor-root').forEach(el => el.remove());
  if (window.__agyContextCircleTimer) clearInterval(window.__agyContextCircleTimer);

  window.__agyContextCircleVersion = REQUIRED_VERSION;

  // 配置项
  const CONTEXT_LIMIT = 1000000;      // 默认上下文上限：100万 (1.0M)
  const MINI_CIRCLE_C = 59.6903;      // 2 * Math.PI * 9.5
  const REFRESH_INTERVAL_MS = 2000;   // 刷新频率：每 2 秒一次

  function formatTokens(n) {
    if (!n || n <= 0) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  function fmtDuration(ms) {
    const totalSec = Math.round(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min > 0) return `${min}分${sec}秒`;
    return `${sec}秒`;
  }

  // 样式定义
  let styleEl = document.getElementById('agy-capsule-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'agy-capsule-style';
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    @keyframes agy-beam-slide {
      0% { left: -120%; }
      60% { left: 140%; }
      100% { left: 140%; }
    }
    .agy-beam-container {
      position: relative;
      overflow: hidden;
    }
    .agy-beam-light {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 50%;
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0.8) 50%,
        rgba(255, 255, 255, 0) 100%
      );
      animation: agy-beam-slide 2.2s ease-in-out infinite;
      pointer-events: none;
    }
    .agy-capsule-item {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 9px;
      border-radius: 9999px;
      background: color-mix(in srgb, var(--foreground, #101010) 4.5%, transparent);
      font-size: 11.5px;
      color: var(--foreground, #101010);
      cursor: pointer;
      transition: background-color 0.15s ease, transform 0.1s ease;
      user-select: none;
      white-space: nowrap;
      font-family: var(--font-sans, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    }
    .agy-capsule-item:hover, .agy-capsule-item.active {
      background: color-mix(in srgb, var(--foreground, #101010) 9.5%, transparent);
    }
    .agy-capsule-item:active {
      transform: scale(0.97);
    }
    .agy-popover-card {
      display: none;
      position: absolute;
      bottom: calc(100% + 10px);
      width: 242px;
      background: var(--card, #ffffff);
      border: 1px solid var(--border, rgba(0, 0, 0, 0.09));
      border-radius: 10px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04);
      padding: 12px 14px;
      z-index: 999999;
      font-family: var(--font-sans, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      pointer-events: auto;
      box-sizing: border-box;
      white-space: nowrap;
    }
    .agy-card-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3.5px 0;
      font-size: 11.5px;
    }
    .agy-card-label {
      color: var(--muted-foreground, rgba(16, 16, 16, 0.6));
    }
    .agy-card-val {
      font-weight: 500;
      color: var(--foreground, #101010);
      font-variant-numeric: tabular-nums;
    }
  `;

  // 创建挂件 DOM 结构
  const widget = document.createElement('div');
  widget.id = 'agy-capsule-monitor-widget';
  widget.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; margin-left: 6px; vertical-align: middle; position: relative; flex-shrink: 0;';

  widget.innerHTML = [
    // 胶囊1：轮次 步数 · 速度
    '<div id="agy-pill-speed" class="agy-capsule-item" title="点击查看会话统计">',
    '  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.75; flex-shrink: 0;">',
    '    <path d="M8 13A6 6 0 1 0 2 8a5.96 5.96 0 0 0 .5 2.4" />',
    '    <path d="M8 8l2.5-2.5" />',
    '  </svg>',
    '  <span id="agy-text-speed">-- 轮 -- 步 · 0 tok/s</span>',
    '</div>',

    // 胶囊2：全会话累计流转 Token · 缓存命中
    '<div id="agy-pill-cache" class="agy-capsule-item" title="点击查看 Token 用量明细">',
    '  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.75; flex-shrink: 0;">',
    '    <ellipse cx="8" cy="3.5" rx="5.5" ry="2" />',
    '    <path d="M2.5 3.5v4.5c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V3.5" />',
    '    <path d="M2.5 8v4.5c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V8" />',
    '  </svg>',
    '  <span id="agy-text-cache">-- tok · 缓存命中 --%</span>',
    '</div>',

    // 胶囊3：微型圆环 · 百分比
    '<div id="agy-pill-pct" class="agy-capsule-item" title="点击查看上下文容量">',
    '  <svg viewBox="0 0 24 24" width="12" height="12" style="transform: rotate(-90deg); display: block; flex-shrink: 0;">',
    '    <circle cx="12" cy="12" r="9.5" fill="transparent" stroke="color-mix(in srgb, var(--foreground, #101010) 14%, transparent)" stroke-width="2.5" />',
    '    <circle id="agy-capsule-ring" cx="12" cy="12" r="9.5" fill="transparent" stroke="var(--primary, #007acc)" stroke-width="2.8" stroke-linecap="round" stroke-dasharray="59.69" stroke-dashoffset="59.69" style="transition: stroke-dashoffset 0.35s ease, stroke 0.3s ease;" />',
    '  </svg>',
    '  <span id="agy-text-pct" style="font-weight: 600; font-variant-numeric: tabular-nums;">--%</span>',
    '</div>',

    // -------------------------------------------------------------
    // 卡片1：会话统计
    // -------------------------------------------------------------
    '<div id="agy-card-session" class="agy-popover-card" style="left: 0;">',
    '  <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 7px;">',
    '    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="color: var(--foreground); opacity: 0.85;">',
    '      <path d="M8 13A6 6 0 1 0 2 8a5.96 5.96 0 0 0 .5 2.4" />',
    '      <path d="M8 8l2.5-2.5" />',
    '    </svg>',
    '    <span style="font-size: 13px; font-weight: 600; color: var(--foreground, #101010);">会话统计</span>',
    '  </div>',
    '  <div style="height: 1px; width: 100%; background: color-mix(in srgb, var(--foreground, #101010) 7%, transparent); margin-bottom: 7px;"></div>',
    '  <div class="agy-card-row">',
    '    <span class="agy-card-label">模型用时</span>',
    '    <span id="agy-stat-modeltime" class="agy-card-val">--</span>',
    '  </div>',
    '  <div class="agy-card-row">',
    '    <span class="agy-card-label">工具调用用时</span>',
    '    <span id="agy-stat-tooltime" class="agy-card-val">--</span>',
    '  </div>',
    '  <div class="agy-card-row">',
    '    <span class="agy-card-label">首 token 平均（TTFT）</span>',
    '    <span id="agy-stat-ttft" class="agy-card-val">--</span>',
    '  </div>',
    '  <div class="agy-card-row">',
    '    <span class="agy-card-label">实时速度（TPS）</span>',
    '    <span id="agy-stat-tps" class="agy-card-val" style="color: #0284c7; font-weight: 600;">0 tok/s</span>',
    '  </div>',
    '  <div class="agy-card-row">',
    '    <span class="agy-card-label">本次会话平均速度</span>',
    '    <span id="agy-stat-avg-speed" class="agy-card-val" style="color: #10b981; font-weight: 600;">-- tok/s</span>',
    '  </div>',
    '  <div class="agy-card-row">',
    '    <span class="agy-card-label">最近生成均速</span>',
    '    <span id="agy-stat-last-speed" class="agy-card-val">-- tok/s</span>',
    '  </div>',
    '  <div style="position: absolute; bottom: -5px; left: 32px; transform: rotate(45deg); width: 8px; height: 8px; background: var(--card, #ffffff); border-right: 1px solid var(--border, rgba(0, 0, 0, 0.09)); border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.09));"></div>',
    '</div>',

    // -------------------------------------------------------------
    // 卡片2：Token 用量
    // -------------------------------------------------------------
    '<div id="agy-card-tokens" class="agy-popover-card" style="left: 60px;">',
    '  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px;">',
    '    <div style="display: flex; align-items: center; gap: 6px;">',
    '      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="color: var(--foreground); opacity: 0.85;">',
    '        <ellipse cx="8" cy="3.5" rx="5.5" ry="2" />',
    '        <path d="M2.5 3.5v4.5c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V3.5" />',
    '        <path d="M2.5 8v4.5c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V8" />',
    '      </svg>',
    '      <span style="font-size: 13px; font-weight: 600; color: var(--foreground, #101010);">Token 用量</span>',
    '    </div>',
    '    <span id="agy-token-total" style="font-size: 12.5px; font-weight: 600; color: var(--foreground, #101010); font-variant-numeric: tabular-nums;">-- tok</span>',
    '  </div>',
    '  <div style="height: 1px; width: 100%; background: color-mix(in srgb, var(--foreground, #101010) 7%, transparent); margin-bottom: 7px;"></div>',
    '  <div class="agy-card-row">',
    '    <span class="agy-card-label">缓存命中</span>',
    '    <span id="agy-token-hitrate" class="agy-card-val" style="color: #10b981; font-weight: 600;">--%</span>',
    '  </div>',
    '  <div class="agy-card-row">',
    '    <span class="agy-card-label">未缓存输入</span>',
    '    <span id="agy-token-uncached" class="agy-card-val">-- tok</span>',
    '  </div>',
    '  <div class="agy-card-row">',
    '    <span class="agy-card-label">缓存读取</span>',
    '    <span id="agy-token-cached" class="agy-card-val">-- tok</span>',
    '  </div>',
    '  <div class="agy-card-row">',
    '    <span class="agy-card-label">输出</span>',
    '    <span id="agy-token-output" class="agy-card-val">-- tok</span>',
    '  </div>',
    '  <div style="position: absolute; bottom: -5px; left: 80px; transform: rotate(45deg); width: 8px; height: 8px; background: var(--card, #ffffff); border-right: 1px solid var(--border, rgba(0, 0, 0, 0.09)); border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.09));"></div>',
    '</div>',

    // -------------------------------------------------------------
    // 卡片3：上下文容量（流光条）
    // -------------------------------------------------------------
    '<div id="agy-card-context" class="agy-popover-card" style="right: 0;">',
    '  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">',
    '    <div style="display: flex; align-items: center; gap: 6px;">',
    '      <span style="font-size: 13px; font-weight: 600; color: var(--foreground, #101010);">上下文容量</span>',
    '    </div>',
    '    <span id="agy-context-pct" style="color: var(--primary, #007acc); font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums;">0%</span>',
    '  </div>',
    '  <!-- 从左向右流光特效进度条 -->',
    '  <div style="height: 6px; width: 100%; background: color-mix(in srgb, var(--foreground, #101010) 8%, transparent); border-radius: 9999px; overflow: hidden; margin-bottom: 9px; position: relative;">',
    '    <div id="agy-context-bar" class="agy-beam-container" style="width: 0%; height: 100%; background: linear-gradient(90deg, #0284c7, #38bdf8); border-radius: 9999px; transition: width 0.3s ease;">',
    '      <div class="agy-beam-light"></div>',
    '    </div>',
    '  </div>',
    '  <div style="height: 1px; width: 100%; background: color-mix(in srgb, var(--foreground, #101010) 7%, transparent); margin-bottom: 7px;"></div>',
    '  <div class="agy-card-row">',
    '    <span class="agy-card-label">当前单轮总占用</span>',
    '    <span id="agy-context-used" class="agy-card-val">0 / 1.0M</span>',
    '  </div>',
    '  <div class="agy-card-row">',
    '    <span class="agy-card-label">本轮 Cache 读取</span>',
    '    <span id="agy-context-step-cache" class="agy-card-val" style="color: #10b981; font-weight: 600;">0</span>',
    '  </div>',
    '  <div class="agy-card-row">',
    '    <span class="agy-card-label">本轮新输入/输出</span>',
    '    <span id="agy-context-inout" class="agy-card-val">0 / 0</span>',
    '  </div>',
    '  <div class="agy-card-row">',
    '    <span class="agy-card-label">全会话总步数</span>',
    '    <span id="agy-context-steps" class="agy-card-val">0 步</span>',
    '  </div>',
    '  <div style="position: absolute; bottom: -5px; right: 28px; transform: rotate(45deg); width: 8px; height: 8px; background: var(--card, #ffffff); border-right: 1px solid var(--border, rgba(0, 0, 0, 0.09)); border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.09));"></div>',
    '</div>'
  ].join('');

  // 交互逻辑：点击胶囊打开对应页面，点击外部区域关闭
  const pillSpeed = widget.querySelector('#agy-pill-speed');
  const pillCache = widget.querySelector('#agy-pill-cache');
  const pillPct = widget.querySelector('#agy-pill-pct');

  const cardSession = widget.querySelector('#agy-card-session');
  const cardTokens = widget.querySelector('#agy-card-tokens');
  const cardContext = widget.querySelector('#agy-card-context');

  function closeAll() {
    cardSession.style.display = 'none';
    cardTokens.style.display = 'none';
    cardContext.style.display = 'none';
    pillSpeed.classList.remove('active');
    pillCache.classList.remove('active');
    pillPct.classList.remove('active');
  }

  function toggleCard(pill, card) {
    const isShowing = card.style.display === 'block';
    closeAll();
    if (!isShowing) {
      card.style.display = 'block';
      pill.classList.add('active');
    }
  }

  pillSpeed.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCard(pillSpeed, cardSession);
  });

  pillCache.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCard(pillCache, cardTokens);
  });

  pillPct.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCard(pillPct, cardContext);
  });

  cardSession.addEventListener('click', (e) => e.stopPropagation());
  cardTokens.addEventListener('click', (e) => e.stopPropagation());
  cardContext.addEventListener('click', (e) => e.stopPropagation());

  // 点击页面任何外部区域，收回页面
  window.removeEventListener('click', window.__agyCloseMonitorPopovers);
  window.__agyCloseMonitorPopovers = (e) => {
    if (!widget.contains(e.target)) {
      closeAll();
    }
  };
  window.addEventListener('click', window.__agyCloseMonitorPopovers);

  function findModelBtn() {
    const trigger = document.querySelector('button[data-testid="model-selector-trigger"]');
    if (trigger) return trigger;
    const btns = Array.from(document.querySelectorAll('button'));
    const found = btns.find(b => {
      const t = (b.innerText || '').trim();
      return (t.includes('Flash') || t.includes('Gemini') || t.includes('Claude') || t.includes('GPT')) && b.querySelector('svg') && !b.closest('.chat-scrollable, [data-testid="virtuoso-item-list"], .overflow-y-auto');
    });
    if (found) return found;
    return document.querySelector('.no-focus-agent-input')?.querySelector('button') || null;
  }

  function ensureMounted() {
    const allWidgets = document.querySelectorAll('#agy-capsule-monitor-widget, #agy-model-context-widget');
    allWidgets.forEach(w => {
      if (w !== widget) w.remove();
    });

    const modelBtn = findModelBtn();
    if (!modelBtn) return false;
    const anchor = modelBtn.closest('.no-focus-agent-input') || modelBtn.parentElement;
    if (!anchor || !anchor.parentElement) return false;

    if (document.contains(widget) && widget.parentElement === anchor.parentElement && widget.previousElementSibling === anchor) {
      return true;
    }

    if (document.contains(widget)) {
      widget.remove();
    }
    anchor.after(widget);
    return true;
  }

  async function updateData() {
    ensureMounted();

    try {
      const path = location.pathname;
      const match = path.match(/\/c\/([a-zA-Z0-9_-]+)/);
      if (!match) return;

      const cascadeId = match[1];
      const token = window.__APP_CONFIG__ && window.__APP_CONFIG__.csrfToken;

      const res = await fetch('/exa.language_server_pb.LanguageServerService/GetCascadeTrajectorySteps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-codeium-csrf-token': token
        },
        body: JSON.stringify({
          cascadeId: cascadeId,
          startIndex: 0,
          endIndex: 500,
          metadata: { ideName: 'antigravity', extensionName: 'antigravity' }
        })
      });

      if (!res.ok) return;
      const data = await res.json();
      const steps = data.steps || [];

      // 统计用户提问轮次
      const rounds = steps.filter(s => s && s.type === 'CORTEX_STEP_TYPE_USER_INPUT').length;

      let modelTotalMs = 0;
      let toolTotalMs = 0;
      let ttftList = [];
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalCacheReadTokens = 0;
      let lastSpeed = null;
      let lastUsage = null;

      for (const s of steps) {
        const meta = s.metadata || {};

        if (meta.modelUsage) {
          const u = meta.modelUsage;
          const inp = Number(u.inputTokens || 0);
          const out = Number(u.outputTokens || 0);
          const cache = Number(u.cacheReadTokens || 0);

          totalInputTokens += inp;
          totalOutputTokens += out;
          totalCacheReadTokens += cache;
          lastUsage = u;

          // 模型用时与生成速度
          const startT = meta.viewableAt ? new Date(meta.viewableAt).getTime() : 0;
          const endT = meta.finishedGeneratingAt ? new Date(meta.finishedGeneratingAt).getTime() : 0;
          if (startT && endT && endT >= startT) {
            const dur = endT - startT;
            modelTotalMs += dur;

            if (dur >= 300 && out >= 40) {
              lastSpeed = Math.round((out / (dur / 1000)) * 10) / 10;
            }
          }

          // 首 Token 时间 (TTFT)
          const createT = meta.createdAt ? new Date(meta.createdAt).getTime() : 0;
          if (createT && startT && startT >= createT) {
            const ttft = startT - createT;
            if (ttft > 100 && ttft < 60000) {
              ttftList.push(ttft);
            }
          }
        } else if (meta.toolCall) {
          // 工具调用用时
          const startT = meta.startedAt ? new Date(meta.startedAt).getTime() : 0;
          const endT = meta.completedAt ? new Date(meta.completedAt).getTime() : 0;
          if (startT && endT && endT >= startT) {
            toolTotalMs += (endT - startT);
          }
        }
      }

      // 当前单轮上下文占用
      let stepCache = 0;
      let stepIn = 0;
      let stepOut = 0;
      let currentTurnUsed = 0;
      if (lastUsage) {
        stepCache = Number(lastUsage.cacheReadTokens || 0);
        stepIn = Number(lastUsage.inputTokens || 0);
        stepOut = Number(lastUsage.outputTokens || 0);
        currentTurnUsed = stepCache + stepIn + stepOut;
      }

      // 全会话累计总流转 Token 与全局缓存命中率
      const totalCumulativeTokens = totalInputTokens + totalOutputTokens + totalCacheReadTokens;
      const globalCacheHitRate = Math.round((totalCacheReadTokens / (totalCumulativeTokens || 1)) * 100);

      // 上下文容量使用率 (基于单轮当前上下文占用 vs 100万)
      const pct = Math.min(100, Math.round((currentTurnUsed / CONTEXT_LIMIT) * 1000) / 10);
      const avgTtftMs = ttftList.length > 0 ? (ttftList.reduce((a, b) => a + b, 0) / ttftList.length) : 0;

      // 颜色规则
      let color = 'var(--primary, #007acc)';
      let barGradient = 'linear-gradient(90deg, #0284c7, #38bdf8)';
      if (pct >= 80) {
        color = 'var(--error, #f05151)';
        barGradient = 'linear-gradient(90deg, #ef4444, #f87171)';
      } else if (pct >= 50) {
        color = 'var(--warning, #ac830b)';
        barGradient = 'linear-gradient(90deg, #d97706, #fbbf24)';
      }

      // -----------------------------------------------------------
      // 1. 实时流速状态判定 (Realtime Speed Engine)
      // -----------------------------------------------------------
      const lastStep = steps[steps.length - 1];
      const lastModelStep = steps.slice().reverse().find(s => s && s.type === 'CORTEX_STEP_TYPE_PLANNER_RESPONSE' && s.metadata?.modelUsage);
      let timeSinceLastModelFinish = 999999;
      if (lastModelStep?.metadata?.finishedGeneratingAt) {
        timeSinceLastModelFinish = Date.now() - new Date(lastModelStep.metadata.finishedGeneratingAt).getTime();
      }
      const isGenerating = (lastStep?.status === 'CORTEX_STEP_STATUS_RUNNING' || lastStep?.status === 'CORTEX_STEP_STATUS_GENERATING') || (timeSinceLastModelFinish < 3500);
      const realtimeSpeed = isGenerating ? (lastSpeed || 0) : 0;

      // -----------------------------------------------------------
      // 2. 更新底部三段式胶囊栏
      // -----------------------------------------------------------
      const textSpeed = document.getElementById('agy-text-speed');
      const textCache = document.getElementById('agy-text-cache');
      const textPct = document.getElementById('agy-text-pct');
      const miniRing = document.getElementById('agy-capsule-ring');

      if (textSpeed) {
        if (isGenerating && realtimeSpeed > 0) {
          textSpeed.innerText = `${rounds} 轮 ${steps.length} 步 · ⚡ ${realtimeSpeed} tok/s`;
        } else {
          textSpeed.innerText = `${rounds} 轮 ${steps.length} 步 · 0 tok/s`;
        }
      }
      if (textCache) {
        textCache.innerText = `${formatTokens(totalCumulativeTokens)} tok · 缓存命中 ${globalCacheHitRate}%`;
      }
      if (textPct) {
        textPct.innerText = `${pct}%`;
        textPct.style.color = color;
      }
      if (miniRing) {
        const miniOffset = Math.max(0, MINI_CIRCLE_C - (pct / 100) * MINI_CIRCLE_C);
        miniRing.style.stroke = color;
        miniRing.style.strokeDashoffset = pct <= 0 ? MINI_CIRCLE_C : miniOffset;
      }

      // -----------------------------------------------------------
      // 3. 更新卡片1：会话统计
      // -----------------------------------------------------------
      const elModelTime = document.getElementById('agy-stat-modeltime');
      const elToolTime = document.getElementById('agy-stat-tooltime');
      const elTtft = document.getElementById('agy-stat-ttft');
      const elTps = document.getElementById('agy-stat-tps');
      const elAvgSpeed = document.getElementById('agy-stat-avg-speed');
      const elLastSpeed = document.getElementById('agy-stat-last-speed');

      const sessionAvgSpeed = modelTotalMs > 0 ? (totalOutputTokens / (modelTotalMs / 1000)).toFixed(1) : '0';

      if (elModelTime) elModelTime.innerText = fmtDuration(modelTotalMs);
      if (elToolTime) elToolTime.innerText = fmtDuration(toolTotalMs);
      if (elTtft) elTtft.innerText = avgTtftMs > 0 ? (avgTtftMs / 1000).toFixed(1) + '秒' : '--';
      if (elTps) {
        if (isGenerating && realtimeSpeed > 0) {
          elTps.innerHTML = `<span style="color: #0284c7; font-weight: 600;">⚡ ${realtimeSpeed} tok/s</span>`;
        } else {
          elTps.innerHTML = `<span style="color: var(--muted-foreground, rgba(16,16,16,0.6)); font-weight: 500;">0 tok/s</span>`;
        }
      }
      if (elAvgSpeed) {
        elAvgSpeed.innerText = sessionAvgSpeed ? `${sessionAvgSpeed} tok/s` : '-- tok/s';
      }
      if (elLastSpeed) {
        elLastSpeed.innerText = lastSpeed ? `${lastSpeed} tok/s` : '--';
      }

      // -----------------------------------------------------------
      // 4. 更新卡片2：Token 用量
      // -----------------------------------------------------------
      const elTokTotal = document.getElementById('agy-token-total');
      const elTokHitRate = document.getElementById('agy-token-hitrate');
      const elTokUncached = document.getElementById('agy-token-uncached');
      const elTokCached = document.getElementById('agy-token-cached');
      const elTokOutput = document.getElementById('agy-token-output');

      if (elTokTotal) elTokTotal.innerText = `${totalCumulativeTokens.toLocaleString()} tok`;
      if (elTokHitRate) elTokHitRate.innerText = `${globalCacheHitRate}%`;
      if (elTokUncached) elTokUncached.innerText = `${totalInputTokens.toLocaleString()} tok`;
      if (elTokCached) elTokCached.innerText = `${totalCacheReadTokens.toLocaleString()} tok`;
      if (elTokOutput) elTokOutput.innerText = `${totalOutputTokens.toLocaleString()} tok`;

      // -----------------------------------------------------------
      // 5. 更新卡片3：上下文容量（流光进度条）
      // -----------------------------------------------------------
      const elContextPct = document.getElementById('agy-context-pct');
      const elContextBar = document.getElementById('agy-context-bar');
      const elContextUsed = document.getElementById('agy-context-used');
      const elContextStepCache = document.getElementById('agy-context-step-cache');
      const elContextInout = document.getElementById('agy-context-inout');
      const elContextSteps = document.getElementById('agy-context-steps');

      if (elContextPct) {
        elContextPct.innerText = `${pct}%`;
        elContextPct.style.color = color;
      }
      if (elContextBar) {
        elContextBar.style.width = `${pct}%`;
        elContextBar.style.background = barGradient;
      }
      if (elContextUsed) elContextUsed.innerText = `${formatTokens(currentTurnUsed)} / 1.0M`;
      if (elContextStepCache) elContextStepCache.innerText = `${formatTokens(stepCache)} (${Math.round((stepCache / (currentTurnUsed || 1)) * 100)}%)`;
      if (elContextInout) elContextInout.innerText = `${formatTokens(stepIn)} / ${formatTokens(stepOut)}`;
      if (elContextSteps) elContextSteps.innerText = `${steps.length} 步`;

    } catch (e) {
      console.warn('[InteractiveCapsule] Error:', e);
    }
  }

  ensureMounted();
  updateData();

  window.__agyContextCircleTimer = setInterval(updateData, REFRESH_INTERVAL_MS);
})();
