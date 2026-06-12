import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '../..')
const progressPath = join(projectRoot, '.harness/progress.json')

if (!existsSync(progressPath)) {
  console.log('📋 新项目 — 等待需求调研')
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
const tierLabels = { 1: 'Walking Skeleton', 2: '功能扩展', 3: '加固' }

console.log(`▶️ 增量执行 — Step ${currentStep ? progress.current_step.replace('step-', '') : '?'}/${total}`)
console.log(`已完成: ${completed}/${total} 步`)
console.log('')

if (!currentStep) {
  console.log('⚠️ 未找到当前步骤，请检查 progress.json')
  process.exit(0)
}

// ─── 状态判断 ───

switch (currentStep.status) {

  case 'pending':
    // 第一步（除 Step 1 已完成外），等待用户批准启动
    console.log(`⏳ 等待开始: Step ${currentStep.id.replace('step-', '')} — ${currentStep.title}`)
    console.log(`  Tier: ${tierLabels[currentStep.tier] || currentStep.tier}`)
    console.log(`  描述: ${currentStep.description}`)
    console.log('')
    console.log('  验收标准:')
    currentStep.acceptance_criteria.forEach((c, i) => {
      console.log(`    ${i + 1}. ${c}`)
    })
    console.log('')
    console.log('  💡 输入 "开始" 启动实施')
    break

  case 'review':
    // 步骤已完成，等待用户审批
    console.log(`⏸️ 步骤完成，等待审批 — Step ${currentStep.id.replace('step-', '')}: ${currentStep.title}`)
    console.log('')
    console.log('  验收结果待确认，请审查后告诉我：')
    console.log('  💡 审查无问题后输入 "通过"')
    break

  case 'approved':
    // 当前步已通过，展示下一步
    const nextStepIndex = progress.steps.findIndex(s => s.id === currentStep.id)
    const nextStep = progress.steps[nextStepIndex + 1]

    console.log(`✅ Step ${currentStep.id.replace('step-', '')} 已通过`)
    console.log('')

    if (nextStep) {
      console.log(`▶️ 下一步: Step ${nextStep.id.replace('step-', '')} — ${nextStep.title}`)
      console.log(`  Tier: ${tierLabels[nextStep.tier] || nextStep.tier}`)
      console.log(`  描述: ${nextStep.description}`)
      console.log('')
      console.log('  验收标准:')
      nextStep.acceptance_criteria.forEach((c, i) => {
        console.log(`    ${i + 1}. ${c}`)
      })
      console.log('')
      console.log('  💡 输入 "开始" 进入 Step ' + nextStep.id.replace('step-', '') + ' 实施')
    } else {
      console.log('🎉 所有步骤已完成！')
    }
    break

  default:
    console.log(`⚠️ 未知状态: ${currentStep.status}`)
    break
}
