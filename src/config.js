export const CONFIG = {
  openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  model: import.meta.env.VITE_LLM_MODEL || 'deepseek-v4-flash',
  canvasWidth: 800,
  canvasHeight: 600,
  maxAgentTurns: 5,
}
