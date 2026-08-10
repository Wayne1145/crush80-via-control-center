import type {ConnectionMode} from './definition';

export const PROFILE_FORMAT = 'crush80-control-center/profile';
export const PROFILE_VERSION = 1;

export type LightingState = {brightness: number; effect: number; speed: number; color: [number, number]};
export type CrushProfile = {
  format: typeof PROFILE_FORMAT;
  version: typeof PROFILE_VERSION;
  createdAt: string;
  mode: ConnectionMode;
  vendorId: number;
  productId: number;
  matrix: {rows: number; cols: number};
  layers: number[][];
  lighting: LightingState;
  macros: number[];
};

export function makeProfile(input: Omit<CrushProfile, 'format' | 'version' | 'createdAt'>): CrushProfile {
  return {...input, format: PROFILE_FORMAT, version: PROFILE_VERSION, createdAt: new Date().toISOString()};
}

export function parseProfile(raw: string): CrushProfile {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('档案不是 JSON 对象。');
  const profile = value as Partial<CrushProfile>;
  if (profile.format !== PROFILE_FORMAT || profile.version !== PROFILE_VERSION) throw new Error('不是本工具生成的兼容档案。');
  if (!profile.matrix || profile.matrix.rows !== 8 || profile.matrix.cols !== 16) throw new Error('档案矩阵与 Crush 80 官方定义不匹配。');
  if (!Array.isArray(profile.layers) || !profile.layers.every(layer => Array.isArray(layer) && layer.length === 128 && layer.every(Number.isInteger))) throw new Error('档案键位数据无效。');
  if (!profile.lighting || !Number.isInteger(profile.lighting.brightness) || profile.lighting.brightness < 0 || profile.lighting.brightness > 9 || !Number.isInteger(profile.lighting.effect) || profile.lighting.effect < 0 || profile.lighting.effect > 18 || !Number.isInteger(profile.lighting.speed) || profile.lighting.speed < 0 || profile.lighting.speed > 4 || !Array.isArray(profile.lighting.color) || profile.lighting.color.length !== 2 || !profile.lighting.color.every(value => Number.isInteger(value) && value >= 0 && value <= 255)) throw new Error('档案灯光数据无效。');
  if (!Array.isArray(profile.macros) || !profile.macros.every(value => Number.isInteger(value) && value >= 0 && value <= 255)) throw new Error('档案宏数据无效。');
  return profile as CrushProfile;
}
