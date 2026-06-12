export const CONFIG = {
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  model: import.meta.env.VITE_LLM_MODEL || 'deepseek-v4-flash',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.deepseek.com/v1',
  canvasWidth: 800,
  canvasHeight: 600,
  maxAgentTurns: 5,
}
