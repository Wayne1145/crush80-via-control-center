import {describe, expect, it} from 'vitest';
import {byteToKeyMap, parseMacroBytes, serializeMacroBytes, type MacroStep} from '../src/via/macros';

const keyToByte = {KC_A: 0x04, KC_C: 0x06, KC_LCTL: 0xe0};
const byteToKey = byteToKeyMap(keyToByte);

describe('VIA 宏缓冲区编解码', () => {
  it('按协议 11 编码按键、文本和延迟，并且可无损读回', () => {
    const macros: MacroStep[][] = [[
      {type: 'down', keycode: 'KC_LCTL'}, {type: 'tap', keycode: 'KC_C'}, {type: 'up', keycode: 'KC_LCTL'},
      {type: 'delay', milliseconds: 120}, {type: 'text', text: 'A'},
    ], []];
    const bytes = serializeMacroBytes(macros, keyToByte, 11);
    expect(bytes).toEqual([1, 2, 0xe0, 1, 1, 0x06, 1, 3, 0xe0, 1, 4, 49, 50, 48, 124, 65, 0, 0]);
    expect(parseMacroBytes(bytes, 2, byteToKey, 11)).toEqual(macros);
  });

  it('按协议 10 将 0x01 解释为旧格式 Tap，而不是协议 11 前缀', () => {
    const bytes = [0x01, 0x04, 0x00];
    expect(parseMacroBytes(bytes, 1, byteToKey, 10)).toEqual([[{type: 'tap', keycode: 'KC_A'}]]);
  });

  it('拒绝协议 11 中未终止或非数字的延迟编码', () => {
    expect(() => parseMacroBytes([0x01, 0x04, 0x31, 0x00], 1, byteToKey, 11)).toThrow(/无效延迟/);
    expect(() => parseMacroBytes([0x01, 0x04, 0x61, 0x7c, 0x00], 1, byteToKey, 11)).toThrow(/无效延迟/);
  });

  it('在旧协议拒绝延迟，并拒绝非 ASCII 文本', () => {
    expect(() => serializeMacroBytes([[{type: 'delay', milliseconds: 1}]], keyToByte, 10)).toThrow(/不支持宏延迟/);
    expect(() => serializeMacroBytes([[{type: 'text', text: '八'}]], keyToByte, 11)).toThrow(/ASCII/);
  });
});
