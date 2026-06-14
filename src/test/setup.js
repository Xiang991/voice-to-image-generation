import '@testing-library/jest-dom/vitest'

// Minimal Canvas 2D mock for jsdom (no native canvas module available).
// Override the prototype so getContext('2d') returns a working stub.

if (!HTMLCanvasElement.prototype._getContextPatched) {
  const noop = () => {}

  function makeMockContext() {
    return {
      canvas: null,
      _fillStyle: '#000000',
      _strokeStyle: '#000000',
      _lineWidth: 1,
      _lineDash: [],

      get fillStyle() { return this._fillStyle },
      set fillStyle(v) { this._fillStyle = v },

      get strokeStyle() { return this._strokeStyle },
      set strokeStyle(v) { this._strokeStyle = v },

      get lineWidth() { return this._lineWidth },
      set lineWidth(v) { this._lineWidth = v },

      save: noop,
      restore: noop,
      clearRect: noop,
      fillRect: noop,
      strokeRect: noop,
      beginPath: noop,
      closePath: noop,
      moveTo: noop,
      lineTo: noop,
      arc: noop,
      fill: noop,
      stroke: noop,
      drawImage: noop,
      fillText: noop,
      strokeText: noop,
      translate: noop,
      rotate: noop,
      scale: noop,
      transform: noop,
      setTransform: noop,
      clip: noop,
      rect: noop,

      setLineDash(d) { this._lineDash = d },
      getLineDash() { return this._lineDash },

      measureText() {
        return { width: 0, fontBoundingBoxAscent: 0, fontBoundingBoxDescent: 0 }
      },

      createLinearGradient() {
        return { addColorStop: noop }
      },
      createRadialGradient() {
        return { addColorStop: noop }
      },

      getImageData(x, y, w, h) {
        const len = w * h * 4
        const arr = new Uint8ClampedArray(len)
        for (let i = 0; i < len; i += 4) {
          arr[i] = 255
          arr[i + 1] = 255
          arr[i + 2] = 255
          arr[i + 3] = 255
        }
        return { data: arr, width: w, height: h, colorSpace: 'srgb' }
      },

      putImageData: noop,
      createImageData(w, h) {
        return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }
      },
      createPattern() { return null },
      isPointInPath: () => false,
      isPointInStroke: () => false,
    }
  }

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    writable: false,
    value: function (type) {
      if (type === '2d') {
        const ctx = makeMockContext()
        ctx.canvas = this
        return ctx
      }
      return null
    },
  })

  HTMLCanvasElement.prototype._getContextPatched = true
}
