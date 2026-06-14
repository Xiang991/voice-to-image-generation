# AI 语音绘图助手 (Voice-to-Image Generation)

> **七牛云暑期实训营 参赛作品**  
> 语音驱动的 AI 绘图工具 —— 你说，它画。支持鼠标交互增强。

---

## 项目简介

AI 语音绘图助手是一款**语音主导 + 鼠标增强**的绘图应用。用户通过自然语言指令（如"画一个红色的圆""在左上角加一个蓝色的正方形"），系统通过语音识别 + LLM 语义理解在画布上绘制图形；同时支持鼠标直接选中、拖拽、删除已绘图形。

**架构模式：** 厚前端 + 薄代理 + 纯云 LLM

| 层 | 职责 | 技术选型 |
|----|------|---------|
| 前端 | 语音捕获、画布渲染、TTS 反馈 | React 19 + Fabric.js 7 + Web Speech API |
| 代理 | API Key 安全隔离、多 Provider 路由 | Node.js + Express + providers.js 注册表 |
| 云 LLM | 自然语言 → 结构化绘图指令 | DeepSeek V4 Flash（已基准测试验证：可切换 Qwen/Kimi） |

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 19 |
| 构建工具 | Vite 8 |
| 画布引擎 | **原生 Canvas 2D API**（非 Fabric.js） |
| 语音识别 | Web Speech API（浏览器原生） |
| 语音合成 | Speech Synthesis API（浏览器原生） |
| 后端代理 | Express + providers.js 多 Provider 路由 |
| LLM | DeepSeek V4 Flash（默认）切换 Qwen3.7-Max / Kimi K2.6 |
| 基准测试 | 16 用例多维评分框架（server/benchmark/） |

---

## 核心功能

### 语音绘图
| 功能 | 说明 |
|------|------|
| **语音交互** | 点击"开始绘画"后全程语音驱动，说"结束绘画"退出 |
| **自然语言理解** | 支持模糊口语指令——"右上角画个红色的圆"，由 LLM 自动解析 |
| **画布状态感知** | 每次指令携带当前画布摘要，LLM 具备空间上下文，支持增量修改 |
| **多图形支持** | 圆形、矩形、线条 + 任意 SVG 路径（LLM 生成） |
| **ASR 纠错** | 内置同音字映射表（发→画、园→圆等） |
| **语音反馈** | 绘图完成后 TTS 播报结果 |

### 画布交互（2026-06-14 新增）
| 功能 | 说明 |
|------|------|
| **鼠标选中** | 点击图形即可选中，显示蓝色虚线框 + 四角手柄 |
| **拖拽移动** | 选中后拖拽改变图形位置 |
| **键盘删除** | Delete / Backspace 删除选中图形 |
| **坐标 HUD** | 选中图形时显示精确坐标和尺寸信息 |
| **网格参考系** | 可切换的坐标网格 + 边距标尺 |
| **动态提示** | Guidance Chips 根据画布密度自动切换 |

### 撤销与持久化
| 功能 | 说明 |
|------|------|
| **多步撤销/重做** | 支持 50 步撤销栈 + 重做（Ctrl+Z / Ctrl+Y） |
| **自动保存** | localStorage 300ms 节流自动保存，刷新后恢复 |
| **导出 PNG** | 一键导出画布为图片 |
| **导出/导入项目** | 保存/加载 .json 项目文件 |

### 工程质量
| 功能 | 说明 |
|------|------|
| **Error Boundary** | 画布渲染错误隔离，防止整页崩溃 |
| **SVG 加载占位** | SVG 异步加载期间显示虚线占位框 |
| **键盘快捷键** | Ctrl+Z 撤销、Ctrl+Y 重做、Ctrl+S 导出 |
| **TTS 时序修复** | 等待 SVG 渲染完成后再播报语音 |
| **竞态保护** | 连续快速指令不丢失数据 |

---

## 目录结构

```
voice-to-image-generation/
├── src/
│   ├── components/
│   │   ├── Canvas.jsx            # 原生 Canvas 2D 渲染 + 鼠标交互
│   │   ├── VoiceController.jsx    # 语音识别生命周期
│   │   ├── VoiceStatusBar.jsx     # 状态可视化指示器
│   │   ├── QuickBar.jsx           # 悬浮操作栏（撤销/重做/删除/导出/网格）
│   │   ├── History.jsx            # 指令历史
│   │   ├── ErrorBoundary.jsx      # 错误边界
│   │   └── _archived/             # 旧组件归档
│   ├── services/
│   │   ├── agent.js               # LLM 代理客户端
│   │   ├── tts.js                 # 语音合成封装
│   │   ├── intentClassifier.js    # 意图分类（draw/control/chat）
│   │   ├── canvasSummary.js       # 画布状态摘要
│   │   ├── storage.js             # localStorage 持久化
│   │   └── hints.js               # 动态 Guidance 生成
│   ├── App.jsx / App.css          # 根组件与样式
│   ├── config.js                  # 运行时配置
│   └── main.jsx                   # React 入口
├── server/                        # Express 代理后端
│   ├── proxy.js
│   ├── providers.js
│   ├── benchmark/
│   └── .env
├── docs/
│   ├── design.md
│   └── benchmark-selection.md
├── public/
├── index.html
├── vite.config.js
├── package.json
├── CLAUDE.md
└── README.md
```

---

## 快速启动

需要同时启动两个服务（前后端分离）：

### 1. 启动后端代理（端口 8000）

```bash
cd server
cp .env.example .env            # 编辑 .env 填入 API Key
npm install
node proxy.js
```

### 2. 启动前端开发服务器（端口 5173）

```bash
# 新开一个终端
cp .env.example .env
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`，点击麦克风按钮开始语音绘图。

---

## 原创功能说明

### 核心功能

| 功能 | 说明 |
|------|------|
| **纯语音交互** | 全程语音驱动，无需键盘鼠标操作。说"开始绘画"激活，说"结束绘画"停止 |
| **自然语言理解** | 支持模糊口语指令——"右上角画个红色的圆""把所有图形放大一倍"等，由 LLM 自动理解 |
| **画布状态感知** | 每次指令携带当前画布摘要，LLM 具备空间上下文，支持增量修改 |
| **多图形支持** | 支持矩形、圆形、椭圆、三角形、线段、多边形等基本图形 + 任意 SVG 路径 |
| **ASR 纠错** | 针对语音识别常见错误（同音字、歧义词）内置映射表，提升准确率 |
| **语音反馈** | 每次操作后 TTS 播报结果摘要，形成完整的语音交互闭环 |
| **三级状态分支** | LLM 返回 `success`（成功）/ `optimized`（已优化）/ `error`（无法理解）三种状态，前端分别处理 |

### 技术亮点

- **API Key 安全隔离：** 前端不接触任何 API 密钥，所有 LLM 请求通过后端代理转发
- **Fabric.js 7 集成：** 利用新版 Fabric.js API 实现高效画布操作
- **无外部语音服务依赖：** 语音识别与合成全部依赖浏览器原生 Web Speech API，零额外成本

---

## 测试

```bash
npm test          # 运行全部测试（Vitest）
npm run dev       # 启动开发服务器手动验证
npx vitest run    # 单次运行
```

当前测试覆盖：164 项功能测试通过，涵盖组件渲染、状态管理、意图分类、端到端链路。

---

## 模型基准测试

内置多模型基准测试框架：

```bash
cd server
node benchmark/runner.mjs
```

**结论（2026-06-13）：** 四模型准确率 95.5% 等价，DeepSeek V4 Flash 以 **265ms** 延迟为最优选型。

---

## 作品提交信息

- **参赛批次：** 七牛云暑期实训营
- **仓库地址：** [https://github.com/Xiang991/voice-to-image-generation](https://github.com/Xiang991/voice-to-image-generation)

---

## 许可

本项目为七牛云暑期实训营参赛作品，知识产权归提交者所有。
