import {qmkKeycodes} from './qmk-keycodes';
import {qmkKeycodesV10} from './qmk-keycodes-v10';
import {qmkKeycodesV11} from './qmk-keycodes-v11';
import {qmkKeycodesV12} from './qmk-keycodes-v12';
import {qmkKeycodesV13} from './qmk-keycodes-v13';

export type KeycodeOption = {code: string; label: string; value: number; category: string};
type KeycodeDictionary = Record<string, number>;

/** 根据设备报告的 VIA 协议版本选择与官方 VIA App 相同的默认 QMK 字典。 */
export function dictionaryForProtocol(protocol: number): KeycodeDictionary {
  if (protocol >= 13) return qmkKeycodesV13 as KeycodeDictionary;
  if (protocol === 12) return qmkKeycodesV12 as KeycodeDictionary;
  if (protocol === 11) return qmkKeycodesV11 as KeycodeDictionary;
  if (protocol === 10) return qmkKeycodesV10 as KeycodeDictionary;
  return qmkKeycodes as KeycodeDictionary;
}

const labels: Record<string, string> = {
  KC_NO: '禁用', KC_TRNS: '透明（继承下层）', KC_ENT: 'Enter', KC_ESC: 'Esc', KC_BSPC: 'Backspace', KC_TAB: 'Tab', KC_SPC: 'Space', KC_CAPS: 'Caps Lock',
  KC_MUTE: '静音', KC_VOLU: '音量 +', KC_VOLD: '音量 −', KC_MNXT: '下一曲', KC_MPRV: '上一曲', KC_MSTP: '停止', KC_MPLY: '播放 / 暂停',
  KC_LCTL: '左 Ctrl', KC_LSFT: '左 Shift', KC_LALT: '左 Alt', KC_LGUI: '左 Win', KC_RCTL: '右 Ctrl', KC_RSFT: '右 Shift', KC_RALT: '右 Alt', KC_RGUI: '右 Win',
};
function categoryFor(code: string, value: number) {
  if (code.startsWith('_')) return '内部';
  if (value >= 0x5f12 && value <= 0x5f21) return '宏';
  if (value >= 0x5010 && value <= 0x59ff || value >= 0x4000 && value <= 0x4fff || value >= 0x6000 && value <= 0x7fff) return '层';
  if (/^(KC_M|KC_VOL|KC_BRI|KC_WWW|KC_MAIL|KC_CALC)/.test(code)) return '媒体';
  if (/^KC_MS_/.test(code)) return '鼠标';
  if (/^(RGB_|BL_|BR_|EF_|ES_|H1_|S1_|H2_|S2_)/.test(code)) return '灯光';
  if (value <= 0x00e7) return '输入';
  return '特殊';
}
function labelFor(code: string) { if (labels[code]) return labels[code]; if (/^KC_[A-Z0-9]$/.test(code)) return code.slice(3); return code.replace(/^KC_/, '').replaceAll('_', ' '); }

/** 完整默认 QMK/VIA 可分配键码表；过滤内部范围标记，保留官方已定义行为。 */
export function keycodeOptionsForProtocol(protocol: number): KeycodeOption[] {
  const dictionary = dictionaryForProtocol(protocol);
  return Object.entries(dictionary).filter(([code, value]) => !code.startsWith('_') && Number.isInteger(value) && value >= 0 && value <= 0x7fff)
    .map(([code, value]) => ({code, label: labelFor(code), value, category: categoryFor(code, value)}))
    .sort((left, right) => left.category.localeCompare(right.category) || left.label.localeCompare(right.label));
}
export const keycodeOptions = keycodeOptionsForProtocol(9);

export function customKeycodeOptions(custom: Array<{name: string; title: string; shortName: string}> = [], protocol = 9): KeycodeOption[] {
  const dictionary = dictionaryForProtocol(protocol);
  return custom.map((keycode, index) => ({code: `CUSTOM(${index})`, label: keycode.shortName, value: dictionary._QK_KB + index, category: '设备'}));
}
export function macroKeycodeOptions(count: number, protocol = 9): KeycodeOption[] {
  const dictionary = dictionaryForProtocol(protocol);
  return Array.from({length: Math.min(count, dictionary._QK_MACRO_MAX - dictionary._QK_MACRO + 1)}, (_, index) => ({code: `MACRO(${index})`, label: `宏 ${index}`, value: dictionary._QK_MACRO + index, category: '宏'}));
}
export function labelForKeycode(value: number, custom: Array<{name: string; title: string; shortName: string}> = [], macroCount = 0, protocol = 9) {
  const option = [...keycodeOptionsForProtocol(protocol), ...customKeycodeOptions(custom, protocol), ...macroKeycodeOptions(macroCount, protocol)].find(item => item.value === value);
  return option?.label ?? `0x${value.toString(16).toUpperCase().padStart(4, '0')}`;
}
/** 供 VIA 宏使用：宏协议只接受单字节基础 HID 键码。 */
export function macroBasicKeyDictionary(protocol = 9) { return Object.fromEntries(Object.entries(dictionaryForProtocol(protocol)).filter(([code, value]) => !code.startsWith('_') && value >= 0 && value <= 0xff)); }
