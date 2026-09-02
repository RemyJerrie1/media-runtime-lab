const themes = {
  dark: {
    canvas: '#080b12',
    surface: '#101724',
    raised: '#151f2e',
    text: '#f3eee8',
    muted: '#9eacba',
    accent: '#5bd7e8',
    action: '#f1ae79',
    success: '#79d29d',
    warning: '#f1ae79',
    danger: '#ff8fa3',
  },
  light: {
    canvas: '#f4f7fb',
    surface: '#ffffff',
    raised: '#eaf0f7',
    text: '#132033',
    muted: '#50657a',
    accent: '#006878',
    action: '#d76c24',
    success: '#247b4b',
    warning: '#a9531e',
    danger: '#b4233c',
  },
};
function luminance(hex) {
  const values = hex
    .match(/[a-f\d]{2}/gi)
    .map((value) => parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const checks = [];
for (const [name, color] of Object.entries(themes)) {
  for (const background of ['canvas', 'surface', 'raised']) {
    checks.push([`${name} text/${background}`, color.text, color[background], 4.5]);
    checks.push([`${name} muted/${background}`, color.muted, color[background], 4.5]);
  }
  checks.push([`${name} accent/surface`, color.accent, color.surface, 3]);
  checks.push([`${name} action/surface`, color.action, color.surface, 3]);
  for (const semantic of ['success', 'warning', 'danger']) {
    if (color[semantic])
      checks.push([`${name} ${semantic}/surface`, color[semantic], color.surface, 4.5]);
  }
}
checks.push(['primary white/#006878', '#ffffff', '#006878', 4.5]);
checks.push(['dark primary ink/action', '#17100c', '#f1ae79', 4.5]);
checks.push(['light primary ink/action', '#132033', '#d76c24', 4.5]);
const failures = checks.filter(
  ([, foreground, background, minimum]) => ratio(foreground, background) < minimum,
);
if (failures.length) {
  for (const [label, foreground, background, minimum] of failures)
    console.error(`${label}: ${ratio(foreground, background).toFixed(2)} < ${minimum}`);
  process.exit(1);
}
console.log(`A11Y color gate: ${checks.length} light/dark contrast pairs passed`);
