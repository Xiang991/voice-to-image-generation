# AI 语音绘图助手 — CLAUDE.md

## 项目概述

纯语音控制的绘图工具。用户通过语音指令完成绘图创作。

**核心链路：** 浏览器语音识别 → DeepSeek Agent (ReAct) 理解指令 → 调用绘图工具 → Canvas 显示结果

## 快速开始

```bash
npm install
npm run dev        # 开发服务器 → localhost:5173
npm run build      # 生产构建
```

## 技术栈

| 模块 | 选型 |
|------|------|
| 前端框架 | React 19 + Vite 8 |
| 语音识别 | Web Speech API |
| Agent LLM | DeepSeek V4 Flash (function calling) |
| 绘图 | HTML5 Canvas 2D + SVG |
| 后端 | 无（纯静态） |
| 部署 | Vercel |

## 目录结构

```
src/
├── components/     # UI 组件（VoiceInput, Canvas, History 等）
├── services/       # Agent 服务、工具调用
├── templates/      # 场景模板（draw_scene）
└── utils/          # 工具函数
.harness/
├── design.md       # 设计方案
└── progress.json   # 进度跟踪（唯一真实来源）
```

## 绘图工具系统

- **draw_shape** — 精确几何图形（circle/rect/line）
- **draw_svg** — 任意自由图形（Agent 生成 SVG）
- **draw_scene** — 组合场景（15 个模板组合）
- **canvas_control** — 画布管理（clear/undo）

---

## Harness 自动化工作制度

项目由 Harness 制度驱动：Hooks + Subagent/Workflow 自动化调研→设计→实施→验收的全生命周期。

### 核心文件

- `.harness/progress.json` — **唯一真实来源**，记录进度、当前步骤、验收标准
- `.harness/design.md` — 设计方案

### Hooks 机制

- `SessionStart hook` — 每次 Session 启动自动运行，输出状态报告和行动指令
- `SessionEnd hook` — 每次 Session 结束自动 Git commit + 写日志

**SessionStart hook 的输出是当前阶段的最高行动指令。**

---

### 阶段 2：增量执行（当前）

每完成一步：

```
✅ 实现功能（垂直切片：从 UI 到 Canvas 全栈闭环）
✅ 验证系统可演示
✅ 运行验收命令
✅ 逐条检查验收标准
✅ 更新 progress.json
✅ Git commit
✅ 读取下一步并执行
```

**单步约束：**
- 一次只做一个步骤，不做后续步骤
- 每步完成后系统必须可演示
- 最小修改原则，不重构不扩展
- 验收失败 → 定位修复 → 重新验收 → 通过后继续

---

### 阶段 3：最终验收（所有步骤完成后）

全量测试 → 检查设计一致性 → 用户确认 → 标记完成

### /clear 后恢复

SessionStart hook 自动输出当前状态。读取 progress.json，从当前步骤继续执行。

---

## 当前状态

- **阶段：** 增量执行
- **进度：** 1/6 步完成
- **当前步骤：** Step 2 — 文字→Agent→Canvas 全栈闭环
- **下一步工作：** 实现 TextInput + Agent 服务 + Canvas 渲染串联

## 工作规范

- **语言：** 中文（普通话）
- **信息粒度：** 偏好极细的信息粒度，不跳过中间步骤
- **设计解释：** 每个决策需详细解释设计缘由与权衡
- **全景视角：** 每项任务先说明整体背景和当前步骤的位置
