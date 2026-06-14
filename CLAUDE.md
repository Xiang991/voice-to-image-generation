# AI 语音绘图助手 — CLAUDE.md

## 项目概述

纯语音控制的 AI 绘画工具。用户通过语音指令完成绘图创作。

**架构：** 厚前端 + 薄代理 + 智能 LLM
**核心链路：** 语音识别 → 厚前端解析 → 薄代理转发 → LLM 以"绘画设计师"角色输出 JSON → 前端状态判断 → Canvas 渲染

## 快速开始

```bash
# 终端 1：启动代理
cd server && npm install && node proxy.js
# → http://localhost:8000

# 终端 2：启动前端
npm run dev
# → http://localhost:5173/voice-to-image-generation/
```

## 技术栈

| 模块 | 选型 |
|------|------|
| 前端框架 | React 19 + Vite 8 |
| 语音识别 | Web Speech API |
| 画布渲染 | 原生 Canvas 2D API |
| LLM | DeepSeek V4 Flash（多 Provider 可切换：Qwen/Kimi/GLM） |
| LLM 代理层 | Node Express + providers.js 注册表 |
| 坐标校验 | Server-side validateActions() 坐标钳制+最小尺寸 |
| SVG 渲染 | Blob → Image → canvas（支持全部 SVG 特性） |
| 基准测试 | server/benchmark/ — 16 用例多维评分 |

## 目录结构

```
voice-to-image-generation/
├── src/                          # React 前端源码
│   ├── components/
│   │   ├── VoiceController.jsx   语音输入 + 生命周期管理
│   │   ├── Canvas.jsx            原生 Canvas 2D 渲染 + 鼠标交互
│   │   ├── VoiceStatusBar.jsx    状态指示器
│   │   ├── QuickBar.jsx          悬浮操作栏
│   │   ├── History.jsx           指令历史
│   │   ├── MessageLog.jsx        系统消息日志
│   │   └── ErrorBoundary.jsx     错误边界
│   ├── services/
│   │   ├── agent.js              代理客户端（调后端 API）
│   │   ├── tts.js                语音合成封装
│   │   ├── intentClassifier.js   意图分类（draw/control/chat）
│   │   ├── canvasSummary.js      画布状态摘要（含 zone 空间区域）
│   │   ├── storage.js            localStorage 持久化
│   │   └── hints.js              动态提示生成
│   ├── App.jsx                   根组件 + status 分支判断
│   ├── App.css                   样式
│   ├── config.js                 配置
│   └── main.jsx                  React 入口
├── server/                       # Express 代理后端
│   ├── proxy.js                  加 Key 转发 + 系统提示词 + validateActions()
│   ├── providers.js              模型注册表（DeepSeek/Qwen/GLM/Kimi）
│   ├── .env                      环境变量（API Key，已 gitignore）
│   ├── benchmark/                基准测试框架（16 用例 × 多维评分）
│   │   ├── test-cases.js
│   │   ├── scorer.js
│   │   ├── report.js
│   │   ├── runner.mjs
│   │   └── results/              （生成结果，已 gitignore）
│   └── package.json              依赖
├── docs/
│   ├── design.md                 设计文档（交付物）
│   └── benchmark-selection.md    基准测试选型报告
├── .harness/
│   ├── design.md                 设计方案
│   └── progress.json             进度跟踪
├── README.md                     项目说明（交付物）
├── .nvmrc                        Node.js 版本锁定
├── index.html                    Vite 入口
├── vite.config.js                构建配置
├── package.json                  前端依赖
└── CLAUDE.md                     项目规范（本文件）
```

## 架构说明

```
用户 → 厚前端（浏览器）
  ├── ASR 转文本（VoiceController）
  ├── 调用代理层（agent.js）
  ├── 解析 LLM 返回的 JSON
  ├── 执行状态判断：success / optimized / error
  ├── 绘图（Canvas.jsx）
  └── 存储画布状态（canvasSummary.js，含 zone 区域描述）

厚前端 → 薄代理（Express）
  ├── 注入系统提示词（绘画设计师角色）
  ├── 坐标校验 validateActions()
  └── 透传，无业务判断

薄代理 → 云 LLM（DeepSeek）
  ├── 以"绘画设计师"角色理解意图/规划构图/设计画面
  └── 输出带 status 标签的结构化 JSON
```

## 当前状态

- **阶段：** ✅ 已完成
- **进度：** 13/13 步完成，绘画质量专项改进已完成
- **里程碑：** Tier 1 骨架 ✓ | 语音输入 ✓ | 薄代理 ✓ | 全栈闭环 ✓ | SVG 质感升级 ✓
- **模型选型：** DeepSeek V4 Flash（已验证 Qwen/Kimi 准确率等价但延迟劣势）
- **基准测试：** 四模型 95.5% 同分，延迟差距 265ms vs 3.6s vs 14s，详见 `docs/benchmark-selection.md`
- **系统提示词（2026-06-14）：** 从"格式转换器"升级为"绘画设计师"——四步设计流程（理解意图→构图规划→确定表达→细化参数）+ SVG 六大技法（渐变/贝塞尔/分层/光影/配色/视口）+ few-shot 高质量示例
- **说明：** 项目所有步骤已完成并通过验收，详见 `.harness/progress.json`

## 工作规范

- **语言：** 中文（普通话）
- **信息粒度：** 偏好极细的信息粒度，不跳过中间步骤
- **设计解释：** 每个决策需详细解释设计缘由与权衡
- **全景视角：** 每项任务先说明整体背景和当前步骤的位置
