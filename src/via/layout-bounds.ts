import type {KeyboardKey} from './layout';

export type LayoutBounds = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

/**
 * 计算官方 KLE 布局的完整边界。部分官方定义会使用负 x/y 偏移；
 * 渲染时必须减去最小值，否则左侧按键会落到不可滚动的负坐标区域。
 */
export function layoutBounds(keys: KeyboardKey[]): LayoutBounds {
  if (!keys.length) return {minX: 0, minY: 0, width: 1, height: 1};
  const minX = Math.min(...keys.map(key => key.x));
  const minY = Math.min(...keys.map(key => key.y));
  const maxX = Math.max(...keys.map(key => key.x + key.width));
  const maxY = Math.max(...keys.map(key => key.y + key.height));
  return {minX, minY, width: maxX - minX, height: maxY - minY};
}

export function normalizedKeyRect(key: KeyboardKey, bounds: LayoutBounds) {
  return {
    left: (key.x - bounds.minX) / bounds.width * 100,
    top: (key.y - bounds.minY) / bounds.height * 100,
    width: key.width / bounds.width * 100,
    height: key.height / bounds.height * 100,
  };
}
