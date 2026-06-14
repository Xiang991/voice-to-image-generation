import { describe, it, expect } from 'vitest'
import { generateCanvasSummary } from '../services/canvasSummary.js'

describe('generateCanvasSummary', () => {
  it('空 layers → 空数组', () => {
    expect(generateCanvasSummary([])).toEqual([])
  })

  it('null/undefined → 空数组', () => {
    expect(generateCanvasSummary(null)).toEqual([])
    expect(generateCanvasSummary(undefined)).toEqual([])
  })

  describe('shape 类型', () => {
    it('circle 提取所有字段', () => {
      const layers = [
        { id: 1, type: 'shape', shape: 'circle', color: 'red', x: 400, y: 300, radius: 50 },
      ]
      expect(generateCanvasSummary(layers)).toEqual([
        { type: 'shape', shape: 'circle', color: 'red', x: 400, y: 300, radius: 50, zone: '中中' },
      ])
    })

    it('rect 提取宽高', () => {
      const layers = [
        { id: 2, type: 'shape', shape: 'rect', color: 'blue', x: 200, y: 150, width: 100, height: 80 },
      ]
      expect(generateCanvasSummary(layers)).toEqual([
        { type: 'shape', shape: 'rect', color: 'blue', x: 200, y: 150, width: 100, height: 80, zone: '左上' },
      ])
    })

    it('line 提取基本字段', () => {
      const layers = [
        { id: 3, type: 'shape', shape: 'line', color: 'green', x: 0, y: 0, x2: 400, y2: 300 },
      ]
      expect(generateCanvasSummary(layers)).toEqual([
        { type: 'shape', shape: 'line', color: 'green', x: 0, y: 0, zone: '左上' },
      ])
    })

    it('shape 无 radius 时不输出 radius', () => {
      const layers = [
        { id: 4, type: 'shape', shape: 'rect', color: 'yellow', x: 10, y: 20, width: 30, height: 40 },
      ]
      const result = generateCanvasSummary(layers)
      expect(result[0].radius).toBeUndefined()
    })
  })

  describe('svg 类型', () => {
    it('提取 svg 相关字段', () => {
      const layers = [
        { id: 5, type: 'svg', svg: '<svg>...</svg>', x: 100, y: 200, scale: 2 },
      ]
      expect(generateCanvasSummary(layers)).toEqual([
        { type: 'svg', x: 100, y: 200, scale: 2, zone: '左中' },
      ])
    })

    it('svg 默认 x/y 为 0', () => {
      const layers = [
        { id: 6, type: 'svg', svg: '<svg>...</svg>' },
      ]
      const result = generateCanvasSummary(layers)
      expect(result[0]).toEqual({ type: 'svg', zone: '中中' })
    })
  })

  describe('混合 layers', () => {
    it('shape + svg 交替', () => {
      const layers = [
        { id: 1, type: 'shape', shape: 'circle', color: 'red', x: 400, y: 300, radius: 50 },
        { id: 2, type: 'svg', svg: '<svg>...</svg>', x: 50, y: 60, scale: 1 },
        { id: 3, type: 'shape', shape: 'rect', color: 'blue', x: 100, y: 100, width: 200, height: 150 },
      ]
      expect(generateCanvasSummary(layers)).toEqual([
        { type: 'shape', shape: 'circle', color: 'red', x: 400, y: 300, radius: 50, zone: '中中' },
        { type: 'svg', x: 50, y: 60, scale: 1, zone: '左上' },
        { type: 'shape', shape: 'rect', color: 'blue', x: 100, y: 100, width: 200, height: 150, zone: '左上' },
      ])
    })
  })

  describe('大批量 layers', () => {
    it('20+ layers 不出错', () => {
      const layers = Array.from({ length: 25 }, (_, i) => ({
        id: i,
        type: 'shape',
        shape: 'circle',
        color: 'red',
        x: i * 10,
        y: i * 10,
        radius: 5,
      }))
      const result = generateCanvasSummary(layers)
      expect(result).toHaveLength(25)
      expect(result[0]).toEqual({ type: 'shape', shape: 'circle', color: 'red', x: 0, y: 0, radius: 5, zone: '左上' })
      expect(result[24].x).toBe(240)
    })
  })
})
