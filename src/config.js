export const CONFIG = {
  proxyUrl: import.meta.env.VITE_PROXY_URL || 'http://localhost:8000',
  model: import.meta.env.VITE_LLM_MODEL || 'deepseek-v4-flash',
  canvasWidth: 800,
  canvasHeight: 600,
  asr: {
    // 'xunfei' (默认, 需 Key) | 'browser' (Web Speech API)
    mode: 'xunfei',
    xunfeiAppId: '082d4a3d',
  },
}
