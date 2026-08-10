import {describe, expect, it} from 'vitest';
import {changedLightingCommands} from '../src/via/lighting';
import type {LightingState} from '../src/via/profile';

const baseline: LightingState = {brightness: 7, effect: 6, speed: 2, color: [12, 255]};

describe('灯光增量写入', () => {
  it('只切换到波浪时不重写颜色，避免把 RGB 动态效果锁成单色', () => {
    expect(changedLightingCommands(baseline, {...baseline, effect: 1})).toEqual([
      {command: 2, value: [1]},
    ]);
  });

  it('明确修改颜色时才写 Hue/Saturation', () => {
    expect(changedLightingCommands(baseline, {...baseline, color: [96, 220]})).toEqual([
      {command: 4, value: [96, 220]},
    ]);
  });

  it('保留多个真实变更的官方命令顺序', () => {
    expect(changedLightingCommands(baseline, {brightness: 9, effect: 2, speed: 4, color: [20, 180]})).toEqual([
      {command: 1, value: [9]},
      {command: 2, value: [2]},
      {command: 3, value: [4]},
      {command: 4, value: [20, 180]},
    ]);
  });
});
