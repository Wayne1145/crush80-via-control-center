/*
 * 标准 VIA WebHID 传输层。
 * 仅实现官方 VIA 协议中本项目实际使用的键位、菜单与宏命令；
 * 明确不包含刷写、EEPROM 重置、Bootloader 跳转或厂商私有命令。
 */
export const VIA = {
  GET_PROTOCOL_VERSION: 0x01,
  GET_KEYBOARD_VALUE: 0x02,
  SET_KEYBOARD_VALUE: 0x03,
  DYNAMIC_KEYMAP_GET_KEYCODE: 0x04,
  DYNAMIC_KEYMAP_SET_KEYCODE: 0x05,
  CUSTOM_MENU_SET_VALUE: 0x07,
  CUSTOM_MENU_GET_VALUE: 0x08,
  CUSTOM_MENU_SAVE: 0x09,
  DYNAMIC_KEYMAP_MACRO_GET_COUNT: 0x0c,
  DYNAMIC_KEYMAP_MACRO_GET_BUFFER_SIZE: 0x0d,
  DYNAMIC_KEYMAP_MACRO_GET_BUFFER: 0x0e,
  DYNAMIC_KEYMAP_MACRO_SET_BUFFER: 0x0f,
  DYNAMIC_KEYMAP_MACRO_RESET: 0x10,
  DYNAMIC_KEYMAP_GET_LAYER_COUNT: 0x11,
  DYNAMIC_KEYMAP_GET_BUFFER: 0x12,
  DYNAMIC_KEYMAP_SET_BUFFER: 0x13,
} as const;

export type HidInputReportEvent = Event & {data: DataView; device: WebHidDevice; reportId: number};
export type HidCollection = {usagePage: number; usage: number};
export type WebHidDevice = {
  opened: boolean;
  vendorId: number;
  productId: number;
  productName: string;
  collections?: HidCollection[];
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(reportId: number, data: BufferSource): Promise<void>;
  addEventListener(type: 'inputreport', listener: (event: HidInputReportEvent) => void): void;
  removeEventListener(type: 'inputreport', listener: (event: HidInputReportEvent) => void): void;
};

type HidNavigator = {
  requestDevice(options: {filters: unknown[]}): Promise<WebHidDevice[]>;
  addEventListener?(type: 'disconnect', listener: (event: {device: WebHidDevice}) => void): void;
  removeEventListener?(type: 'disconnect', listener: (event: {device: WebHidDevice}) => void): void;
};

const REPORT_LENGTH = 32;
const MAX_BUFFER_CHUNK = 28;
const toU16 = (hi: number, lo: number) => (hi << 8) | lo;
const fromU16 = (value: number) => [(value >>> 8) & 0xff, value & 0xff];

function exactPrefixEquals(data: Uint8Array, prefix: number[]) {
  return prefix.every((value, index) => data[index] === value);
}

export class ViaHidClient {
  private queue = Promise.resolve();
  private disconnected = false;

  constructor(readonly device: WebHidDevice) {}

  async open() {
    if (this.disconnected) throw new Error('键盘已经断开，请重新连接。');
    if (!this.device.opened) await this.device.open();
  }

  async close() {
    if (this.device.opened) await this.device.close();
  }

  markDisconnected() { this.disconnected = true; }

  command(command: number, payload: number[] = []) {
    const run = () => this.send(command, payload);
    const result = this.queue.then(run, run);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async send(command: number, payload: number[]) {
    await this.open();
    if (payload.length > REPORT_LENGTH - 1) throw new Error('VIA 命令负载超过 31 字节安全上限。');
    const message = new Uint8Array(REPORT_LENGTH);
    message[0] = command;
    message.set(payload, 1);
    const expected = [command, ...payload];

    let timer: ReturnType<typeof setTimeout> | undefined;
    let onReport: ((event: HidInputReportEvent) => void) | undefined;
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      if (onReport) this.device.removeEventListener('inputreport', onReport);
    };
    const reply = new Promise<Uint8Array>((resolve, reject) => {
      timer = setTimeout(() => {
        cleanup();
        reject(new Error('键盘未在 1.5 秒内响应 VIA 命令。请确认选择的是官方 VIA HID 接口。'));
      }, 1500);
      onReport = (event: HidInputReportEvent) => {
        if (event.reportId !== 0) return;
        const data = new Uint8Array(event.data.buffer.slice(event.data.byteOffset, event.data.byteOffset + event.data.byteLength));
        if (!exactPrefixEquals(data, expected)) return;
        cleanup();
        resolve(data);
      };
      this.device.addEventListener('inputreport', onReport);
    });

    try {
      // WebHID 把 Report ID 独立传入，data 中恰为 VIA 的 32 字节协议包。
      await this.device.sendReport(0, message);
      return await reply;
    } catch (error) {
      cleanup();
      void reply.catch(() => undefined);
      throw error;
    }
  }

  async protocolVersion() {
    const reply = await this.command(VIA.GET_PROTOCOL_VERSION);
    return toU16(reply[1], reply[2]);
  }

  async layerCount(protocol?: number) {
    const version = protocol ?? await this.protocolVersion();
    return version >= 8 ? (await this.command(VIA.DYNAMIC_KEYMAP_GET_LAYER_COUNT))[1] : 4;
  }

  async getKeyboardValue(valueId: number, parameters: number[] = [], size = 1) {
    const payload = [valueId, ...parameters];
    const reply = await this.command(VIA.GET_KEYBOARD_VALUE, payload);
    return Array.from(reply.slice(1 + payload.length, 1 + payload.length + size));
  }

  async qmkKeycodesVersion() {
    const bytes = await this.getKeyboardValue(0x06, [], 4);
    if (bytes.length !== 4 || bytes.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 0xff)) throw new Error('键盘返回了无效的 QMK 键码版本。');
    const isBcd = bytes.every(byte => (byte >> 4) <= 9 && (byte & 0x0f) <= 9);
    if (!isBcd) throw new Error('键盘返回的 QMK 键码版本不是有效 BCD。');
    return ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  }

  async getKey(layer: number, row: number, col: number) {
    const reply = await this.command(VIA.DYNAMIC_KEYMAP_GET_KEYCODE, [layer, row, col]);
    return toU16(reply[4], reply[5]);
  }

  async setKey(layer: number, row: number, col: number, keycode: number) {
    await this.command(VIA.DYNAMIC_KEYMAP_SET_KEYCODE, [layer, row, col, ...fromU16(keycode)]);
  }

  async readLayer(rows: number, cols: number, layer: number, protocol: number) {
    const total = rows * cols;
    if (protocol < 8) {
      const values: number[] = [];
      for (let index = 0; index < total; index++) values.push(await this.getKey(layer, Math.floor(index / cols), index % cols));
      return values;
    }
    const bytes: number[] = [];
    for (let offset = 0; offset < total * 2; offset += MAX_BUFFER_CHUNK) {
      const size = Math.min(MAX_BUFFER_CHUNK, total * 2 - offset);
      const reply = await this.command(VIA.DYNAMIC_KEYMAP_GET_BUFFER, [...fromU16(layer * total * 2 + offset), size]);
      bytes.push(...reply.slice(4, 4 + size));
    }
    return Array.from({length: total}, (_, index) => toU16(bytes[index * 2], bytes[index * 2 + 1]));
  }

  async getMenuValue(channel: number, valueId: number, size = 1) {
    const payload = [channel, valueId];
    const reply = await this.command(VIA.CUSTOM_MENU_GET_VALUE, payload);
    return Array.from(reply.slice(1 + payload.length, 1 + payload.length + size));
  }

  async setMenuValue(channel: number, valueId: number, values: number[]) {
    await this.command(VIA.CUSTOM_MENU_SET_VALUE, [channel, valueId, ...values]);
  }

  async saveMenu(channel: number) { await this.command(VIA.CUSTOM_MENU_SAVE, [channel]); }

  async macroCount() { return (await this.command(VIA.DYNAMIC_KEYMAP_MACRO_GET_COUNT))[1]; }
  async macroBufferSize() {
    const reply = await this.command(VIA.DYNAMIC_KEYMAP_MACRO_GET_BUFFER_SIZE);
    return toU16(reply[1], reply[2]);
  }

  async readMacroBytes() {
    const size = await this.macroBufferSize();
    const bytes: number[] = [];
    for (let offset = 0; offset < size; offset += MAX_BUFFER_CHUNK) {
      const chunkSize = Math.min(MAX_BUFFER_CHUNK, size - offset);
      const reply = await this.command(VIA.DYNAMIC_KEYMAP_MACRO_GET_BUFFER, [...fromU16(offset), chunkSize]);
      bytes.push(...reply.slice(4, 4 + chunkSize));
    }
    return bytes;
  }

  async writeMacroBytes(data: number[]) {
    const capacity = await this.macroBufferSize();
    if (data.length > capacity) throw new Error(`宏内容 ${data.length} 字节超过键盘缓冲区 ${capacity} 字节。`);
    const guardOffset = capacity - 1;
    // VIA 官方协议的写入中断保护：最后一字节非 0 表示写入中。
    await this.command(VIA.DYNAMIC_KEYMAP_MACRO_RESET);
    await this.command(VIA.DYNAMIC_KEYMAP_MACRO_SET_BUFFER, [...fromU16(guardOffset), 1, 0xff]);
    try {
      for (let offset = 0; offset < data.length; offset += MAX_BUFFER_CHUNK) {
        const chunk = data.slice(offset, offset + MAX_BUFFER_CHUNK);
        await this.command(VIA.DYNAMIC_KEYMAP_MACRO_SET_BUFFER, [...fromU16(offset), chunk.length, ...chunk]);
      }
    } finally {
      await this.command(VIA.DYNAMIC_KEYMAP_MACRO_SET_BUFFER, [...fromU16(guardOffset), 1, 0]);
    }
  }
}

export function assertCompatibleViaDevice(device: WebHidDevice, vendorId: number, productId: number) {
  if (device.vendorId !== vendorId || device.productId !== productId) {
    throw new Error(`当前模式要求 0x${vendorId.toString(16).toUpperCase()}:0x${productId.toString(16).toUpperCase()}，但选择的设备不匹配。`);
  }
  const isVia = device.collections?.some(collection => collection.usagePage === 0xff60 && collection.usage === 0x61);
  if (!isVia) throw new Error('选择的不是 VIA HID 接口（Usage Page 0xFF60 / Usage 0x61）。请在系统弹窗中选择供应商定义接口。');
}

export async function requestAnyHidDevice() {
  const hid = (navigator as Navigator & {hid?: HidNavigator}).hid;
  if (!hid) throw new Error('当前浏览器不支持 WebHID。请使用最新版 Chrome 或 Edge，并通过 localhost 打开本工具。');
  const devices = await hid.requestDevice({filters: []});
  if (!devices[0]) throw new Error('未选择设备。');
  return devices[0];
}

export function observeHidDisconnect(client: ViaHidClient, callback: () => void) {
  const hid = (navigator as Navigator & {hid?: HidNavigator}).hid;
  const handler = (event: {device: WebHidDevice}) => {
    if (event.device === client.device) { client.markDisconnected(); callback(); }
  };
  hid?.addEventListener?.('disconnect', handler);
  return () => hid?.removeEventListener?.('disconnect', handler);
}
