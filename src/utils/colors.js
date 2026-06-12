const COLOR_MAP = {
  '红': 'red', '红色': 'red',
  '蓝': 'blue', '蓝色': 'blue',
  '绿': 'green', '绿色': 'green',
  '黄': 'yellow', '黄色': 'yellow',
  '黑': 'black', '黑色': 'black',
  '白': 'white', '白色': 'white',
  '橙': 'orange', '橙色': 'orange',
  '紫': 'purple', '紫色': 'purple',
  '粉': 'pink', '粉色': 'pink',
  '灰': 'gray', '灰色': 'gray',
  '棕': 'brown', '棕色': 'brown',
  '青': 'cyan', '青色': 'cyan',
}

export function resolveColor(name) {
  if (!name) return 'black'
  return COLOR_MAP[name] || name
}
