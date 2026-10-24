// Interface fonts. Specimen fonts are loaded on demand through lib/fonts.ts.
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/400-italic.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/jetbrains-mono/400.css';
// CJK: split by unicode-range, so only the characters on the page download.
import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/noto-serif-tc/400.css';
import '@fontsource/noto-serif-jp/400.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/controls.css';
import './styles/figures.css';

import { mountAnatomy } from './figures/anatomy';
import { mountCjkDirection } from './figures/cjk-direction';
import { mountCjkEmBox } from './figures/cjk-embox';
import { mountCjkLineBreak } from './figures/cjk-linebreak';
import { mountFontExplorer } from './figures/font-explorer';
import { mountTransformStack } from './figures/transform-stack';
import { mountVerticalMetrics } from './figures/vertical-metrics';
import { fontStore } from './lib/fonts';
import { initTheme, palettePanel } from './lib/theme';

const FIGURES: Record<string, (root: HTMLElement) => void> = {
  anatomy: mountAnatomy,
  'font-explorer': mountFontExplorer,
  'vertical-metrics': mountVerticalMetrics,
  'transform-stack': mountTransformStack,
  'cjk-embox': mountCjkEmBox,
  'cjk-linebreak': mountCjkLineBreak,
  'cjk-direction': mountCjkDirection,
};

initTheme();
document.querySelector('[data-mount="palette"]')?.replaceWith(palettePanel());

// Figures measure text, so the fonts they measure must be loaded first.
await Promise.all([
  document.fonts.load('112px "EB Garamond"'),
  document.fonts.load('italic 112px "EB Garamond"'),
  fontStore.init(),
]);

for (const el of document.querySelectorAll<HTMLElement>('[data-figure]')) {
  const mount = FIGURES[el.dataset.figure!];
  try {
    mount?.(el);
  } catch (err) {
    console.error(`figure "${el.dataset.figure}" failed`, err);
    el.textContent = `This figure failed to load: ${(err as Error).message}`;
  }
}
