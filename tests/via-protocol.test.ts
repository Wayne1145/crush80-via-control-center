import {describe, expect, it} from 'vitest';
import {VIA} from '../src/via/client';

describe('VIA 命令表', () => {
  it('保留官方 keymap 和自定义菜单命令编号', () => {
    expect(VIA.DYNAMIC_KEYMAP_GET_KEYCODE).toBe(0x04);
    expect(VIA.DYNAMIC_KEYMAP_SET_KEYCODE).toBe(0x05);
    expect(VIA.CUSTOM_MENU_GET_VALUE).toBe(0x08);
    expect(VIA.CUSTOM_MENU_SAVE).toBe(0x09);
  });
});
