// generate-schedule.js — 进度表生成 Workflow
// 设计方案确认后 → 拆解为可执行的 JSON 进度表
// 遵循 Progressive Disclosure（渐进式揭示）原则：
//   每步是垂直切片（全栈闭环），而非水平分层
//   三 Tier 结构：Walking Skeleton → 功能扩展 → 加固

export const meta = {
  name: 'generate-schedule',
  description: '将设计方案拆解为逐步实施的 JSON 进度表',
  phases: [
    { title: '分析', detail: '分析设计文档，按垂直切片 + 三 Tier 结构分解' },
    { title: '编排', detail: '确定依赖关系和执行顺序，Tier 优先' },
    { title: '生成', detail: '生成完整的进度表 JSON' },
  ],
}

const SCHEDULE_SCHEMA = {
  type: 'object',
  properties: {
    project: { type: 'string' },
    phase: { type: 'string', enum: ['implementation'] },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          tier: { type: 'integer', description: '1=Walking Skeleton, 2=功能扩展, 3=加固' },
          milestone: { type: 'string', description: '可选里程碑标签，如 "Walking Skeleton Complete"' },
          acceptance_criteria: { type: 'array', items: { type: 'string' } },
          verification_commands: { type: 'array', items: { type: 'string' } },
          depends_on: { type: 'array', items: { type: 'string' } },
          e2e_interval: { type: 'integer' },
        },
        required: ['id', 'title', 'description', 'tier', 'acceptance_criteria', 'verification_commands', 'depends_on'],
      },
    },
    milestones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tier: { type: 'integer' },
          label: { type: 'string' },
          step_id: { type: 'string' },
        },
        required: ['tier', 'label'],
      },
    },
    total_steps: { type: 'integer' },
    completed: { type: 'integer', enum: [0] },
    design_decisions: {
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
  },
  required: ['project', 'phase', 'steps', 'milestones', 'total_steps', 'completed'],
}

export default async function main() {
  const designDoc = args?.design || args
  if (!designDoc) {
    log('❌ 需要输入设计方案')
    return { error: '请提供已确认的设计方案' }
  }

  log('📋 开始分析设计方案，生成实施进度表...')

  phase('分析')

  // 分析设计文档，按垂直切片 + 三 Tier 结构分解
  const analysis = await agent(
    `分析以下设计方案，识别所有需要实施的工作单元。

设计方案:
${JSON.stringify(designDoc, null, 2)}

请按 **垂直切片（Vertical Slice）** 方式分解，而非水平分层。

### 垂直切片原则：
- 每个切片是从数据库到用户界面的全栈功能闭环（DB → Model → API → UI）
- Step 1 必须是 Walking Skeleton：系统最简闭环，做一件事跑通全栈
- 后续切片逐步添加新功能，每个切片也是全栈

### 三 Tier 结构：
- Tier 1 (Walking Skeleton): 最少功能，但必须端到端可运行，允许硬编码
- Tier 2 (功能扩展): 添加其余核心功能，每个仍是全栈切片
- Tier 3 (加固): 错误处理、性能、监控、文档、体验优化

### 请识别:
1. 每个 Tier 包含哪些垂直切片
2. 每个切片的预估复杂度（S/M/L）
3. 切片之间的依赖关系`,
    {
      label: 'analyze-design',
      schema: {
        type: 'object',
        properties: {
          tiers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tier: { type: 'integer', description: '1=Walking Skeleton, 2=功能扩展, 3=加固' },
                label: { type: 'string', enum: ['Walking Skeleton', '功能扩展', '加固'] },
                slices: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      description: { type: 'string', description: '全栈闭环描述：用户做什么 → API → 数据 → 返回 → 用户看到什么' },
                      complexity: { type: 'string', enum: ['S', 'M', 'L'] },
                      depends_on: { type: 'array', items: { type: 'string' } },
                      verification_approach: { type: 'string' },
                    },
                    required: ['title', 'description', 'complexity'],
                  },
                },
              },
            },
            required: ['tier', 'label', 'slices'],
          },
        },
        required: ['tiers'],
      },
    }
  )

  phase('编排')

  log('🔗 确定执行顺序和依赖关系...')

  // 编排执行顺序（Tier 优先 + 垂直切片）
  const ordered = await agent(
    `基于以下分析结果，确定最优的执行顺序，遵循渐进式揭示原则。

分析结果:
${JSON.stringify(analysis, null, 2)}

### 排序规则（按优先级）:
1. Tier 1 (Walking Skeleton) 的所有切片必须先于 Tier 2 的所有切片
2. Tier 2 的所有切片必须先于 Tier 3 的所有切片
3. 同一 Tier 内：S 复杂度优先安排（快速见效，验证方向正确）
4. 前置依赖必须在依赖它的切片之前
5. 每个步骤应该能在 1 个 Session 内完成
6. 在每个 Tier 结束时设置 E2E 检查点
7. Tier 1 的每个切片必须是可演示的：完成后能展示该功能的完整闭环

### 每个切片定义要求:
- description: 该功能的全栈闭环描述（用户做了什么→API→数据→返回→用户看到什么）
- acceptance_criteria: 必须是可执行的端到端验证（如"注册新用户→确认数据库有记录→确认能登录→确认页面显示正确"）
- verification_commands: 具体的 shell 命令或 pytest 路径
- depends_on: 只引用同一 Tier 或之前 Tier 的切片`,
    {
      label: 'order-tasks',
      schema: {
        type: 'object',
        properties: {
          ordered_tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string', description: '全栈闭环描述' },
                tier: { type: 'integer', description: '1=Walking Skeleton, 2=功能扩展, 3=加固' },
                acceptance_criteria: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '每个验收标准必须是可执行的：跑一个命令、打开页面、调用 API'
                },
                verification_commands: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '具体的 shell 命令或 pytest 路径'
                },
                depends_on: { type: 'array', items: { type: 'string' } },
                e2e_interval: { type: 'integer' },
              },
              required: ['title', 'description', 'tier', 'acceptance_criteria', 'verification_commands'],
            },
          },
        },
        required: ['ordered_tasks'],
      },
    }
  )

  phase('生成')

  log('📝 生成进度表 JSON...')

  // 提取设计决策
  const decisions = designDoc.tech_decisions || []

  // 构建步骤列表，映射 tier 字段
  const steps = ordered.ordered_tasks.map((task, i) => ({
    id: `step-${i + 1}`,
    title: task.title,
    description: task.description,
    tier: task.tier || 1,
    milestone: '',
    acceptance_criteria: task.acceptance_criteria || [],
    verification_commands: task.verification_commands || [],
    passes: false,
    e2e_interval: task.e2e_interval || 3,
    depends_on: task.depends_on || [],
  }))

  // 自动计算里程碑：每个 Tier 的最后一个 step 打标
  const tierLabels = { 1: 'Walking Skeleton 完成', 2: '功能扩展完成', 3: '加固完成' }
  const milestones = []
  const tiersFound = [...new Set(steps.map(s => s.tier))].sort()
  for (const t of tiersFound) {
    const lastStep = [...steps].reverse().find(s => s.tier === t)
    if (lastStep) {
      lastStep.milestone = tierLabels[t] || `Tier ${t} 完成`
      milestones.push({ tier: t, label: tierLabels[t] || `Tier ${t} 完成`, step_id: lastStep.id })
    }
  }

  const schedule = {
    project: designDoc.title || args?.projectName || 'my-project',
    phase: 'implementation',
    current_step: steps[0]?.id || '',
    design_doc: 'design.md',
    steps,
    milestones,
    total_steps: steps.length,
    completed: 0,
    design_decisions: decisions.map((d) => ({
      decision: d.decision,
      alternatives: d.alternatives || [],
      reason: d.reason,
    })),
    last_updated: new Date().toISOString(),
  }

  log(`✅ 进度表已生成: ${schedule.total_steps} 个实施步骤`)
  log(`   第 1 步: ${steps[0]?.title || ''} [Tier ${steps[0]?.tier || 1}]`)
  log(`   最后一步: ${steps[steps.length - 1]?.title || ''} [Tier ${steps[steps.length - 1]?.tier || 1}]`)
  for (const m of milestones) {
    log(`   🏁 里程碑: ${m.label} (${m.step_id})`)
  }

  return schedule
}
