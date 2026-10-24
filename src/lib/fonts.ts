// Font catalog, loading and the shared "current font".
//
// Every font, from the catalog or uploaded, goes through register(): the same
// bytes are handed to the browser as a FontFace (so SVG, canvas and CSS can set
// it) and to opentype.js (so figures can read outlines and tables).
import { parse, type Font } from 'opentype.js';

export type Category = 'serif' | 'sans' | 'mono' | 'display';

export interface CatalogEntry {
  id: string;
  name: string;
  category: Category;
  designer: string;
  year: number;
  url: () => Promise<{ default: string }>;
}

// Latin subset, regular weight, WOFF (opentype.js cannot read WOFF2 without an
// extra decompressor). Add a family here and it shows up in every picker.
export const CATALOG: CatalogEntry[] = [
  { id: 'eb-garamond', name: 'EB Garamond', category: 'serif', designer: 'Georg Duffner, after Claude Garamont', year: 2011,
    url: () => import('@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff?url') },
  { id: 'cormorant-garamond', name: 'Cormorant Garamond', category: 'serif', designer: 'Christian Thalmann', year: 2015,
    url: () => import('@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff?url') },
  { id: 'libre-caslon-text', name: 'Libre Caslon Text', category: 'serif', designer: 'Pablo Impallari, after William Caslon', year: 2012,
    url: () => import('@fontsource/libre-caslon-text/files/libre-caslon-text-latin-400-normal.woff?url') },
  { id: 'libre-baskerville', name: 'Libre Baskerville', category: 'serif', designer: 'Impallari Type, after John Baskerville', year: 2012,
    url: () => import('@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff?url') },
  { id: 'crimson-pro', name: 'Crimson Pro', category: 'serif', designer: 'Jacques Le Bailly', year: 2018,
    url: () => import('@fontsource/crimson-pro/files/crimson-pro-latin-400-normal.woff?url') },
  { id: 'source-serif-4', name: 'Source Serif 4', category: 'serif', designer: 'Frank Grießhammer (Adobe)', year: 2014,
    url: () => import('@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff?url') },
  { id: 'literata', name: 'Literata', category: 'serif', designer: 'TypeTogether', year: 2014,
    url: () => import('@fontsource/literata/files/literata-latin-400-normal.woff?url') },
  { id: 'inter', name: 'Inter', category: 'sans', designer: 'Rasmus Andersson', year: 2017,
    url: () => import('@fontsource/inter/files/inter-latin-400-normal.woff?url') },
  { id: 'source-sans-3', name: 'Source Sans 3', category: 'sans', designer: 'Paul D. Hunt (Adobe)', year: 2012,
    url: () => import('@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff?url') },
  { id: 'work-sans', name: 'Work Sans', category: 'sans', designer: 'Wei Huang', year: 2015,
    url: () => import('@fontsource/work-sans/files/work-sans-latin-400-normal.woff?url') },
  { id: 'ibm-plex-sans', name: 'IBM Plex Sans', category: 'sans', designer: 'Mike Abbink with Bold Monday', year: 2017,
    url: () => import('@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff?url') },
  { id: 'fira-sans', name: 'Fira Sans', category: 'sans', designer: 'Erik Spiekermann, Ralph du Carrois et al.', year: 2013,
    url: () => import('@fontsource/fira-sans/files/fira-sans-latin-400-normal.woff?url') },
  { id: 'jost', name: 'Jost', category: 'sans', designer: 'Owen Earl, after the geometric sans of the 1920s', year: 2017,
    url: () => import('@fontsource/jost/files/jost-latin-400-normal.woff?url') },
  { id: 'space-grotesk', name: 'Space Grotesk', category: 'sans', designer: 'Florian Karsten', year: 2018,
    url: () => import('@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff?url') },
  { id: 'jetbrains-mono', name: 'JetBrains Mono', category: 'mono', designer: 'Philipp Nurullin, Konstantin Bulenkov', year: 2020,
    url: () => import('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff?url') },
  { id: 'ibm-plex-mono', name: 'IBM Plex Mono', category: 'mono', designer: 'Mike Abbink with Bold Monday', year: 2017,
    url: () => import('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff?url') },
  { id: 'playfair-display', name: 'Playfair Display', category: 'display', designer: 'Claus Eggers Sørensen', year: 2011,
    url: () => import('@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff?url') },
  { id: 'dm-serif-display', name: 'DM Serif Display', category: 'display', designer: 'Colophon Foundry', year: 2019,
    url: () => import('@fontsource/dm-serif-display/files/dm-serif-display-latin-400-normal.woff?url') },
];

export const CATEGORY_LABELS: Record<Category, string> = {
  serif: 'Serif', sans: 'Sans serif', mono: 'Monospace', display: 'Display',
};

export interface LoadedFont {
  key: string;            // catalog id, or "upload-N"
  name: string;
  family: string;         // CSS font-family the bytes were registered under
  ot: Font | null;        // parsed tables and outlines, when opentype.js could read them
  entry?: CatalogEntry;
  file?: { name: string; bytes: number; format: string };
  parseError?: string;
}

const loading = new Map<string, Promise<LoadedFont>>();
const uploads: LoadedFont[] = [];
let uploadCount = 0;

async function register(key: string, name: string, buffer: ArrayBuffer): Promise<Omit<LoadedFont, 'entry' | 'file'>> {
  const family = `tl-${key}`;
  const face = new FontFace(family, buffer.slice(0));
  await face.load();
  document.fonts.add(face);
  try {
    return { key, name, family, ot: parse(buffer) };
  } catch (err) {
    return { key, name, family, ot: null, parseError: (err as Error).message };
  }
}

export function loadCatalogFont(id: string): Promise<LoadedFont> {
  let p = loading.get(id);
  if (!p) {
    const entry = CATALOG.find((e) => e.id === id);
    if (!entry) return Promise.reject(new Error(`No catalog font "${id}"`));
    p = entry.url()
      .then((m) => fetch(m.default))
      .then((r) => r.arrayBuffer())
      .then((buf) => register(id, entry.name, buf))
      .then((f) => ({ ...f, entry }));
    loading.set(id, p);
  }
  return p;
}

/** Add a font from raw bytes (an upload, or a font built in the lab) to "Your fonts". */
export async function addFont(name: string, buffer: ArrayBuffer, file?: LoadedFont['file']): Promise<LoadedFont> {
  const key = `upload-${++uploadCount}`;
  const base = await register(key, name, buffer);
  const font: LoadedFont = { ...base, file };
  uploads.push(font);
  loading.set(key, Promise.resolve(font));
  return font;
}

export async function loadUpload(file: File): Promise<LoadedFont> {
  const buffer = await file.arrayBuffer();
  const format = sniffFormat(buffer);
  const font = await addFont(file.name.replace(/\.(otf|ttf|woff2?)$/i, ''), buffer, { name: file.name, bytes: file.size, format });
  font.name = font.ot?.names.fullName?.en ?? font.name;
  if (font.parseError && format === 'WOFF2') {
    font.parseError = 'WOFF2 renders fine but its outlines cannot be read yet. Upload the TTF, OTF or WOFF to edit glyphs.';
  }
  return font;
}

function sniffFormat(buf: ArrayBuffer) {
  const tag = String.fromCharCode(...new Uint8Array(buf, 0, 4));
  return ({ wOFF: 'WOFF', wOF2: 'WOFF2', OTTO: 'OpenType (CFF)', true: 'TrueType' } as Record<string, string>)[tag] ?? 'TrueType';
}

export const getUploads = () => uploads as readonly LoadedFont[];

// ---------------------------------------------------------------------------
// Current font: the explorer, metrics and text figures all follow it.

type Listener = (font: LoadedFont) => void;
const listeners = new Set<Listener>();
let current: LoadedFont | null = null;

export const fontStore = {
  get(): LoadedFont {
    if (!current) throw new Error('fontStore read before init()');
    return current;
  },
  async init(id = 'eb-garamond') {
    current = await loadCatalogFont(id);
  },
  async select(key: string) {
    const font = await (loading.get(key) ?? loadCatalogFont(key));
    current = font;
    listeners.forEach((fn) => fn(font));
  },
  /** Called on every change, including a new upload joining the list. */
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// ---------------------------------------------------------------------------
// Vertical metrics in px at a given size. From the font's tables when we have
// them, otherwise measured from rendered text on a canvas.

export interface VMetrics {
  ascent: number;     // hhea ascender: what browsers on macOS use
  descent: number;    // positive, below the baseline
  lineGap: number;
  cap: number;
  x: number;
  unitsPerEm: number | null;
  source: 'font tables' | 'canvas';
}

interface Hhea { ascender: number; descender: number; lineGap: number }
interface Os2 { sCapHeight?: number; sxHeight?: number }

/** The vertical-metric tables, typed (opentype.js types them loosely). */
export function metricTables(ot: Font) {
  return {
    hhea: ot.tables.hhea as unknown as Hhea,
    os2: ot.tables.os2 as unknown as Os2 | undefined,
  };
}

const ctx = document.createElement('canvas').getContext('2d')!;

export function measureText(family: string, size: number, text: string, style = 'normal', weight = 400) {
  ctx.font = `${style} ${weight} ${size}px ${quoteFamily(family)}`;
  return ctx.measureText(text);
}

export const quoteFamily = (family: string) => (family.includes('"') || family.includes(',') ? family : `"${family}"`);

export function verticalMetrics(font: LoadedFont, size: number): VMetrics {
  const ot = font.ot;
  if (ot) {
    const k = size / ot.unitsPerEm;
    const { hhea, os2 } = metricTables(ot);
    const glyphTop = (ch: string) => ot.charToGlyph(ch).getBoundingBox().y2;
    return {
      ascent: hhea.ascender * k,
      descent: -hhea.descender * k,
      lineGap: hhea.lineGap * k,
      cap: (os2?.sCapHeight || glyphTop('H')) * k,
      x: (os2?.sxHeight || glyphTop('x')) * k,
      unitsPerEm: ot.unitsPerEm,
      source: 'font tables',
    };
  }
  const m = measureText(font.family, size, 'Hxgp');
  return {
    ascent: m.fontBoundingBoxAscent,
    descent: m.fontBoundingBoxDescent,
    lineGap: 0,
    cap: measureText(font.family, size, 'H').actualBoundingBoxAscent,
    x: measureText(font.family, size, 'x').actualBoundingBoxAscent,
    unitsPerEm: null,
    source: 'canvas',
  };
}
