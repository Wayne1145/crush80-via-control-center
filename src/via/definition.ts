export type ConnectionMode = 'usb' | '2.4g';

export type RawDefinition = {
  name: string;
  vendorId: string;
  productId: string;
  matrix: {rows: number; cols: number};
  menus: Array<{label: string; content: Array<{label: string; content: Array<{label: string; type: string; options?: unknown[]; content: Array<string | number>}>}>}>;
  customKeycodes: Array<{name: string; title: string; shortName: string}>;
};

const effects = [
  ['关闭', 0], ['波浪', 1], ['彩云', 2], ['漩涡', 3], ['混色', 4], ['呼吸', 5], ['常亮', 6], ['渐灭', 7], ['石纹', 8], ['激光', 9], ['星空', 10], ['花开', 11], ['穿梭', 12], ['波条', 13], ['流星', 14], ['雨滴', 15], ['扫描', 16], ['按键触发', 17], ['中心扩散', 18],
] as const;

const customKeycodes = [
  ['2.4G MODE', '切换至 2.4G'], ['BT 1', '蓝牙设备 1'], ['BT 2', '蓝牙设备 2'], ['BT 3', '蓝牙设备 3'], ['THREEMODE', '三模切换'], ['WINLOCK', '锁定 Win 键'], ['WINMAC', 'Windows / macOS'], ['LOMODE', 'Logo 灯效'], ['LOCOLOUR', 'Logo 灯颜色'], ['LOPOWER', 'Logo 灯开关'], ['SIMODE', '侧灯模式'], ['SICOLOUR', '侧灯颜色'], ['SIPOWER', '侧灯开关'], ['KSDELAY', '按键扫描延迟'], ['SYSPOWER', '总灯光开关'], ['BATTST', '电量状态'],
].map(([shortName, name]) => ({shortName, name, title: name}));

function createDefinition(productId: string): RawDefinition {
  return {
    name: 'Crush 80 RGB 旗舰版', vendorId: '0x320F', productId, matrix: {rows: 8, cols: 16}, customKeycodes,
    menus: [{label: 'Lighting', content: [{label: 'Backlight', content: [
      {label: 'Brightness', type: 'range', options: [0, 9], content: ['id_qmk_rgb_matrix_brightness', 3, 1]},
      {label: 'Effect', type: 'dropdown', options: effects as unknown as unknown[], content: ['id_qmk_rgb_matrix_effect', 3, 2]},
      {label: 'Effect Speed', type: 'range', options: [0, 4], content: ['id_qmk_rgb_matrix_effect_speed', 3, 3]},
      {label: 'Color', type: 'color', content: ['id_qmk_rgb_matrix_color', 3, 4]},
    ]}]}],
  };
}

const definitions = {usb: createDefinition('0x5055'), '2.4g': createDefinition('0x5088')} as const;
export const definitionForMode = (mode: ConnectionMode) => definitions[mode];
export function normalizeDefinition(definition: RawDefinition) {
  const effectControl = definition.menus[0].content[0].content[1];
  return {
    vendorId: Number.parseInt(definition.vendorId, 16),
    productId: Number.parseInt(definition.productId, 16),
    matrix: definition.matrix,
    lighting: {effects: effectControl.options as ReadonlyArray<readonly [string, number]>},
    customKeycodes: definition.customKeycodes,
  };
}
