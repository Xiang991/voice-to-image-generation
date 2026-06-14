// 语音反馈已禁用
export async function speak(text, onEnd) {
  if (onEnd) onEnd()
}

export function stopSpeaking() {
  // no-op
}
