import { describe, expect, it } from 'vitest';

const colorPairs = [
  ['亮色主要文字', '#132033', '#ffffff'],
  ['亮色次要文字', '#50657a', '#ffffff'],
  ['亮色強調文字', '#006878', '#ffffff'],
  ['亮色警告文字', '#a9531e', '#ffffff'],
  ['亮色危險文字', '#b4233c', '#ffffff'],
  ['亮色成功文字', '#247b4b', '#ffffff'],
  ['深色主要文字', '#f3eee8', '#101724'],
  ['深色次要文字', '#9eacba', '#101724'],
  ['深色強調文字', '#5bd7e8', '#101724'],
  ['主要按鈕文字', '#ffffff', '#006878'],
  ['操作按鈕文字', '#17100c', '#d76c24'],
] as const;

function luminance(hex: string) {
  const [red, green, blue] = hex
    .slice(1)
    .match(/../g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrastRatio(foreground: string, background: string) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe('設計系統文字色彩', () => {
  it.each(colorPairs)('%s 符合 WCAG AA 一般文字對比', (_name, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});
