// design.js — 设计 Workflow
// 基于调研报告，产出总体技术方案

export const meta = {
  name: 'design',
  description: '基于调研结果产出技术方案设计',
  phases: [
    { title: '架构设计', detail: '总体架构和技术选型' },
    { title: '细化设计', detail: '详细设计和 Schema' },
  ],
}

const DESIGN_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    overview: { type: 'string' },
    mvp_overview: {
      type: 'object',
      description: 'MVP 级一页总览：描述系统最简骨架的全貌',
      properties: {
        one_page_summary: { type: 'string', description: '整个系统 Walking Skeleton 的一页总览：描述从用户操作到数据持久化的最小闭环路径' },
        walking_skeleton_flow: { type: 'string', description: '数据流：用户做什么 → 什么 API 被调用 → 什么数据存到哪里 → 用户看到什么' },
        skeleton_components: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              role_in_skeleton: { type: 'string', description: '该组件在 Walking Skeleton 中的角色，而非完整职责' },
            },
            required: ['name', 'role_in_skeleton'],
          },
        },
      },
      required: ['one_page_summary'],
    },
    architecture: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        components: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              responsibility: { type: 'string' },
              tech_stack: { type: 'string' },
            },
            required: ['name', 'responsibility'],
          },
        },
      },
      required: ['description', 'components'],
    },
    tech_decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          decision: { type: 'string' },
          alternatives: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
        },
        required: ['decision', 'reason'],
      },
    },
    implementation_tiers: {
      type: 'array',
      description: '三 Tier 实施规划：Walking Skeleton → 功能扩展 → 加固',
      items: {
        type: 'object',
        properties: {
          tier: { type: 'integer', description: '1=Walking Skeleton, 2=功能扩展, 3=加固' },
          label: { type: 'string', enum: ['Walking Skeleton', '功能扩展', '加固'] },
          content: { type: 'string', description: '该 Tier 要实现的功能列表和范围' },
          estimated_days: { type: 'string' },
        },
        required: ['tier', 'label', 'content'],
      },
    },
    // 向后兼容：保留旧字段作为可选
    implementation_phases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          phase: { type: 'string' },
          content: { type: 'string' },
          estimated_days: { type: 'string' },
        },
        required: ['phase', 'content'],
      },
    },
    key_constraints: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'overview', 'mvp_overview', 'architecture', 'tech_decisions', 'implementation_tiers'],
}

export default async function main() {
  const researchReport = args?.research || args
  const userRequirements = args?.requirements || ''

  if (!researchReport) {
    log('❌ 需要输入调研报告')
    return { error: '请提供调研报告，例如: args = { research: {...}, requirements: "..." }' }
  }

  log('📐 开始总体方案设计...')

  phase('架构设计')

  const design = await agent(
    `你是资深软件架构师。基于以下调研结果和用户需求，设计总体技术方案。

用户需求:
${userRequirements}

调研报告:
${JSON.stringify(researchReport, null, 2)}

### 设计步骤（按此顺序思考）：

**第 1 步 — MVP 总览（先画骨架，再填血肉）**
先思考：这个系统的 Walking Skeleton 是什么？只做一件事跑通全栈，最简路径是什么？
输出 mvp_overview:
- one_page_summary: 一页纸描述系统最简骨架的全貌
- walking_skeleton_flow: 数据流，从用户操作到数据持久化再回到界面
- skeleton_components: 每个组件在骨架中的角色（非完整职责）

**第 2 步 — 总体架构**
详细展开：核心组件、职责、技术栈

**第 3 步 — 技术选型**
各组件选什么技术，为什么，对比方案

**第 4 步 — 三 Tier 实施规划（关键！）**
按 Progressive Disclosure 原则拆分实施层级：
- Tier 1 (Walking Skeleton): 最少功能，但必须端到端可运行。允许硬编码、无错误处理、无权限控制
- Tier 2 (功能扩展): 添加其余核心功能，每个功能是全栈闭环
- Tier 3 (加固): 错误处理、验证、性能、日志、监控、体验优化

**第 5 步 — 关键约束和注意事项**

约束：设计要务实，先解决核心痛点，避免过度工程。Walking Skeleton 宁可简陋不可残缺。`,
    { label: 'architect', schema: DESIGN_SCHEMA }
  )

  phase('细化设计')

  log('📋 细化设计完成，产出设计方案')

  return design
}
