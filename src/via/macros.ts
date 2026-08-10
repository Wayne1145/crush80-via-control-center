export type MacroStep =
  | {type: 'tap'; keycode: string}
  | {type: 'down'; keycode: string}
  | {type: 'up'; keycode: string}
  | {type: 'text'; text: string}
  | {type: 'delay'; milliseconds: number};

export const MACRO_TERMINATOR = 0x00;
const ACTION_PREFIX = 0x01;
const DELAY_TERMINATOR = 0x7c;
const ACTION = {tap: 1, down: 2, up: 3, delay: 4} as const;

export function parseMacroBytes(bytes: number[], count: number, byteToKey: Record<number, string>, protocol: number) {
  const macros: MacroStep[][] = [];
  let steps: MacroStep[] = [];
  let text = '';
  const flushText = () => { if (text) { steps.push({type: 'text', text}); text = ''; } };

  for (let index = 0; index < bytes.length && macros.length < count; index++) {
    const value = bytes[index];
    if (value === MACRO_TERMINATOR) { flushText(); macros.push(steps); steps = []; continue; }
    if (protocol >= 11 && value === ACTION_PREFIX) {
      const action = bytes[++index];
      if (action === undefined) throw new Error('宏动作前缀后缺少动作类型。');
      if (action === ACTION.delay) {
        const digits: number[] = [];
        let terminated = false;
        while (++index < bytes.length) {
          if (bytes[index] === DELAY_TERMINATOR) { terminated = true; break; }
          digits.push(bytes[index]);
        }
        if (!terminated || digits.length === 0 || !digits.every(byte => byte >= 0x30 && byte <= 0x39)) throw new Error('宏内含无效延迟。');
        flushText();
        const milliseconds = Number(String.fromCharCode(...digits));
        if (!Number.isInteger(milliseconds) || milliseconds < 0 || milliseconds > 9999) throw new Error('宏内含无效延迟。');
        steps.push({type: 'delay', milliseconds});
        continue;
      }
      const keyByte = bytes[++index];
      const key = keyByte === undefined ? undefined : byteToKey[keyByte];
      if (!key) throw new Error('宏内含当前 VIA 协议不支持的按键码。');
      flushText();
      if (action === ACTION.tap) steps.push({type: 'tap', keycode: key});
      else if (action === ACTION.down) steps.push({type: 'down', keycode: key});
      else if (action === ACTION.up) steps.push({type: 'up', keycode: key});
      else throw new Error('宏内含未知动作。');
      continue;
    }
    // 协议 7–10 旧宏格式没有前缀：01/02/03 直接是动作码。
    if (protocol < 11 && [ACTION.tap, ACTION.down, ACTION.up].includes(value as 1 | 2 | 3)) {
      const keyByte = bytes[++index];
      const key = keyByte === undefined ? undefined : byteToKey[keyByte];
      if (!key) throw new Error('宏内含当前 VIA 协议不支持的按键码。');
      flushText();
      steps.push({type: value === ACTION.tap ? 'tap' : value === ACTION.down ? 'down' : 'up', keycode: key});
      continue;
    }
    text += String.fromCharCode(value);
  }
  while (macros.length < count) macros.push([]);
  return macros;
}

export function serializeMacroBytes(macros: MacroStep[][], keyToByte: Record<string, number>, protocol: number) {
  return macros.flatMap(steps => {
    const output: number[] = [];
    for (const step of steps) {
      if (step.type === 'text') {
        for (const char of step.text) {
          const code = char.charCodeAt(0);
          if (code > 0x7f) throw new Error('VIA 宏仅支持 ASCII 文本；请改用按键动作。');
          output.push(code);
        }
        continue;
      }
      if (step.type === 'delay') {
        if (protocol < 11) throw new Error('此键盘 VIA 协议版本不支持宏延迟。');
        if (!Number.isInteger(step.milliseconds) || step.milliseconds < 0 || step.milliseconds > 9999) throw new Error('宏延迟必须是 0–9999 毫秒。');
        output.push(ACTION_PREFIX, ACTION.delay, ...String(step.milliseconds).split('').map(char => char.charCodeAt(0)), DELAY_TERMINATOR);
        continue;
      }
      const key = keyToByte[step.keycode];
      if (key === undefined || key > 0xff) throw new Error(`宏按键 ${step.keycode} 不属于当前协议的基础键码。`);
      const action = ACTION[step.type];
      if (protocol >= 11) output.push(ACTION_PREFIX, action, key);
      else output.push(action, key);
    }
    output.push(MACRO_TERMINATOR);
    return output;
  });
}

export function byteToKeyMap(keyToByte: Record<string, number>) {
  return Object.fromEntries(Object.entries(keyToByte).filter(([, value]) => value <= 0xff).map(([key, value]) => [value, key]));
}
