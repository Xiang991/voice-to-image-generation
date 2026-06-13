import { describe, it, expect } from 'vitest'
import { classifyIntent } from '../services/intentClassifier.js'

describe('classifyIntent — draw', () => {
  const drawCases = [
    ['画红圆', '画'],
    ['画一只小猫', '画'],
    ['画蓝色矩形', '画'],
    ['画一棵树', '画'],
    ['画房子', '画'],
    ['画黄色太阳', '画'],
    ['画一个圆', '画'],
    ['绘制一个三角形', '绘制'],
    ['绘一条龙', '绘'],
    ['加个五角星', '加个'],
    ['加一个爱心', '加.?个'],
    ['添个云朵', '添个'],
    ['来个笑脸', '来个'],
    ['弄个波浪线', '弄个'],
    ['做个月亮', '做个'],
    ['做一个星星', '做个'],
    ['加一只鸟', '加一'],
    ['添加花朵', '添加'],
    ['画一条线', '画一'],
    ['涂个背景', '涂'],
    ['画一个红色的太阳', '画'],
    ['绘一只蓝色的小鸟', '绘'],
  ]

  it.each(drawCases)('%s → draw', (input) => {
    expect(classifyIntent(input)).toBe('draw')
  })
})

describe('classifyIntent — control', () => {
  const controlCases = [
    ['撤销', '撤销'],
    ['回退', '回退'],
    ['后退', '后退'],
    ['撤消', '撤消'],
    ['清空', '清空'],
    ['清除', '清除'],
    ['删掉', '删掉'],
    ['删了', '删了'],
    ['全删', '全删'],
    ['重来', '重来'],
    ['重新开始', '重新开始'],
    ['结束绘画', '结束绘画'],
    ['结束绘图', '结束绘图'],
    ['结束画图', '结束画图'],
    ['结束画画', '结束画画'],
    ['清空画布', '清空'],
  ]

  it.each(controlCases)('%s → control', (input) => {
    expect(classifyIntent(input)).toBe('control')
  })
})

describe('classifyIntent — chat', () => {
  const chatCases = [
    ['你好'],
    ['今天天气怎么样'],
    ['你是谁'],
    ['帮我写首诗'],
    ['hello'],
    ['123'],
    ['...'],
    ['谢谢'],
    ['好的'],
    ['嗯'],
  ]

  it.each(chatCases)('%s → chat', (input) => {
    expect(classifyIntent(input)).toBe('chat')
  })
})

describe('classifyIntent — edge cases', () => {
  it('空字符串 → chat', () => {
    expect(classifyIntent('')).toBe('chat')
  })

  it('纯空格 → chat', () => {
    expect(classifyIntent('   ')).toBe('chat')
  })

  it('纯标点 → chat', () => {
    expect(classifyIntent('，。！？…')).toBe('chat')
  })

  it('英文 → chat', () => {
    expect(classifyIntent('draw a circle')).toBe('chat')
  })

  // control 优先于 draw
  it('"画红色圆然后结束绘画" → control（control 优先）', () => {
    expect(classifyIntent('画红色圆然后结束绘画')).toBe('control')
  })

  it('"画完撤销" → control（control 优先）', () => {
    expect(classifyIntent('画完撤销')).toBe('control')
  })
})
