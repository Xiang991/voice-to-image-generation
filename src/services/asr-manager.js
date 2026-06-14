/**
 * ASR 统一入口
 * 根据 CONFIG.asr.mode 选择引擎，对外提供统一接口
 */

import { CONFIG } from '../config.js'
import { createBrowserAsr, isBrowserAsrAvailable } from './asr-browser.js'

let xunfeiAsr = null

async function loadXunfeiAsr() {
  if (!xunfeiAsr) {
    const mod = await import('./asr-xunfei.js')
    xunfeiAsr = mod.createXunfeiAsr
  }
  return xunfeiAsr
}

export async function createAsr() {
  const mode = CONFIG.asr.mode

  if (mode === 'browser') {
    if (!isBrowserAsrAvailable()) {
      throw new Error('浏览器不支持语音识别，请在 Chrome 或 Edge 中使用，或切换到讯飞模式')
    }
    return createBrowserAsr()
  }

  // xunfei mode (default)
  if (!CONFIG.asr.xunfeiAppId) {
    throw new Error('未配置讯飞 Key，请运行 npm run asr:xunfei 进行配置')
  }
  const factory = await loadXunfeiAsr()
  return factory()
}
