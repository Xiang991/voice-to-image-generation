# AI 语音绘图助手 — CLAUDE.md

## 项目概述

纯语音控制 + 鼠标增强的绘图工具。用户通过语音指令完成绘图创作，也可用鼠标直接操作已绘图形。

**架构：** 厚前端 + 薄代理 + 纯云 LLM
**核心链路：** 语音识别 → 厚前端解析 → 薄代理转发 → LLM 输出 JSON → 前端状态判断 → Canvas 渲染 + TTS 反馈

## 快速开始

```bash
# 终端 1：启动代理
cd server && npm install && node proxy.js
# → http://localhost:8000

# 终端 2：启动前端
npm run dev
# → http://localhost:5173
```

## 技术栈

| 模块 | 选型 |
|------|------|
| 前端框架 | React 19 + Vite 8 |
| 语音识别 | Web Speech API |
| 画布渲染 | **原生 Canvas 2D API**（非 Fabric.js） |
| LLM | DeepSeek V4 Flash (JSON 直出) |
| 代理层 | Node Express（仅透传） |
| TTS | Web Speech Synthesis API |
| 动画 | Framer Motion 12 |
| 图标 | Lucide React |

## 目录结构

```
frontend/
├── src/
│   ├── components/
│   │   ├── Canvas.jsx            原生 Canvas 2D + 鼠标交互
│   │   ├── ErrorBoundary.jsx     错误边界
│   │   ├── VoiceController.jsx   语音输入 + 生命周期管理
│   │   ├── VoiceStatusBar.jsx    状态指示器
│   │   ├── QuickBar.jsx          悬浮操作栏（撤销/重做/删除/导出/网格）
│   │   └── History.jsx           指令历史
│   ├── services/
│   │   ├── agent.js              代理客户端
│   │   ├── tts.js                TTS 封装
│   │   ├── intentClassifier.js   意图分类
│   │   ├── canvasSummary.js      画布状态摘要
│   │   ├── storage.js            localStorage 持久化
│   │   └── hints.js              动态 Guidance
│   ├── App.jsx                   根组件
│   ├── App.css                   样式
│   ├── config.js                 配置
│   └── main.jsx                  React 入口
server/
├── proxy.js          Express 代理
├── .env              环境变量
└── package.json
docs/
├── design.md         设计文档
└── benchmark-selection.md  模型选型报告
```

## 架构说明：厚前端 + 薄代理 + 纯云 LLM

```
用户 → 厚前端（浏览器）
  ├── 语音输入 / 鼠标操作
  ├── ASR 转文本（VoiceController）
  ├── 调用代理层（agent.js）
  ├── 解析 LLM 返回的 JSON
  ├── 执行状态判断：success / optimized / error
  ├── 绘图 + 选中/拖拽（Canvas.jsx）+ TTS 反馈（tts.js）
  └── 持久化（storage.js）+ 动态提示（hints.js）

厚前端 → 薄代理（Express）
  └── 仅加 Key 透传，无分支判断

薄代理 → 云 LLM（DeepSeek）
  └── 理解自然语言 → 输出带 status 标签的结构化 JSON
```

## 当前状态

- **阶段：** 功能完善
- **已完成迭代（2026-06-14）：**
  - 画布交互（选中/拖拽/删除）
  - 多步撤销 + 重做
  - 竞态条件修复
  - localStorage 自动保存/恢复
  - 导出 PNG + 项目文件
  - 坐标网格 + 标尺 + HUD
  - 动态 Guidance Chips
  - TTS 时序修复 + 键盘快捷键
  - Error Boundary + SVG 加载占位
  - 性能优化
- **测试覆盖率：** 164 项功能测试通过，12 项 Canvas 像素测试需原生 node-canvas 模块
- **构建产物：** ~347 KB JS + ~9.8 KB CSS

## 工作规范

- **语言：** 中文（普通话）
- **信息粒度：** 偏好极细的信息粒度，不跳过中间步骤
- **设计解释：** 每个决策需详细解释设计缘由与权衡
- **全景视角：** 每项任务先说明整体背景和当前步骤的位置
