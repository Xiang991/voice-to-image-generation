import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '../..')
const progressPath = join(projectRoot, '.harness/progress.json')
const designConfirmedPath = join(projectRoot, '.harness/design.confirmed')

if (!existsSync(progressPath)) {
  if (existsSync(designConfirmedPath)) {
    console.log('📐 设计待实施 — 请生成进度表')
  } else if (existsSync(join(projectRoot, '.harness/design.md'))) {
    console.log('📋 设计阶段 — 设计文档已存在，等待确认')
  } else {
    console.log('📋 新项目 — 等待需求调研')
  }
  process.exit(0)
}

const progress = JSON.parse(readFileSync(progressPath, 'utf-8'))

if (progress.phase === 'completed') {
  console.log('🧪 已完成 — 所有步骤完成')
  process.exit(0)
}

const currentStep = progress.steps.find(s => s.id === progress.current_step)
const completed = progress.completed
const total = progress.total_steps

console.log(`▶️ 增量执行 — Step ${currentStep ? progress.current_step.replace('step-', '') : '?'}/${total}`)
console.log('')

if (completed > 0) {
  console.log(`已完成: ${completed}/${total} 步`)
  console.log('')
}

if (currentStep) {
  const tierLabels = { 1: 'Walking Skeleton', 2: '功能扩展', 3: '加固' }
  console.log(`当前步骤: ${currentStep.title}`)
  console.log(`  Tier: ${tierLabels[currentStep.tier] || currentStep.tier}`)
  console.log(`  描述: ${currentStep.description}`)
  console.log('')
  console.log('  验收标准:')
  currentStep.acceptance_criteria.forEach((c, i) => {
    console.log(`    ${i + 1}. ${c}`)
  })
  if (currentStep.verification_commands?.length) {
    console.log('')
    console.log('  验证命令:')
    currentStep.verification_commands.forEach(c => console.log(`    $ ${c}`))
  }
}
