/**
 * 浏览器 Web Speech API ASR 引擎
 * 实现 ASR 统一接口 { start, stop, onResult, onError, onEnd, destroy }
 */

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

export function createBrowserAsr() {
  let rec = null
  let killed = false

  let onResultCb = null
  let onErrorCb = null
  let onEndCb = null

  const ERR_NOT_SUPPORTED = '浏览器不支持语音识别，请使用 Chrome 或 Edge'

  function start() {
    if (!SpeechRecognition) {
      onErrorCb?.({ message: ERR_NOT_SUPPORTED })
      return
    }

    killed = false

    try {
      if (rec) rec.stop()
    } catch {}

    rec = new SpeechRecognition()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'zh-CN'

    rec.onresult = (e) => {
      if (killed) return
      let final = ''
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) final += r[0].transcript
        else interim += r[0].transcript
      }
      onResultCb?.({ transcript: final + interim, isFinal: !!final && !interim })
    }

    rec.onspeechend = () => {
      if (killed) return
      onEndCb?.()
    }

    rec.onerror = (e) => {
      if (killed) return
      if (e.error === 'aborted') return
      if (e.error === 'not-allowed') {
        onErrorCb?.({ message: '请在浏览器设置中允许麦克风权限，然后刷新页面' })
        return
      }
      onErrorCb?.({ message: `语音识别出错: ${e.error}` })
    }

    rec.onend = () => {
      if (killed) return
      onEndCb?.()
    }

    rec.start()
  }

  function stop() {
    killed = true
    try { rec?.stop() } catch {}
  }

  function destroy() {
    stop()
    rec = null
  }

  function onResult(fn) { onResultCb = fn }
  function onError(fn) { onErrorCb = fn }
  function onEnd(fn) { onEndCb = fn }

  return { start, stop, onResult, onError, onEnd, destroy }
}

/** Quick check if browser ASR is available */
export function isBrowserAsrAvailable() {
  return !!SpeechRecognition
}
