import {describe, expect, it} from 'vitest';
import {customKeycodeOptions, dictionaryForProtocol, keycodeOptionsForProtocol, labelForKeycode, macroBasicKeyDictionary} from '../src/via/keycodes';

describe('协议版本键码字典', () => {
  it('为协议 7–13 返回官方 VIA 对应的 QMK 字典', () => {
    for (const protocol of [7, 8, 9, 10, 11, 12, 13]) {
      const dictionary = dictionaryForProtocol(protocol);
      expect(dictionary.KC_A).toBe(0x0004);
      expect(dictionary._QK_KB).toBeDefined();
      expect(dictionary._QK_MACRO).toBeDefined();
      expect(keycodeOptionsForProtocol(protocol).length).toBeGreaterThan(100);
    }
  });

  it('仅根据官方 customKeycodes 顺序生成设备键码', () => {
    const custom = [{name:'测试', title:'测试', shortName:'TEST'}];
    const option = customKeycodeOptions(custom, 9)[0];
    expect(option.value).toBe(dictionaryForProtocol(9)._QK_KB);
    expect(labelForKeycode(option.value, custom, 0, 9)).toBe('TEST');
  });

  it('宏编码字典只含单字节基础键码', () => {
    expect(Object.values(macroBasicKeyDictionary(11)).every(value => value >= 0 && value <= 0xff)).toBe(true);
  });
});
