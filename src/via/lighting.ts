import type {LightingState} from './profile';

export type LightingMenuChange = {
  command: 1 | 2 | 3 | 4;
  value: number[];
};

/**
 * 只生成用户真正修改过的官方 VIA 灯光菜单命令。
 * 选择动态 RGB 灯效时绝不能顺带重写 Hue/Saturation，
 * 否则部分固件会把动态效果锁成该单一基色。
 */
export function changedLightingCommands(before: LightingState, after: LightingState): LightingMenuChange[] {
  const changes: LightingMenuChange[] = [];
  if (before.brightness !== after.brightness) changes.push({command: 1, value: [after.brightness]});
  if (before.effect !== after.effect) changes.push({command: 2, value: [after.effect]});
  if (before.speed !== after.speed) changes.push({command: 3, value: [after.speed]});
  if (before.color[0] !== after.color[0] || before.color[1] !== after.color[1]) changes.push({command: 4, value: [...after.color]});
  return changes;
}
