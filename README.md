# AI 语音绘图助手 🎨 (Voice-to-Image Generation)

> **七牛云暑期实训营 参赛作品**  
> 语音驱动的 AI 绘画工具 —— 你说，它画。支持鼠标交互增强。

**演示 Demo：**https://www.bilibili.com/video/BV1wzJK6zExG/?spm_id_from=333.1387.homepage.video_card.click&vd_source=68837250daeafdb481ecf452c014f217

---

## 核心亮点

| 亮点 | 说明 |
|------|------|
| **🎤 语音驱动 + 双引擎** | 点击"开始绘画"，全程语音操控。默认讯飞极速转写（高精度），降级浏览器 Web Speech API（零配置），一键切换 |
| **🧠 LLM = 绘画设计师** | 不再是被动的指令转换器，而是主动理解意图、规划构图、设计画面的**绘画设计师** |
| **✨ SVG 艺术级质感** | 渐变、贝塞尔曲线、分层构建、光影效果——LLM 生成的 SVG 具备绘画级品质 |
| **🎯 自然语言理解** | "右上角画个红色的圆""在房子旁边画一只小狗"——LLM 自动解析位置、颜色、大小 |
| **🖱️ 鼠标交互增强** | 选中、拖拽、删除、撤销/重做、网格参考系 |
| **🔒 API Key 安全隔离** | 代理层转发，前端不接触任何密钥 |

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 19 + Vite 8 |
| 画布引擎 | **原生 Canvas 2D API** |
| 语音识别 | 讯飞 IAT（默认）+ Web Speech API（降级），双引擎可切换 |
| 语音合成 | Speech Synthesis API（浏览器原生） |
| 后端代理 | Express + providers.js 多 Provider 路由 |
| LLM | DeepSeek V4 Flash（默认，可切换 Qwen3.7-Max / Kimi K2.6） |
| 基准测试 | 16 用例多维评分框架（server/benchmark/） |

---

## 架构：厚前端 + 薄代理 + 智能 LLM

```
      用户语音
         │
         ▼
  ┌──────────────────────────────────────┐
  │  厚前端（浏览器）                     │
  │                                      │
  │  ● VoiceController — Web Speech API  │
  │  ● agent.js — 调用代理层              │
  │  ● 解析 JSON → 状态判断               │
  │  ● Canvas 2D 渲染                     │
  │  ● canvasSummary — 画布状态摘要       │
  │  ● History — 指令历史                 │
  └────────────┬─────────────────────────┘
               │ { text, canvasSummary }
               ▼
  ┌──────────────────────────────────────┐
  │  薄代理（Express）                    │
  │  ● 接收请求 + 注入 API Key            │
  │  ● 注入系统提示词（绘画设计师角色）    │
  │  ● 坐标校验 validateActions()         │
  │  ● 多 Provider 路由                   │
  └────────────┬─────────────────────────┘
               │
               ▼
  ┌──────────────────────────────────────┐
  │  云 LLM — 绘画设计师                  │
  │                                      │
  │  不是"格式转换器"而是"设计师"：        │
  │  ① 理解设计意图                       │
  │  ② 构图规划（布局/平衡/主次）         │
  │  ③ 确定表达方式（几何/SVG）           │
  │  ④ 细化参数（坐标/尺寸/颜色）         │
  │                                      │
  │  输出：{ status, actions[], summary } │
  └──────────────────────────────────────┘
```

## 系统提示词设计哲学

2026-06-14 重写了系统提示词，核心转变：

**之前：** 你是一个绘图助手。用户通过语音告诉你画什么。（被动执行者）

**之后：** 你是一位经验丰富的**绘画设计师和空间规划师**。（主动创造者）

### 四步设计流程

每次绘制前，LLM 在大脑中完成：

1. **逐元素解析** — 提取每个元素的颜色/形状/位置，确保颜色绑定正确
2. **构图规划** — 主次分明、视觉平衡、场景协调
3. **确定表达方式** — 几何形体用 draw_shape，复杂物体用 draw_svg
4. **细化参数** — 精确到坐标、尺寸、颜色，检查重叠比例

### SVG 艺术质量标准（六大技法）

| 技法 | 要求 |
|------|------|
| **① 渐变** | 每个主要物体至少使用 `linearGradient` 或 `radialGradient` |
| **② 贝塞尔曲线** | 有机形体必须用 C/Q 曲线，避免几何堆砌 |
| **③ 分层构造** | 背景→中景→前景，利用 `opacity` 创造景深 |
| **④ 光影立体感** | 半透明投影 + 高光，不做纯平面填充 |
| **⑤ 丰富配色** | 十六进制色码，每物体至少 3 种色调 |
| **⑥ 视口规范** | `viewBox="0 0 800 600"` 与画布一致 |

---

## 目录结构

```
voice-to-image-generation/
├── src/                          # React 前端源码
│   ├── components/
│   │   ├── Canvas.jsx            原生 Canvas 2D 渲染 + 鼠标交互
│   │   ├── VoiceController.jsx   语音识别生命周期
│   │   ├── VoiceStatusBar.jsx    状态可视化指示器
│   │   ├── VoiceStatusBar.jsx    状态指示器
│   │   ├── QuickBar.jsx          悬浮操作栏
│   │   ├── History.jsx           指令历史
│   │   ├── MessageLog.jsx        系统消息日志
│   │   └── ErrorBoundary.jsx     错误边界
│   ├── services/
│   │   ├── agent.js              LLM 代理客户端
│   │   ├── tts.js                语音合成封装
│   │   ├── asr-manager.js        ASR 统一入口（双引擎切换）
│   │   ├── asr-xunfei.js         讯飞 IAT WebSocket 引擎
│   │   ├── asr-browser.js        浏览器 Web Speech API 引擎
│   │   ├── audio-capture.js      getUserMedia PCM 音频采集
│   │   ├── intentClassifier.js   意图分类（draw/control/chat）
│   │   ├── canvasSummary.js      画布状态摘要（含 zone 区域）
│   │   ├── storage.js            localStorage 持久化
│   │   └── hints.js              动态 Guidance 生成
│   ├── App.jsx / App.css         根组件与样式
│   ├── config.js                 运行时配置
│   └── main.jsx                  React 入口
├── server/                       # Express 代理后端
│   ├── proxy.js                  加 Key 转发 + 系统提示词 + validateActions()
│   ├── providers.js              模型注册表（DeepSeek/Qwen/GLM/Kimi）
│   ├── benchmark/                基准测试框架（16 用例 × 多维评分）
│   │   ├── test-cases.js
│   │   ├── scorer.js
│   │   ├── report.js
│   │   ├── runner.mjs
│   │   └── results/              （生成结果，已 gitignore）
│   └── package.json
├── docs/                         # 文档
│   ├── design.md                 设计文档
│   └── benchmark-selection.md    基准测试选型报告
├── .harness/                     # Harness 自动化工作制
├── scripts/
│   └── switch-asr.mjs            CLI 语音引擎切换工具
├── docs/
│   ├── design.md                 设计文档
│   └── benchmark-selection.md    基准测试选型报告
├── .harness/
│   ├── design.md                 设计方案
│   └── progress.json             进度跟踪
├── index.html
├── vite.config.js
├── package.json
├── CLAUDE.md                     项目规范
└── README.md                     本文件
```

---

## 快速启动

### 环境要求

- Node.js 20+
- 两个终端窗口（前后端需同时运行）
- 端口 8000 和 5173 未被占用
- 麦克风权限
- **浏览器：** 讯飞模式任意浏览器可用；浏览器模式 Edge 直接可用，Chrome 需要 VPN（Google Web Speech API 对中国大陆的限制，与项目无关）

### 1. 克隆与配置

```bash
git clone https://github.com/Xiang991/voice-to-image-generation.git
cd voice-to-image-generation
cp .env.example .env              # 编辑 .env，填入 DEEPSEEK_API_KEY
cp server/.env.example server/.env # 编辑 server/.env，填入 LLM Key + 讯飞 Key（可选）
```

### 2. 启动后端代理（端口 8000）

```bash
cd server
npm install
node proxy.js
```

### 3. 启动前端开发服务器（端口 5173）

```bash
npm install
npm run dev
```
### 4.选择语音引擎  
在根文件夹下：
#### 模式一：讯飞极速转写（默认）

使用讯飞 IAT WebSocket 接口，端到端延迟低、中文识别准。

```bash
npm run asr:xunfei
```

按提示依次输入 App ID、API Key、API Secret，自动写入 `server/.env`。

#### 模式二：浏览器 Web Speech API

不依赖任何外部 API Key，直接使用浏览器内置语音识别。

```bash
npm run asr:browser
```

- **Edge 浏览器**：直接可用
- **Chrome 浏览器**：需要 VPN（Google Web Speech API 的区域限制，与项目无关）

> 没有讯飞 Key？直接用 Edge 打开，零配置即可体验。


浏览器打开 `http://localhost:5173/voice-to-image-generation/`，点击「开始绘画」按钮。


---
## 核心功能

### 语音绘图

| 功能 | 说明 |
|------|------|
| **语音交互** | 点击"开始绘画"后全程语音驱动 |
| **自然语言理解** | 支持模糊口语指令，LLM 自动解析意图和参数 |
| **画布状态感知** | 每次指令携带当前画布摘要，LLM 具备空间上下文 |
| **多图形支持** | 圆形、矩形、线条 + 任意 SVG 路径（LLM 生成） |
| **ASR 纠错** | 内置同音字映射（发→画、园→圆、巨形→矩形） |

### 画布交互

| 功能 | 说明 |
|------|------|
| **鼠标选中** | 点击图形选中，蓝色虚线框 + 四角手柄 |
| **拖拽移动** | 选中后拖拽修改位置 |
| **键盘删除** | Delete / Backspace |
| **坐标 HUD** | 选中时显示精确坐标和尺寸 |
| **网格参考系** | 可切换坐标网格 + 边距标尺 |

### 撤销与持久化

| 功能 | 说明 |
|------|------|
| **多步撤销/重做** | 50 步撤销栈（Ctrl+Z / Ctrl+Y） |
| **自动保存** | localStorage 300ms 节流，刷新恢复 |
| **导出 PNG** | 一键导出画布图片 |
| **导出/导入项目** | .json 项目文件保存/加载 |

---

## 模型基准测试

内置 16 用例 × 10 维度评分框架：

```bash
cd server
node benchmark/runner.mjs
```

**结论：** 四模型（DeepSeek V4 Flash/Pro、Qwen3.7-Max、Kimi K2.6）准确率 95.5% 完全相同，**DeepSeek V4 Flash 以 265ms 延迟**为最优选型。详见 `docs/benchmark-selection.md`。

---

## 作品提交信息

- **参赛批次：** 七牛云暑期实训营
- **仓库地址：** [https://github.com/Xiang991/voice-to-image-generation](https://github.com/Xiang991/voice-to-image-generation)

---

## 许可

本项目为七牛云暑期实训营参赛作品，知识产权归提交者所有。
