// Interface fonts. Specimen fonts are loaded on demand through lib/fonts.ts.
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/400-italic.css';
import '@fontsource/eb-garamond/800.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/jetbrains-mono/400.css';
// CJK: split by unicode-range, so only the characters on screen download.
import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/noto-serif-tc/400.css';
import '@fontsource/noto-serif-jp/400.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import './styles/controls.css';
import './styles/figures.css';

import { mountApp } from './app';
import { fontStore } from './lib/fonts';
import { initTheme } from './lib/theme';

initTheme();

// Figures measure text, so the fonts they measure must be loaded first.
await Promise.all([
  document.fonts.load('112px "EB Garamond"'),
  document.fonts.load('italic 112px "EB Garamond"'),
  fontStore.init(),
]);

mountApp(document.getElementById('app')!);
