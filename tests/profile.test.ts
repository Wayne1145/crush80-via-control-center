import {describe, expect, it} from 'vitest';
import {makeProfile, parseProfile} from '../src/via/profile';

const valid = () => makeProfile({
  mode: 'usb', vendorId: 0x320f, productId: 0x5055, matrix: {rows: 8, cols: 16},
  layers: Array.from({length: 4}, () => Array.from({length: 128}, () => 0x0004)),
  lighting: {brightness: 7, effect: 2, speed: 3, color: [120, 255]}, macros: [0, 0],
});

describe('本地档案安全校验', () => {
  it('接受当前版本且矩阵匹配的档案', () => { expect(parseProfile(JSON.stringify(valid())).matrix).toEqual({rows: 8, cols: 16}); });
  it('拒绝错误矩阵、越界灯光与非字节宏数据', () => {
    const broken = valid(); broken.matrix = {rows: 6, cols: 16};
    expect(() => parseProfile(JSON.stringify(broken))).toThrow(/矩阵/);
    const brokenLighting = valid(); brokenLighting.lighting.effect = 19;
    expect(() => parseProfile(JSON.stringify(brokenLighting))).toThrow(/灯光/);
    const brokenMacro = valid(); brokenMacro.macros = [300];
    expect(() => parseProfile(JSON.stringify(brokenMacro))).toThrow(/宏数据/);
  });
});
