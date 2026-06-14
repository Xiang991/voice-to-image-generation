/**
 * ASR 模式切换工具
 * 用法：
 *   node scripts/switch-asr.mjs xunfei   → 交互填写讯飞 Key
 *   node scripts/switch-asr.mjs browser  → 切换到浏览器模式
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createInterface } from 'readline'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const CONFIG_PATH = resolve(ROOT, 'src', 'config.js')
const ENV_PATH = resolve(ROOT, 'server', '.env')

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function updateConfigFile(mode, appId) {
  let content = readFileSync(CONFIG_PATH, 'utf-8')
  content = content.replace(/'__ASR_MODE__'/, `'${mode}'`)
  content = content.replace(/'__XUNFEI_APP_ID__'/, appId ? `'${appId}'` : 'undefined')
  writeFileSync(CONFIG_PATH, content, 'utf-8')
}

function updateEnvFile(vars) {
  let content
  try {
    content = readFileSync(ENV_PATH, 'utf-8')
  } catch {
    content = ''
  }

  for (const [key, value] of Object.entries(vars)) {
    const line = `${key}=${value}`
    if (content.includes(`${key}=`)) {
      content = content.replace(new RegExp(`^${key}=.*`, 'm'), line)
    } else {
      content = content.trimEnd() + '\n' + line + '\n'
    }
  }
  writeFileSync(ENV_PATH, content, 'utf-8')
}

const mode = process.argv[2]

if (mode === 'xunfei') {
  console.log('\n=== 讯飞语音识别配置 ===\n')
  console.log('请从讯飞开放平台控制台获取以下信息：')
  console.log('https://console.xfyun.cn/services/iat\n')

  const appId = await ask('APP ID: ')
  if (!appId) { console.log('未输入 APP ID，已取消'); process.exit(0) }

  const apiKey = await ask('API Key: ')
  if (!apiKey) { console.log('未输入 API Key，已取消'); process.exit(0) }

  const apiSecret = await ask('API Secret: ')
  if (!apiSecret) { console.log('未输入 API Secret，已取消'); process.exit(0) }

  updateConfigFile('xunfei', appId)
  updateEnvFile({
    XUNFEI_APP_ID: appId,
    XUNFEI_API_KEY: apiKey,
    XUNFEI_API_SECRET: apiSecret,
  })

  console.log('\n已切换到讯飞模式')
  console.log(`  src/config.js → asr.mode = 'xunfei', appId = '${appId}'`)
  console.log(`  server/.env   → XUNFEI_* 已写入`)
  console.log('\n重启 dev server 生效\n')

} else if (mode === 'browser') {
  updateConfigFile('browser', undefined)

  console.log('\n已切换到浏览器模式')
  console.log("  src/config.js → asr.mode = 'browser'")
  console.log('\n重启 dev server 生效\n')

} else {
  console.log('用法:')
  console.log('  npm run asr:xunfei    → 配置讯飞语音识别')
  console.log('  npm run asr:browser   → 使用浏览器语音识别')
}
