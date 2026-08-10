import {describe, expect, it} from 'vitest';
import usbDefinition from '../public/definitions/crush80-rgb-usb.json';
import {coordinateIndex, parseOfficialLayout} from '../src/via/layout';

describe('Crush 80 官方物理布局', () => {
  it('只从官方 JSON 解析可寻址矩阵键位', () => {
    const keys = parseOfficialLayout(usbDefinition);
    expect(keys).toHaveLength(93);
    expect(new Set(keys.map(key => key.id)).size).toBe(93);
    expect(keys.every(key => key.row >= 0 && key.row < 8 && key.col >= 0 && key.col < 16)).toBe(true);
  });

  it('矩阵索引严格遵循官方 8×16 行优先顺序', () => {
    expect(coordinateIndex({row: 0, col: 0}, 16)).toBe(0);
    expect(coordinateIndex({row: 5, col: 15}, 16)).toBe(95);
  });
});
