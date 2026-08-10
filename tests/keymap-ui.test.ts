import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

describe('键位设置交互回归保护', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8');
  const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('默认分类必须真实存在，避免所有可选键码都被过滤为空', () => {
    expect(source).toContain("useState('全部')");
    expect(source).not.toContain("useState('常用')");
    expect(source).toContain("category === '全部' || option.category === category");
  });

  it('提供键名和 QMK 键码搜索入口', () => {
    expect(source).toContain('aria-label="搜索可分配键码"');
    expect(source).toContain('option.code.toLocaleLowerCase().includes(normalizedQuery)');
  });

  it('Layer 活动态与键盘画布溢出布局有明确样式', () => {
    expect(styles).toContain('.layer-bar>button.active');
    expect(styles).toContain('grid-template-columns:minmax(0,1fr) minmax(300px,350px)');
    expect(styles).toContain('.keymap-canvas{min-width:0');
  });
});
