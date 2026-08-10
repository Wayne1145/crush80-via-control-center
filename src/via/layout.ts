export type MatrixCoordinate = {row: number; col: number};

export type KeyboardKey = MatrixCoordinate & {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

type KLEProperty = {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  c?: string;
};

export type OfficialViaDefinition = {
  name: string;
  vendorId: string;
  productId: string;
  matrix: {rows: number; cols: number};
  keycodes?: string[];
  customKeycodes?: Array<{name: string; title: string; shortName: string}>;
  menus?: unknown[];
  layouts: {keymap: Array<Array<KLEProperty | string>>};
};

/**
 * 解析 VIA 官方 JSON 的 KLE keymap。
 * 仅使用官方定义中的坐标和尺寸；重复坐标只保留第一个可寻址实体键，
 * 避免 ISO/ANSI 兼容占位符在 UI 中生成两个可写按键。
 */
export function parseOfficialLayout(definition: OfficialViaDefinition): KeyboardKey[] {
  const keys: KeyboardKey[] = [];
  const seen = new Set<string>();
  let absoluteY = 0;

  for (const row of definition.layouts.keymap) {
    let x = 0;
    let y = absoluteY;
    let properties: Required<KLEProperty> = {x: 0, y: 0, w: 1, h: 1, c: '#d1d1d6'};

    for (const token of row) {
      if (typeof token !== 'string') {
        if (token.y !== undefined) {
          absoluteY += token.y;
          y += token.y;
        }
        if (token.x !== undefined) x += token.x;
        properties = {...properties, ...token, x: 0, y: 0};
        continue;
      }

      const match = /^(\d+),(\d+)$/.exec(token);
      if (!match) continue;
      const rowIndex = Number(match[1]);
      const colIndex = Number(match[2]);
      if (rowIndex >= definition.matrix.rows || colIndex >= definition.matrix.cols) {
        throw new Error(`官方 JSON 包含超出矩阵范围的坐标：${token}`);
      }
      const id = `${rowIndex}:${colIndex}`;
      if (!seen.has(id)) {
        keys.push({
          id,
          row: rowIndex,
          col: colIndex,
          x,
          y,
          width: properties.w,
          height: properties.h,
          color: properties.c,
        });
        seen.add(id);
      }
      x += properties.w;
      properties = {...properties, x: 0, y: 0, w: 1, h: 1};
    }
    absoluteY += 1;
  }

  return keys;
}

export function coordinateIndex(coordinate: MatrixCoordinate, cols: number) {
  return coordinate.row * cols + coordinate.col;
}
