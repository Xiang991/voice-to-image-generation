# AI 语音绘图助手 (Voice-to-Image Generation)

> **七牛云暑期实训营 参赛作品**  
> 纯语音驱动的 AI 绘图工具 —— 你说，它画。

---

## 项目简介

AI 语音绘图助手是一款**纯语音控制**的绘图应用。用户只需说出自然语言指令（如"画一个红色的圆""在左上角加一个蓝色的正方形"），系统通过语音识别 + LLM 语义理解，自动在画布上绘制对应图形。

**架构模式：** 厚前端 + 薄代理 + 纯云 LLM

| 层 | 职责 | 技术选型 |
|----|------|---------|
| 前端 | 语音捕获、画布渲染 | React 19 + Fabric.js 7 + Web Speech API |
| 代理 | API Key 安全隔离、坐标后处理校验 | Node.js + Express + providers.js 注册表 |
| 云 LLM | 自然语言 → 结构化绘图指令 | DeepSeek V4 Flash（已基准测试验证：可切换 Qwen/Kimi） |

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 19 |
| 构建工具 | Vite |
| 画布引擎 | Fabric.js 7 |
| 语音识别 | Web Speech API（浏览器原生） |
| 语音合成 | Speech Synthesis API（已禁用） |
| 后端代理 | Express + providers.js 多 Provider 路由 |
| LLM | DeepSeek V4 Flash（默认）切换 Qwen3.7-Max / Kimi K2.6 |
| 基准测试 | 16 用例多维评分框架（server/benchmark/） |

---

## 目录结构

```
voice-to-image-generation/     ← GitHub 远端仓库名
├── src/                       # React 前端源码
│   ├── components/            # UI 组件 (VoiceController, Canvas, History)
│   ├── services/              # 服务模块 (agent, tts, canvasSummary)
│   ├── App.jsx / App.css      # 根组件与样式
│   └── main.jsx               # 入口
├── server/                    # Express 代理后端
│   ├── proxy.js               # API 代理服务（多 Provider 路由）
│   ├── providers.js           # 模型注册表（DeepSeek/Qwen/Kimi）
│   ├── smoke-test.mjs         # 冒烟测试
│   ├── benchmark/             # 基准测试框架
│   │   ├── runner.mjs         # 测试入口
│   │   ├── test-cases.js      # 16 条标准用例
│   │   ├── scorer.js          # 多维评分引擎
│   │   └── report.js          # 报告格式化
│   └── .env                   # 服务端环境变量（含 API Key，已 gitignore）
├── docs/                      # 设计文档
│   ├── design.md              # 架构设计
│   └── benchmark-selection.md # 四模型基准测试选型报告
├── public/                    # 静态资源
├── index.html                 # Vite 入口 HTML
├── vite.config.js             # Vite 配置
├── package.json               # 前端依赖
├── CLAUDE.md                  # 项目规范
└── README.md                  # ← 你现在正在看这里
```

> **注：** 本地开发目录名为 `ai-voice-painter`，远端仓库名为 `voice-to-image-generation`，两者为同一项目。

---

## 快速启动

需要同时启动两个服务（前后端分离）：

### 1. 启动后端代理（端口 8000）

```bash
cd server
cp .env.example .env            # 编辑 .env 填入 API Key
# 必填：DEEPSEEK_API_KEY（在 platform.deepseek.com 获取）
# 可选：QWEN_API_KEY / MOONSHOT_API_KEY 用于模型对比测试
npm install
node proxy.js
```

### 2. 启动前端开发服务器（端口 5173）

```bash
# 新开一个终端，在项目根目录
cp .env.example .env       # 编辑 .env 配置代理地址（已有默认值）
npm install
npm run dev
```

然后浏览器打开 `http://localhost:5173`，点击麦克风按钮开始语音绘图。

---

## 原创功能说明

### 核心功能

| 功能 | 说明 |
|------|------|
| **纯语音交互** | 全程语音驱动，无需键盘鼠标操作。说"开始绘画"激活，说"结束绘画"停止 |
| **自然语言理解** | 支持模糊口语指令——"右上角画个红色的圆""把所有图形放大一倍"等，由 LLM 自动理解 |
| **画布状态感知** | 每次指令携带当前画布摘要（含 zone 区域描述），LLM 具备空间上下文，支持增量修改 |
| **多图形支持** | 支持矩形、圆形、椭圆、三角形、线段、多边形等基本图形 + 任意 SVG 路径 |
| **ASR 纠错** | 针对语音识别常见错误（同音字、歧义词）内置映射表，提升准确率 |
| **坐标网格系统** | 3×3 画布区域划分（左/中/右 × 上/中/下），尺寸量化分级（小/中/大），碰撞自动规避 |
| **三级状态分支** | LLM 返回 `success`（成功）/ `optimized`（已优化）/ `error`（无法理解）三种状态，前端分别处理 |

### 技术亮点

- **API Key 安全隔离：** 前端不接触任何 API 密钥，所有 LLM 请求通过后端代理转发
- **Fabric.js 7 集成：** 利用新版 Fabric.js API 实现高效画布操作
- **无外部语音服务依赖：** 语音识别与合成全部依赖浏览器原生 Web Speech API，零额外成本

---

## Demo 视频

<!-- TODO: 上传 Demo 视频后替换链接 -->
Demo 视频链接：**[点击观看]()**

视频内容涵盖：
1. 语音唤醒与指令输入
2. 基本图形绘制（圆形、矩形、三角形）
3. 颜色、位置、大小修改
4. 多图形组合操作
5. 语音清除画布

---

## 环境要求

- Node.js >= 20
- 现代浏览器（Chrome / Edge 推荐，需支持 Web Speech API）
- API Key（至少一个）：
  - **DeepSeek**（必选）→ [platform.deepseek.com](https://platform.deepseek.com/)
  - **Qwen**（可选）→ [dashscope.aliyun.com](https://dashscope.aliyun.com/)
  - **Kimi**（可选）→ [platform.moonshot.cn](https://platform.moonshot.cn/)

---

## 模型基准测试

项目内置多模型基准测试框架，支持对比 DeepSeek V4 Flash/Pro、Qwen3.7-Max、Kimi K2.6。

```bash
cd server
node benchmark/runner.mjs                              # 跑所有已配置 Key 的模型
node benchmark/runner.mjs --models deepseek-v4-pro,qwen3.7-max  # 指定模型
node benchmark/runner.mjs --limit 5                    # 快速测试（前 5 条）
node benchmark/runner.mjs --verbose                    # 逐用例详情
```

**最新测试结论（2026-06-13）：** 四模型准确率 95.5% 等价，DeepSeek V4 Flash 以 **265ms** 延迟保持最优选型（Qwen 3.6s、Kimi 14s）。详见 [`docs/benchmark-selection.md`](docs/benchmark-selection.md)。

---

## 作品提交信息

- **参赛批次：** 七牛云暑期实训营
- **仓库地址：** [https://github.com/Xiang991/voice-to-image-generation](https://github.com/Xiang991/voice-to-image-generation)
- **本地开发目录：** `ai-voice-painter`（与远端仓库同步）

---

## 许可

本项目为七牛云暑期实训营参赛作品，知识产权归提交者所有。
