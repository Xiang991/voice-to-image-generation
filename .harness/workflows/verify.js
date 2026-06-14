// verify.js — 验收 Workflow
// 并行运行多个测试/检查任务，汇总报告
// 用于 E2E 检查点或最终验收

export const meta = {
  name: 'verify',
  description: '并行运行验收测试，汇总结果报告',
  phases: [
    { title: '运行', detail: '并行执行验收任务' },
    { title: '汇总', detail: '汇总测试结果' },
  ],
}

const VERIFY_RESULT = {
  type: 'object',
  properties: {
    summary: {
      type: 'object',
      properties: {
        total: { type: 'integer' },
        passed: { type: 'integer' },
        failed: { type: 'integer' },
        all_pass: { type: 'boolean' },
      },
      required: ['total', 'passed', 'failed', 'all_pass'],
    },
    details: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          status: { type: 'string', enum: ['passed', 'failed', 'skipped'] },
          output: { type: 'string' },
          error: { type: 'string' },
        },
        required: ['name', 'status'],
      },
    },
  },
  required: ['summary', 'details'],
}

export default async function main() {
  // args 可以是:
  // - 验收命令列表: ["pytest tests/test_a.py", "pytest tests/test_b.py"]
  // - { commands: [...], project: "..." }
  // - { step_id: "step-3", commands: [...] }

  const commands = args?.commands || args
  const stepId = args?.step_id || ''

  if (!commands || (Array.isArray(commands) && commands.length === 0)) {
    log('❌ 需要提供验收命令列表')
    return { error: '请提供验收命令，例如: args = { commands: ["pytest tests/...", "..."], step_id: "step-3" }' }
  }

  const cmdList = Array.isArray(commands) ? commands : [commands]
  log(`🧪 开始验收: ${stepId || '全面检查'} — ${cmdList.length} 个任务`)

  phase('运行')

  // 并行运行所有验收命令
  // 对于 Shell 命令用 agent，对于测试文件可以用更丰富的方式
  const results = await parallel(
    cmdList.map((cmd, i) => () =>
      agent(
        `执行以下验收命令并报告结果:

命令: ${cmd}

请运行这个命令，捕获输出，判断通过/失败。
返回结果格式:
- name: 检查名称
- status: "passed" 或 "failed"
- output: 命令的标准输出
- error: 如果有错误，描述错误信息`,
        {
          label: `check-${i + 1}`,
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              status: { type: 'string', enum: ['passed', 'failed'] },
              output: { type: 'string' },
              error: { type: 'string' },
            },
            required: ['name', 'status'],
          },
        }
      )
    )
  )

  phase('汇总')

  const validResults = (results || []).filter(Boolean)
  const passed = validResults.filter((r) => r.status === 'passed').length
  const failed = validResults.filter((r) => r.status === 'failed').length

  const summary = {
    total: validResults.length,
    passed,
    failed,
    all_pass: failed === 0,
  }

  log(`📊 验收结果: ${passed}/${validResults.length} 通过${failed > 0 ? `, ${failed} 失败` : ''}`)

  return { summary, details: validResults }
}
