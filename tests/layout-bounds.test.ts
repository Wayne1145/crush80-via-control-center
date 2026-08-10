import {describe, expect, it} from 'vitest';
import usbDefinition from '../public/definitions/crush80-rgb-usb.json';
import {parseOfficialLayout} from '../src/via/layout';
import {layoutBounds, normalizedKeyRect} from '../src/via/layout-bounds';

describe('官方键盘布局渲染边界', () => {
  it('把官方 JSON 的负坐标归一化到可点击区域内', () => {
    const keys = parseOfficialLayout(usbDefinition);
    const bounds = layoutBounds(keys);
    expect(bounds).toEqual({minX: -2.5, minY: 0, width: 23.25, height: 7.25});
    for (const key of keys) {
      const rect = normalizedKeyRect(key, bounds);
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.left + rect.width).toBeLessThanOrEqual(100.000001);
      expect(rect.top + rect.height).toBeLessThanOrEqual(100.000001);
    }
    expect(normalizedKeyRect(keys.find(key => key.id === '4:0')!, bounds).left).toBe(0);
    expect(normalizedKeyRect(keys.find(key => key.id === '4:1')!, bounds).left).toBeGreaterThan(0);
  });
});
