export const CONFIG = {
  proxyUrl: import.meta.env.VITE_PROXY_URL || 'http://localhost:8000',
  model: import.meta.env.VITE_LLM_MODEL || 'deepseek-v4-flash',
  canvasWidth: 800,
  canvasHeight: 600,
  asr: {
    // 'browser' (默认, 零配置) | 'xunfei' (需 Key)
    mode: 'browser',
    xunfeiAppId: '082d4a3d',
  },
}
