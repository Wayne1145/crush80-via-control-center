import {describe, expect, it, vi} from 'vitest';
import {assertCompatibleViaDevice, VIA, ViaHidClient, viaCollectionStatus, type HidInputReportEvent, type WebHidDevice} from '../src/via/client';

class FakeDevice implements WebHidDevice {
  opened = false;
  vendorId = 0x320f;
  productId = 0x5055;
  productName = 'Crush 80';
  collections = [{usagePage: 0xff60, usage: 0x61}];
  listeners = new Set<(event: HidInputReportEvent) => void>();
  sent: Uint8Array[] = [];
  async open() { this.opened = true; }
  async close() { this.opened = false; }
  async sendReport(_reportId: number, data: BufferSource) {
    const source = ArrayBuffer.isView(data)
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);
    const bytes = new Uint8Array(source);
    this.sent.push(new Uint8Array(bytes));
    const response = new Uint8Array(32);
    response.set(bytes.slice(0, 4));
    response[4] = 0x12;
    response[5] = 0x34;
    queueMicrotask(() => this.listeners.forEach(listener => listener({data: new DataView(response.buffer), device: this, reportId: 0} as unknown as HidInputReportEvent)));
  }
  addEventListener(_type: 'inputreport', listener: (event: HidInputReportEvent) => void) { this.listeners.add(listener); }
  removeEventListener(_type: 'inputreport', listener: (event: HidInputReportEvent) => void) { this.listeners.delete(listener); }
}

describe('VIA WebHID 安全边界', () => {
  it('VID/PID 不匹配时在发送命令前拒绝；缺少 collection 仅记录诊断，不误拒官方设备', () => {
    const device = new FakeDevice();
    expect(() => assertCompatibleViaDevice(device, 0x320f, 0x5055)).not.toThrow();
    device.collections = [{usagePage: 1, usage: 6}];
    expect(() => assertCompatibleViaDevice(device, 0x320f, 0x5055)).not.toThrow();
    expect(viaCollectionStatus(device)).toEqual({matched: false, collections: [{usagePage: 1, usage: 6}]});
    expect(() => assertCompatibleViaDevice(device, 0x320f, 0x5088)).toThrow(/当前模式要求/);
  });

  it('以 32 字节、报告 ID 0 发送，并匹配完整请求回显', async () => {
    vi.useFakeTimers();
    const device = new FakeDevice();
    const client = new ViaHidClient(device);
    const result = await client.getKey(0, 2, 3);
    expect(result).toBe(0x1234);
    expect(device.sent[0]).toHaveLength(32);
    expect(Array.from(device.sent[0].slice(0, 4))).toEqual([VIA.DYNAMIC_KEYMAP_GET_KEYCODE, 0, 2, 3]);
    expect(device.listeners.size).toBe(0);
    vi.useRealTimers();
  });

  it('可读取协议 13 所需的 QMK 键码版本', async () => {
    const device = new FakeDevice();
    device.sendReport = async (_reportId: number, data: BufferSource) => {
      const source = ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
      const response = new Uint8Array(32); response.set(source.slice(0, 2)); response.set([0, 0, 0, 8], 2);
      queueMicrotask(() => device.listeners.forEach(listener => listener({data: new DataView(response.buffer), device, reportId: 0} as unknown as HidInputReportEvent)));
    };
    await expect(new ViaHidClient(device).qmkKeycodesVersion()).resolves.toBe(8);
  });
});
