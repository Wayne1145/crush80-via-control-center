import {describe, expect, it} from 'vitest';
import {definitionForMode, normalizeDefinition} from '../src/via/definition';

describe('Crush 80 官方定义', () => {
  it('为 USB 有线模式保留官方 0x5055 标识', () => {
    expect(definitionForMode('usb').productId).toBe('0x5055');
    expect(normalizeDefinition(definitionForMode('usb')).productId).toBe(0x5055);
  });

  it('为 2.4G 模式保留官方 0x5088 标识', () => {
    expect(definitionForMode('2.4g').productId).toBe('0x5088');
    expect(normalizeDefinition(definitionForMode('2.4g')).productId).toBe(0x5088);
  });

  it('规范化定义后保留 8×16 矩阵和 19 个灯效', () => {
    const definition = normalizeDefinition(definitionForMode('usb'));
    expect(definition.matrix).toEqual({rows: 8, cols: 16});
    expect(definition.lighting.effects).toHaveLength(19);
  });
});
