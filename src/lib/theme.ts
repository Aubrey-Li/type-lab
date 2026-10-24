// User palettes. A palette is three colors; tokens.css mixes every other tone
// from them. The choice is remembered per browser.
import { h } from './dom';

export interface Palette { name: string; bg: string; ink: string; accent: string }

export const PRESETS: Palette[] = [
  { name: 'Ink', bg: '#141414', ink: '#e6e2dc', accent: '#ef5b4b' },
  { name: 'Paper', bg: '#f4f2ed', ink: '#1c1b1a', accent: '#d8281b' },
  { name: 'Blueprint', bg: '#10294a', ink: '#e6edf6', accent: '#ffc94a' },
  { name: 'Riso', bg: '#f2ede2', ink: '#24305e', accent: '#f0507f' },
  { name: 'Moss', bg: '#191d17', ink: '#dfe4d4', accent: '#bfe85a' },
];

const STORAGE_KEY = 'type-lab:palette';

function load(): Palette {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved?.bg && saved?.ink && saved?.accent) return saved;
  } catch { /* storage unavailable or corrupt: fall through to default */ }
  return PRESETS[0];
}

function save(p: Palette) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* not persisted */ }
}

export function applyPalette(p: Palette) {
  const root = document.documentElement.style;
  root.setProperty('--bg', p.bg);
  root.setProperty('--ink', p.ink);
  root.setProperty('--accent', p.accent);
  root.setProperty('color-scheme', luminance(p.bg) < 0.4 ? 'dark' : 'light');
}

// WCAG relative luminance and contrast, so the panel can warn about unreadable picks.
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

export function initTheme() {
  applyPalette(load());
}

/** The palette section of the settings panel: presets and custom colors. */
export function paletteSettings() {
  let palette = load();

  const swatches = PRESETS.map((p) =>
    h('button', {
      type: 'button', class: 'swatch', title: p.name,
      style: `--sw-bg:${p.bg};--sw-ink:${p.ink};--sw-accent:${p.accent}`,
      onclick: () => setPalette({ ...p }),
    }, h('span', { class: 'swatch-aa' }, 'Aa'), h('span', { class: 'swatch-name' }, p.name)),
  );

  const inputs = (['bg', 'ink', 'accent'] as const).map((key) => {
    const input = h('input', {
      type: 'color',
      oninput: () => setPalette({ ...palette, name: 'Custom', [key]: input.value }),
    });
    return { key, input };
  });
  const labels: Record<string, string> = { bg: 'Background', ink: 'Ink', accent: 'Accent' };
  const report = h('p', { class: 'palette-report' });

  const section = h('section', { class: 'settings-section' },
    h('h4', { class: 'settings-heading' }, 'Palette'),
    h('div', { class: 'swatches' }, swatches),
    h('div', { class: 'palette-inputs' },
      inputs.map(({ key, input }) => h('label', { class: 'ctl' }, input, h('span', { class: 'ctl-label' }, labels[key])))),
    report,
  );

  function setPalette(p: Palette) {
    palette = p;
    applyPalette(p);
    save(p);
    sync();
  }

  function sync() {
    for (const { key, input } of inputs) input.value = palette[key];
    swatches.forEach((el, i) => el.setAttribute('aria-pressed', String(
      PRESETS[i].bg === palette.bg && PRESETS[i].ink === palette.ink && PRESETS[i].accent === palette.accent)));
    const text = contrast(palette.ink, palette.bg);
    const accent = contrast(palette.accent, palette.bg);
    report.replaceChildren(
      `Ink on background ${text.toFixed(1)}:1 · accent ${accent.toFixed(1)}:1`,
      text < 4.5 || accent < 3 ? h('span', { class: 'warn' }, ' Low contrast: small labels may be hard to read.') : '',
    );
  }
  sync();

  return section;
}
