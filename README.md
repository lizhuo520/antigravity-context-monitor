# Antigravity Context & Session Monitor 🚀

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-brightgreen.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-orange.svg)](#)
[![Antigravity](https://img.shields.io/badge/Client-Antigravity-6366f1.svg)](#)

**专为 Google Antigravity 打造的底部会话监控与上下文仪表盘组件**  
实时吞吐流速 (TPS) · 流光上下文容量条 · 会话平均速度 · Token 缓存命中统计 · 鼠标点击交互

[简体中文](./README.md) | [English](./README_EN.md)

</div>

---

## 🌟 效果展示与特性速览

### 1. 底部常驻微型监控胶囊栏
紧凑嵌入在输入框模型选择按钮旁，提供无干扰的高信息密度监控：

<div align="center">
  <img src="./assets/capsules.png" alt="底部三段式胶囊栏" width="600" />
</div>

- **胶囊 1（`⏱` 会话统计）**：`{轮次} 轮 {步数} 步 · {⚡ 实时速度 / 0 tok/s}`
- **胶囊 2（`🗄` Token 用量）**：`{全会话累计流转 Token} · 缓存命中 {百分比}%`
- **胶囊 3（`⭕` 上下文容量）**：微型环形进度条，根据 1.0M 窗口占用自适应变色（蓝色安全 / 黄色预警 / 红色危险）。

---

### 2. 三大交互卡片（点击弹出，点击空白处自动收起）

<div align="center">
  <table>
    <tr>
      <td align="center"><b>会话统计页面</b></td>
      <td align="center"><b>Token 用量明细</b></td>
    </tr>
    <tr>
      <td><img src="./assets/card_session.png" width="300" alt="会话统计" /></td>
      <td><img src="./assets/card_tokens.png" width="300" alt="Token用量" /></td>
    </tr>
  </table>
</div>

- **卡片 1【会话统计】（点击胶囊 1 打开）**：
  - **模型用时**：统计全会话模型实际思考生成累计耗时（分秒格式）。
  - **工具调用用时**：统计命令行、代码修改等工具执行累计耗时。
  - **首 token 平均（TTFT）**：统计模型首次吐字的平均响应延迟。
  - **实时速度（TPS）**：活跃生成时跳动显示实时流速（如 `⚡ 549 tok/s`），空闲待命时实时归零。
  - **本次会话平均速度**：全会话全局加权平均流速（$\text{总生成Token} / \text{总模型耗时}$）。
  - **最近生成均速**：完整保留上一轮生成的峰值/均速记录。

- **卡片 2【Token 用量】（点击胶囊 2 打开）**：
  - **总量与缓存命中**：右上角展示全会话累计流转 Token 总数，绿色高亮缓存命中率（如 `94%`）。
  - **细分维度**：精确统计未缓存输入、缓存读取（Cache Read）与生成输出总量。

- **卡片 3【上下文容量】（点击胶囊 3 打开）**：
  - **从左到右流光特效**：基于 CSS `@keyframes agy-beam-slide` 的白色光芒渐变流光，生动展现容量水位。
  - **单轮占用 vs 100万**：展示当前轮次所消耗的上下文（如 `47.2k / 1.0M`）。
  - **单轮 Cache 占比**：标明本轮缓存读取 token 及其在当前上下文中的占比。

---

## ⚡ 核心优势与技术原理

1. **真实时流速引擎（Real-time Speed Engine）**：
   - 告别传统工具“静态常驻历史数值”的假速度。
   - 监听底层 RPC 状态机，模型生成中实时捕获动态吞吐率；生成完毕后实时归零（`0 tok/s`），符合网络与性能仪表的工业标准。
2. **轻量非侵入式热加载**：
   - 通过 Chrome DevTools Protocol (CDP) 自动发现 Antigravity 调试端口并注入。
   - 无需修改客户端核心源码，安全无损，关闭客户端后不留残留。
3. **极速 2 秒自适应轮询**：
   - 每 2 秒同步一次底层轨迹步骤，计算消耗微乎其微。
4. **原生 UI 融合设计**：
   - 完全遵循 Antigravity 客户端视觉规范，完美适配浅色/深色主题与字体层级。

---

## 🛠️ 安装与使用

### 前置要求
- 已安装 [Node.js](https://nodejs.org/) (v18 或更高版本)。
- 已安装并启动 [Antigravity](https://antigravity.google) 客户端。

---

### 方法一：Windows 一键快速注入（推荐）

1. 克隆或下载本项目：
   ```bash
   git clone https://github.com/lizhuo520/antigravity-context-monitor.git
   cd antigravity-context-monitor
   ```
2. 双击运行 `install.bat`，即可一键自动检测并完成注入！

---

### 方法二：命令行一键启动

```bash
# 克隆仓库
git clone https://github.com/lizhuo520/antigravity-context-monitor.git
cd antigravity-context-monitor

# 一次性注入到当前 Antigravity 窗口
npm start
# 或运行
npm run inject
```

---

### 方法三：常驻后台守护模式（自动随客户端重连）

如果您希望在 Antigravity 重启或新建窗口时自动持续生效，可以启动守护进程：

```bash
npm run daemon
```

---

## 📁 目录结构

```
antigravity-context-monitor/
├── assets/                 # 效果截图与图标资源
├── src/
│   ├── widget.js           # 挂件核心代码（UI、动画、事件委托与指标计算）
│   ├── injector.js         # CDP 端口自动探测与注入模块
│   └── daemon.js           # 常驻后台守护进程
├── install.bat             # Windows 一键执行脚本
├── package.json            # 项目配置与 npm 脚本
├── LICENSE                 # MIT 开源许可证
└── README.md               # 中文使用说明书
```

---

## 📄 开源许可证

本项目基于 [MIT License](./LICENSE) 开源。欢迎提 Issue 与 PR！
