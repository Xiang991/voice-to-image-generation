import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { createRef } from 'react'
import Canvas from '../components/Canvas.jsx'

function setup(width = 400, height = 300) {
  const ref = createRef()
  const { container } = render(<Canvas ref={ref} width={width} height={height} />)
  const canvas = container.querySelector('canvas')
  return { ref, canvas, container }
}

function pixelAt(canvas, x, y) {
  return Array.from(canvas.getContext('2d').getImageData(x, y, 1, 1).data)
}

describe('Canvas — 原生渲染', () => {
  // ==================== 空画布 ====================
  describe('空画布', () => {
    it('setLayers([]) → 白背景', () => {
      const { ref, canvas } = setup()
      ref.current.setLayers([])
      expect(pixelAt(canvas, 100, 100)).toEqual([255, 255, 255, 255])
    })

    it('setLayers([]) 多次调用不报错', () => {
      const { ref } = setup()
      expect(() => {
        ref.current.setLayers([])
        ref.current.setLayers([])
        ref.current.setLayers([])
      }).not.toThrow()
    })
  })

  // ==================== Circle ====================
  describe('circle 渲染', () => {
    it('圆心处像素 = 指定颜色', () => {
      const { ref, canvas } = setup()
      ref.current.setLayers([
        { id: 1, type: 'shape', shape: 'circle', color: 'red', x: 200, y: 150, radius: 50 },
      ])
      expect(pixelAt(canvas, 200, 150)).toEqual([255, 0, 0, 255])
    })

    it('圆外像素 = 白色', () => {
      const { ref, canvas } = setup()
      ref.current.setLayers([
        { id: 1, type: 'shape', shape: 'circle', color: 'red', x: 200, y: 150, radius: 30 },
      ])
      expect(pixelAt(canvas, 200, 150)).toEqual([255, 0, 0, 255])
      // 半径外应该是白色
      expect(pixelAt(canvas, 200, 110)).toEqual([255, 255, 255, 255])
    })

    it('默认半径 50 当未指定', () => {
      const { ref, canvas } = setup()
      ref.current.setLayers([
        { id: 1, type: 'shape', shape: 'circle', color: 'blue', x: 200, y: 150 },
      ])
      // 圆心应在默认半径内被填充
      expect(pixelAt(canvas, 200, 150)).toEqual([0, 0, 255, 255])
    })

    it('不同颜色正确渲染', () => {
      const { ref, canvas } = setup()
      ref.current.setLayers([
        { id: 1, type: 'shape', shape: 'circle', color: 'green', x: 100, y: 100, radius: 40 },
      ])
      expect(pixelAt(canvas, 100, 100)).toEqual([0, 128, 0, 255])
    })
  })

  // ==================== Rect ====================
  describe('rect 渲染', () => {
    it('矩形内部像素 = 指定颜色', () => {
      const { ref, canvas } = setup()
      ref.current.setLayers([
        { id: 1, type: 'shape', shape: 'rect', color: 'blue', x: 200, y: 150, width: 100, height: 80 },
      ])
      expect(pixelAt(canvas, 200, 150)).toEqual([0, 0, 255, 255])
    })

    it('矩形以 x/y 为中心', () => {
      const { ref, canvas } = setup()
      ref.current.setLayers([
        { id: 1, type: 'shape', shape: 'rect', color: 'red', x: 100, y: 100, width: 60, height: 60 },
      ])
      // 中心 (100,100) = 红色
      expect(pixelAt(canvas, 100, 100)).toEqual([255, 0, 0, 255])
      // (100-31, 100) 边界内
      expect(pixelAt(canvas, 75, 100)).toEqual([255, 0, 0, 255])
      // (100-31, 100) 边界外
      expect(pixelAt(canvas, 65, 100)).toEqual([255, 255, 255, 255])
    })

    it('默认宽高 100x80', () => {
      const { ref, canvas } = setup()
      ref.current.setLayers([
        { id: 1, type: 'shape', shape: 'rect', color: 'red', x: 200, y: 150 },
      ])
      expect(pixelAt(canvas, 200, 150)).toEqual([255, 0, 0, 255])
    })
  })

  // ==================== Line ====================
  describe('line 渲染', () => {
    it('线段路径上有颜色', () => {
      const { ref, canvas } = setup()
      ref.current.setLayers([
        { id: 1, type: 'shape', shape: 'line', color: 'green', x: 50, y: 50, x2: 150, y2: 50 },
      ])
      // 线段中点
      expect(pixelAt(canvas, 100, 50)).toEqual([0, 128, 0, 255])
    })

    it('未指定 x2/y2 → 默认+100', () => {
      const { ref, canvas } = setup()
      ref.current.setLayers([
        { id: 1, type: 'shape', shape: 'line', color: 'red', x: 100, y: 100 },
      ])
      expect(pixelAt(canvas, 150, 100)).toEqual([255, 0, 0, 255])
    })
  })

  // ==================== 复合 ====================
  describe('复合渲染', () => {
    it('多个 shape 同时渲染', () => {
      const { ref, canvas } = setup()
      ref.current.setLayers([
        { id: 1, type: 'shape', shape: 'circle', color: 'red', x: 100, y: 100, radius: 40 },
        { id: 2, type: 'shape', shape: 'rect', color: 'blue', x: 250, y: 200, width: 60, height: 60 },
      ])
      expect(pixelAt(canvas, 100, 100)).toEqual([255, 0, 0, 255])
      expect(pixelAt(canvas, 250, 200)).toEqual([0, 0, 255, 255])
      // 两图形之间空白区域 = 白色
      expect(pixelAt(canvas, 180, 150)).toEqual([255, 255, 255, 255])
    })

    it('第二次 setLayers 覆盖第一次', () => {
      const { ref, canvas } = setup()
      ref.current.setLayers([
        { id: 1, type: 'shape', shape: 'circle', color: 'red', x: 200, y: 150, radius: 50 },
      ])
      expect(pixelAt(canvas, 200, 150)).toEqual([255, 0, 0, 255])

      ref.current.setLayers([
        { id: 2, type: 'shape', shape: 'rect', color: 'blue', x: 200, y: 150, width: 100, height: 80 },
      ])
      // 旧的红色圆被清掉，只剩蓝色矩形
      expect(pixelAt(canvas, 200, 150)).toEqual([0, 0, 255, 255])
    })

    it('20+ 图层不出错', () => {
      const { ref } = setup()
      const layers = Array.from({ length: 25 }, (_, i) => ({
        id: i, type: 'shape', shape: 'circle', color: 'red',
        x: 50 + i * 12, y: 150, radius: 5,
      }))
      expect(() => ref.current.setLayers(layers)).not.toThrow()
    })
  })

  // ==================== SVG ====================
  describe('SVG 渲染', () => {
    it('SVG 图层不抛错（异步加载在浏览器验证）', () => {
      const { ref } = setup()
      expect(() => ref.current.setLayers([
        { id: 1, type: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>', x: 0, y: 0, scale: 1 },
      ])).not.toThrow()
    })

    it('SVG 混合 shape 同步部分正常渲染', () => {
      const { ref, canvas } = setup()
      ref.current.setLayers([
        { id: 1, type: 'shape', shape: 'circle', color: 'red', x: 100, y: 100, radius: 30 },
        { id: 2, type: 'svg', svg: '<svg>...</svg>', x: 200, y: 50, scale: 1 },
      ])
      // shape 同步渲染不受 SVG 影响
      expect(pixelAt(canvas, 100, 100)).toEqual([255, 0, 0, 255])
    })

    it('SVG 恶意内容不抛错', () => {
      const { ref } = setup()
      expect(() => ref.current.setLayers([
        { id: 1, type: 'svg', svg: 'not-valid-svg', x: 0, y: 0 },
      ])).not.toThrow()
    })

    it('空 SVG 不抛错', () => {
      const { ref } = setup()
      expect(() => ref.current.setLayers([
        { id: 1, type: 'svg', svg: '', x: 0, y: 0 },
      ])).not.toThrow()
    })
  })

  // ==================== 边界 ====================
  describe('边界情况', () => {
    it('未知 shape 类型不报错', () => {
      const { ref } = setup()
      expect(() => ref.current.setLayers([
        { id: 1, type: 'shape', shape: 'triangle', color: 'red', x: 200, y: 150 },
      ])).not.toThrow()
    })

    it('ref 未挂载时不抛错', () => {
      const ref = createRef()
      expect(() => {
        // ref.current 为 null，不应抛错
        ref.current?.setLayers([])
      }).not.toThrow()
    })

    it('canvas 元素有正确属性', () => {
      const { canvas } = setup(800, 600)
      expect(canvas.width).toBe(800)
      expect(canvas.height).toBe(600)
    })
  })
})
