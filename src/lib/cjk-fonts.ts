// CJK outlines. A CJK font is tens of thousands of glyphs, so Fontsource
// splits each one into ~100 files by unicode-range. To read one character's
// outline we find the file that holds it (from the family's CSS), fetch it
// and parse it, once per file.
import { parse, type Font, type Glyph } from 'opentype.js';
import { woffToSfnt } from './woff';

// Each family's CSS says which file holds which characters (~60 kB a family); the
// file list is its own chunk. Both load on first use, and only the files a
// visitor's text needs are ever fetched.
const CSS = import.meta.glob(
  '/node_modules/@fontsource/{noto-serif-sc,noto-sans-sc,noto-serif-tc,lxgw-wenkai-tc,noto-serif-jp,noto-sans-jp,noto-serif-kr}/400.css',
  { query: '?raw', import: 'default' },
) as Record<string, () => Promise<string>>;
const files = () => import('./cjk-font-files').then((m) => m.FILES);

export interface CjkFont { id: string; name: string; lang: string }

export const CJK_FONTS: CjkFont[] = [
  { id: 'noto-serif-sc', name: 'Noto Serif SC', lang: 'zh-Hans' },
  { id: 'noto-sans-sc', name: 'Noto Sans SC', lang: 'zh-Hans' },
  { id: 'noto-serif-tc', name: 'Noto Serif TC', lang: 'zh-Hant' },
  { id: 'lxgw-wenkai-tc', name: 'LXGW WenKai TC', lang: 'zh-Hant' },
  { id: 'noto-serif-jp', name: 'Noto Serif JP', lang: 'ja' },
  { id: 'noto-sans-jp', name: 'Noto Sans JP', lang: 'ja' },
  { id: 'noto-serif-kr', name: 'Noto Serif KR', lang: 'ko' },
];

interface Subset { url: string; ranges: [number, number][] }
const subsetsOf = new Map<string, Promise<Subset[]>>();

function subsets(font: CjkFont): Promise<Subset[]> {
  let list = subsetsOf.get(font.id);
  if (!list) {
    list = Promise.all([CSS[`/node_modules/@fontsource/${font.id}/400.css`](), files()]).then(([css, urls]) => {
      const out: Subset[] = [];
      for (const block of css.split('@font-face').slice(1)) {
        const file = block.match(/url\(\.\/files\/([^)]+\.woff)\)/)?.[1];
        const range = block.match(/unicode-range:\s*([^;]+)/)?.[1];
        const url = file && urls[`/node_modules/@fontsource/${font.id}/files/${file}`];
        if (!url || !range) continue;
        out.push({
          url,
          ranges: range.split(',').map((r) => {
            const [a, b = a] = r.trim().replace(/^U\+/i, '').split('-').map((x) => parseInt(x, 16));
            return [a, b];
          }),
        });
      }
      return out;
    });
    subsetsOf.set(font.id, list);
  }
  return list;
}

const parsed = new Map<string, Promise<Font | null>>();

function loadSubset(url: string): Promise<Font | null> {
  let p = parsed.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => r.arrayBuffer())
      .then(woffToSfnt)
      .then((buf) => parse(buf))
      .catch((err) => { console.warn('CJK subset failed', url, err); return null; });
    parsed.set(url, p);
  }
  return p;
}

export interface CjkGlyph {
  glyph: Glyph;
  /** font units → a 1000-unit em */
  k: number;
  /** the top of the ideographic em box, in font units above the baseline */
  emTop: number;
  advance: number;
}

/** The outline of one character in a CJK family, or null if the family doesn't draw it. */
export async function cjkGlyph(fontId: string, ch: string): Promise<CjkGlyph | null> {
  const font = CJK_FONTS.find((f) => f.id === fontId) ?? CJK_FONTS[0];
  const cp = ch.codePointAt(0)!;
  const subset = (await subsets(font)).find((s) => s.ranges.some(([a, b]) => cp >= a && cp <= b));
  if (!subset) return null;
  const ot = await loadSubset(subset.url);
  if (!ot) return null;
  const glyph = ot.charToGlyph(ch);
  if (!glyph || glyph.index === 0) return null;
  const k = 1000 / ot.unitsPerEm;
  const os2 = ot.tables.os2 as { sTypoAscender?: number; sTypoDescender?: number } | undefined;
  // CJK fonts set the typo metrics to the em box (880 / −120 in a 1000 em); fall back to that ratio.
  const typo = os2?.sTypoAscender != null && os2.sTypoDescender != null
    && os2.sTypoAscender - os2.sTypoDescender === ot.unitsPerEm;
  const emTop = typo ? os2!.sTypoAscender! : 0.88 * ot.unitsPerEm;
  return { glyph, k, emTop, advance: (glyph.advanceWidth ?? ot.unitsPerEm) * k };
}

// A character the chosen font doesn't draw (a simplified form in a Traditional
// font, kana in a Korean one) comes from the next font that does, as a browser
// would fall back: the nearest style first, then the nearest locale.
const NEAR: Record<string, string[]> = {
  'zh-Hans': ['zh-Hans', 'zh-Hant', 'ja', 'ko'],
  'zh-Hant': ['zh-Hant', 'zh-Hans', 'ja', 'ko'],
  ja: ['ja', 'zh-Hant', 'zh-Hans', 'ko'],
  ko: ['ko', 'zh-Hant', 'ja', 'zh-Hans'],
};
// The same design in another locale matches best (Noto Serif SC for Noto Serif TC); a brush
// kai is nearer a serif (Song/Ming) than a sans (Gothic/Hei).
const styleOf = (f: CjkFont) => (f.id.includes('wenkai') ? 1 : f.name.includes('Sans') ? 2 : 0);   // serif 0, kai 1, sans 2

function fallbacks(fontId: string): CjkFont[] {
  const first = CJK_FONTS.find((f) => f.id === fontId) ?? CJK_FONTS[0];
  const rank = (f: CjkFont) => 10 * Math.abs(styleOf(f) - styleOf(first)) + NEAR[first.lang].indexOf(f.lang);
  return [first, ...CJK_FONTS.filter((f) => f !== first).sort((a, b) => rank(a) - rank(b))];
}

/** The outline from the chosen font, or from the first fallback that draws the character. */
export async function cjkGlyphOrFallback(fontId: string, ch: string): Promise<(CjkGlyph & { font: CjkFont }) | null> {
  for (const font of fallbacks(fontId)) {
    const g = await cjkGlyph(font.id, ch);
    if (g) return { ...g, font };
  }
  return null;
}
