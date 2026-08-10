import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

describe('写入入口回归保护', () => {
  it('保存按钮必须实际调用 applyDraft，而不是只引用函数对象', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8');
    expect(source).toContain('onClick={() => void applyDraft()}');
    expect(source).not.toContain('onClick={() => void applyDraft}>');
  });
});
