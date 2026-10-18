(() => {
  const REQUIRED_VERSION = '1.0M-interactive-three-cards-v18-robust-click-outside';
  const existingWidgets = document.querySelectorAll('#agy-model-context-widget, #agy-capsule-monitor-widget');
  if (window.__agyContextCircleVersion === REQUIRED_VERSION && existingWidgets.length === 1) {
    return;
  }

  // 清理历史挂件、定时器与全局监听
  existingWidgets.forEach(el => el.remove());
  document.querySelectorAll('#agy-context-circle-container, #antigravity-context-monitor-root').forEach(el => el.remove());
  if (window.__agyContextCircleTimer) clearInterval(window.__agyContextCircleTimer);
  if (window.__agyFastUrlWatcher) clearInterval(window.__agyFastUrlWatcher);
  if (window.__agyRetryMountTimer) clearInterval(window.__agyRetryMountTimer);
  if (window.__agyCloseMonitorPopovers) {
    window.removeEventListener('click', window.__agyCloseMonitorPopovers);
    document.removeEventListener('click', window.__agyCloseMonitorPopovers);
  }
  if (window.__agyOnPopState) window.removeEventListener('popstate', window.__agyOnPopState);
  if (window.__agyOnHashChange) window.removeEventListener('hashchange', window.__agyOnHashChange);

  window.__agyContextCircleVersion = REQUIRED_VERSION;

  const CONTEXT_LIMIT = 1000000; // 1,000,000 (1.0M)
  const MINI_CIRCLE_C = 59.6903;  // 2 * Math.PI * 9.5

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

  function getCascadeIdFromUrl() {
    const match = location.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
  }

  // 注入样式
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
      width: 236px;
      background: var(--card, #ffffff);
      border: 1px solid var(--border, rgba(0, 0, 0, 0.09));
      border-radius: 10px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.04);
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
    '  <span id="agy-text-speed">-- 轮 -- 步 · -- tok/s</span>',
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
    // 卡片1：会话统计（已去掉本次会话平均速度）
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
    '    <span class="agy-card-label">输出速度（TPS）</span>',
    '    <span id="agy-stat-tps" class="agy-card-val" style="color: #0284c7; font-weight: 600;">-- tok/s</span>',
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
    // 卡片3：上下文界面（流光条）
    // -------------------------------------------------------------
    '<div id="agy-card-context" class="agy-popover-card" style="right: 0;">',
    '  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">',
    '    <div style="display: flex; align-items: center; gap: 6px;">',
    '      <span style="font-size: 13px; font-weight: 600; color: var(--foreground, #101010);">上下文容量</span>',
    '    </div>',
    '    <span id="agy-context-pct" style="color: var(--primary, #007acc); font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums;">0%</span>',
    '  </div>',
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

  // 交互逻辑
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

  window.__agyCloseMonitorPopovers = (e) => {
    try {
      if (!e || !e.target || e.target === window || !(e.target instanceof Node) || !widget.contains(e.target)) {
        closeAll();
      }
    } catch (_) {
      closeAll();
    }
  };
  window.addEventListener('click', window.__agyCloseMonitorPopovers);
  document.addEventListener('click', window.__agyCloseMonitorPopovers);

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

  // 精准计算单步生成速度
  function getStepSpeed(s) {
    const m = s.metadata || {};
    const u = m.modelUsage;
    if (!u) return null;
    const out = Number(u.outputTokens || 0);
    if (out < 50) return null;

    let dur = 0;
    const transitions = m.internalMetadata?.statusTransitions || [];
    const genT = transitions.find(t => t.updatedStatus === 'CORTEX_STEP_STATUS_GENERATING')?.timestamp;
    const doneT = transitions.find(t => t.updatedStatus === 'CORTEX_STEP_STATUS_DONE')?.timestamp;

    if (genT && doneT) {
      dur = new Date(doneT).getTime() - new Date(genT).getTime();
    }
    if (dur < 300) {
      const v = m.viewableAt ? new Date(m.viewableAt).getTime() : 0;
      const f = m.finishedGeneratingAt ? new Date(m.finishedGeneratingAt).getTime() : 0;
      if (v && f && f > v) dur = f - v;
    }
    if (dur < 300) {
      const c = m.createdAt ? new Date(m.createdAt).getTime() : 0;
      const f = m.finishedGeneratingAt ? new Date(m.finishedGeneratingAt).getTime() : 0;
      if (c && f && f > c) {
        const totalTime = f - c;
        if (out >= 100 && totalTime >= 800) {
          dur = totalTime;
        }
      }
    }

    if (dur >= 400) {
      const spd = Math.round((out / (dur / 1000)) * 10) / 10;
      if (spd >= 10 && spd <= 600) {
        return { out, dur, spd };
      }
    }
    return null;
  }

  let lastActiveCascadeId = '';

  async function updateData() {
    ensureMounted();

    try {
      const cascadeId = getCascadeIdFromUrl();
      if (!cascadeId) return;

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
          endIndex: 10000,
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
      let lastUsage = null;

      // 反向扫描提取“上一次发生大段文字生成时的平均速度”
      // 优先扫描大段文本生成 (out >= 200)；若无则降级扫描常规生成 (out >= 50)
      let lastSpeed = null;
      for (let i = steps.length - 1; i >= 0; i--) {
        const sp = getStepSpeed(steps[i]);
        if (sp && sp.out >= 200) {
          lastSpeed = sp.spd;
          break;
        }
      }
      if (!lastSpeed) {
        for (let i = steps.length - 1; i >= 0; i--) {
          const sp = getStepSpeed(steps[i]);
          if (sp) {
            lastSpeed = sp.spd;
            break;
          }
        }
      }

      for (const s of steps) {
        const meta = s.metadata || {};

        if (meta.modelUsage) {
          const u = meta.modelUsage;
          totalInputTokens += Number(u.inputTokens || 0);
          totalOutputTokens += Number(u.outputTokens || 0);
          totalCacheReadTokens += Number(u.cacheReadTokens || 0);
          lastUsage = u;

          // 模型用时精准累加
          let stepModelMs = 0;
          const transitions = meta.internalMetadata?.statusTransitions || [];
          const genT = transitions.find(t => t.updatedStatus === 'CORTEX_STEP_STATUS_GENERATING')?.timestamp;
          const doneT = transitions.find(t => t.updatedStatus === 'CORTEX_STEP_STATUS_DONE')?.timestamp;
          if (genT && doneT) {
            stepModelMs = new Date(doneT).getTime() - new Date(genT).getTime();
          }
          if (stepModelMs < 100) {
            const c = meta.createdAt ? new Date(meta.createdAt).getTime() : 0;
            const f = meta.finishedGeneratingAt ? new Date(meta.finishedGeneratingAt).getTime() : 0;
            if (c && f && f > c) stepModelMs = f - c;
          }
          if (stepModelMs > 0 && stepModelMs < 300000) {
            modelTotalMs += stepModelMs;
          }

          // 首 Token 时间 (TTFT)
          const createT = meta.createdAt ? new Date(meta.createdAt).getTime() : 0;
          const genStart = genT ? new Date(genT).getTime() : (meta.viewableAt ? new Date(meta.viewableAt).getTime() : 0);
          if (createT && genStart && genStart >= createT) {
            const ttft = genStart - createT;
            if (ttft > 50 && ttft < 60000) {
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

      // 全会话累计总流转 Token
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

      // 1. 更新底部三段式胶囊栏
      const textSpeed = document.getElementById('agy-text-speed');
      const textCache = document.getElementById('agy-text-cache');
      const textPct = document.getElementById('agy-text-pct');
      const miniRing = document.getElementById('agy-capsule-ring');

      if (textSpeed) {
        textSpeed.innerText = `${rounds} 轮 ${steps.length} 步 · ${lastSpeed ? lastSpeed + ' tok/s' : '-- tok/s'}`;
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

      // 2. 更新卡片1：会话统计
      const elModelTime = document.getElementById('agy-stat-modeltime');
      const elToolTime = document.getElementById('agy-stat-tooltime');
      const elTtft = document.getElementById('agy-stat-ttft');
      const elTps = document.getElementById('agy-stat-tps');

      if (elModelTime) elModelTime.innerText = fmtDuration(modelTotalMs);
      if (elToolTime) elToolTime.innerText = fmtDuration(toolTotalMs);
      if (elTtft) elTtft.innerText = avgTtftMs > 0 ? (avgTtftMs / 1000).toFixed(1) + '秒' : '--';
      if (elTps) {
        elTps.innerText = lastSpeed ? `${lastSpeed} tok/s` : '-- tok/s';
      }

      // 3. 更新卡片2：Token 用量
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

      // 4. 更新卡片3：上下文容量
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

  // -----------------------------------------------------------
  // 极速切换机制：切会话 0 延迟响应与重挂载
  // -----------------------------------------------------------
  function triggerImmediateUpdate() {
    if (window.__agyRetryMountTimer) {
      clearInterval(window.__agyRetryMountTimer);
      window.__agyRetryMountTimer = null;
    }

    if (ensureMounted()) {
      updateData();
    } else {
      let attempts = 0;
      window.__agyRetryMountTimer = setInterval(() => {
        attempts++;
        if (ensureMounted()) {
          clearInterval(window.__agyRetryMountTimer);
          window.__agyRetryMountTimer = null;
          updateData();
        } else if (attempts >= 20) {
          clearInterval(window.__agyRetryMountTimer);
          window.__agyRetryMountTimer = null;
        }
      }, 50);
    }
  }

  function handleRouteOrUrlChange() {
    const curId = getCascadeIdFromUrl();
    if (curId && curId !== lastActiveCascadeId) {
      lastActiveCascadeId = curId;
      triggerImmediateUpdate();
    }
  }

  // 拦截 pushState 与 replaceState
  if (!window.__agyPatchedHistory) {
    window.__agyPatchedHistory = true;
    const origPush = history.pushState;
    history.pushState = function(...args) {
      origPush.apply(this, args);
      handleRouteOrUrlChange();
    };
    const origReplace = history.replaceState;
    history.replaceState = function(...args) {
      origReplace.apply(this, args);
      handleRouteOrUrlChange();
    };
  }

  window.__agyOnPopState = () => handleRouteOrUrlChange();
  window.__agyOnHashChange = () => handleRouteOrUrlChange();
  window.addEventListener('popstate', window.__agyOnPopState);
  window.addEventListener('hashchange', window.__agyOnHashChange);

  // 150ms 超高速 URL 变化嗅探器
  window.__agyFastUrlWatcher = setInterval(() => {
    handleRouteOrUrlChange();
  }, 150);

  // 初始化执行
  lastActiveCascadeId = getCascadeIdFromUrl();
  ensureMounted();
  updateData();

  // 兜底 2 秒定期刷新（同一会话中生成完毕时自动同步数据）
  window.__agyContextCircleTimer = setInterval(updateData, 2000);
})();
