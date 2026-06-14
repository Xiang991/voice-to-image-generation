/**
 * PCM audio capture from getUserMedia.
 * Outputs 16kHz 16bit mono Int16Array chunks (640 samples / 1280 bytes each).
 */

let audioCtx = null
let stream = null
let processor = null
let source = null

export async function startCapture(onChunk) {
  const nativeStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: { ideal: 16000 },
      channelCount: { ideal: 1 },
      echoCancellation: true,
      noiseSuppression: true,
    },
  })

  audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const nativeRate = audioCtx.sampleRate
  stream = nativeStream
  source = audioCtx.createMediaStreamSource(nativeStream)

  // Downsample ratio from native rate to 16kHz
  const targetRate = 16000
  const ratio = nativeRate / targetRate

  let accum = new Int16Array(0)
  const CHUNK_SIZE = 640 // 40ms at 16kHz

  // bufferSize=2048 for ~43ms at 48kHz → more frequent callbacks
  processor = audioCtx.createScriptProcessor(2048, 1, 1)

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0) // Float32Array
    // Downsample with averaging to reduce aliasing
    const downLen = Math.floor(input.length / ratio)
    const down = new Int16Array(downLen)
    for (let i = 0; i < downLen; i++) {
      const start = i * ratio
      const end = Math.min((i + 1) * ratio, input.length)
      let sum = 0
      for (let j = Math.floor(start); j < Math.ceil(end); j++) {
        const weight = Math.min(j + 1, end) - Math.max(j, start)
        sum += input[j] * weight
      }
      let sample = (sum / ratio) * 32768
      if (sample > 32767) sample = 32767
      if (sample < -32768) sample = -32768
      down[i] = sample
    }

    // Accumulate and emit chunks
    const merged = new Int16Array(accum.length + down.length)
    merged.set(accum)
    merged.set(down, accum.length)

    let offset = 0
    while (offset + CHUNK_SIZE <= merged.length) {
      const chunk = merged.slice(offset, offset + CHUNK_SIZE)
      onChunk(chunk)
      offset += CHUNK_SIZE
    }
    accum = merged.slice(offset)
  }

  source.connect(processor)
  processor.connect(audioCtx.destination)

  return {
    nativeRate,
    stop() {
      try { source?.disconnect() } catch {}
      try { processor?.disconnect() } catch {}
    },
  }
}

export function stopCapture() {
  try { source?.disconnect() } catch {}
  try { processor?.disconnect() } catch {}
  try { stream?.getTracks().forEach((t) => t.stop()) } catch {}
  try { audioCtx?.close() } catch {}
  source = null
  processor = null
  stream = null
  audioCtx = null
}
