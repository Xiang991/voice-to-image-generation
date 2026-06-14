/**
 * 讯飞 IAT (语音听写) WebSocket 引擎
 * 实现 ASR 统一接口 { start, stop, onResult, onError, onEnd, destroy }
 *
 * 协议：wss://iat-api.xfyun.cn/v2/iat
 * 所有帧 = JSON 文本，音频 base64 编码嵌入 data.audio
 * status: 0=首帧, 1=数据帧, 2=尾帧
 * 音频格式：16kHz 16bit mono PCM → base64
 */

import { CONFIG } from '../config.js'
import { startCapture, stopCapture } from './audio-capture.js'

export function createXunfeiAsr() {
  let ws = null
  let audioCtrl = null
  let closed = false
  let connected = false

  let onResultCb = null
  let onErrorCb = null
  let onEndCb = null
  let interimText = ''

  // ── Fetch signed WebSocket URL from backend ──
  async function fetchAuthUrl() {
    const res = await fetch(`${CONFIG.proxyUrl}/api/xunfei/auth`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.summary || `鉴权失败 (${res.status})`)
    }
    const data = await res.json()
    return data.url
  }

  // ── Int16Array → exact base64 (1280 bytes = 640 samples) ──
  function pcmToBase64(chunk) {
    // MUST slice: Int16Array.buffer may be larger than byteLength
    const exact = new Uint8Array(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength))
    let binary = ''
    for (let i = 0; i < exact.length; i++) {
      binary += String.fromCharCode(exact[i])
    }
    return btoa(binary)
  }

  // ── Build data frame (status 0/1/2) ──
  function buildFrame(status, audioBase64) {
    return JSON.stringify({
      data: {
        status,
        format: 'audio/L16;rate=16000',
        encoding: 'raw',
        audio: audioBase64,
      },
    })
  }

  function buildFirstFrame() {
    return JSON.stringify({
      common: { app_id: CONFIG.asr.xunfeiAppId },
      business: {
        language: 'zh_cn',
        domain: 'iat',
        accent: 'mandarin',
        vad_eos: 3000,
        dwa: 'wpgs',
      },
      data: {
        status: 0,
        format: 'audio/L16;rate=16000',
        encoding: 'raw',
        audio: '',
      },
    })
  }

  // ── Parse IAT result into transcript ──
  function parseResult(result) {
    if (!result) return ''
    const wsArr = result.ws
    if (!wsArr || !wsArr.length) return ''
    return wsArr
      .map((w) => (w.cw || []).map((c) => c.w || '').join(''))
      .join('')
  }

  async function start() {
    closed = false
    connected = false
    interimText = ''

    try {
      const url = await fetchAuthUrl()

      ws = new WebSocket(url)
      // TEXT mode: all frames are JSON strings

      ws.onopen = () => {
        connected = true
        console.log('[xunfei] 已连接')
        ws.send(buildFirstFrame())

        startCapture((chunk) => {
          if (ws && ws.readyState === WebSocket.OPEN && connected) {
            ws.send(buildFrame(1, pcmToBase64(chunk)))
          }
        }).then((ctrl) => {
          audioCtrl = ctrl
        }).catch((err) => {
          if (!closed) onErrorCb?.({ message: '麦克风采集失败: ' + (err.message || '权限被拒绝') })
        })
      }

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.code !== 0) {
            console.error('[xunfei] 错误:', msg.message || msg.code)
            onErrorCb?.({ message: msg.message || `讯飞错误 ${msg.code}` })
            return
          }
          const result = msg.data?.result
          const text = parseResult(result)
          if (text) {
            // Track best (longest meaningful) text — ls=true often only has punctuation
            const cleaned = text.replace(/[。，！？、\s]/g, '')
            const bestClean = interimText.replace(/[。，！？、\s]/g, '')
            if (cleaned.length >= bestClean.length) {
              interimText = text
            }
            const isFinal = result?.ls === true
            onResultCb?.({ transcript: isFinal ? interimText : text, isFinal })
            // Final result — close gracefully
            if (isFinal) {
              console.log('[xunfei] 最终文本:', interimText)
              stopCapture()
              audioCtrl?.stop()
              ws.send(buildFrame(2, ''))
              setTimeout(() => { try { ws?.close() } catch {} }, 200)
            }
          }
        } catch (err) {
          console.error('[xunfei] 解析失败:', err.message, e.data)
        }
      }

      ws.onerror = () => {
        if (closed) return
        onErrorCb?.({ message: '讯飞服务连接失败' })
      }

      ws.onclose = () => {
        if (closed) return
        connected = false
        if (interimText) {
          onResultCb?.({ transcript: interimText, isFinal: true })
          interimText = ''
        }
        onEndCb?.()
      }
    } catch (err) {
      if (!closed) {
        onErrorCb?.({ message: err.message || '讯飞初始化失败' })
      }
    }
  }

  function stop() {
    closed = true
    if (ws && ws.readyState === WebSocket.OPEN && connected) {
      ws.send(buildFrame(2, ''))
    }
    audioCtrl?.stop()
    stopCapture()
    setTimeout(() => {
      try { ws?.close() } catch {}
    }, 200)
  }

  function destroy() {
    stop()
    ws = null
    audioCtrl = null
  }

  function onResult(fn) { onResultCb = fn }
  function onError(fn) { onErrorCb = fn }
  function onEnd(fn) { onEndCb = fn }

  return { start, stop, onResult, onError, onEnd, destroy }
}
