// Taking a character apart (分解, bunkai), two ways:
//   pieces  – the connected outlines of the font's own glyph, each with its holes
//   parts   – pieces grouped by the character's structure, found by cutting the
//             glyph along empty channels: 語 → 言 | 吾, 字 → 宀 / 子
// and putting them in writing order, from stroke-order data where there is some.
// Everything is in a 1000-unit em, y down, the top of the em box at 0.
import type { PathCommand } from 'opentype.js';
import { cjkGlyphOrFallback } from './cjk-fonts';
import { clamp } from './dom';
import { area, box as polyBox, flatten, spansAt, type Box, type Poly } from './outline';

export type Split = 'parts' | 'pieces';
export type Axis = 'x' | 'y';
type Pt = [number, number];

export interface Part {
  d: string;
  box: Box;
  cx: number;
  cy: number;
  ink: number;
  /** The cut that set this part apart, and which side of it the part lies on: where it slides from. */
  axis: Axis;
  side: number;
  /** Its outline as polygons, to tell which strokes it holds. */
  shapes: Shape[];
  /** The strokes that fall in it, in order (indices into Breakdown.strokes). */
  strokes: number[];
}

/** One outer contour and the holes inside it. */
export interface Shape { outer: Poly; holes: Poly[] }

export interface Stroke {
  /** The pen's path, warped onto the font's own glyph. */
  median: Pt[];
  /** The part it falls in, or −1. */
  part: number;
}

export type StrokeSource = 'kanjivg' | 'mmah';

export interface Cut { axis: Axis; at: number; from: number; to: number; depth: number }

export interface Breakdown {
  ch: string;
  advance: number;
  /** The whole outline. */
  glyph: string;
  /** The fallback font it was drawn from, when the chosen font doesn't draw it ('' otherwise). */
  fallback: string;
  /** In writing order. */
  parts: Part[];
  /** Strokes in their fixed writing order, or null where no stroke-order data covers the character. */
  strokes: Stroke[] | null;
  strokeSource: StrokeSource | null;
  /** The structure, as an Ideographic Description Sequence with □ for each part. */
  ids: string;
  cuts: Cut[];
  source: 'outline' | 'missing';
  counts: { parts: number; pieces: number };
}

// ---- outline pieces ---------------------------------------------------------

const fmtN = (n: number) => String(Math.round(n * 10) / 10);

function pathD(cmds: PathCommand[]) {
  return cmds.map((c) => {
    switch (c.type) {
      case 'M': return `M${fmtN(c.x)} ${fmtN(c.y)}`;
      case 'L': return `L${fmtN(c.x)} ${fmtN(c.y)}`;
      case 'Q': return `Q${fmtN(c.x1)} ${fmtN(c.y1)} ${fmtN(c.x)} ${fmtN(c.y)}`;
      case 'C': return `C${fmtN(c.x1)} ${fmtN(c.y1)} ${fmtN(c.x2)} ${fmtN(c.y2)} ${fmtN(c.x)} ${fmtN(c.y)}`;
      default: return 'Z';
    }
  }).join('');
}

function inside([x, y]: Pt, p: Poly) {
  let hit = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// Ink profiles: how much of a piece lies in each 8-unit band across x and down y.
const BIN = 8, BIN0 = -200, BINS = 1400 / BIN;
const toBin = (v: number) => (v - BIN0) / BIN;

interface Piece { d: string; box: Box; ink: number; px: Float64Array; py: Float64Array; shape: Shape }

function profiles(polys: Poly[], b: Box) {
  const px = new Float64Array(BINS), py = new Float64Array(BINS);
  for (let y = Math.ceil(b.y0 / BIN) * BIN + BIN / 2; y < b.y1; y += BIN) {
    const row = Math.floor(toBin(y));
    for (const [x0, x1] of spansAt(polys, y)) {
      py[row] += (x1 - x0) * BIN;
      // Spread the span over the x bands it covers.
      for (let c = Math.floor(toBin(x0)); c <= Math.floor(toBin(x1)) && c < BINS; c++) {
        const l = Math.max(x0, BIN0 + c * BIN), r = Math.min(x1, BIN0 + (c + 1) * BIN);
        if (r > l && c >= 0) px[c] += (r - l) * BIN;
      }
    }
  }
  return { px, py };
}

/** Split an outline into connected pieces: each outer contour with the holes inside it. */
function piecesOf(cmds: PathCommand[]): Piece[] {
  const contours: PathCommand[][] = [];
  for (const c of cmds) {
    if (c.type === 'M') contours.push([c]);
    else contours.at(-1)?.push(c);
  }
  const shapes = contours
    .map((cs) => ({ cs, poly: flatten(cs, 8)[0] }))
    .filter((s): s is { cs: PathCommand[]; poly: Poly } => !!s.poly)
    .map((s) => ({ ...s, a: area(s.poly) }));
  if (!shapes.length) return [];
  const sign = Math.sign(shapes.reduce((m, s) => (Math.abs(s.a) > Math.abs(m.a) ? s : m)).a);
  const outers = shapes.filter((s) => Math.sign(s.a) === sign).map((s) => ({ ...s, holes: [] as typeof shapes }));
  for (const hole of shapes.filter((s) => Math.sign(s.a) !== sign)) {
    // The smallest outer contour around the hole owns it.
    const owner = outers.filter((o) => inside(hole.poly[0], o.poly)).sort((a, b) => Math.abs(a.a) - Math.abs(b.a))[0];
    if (owner) owner.holes.push(hole);
    else outers.push({ ...hole, holes: [] });
  }
  return outers.map((o) => {
    const box = polyBox(o.poly);
    return {
      d: pathD([...o.cs, ...o.holes.flatMap((h) => h.cs)]),
      box,
      ink: Math.abs(o.a) - o.holes.reduce((n, h) => n + Math.abs(h.a), 0),
      shape: { outer: o.poly, holes: o.holes.map((h) => h.poly) },
      ...profiles([o.poly, ...o.holes.map((h) => h.poly)], box),
    };
  });
}

// ---- structure: cut along empty channels ----------------------------------

// Components interlock: the sweep of 月 tucks under 日, so their boxes overlap.
// A cut is still clean if it slices through little ink: each piece goes to the
// side holding most of it, and what it leaves on the other side is the cost.
const SLICE = 0.05;      // a cut may slice through this much of the ink
const SPECK = 0.1;       // a group with less of the ink than this joins its neighbour

interface Node { items: number[]; box: Box; axis?: Axis; kids?: Node[]; cuts?: number[] }

const lo = (b: Box, a: Axis) => (a === 'x' ? b.x0 : b.y0);
const hi = (b: Box, a: Axis) => (a === 'x' ? b.x1 : b.y1);
const union = (bs: Box[]): Box => ({
  x0: Math.min(...bs.map((b) => b.x0)), y0: Math.min(...bs.map((b) => b.y0)),
  x1: Math.max(...bs.map((b) => b.x1)), y1: Math.max(...bs.map((b) => b.y1)),
});

function splitAlong(items: number[], pieces: Piece[], axis: Axis, box: Box) {
  const prof = items.map((i) => (axis === 'x' ? pieces[i].px : pieces[i].py));
  const cum = prof.map((p) => { const c = new Float64Array(BINS + 1); p.forEach((v, b) => { c[b + 1] = c[b] + v; }); return c; });
  const tot = cum.map((c) => c[BINS]);
  const total = tot.reduce((a, b) => a + b, 0);
  // Where each piece's ink is half on either side.
  const mid = cum.map((c, j) => { let b = 0; while (b < BINS && c[b] < tot[j] / 2) b++; return b; });
  const order = items.map((_, j) => j).sort((a, b) => mid[a] - mid[b]);

  // Every clean cut between pieces, as [how many pieces lie before it, its bins and the ink each slices].
  const zones = new Map<number, { c: number; sliced: number }[]>();
  const from = Math.max(1, Math.floor(toBin(lo(box, axis)))), to = Math.min(BINS - 1, Math.ceil(toBin(hi(box, axis))));
  for (let c = from; c <= to; c++) {
    let sliced = 0, before = 0;
    for (let j = 0; j < items.length; j++) {
      sliced += Math.min(cum[j][c], tot[j] - cum[j][c]);
      if (mid[j] < c) before++;
    }
    if (before > 0 && before < items.length && sliced <= SLICE * total) {
      zones.set(before, [...(zones.get(before) ?? []), { c, sliced }]);
    }
  }
  const bounds = [...zones.keys()].sort((a, b) => a - b);
  let groups = [0, ...bounds].map((start, g) => order.slice(start, bounds[g] ?? items.length).map((j) => items[j]));
  // Draw each cut down the middle of its cleanest stretch.
  let cuts = bounds.map((k) => {
    const zone = zones.get(k)!, least = Math.min(...zone.map((z) => z.sliced));
    const clean = zone.filter((z) => z.sliced <= least + 0.002 * total);
    return BIN0 + ((clean[0].c + clean.at(-1)!.c) / 2) * BIN;
  });

  // Specks (the dot of 宀, the ticks of 言) belong with the nearer neighbour, not on their own.
  const ink = (g: number[]) => g.reduce((n, i) => n + pieces[i].ink, 0);
  const all = ink(items);
  for (;;) {
    if (groups.length < 2) break;
    const j = groups.findIndex((g) => ink(g) < SPECK * all);
    if (j < 0) break;
    const gb = (g: number[]) => union(g.map((i) => pieces[i].box));
    const before = j > 0 ? lo(gb(groups[j]), axis) - hi(gb(groups[j - 1]), axis) : Infinity;
    const after = j < groups.length - 1 ? lo(gb(groups[j + 1]), axis) - hi(gb(groups[j]), axis) : Infinity;
    const a = before <= after ? j - 1 : j;
    groups = [...groups.slice(0, a), [...groups[a], ...groups[a + 1]], ...groups.slice(a + 2)];
    cuts = [...cuts.slice(0, a), ...cuts.slice(a + 1)];
  }
  return { groups, cuts };
}

function structure(items: number[], pieces: Piece[]): Node {
  const box = union(items.map((i) => pieces[i].box));
  if (items.length < 2) return { items, box };
  // Side by side is by far the commonest build (⿰), so a clean vertical cut wins.
  for (const axis of ['x', 'y'] as Axis[]) {
    const { groups, cuts } = splitAlong(items, pieces, axis, box);
    if (groups.length > 1) return { items, box, axis, cuts, kids: groups.map((g) => structure(g, pieces)) };
  }
  return { items, box };
}

function idsOf(n: Node): string {
  if (!n.kids) return '□';
  const ops = n.axis === 'x' ? ['⿰', '⿲'] : ['⿱', '⿳'];
  const seq = (kids: Node[]): string =>
    kids.length === 1 ? idsOf(kids[0])
      : kids.length === 3 ? ops[1] + kids.map(idsOf).join('')
        : ops[0] + idsOf(kids[0]) + seq(kids.slice(1));
  return seq(n.kids);
}

function cutsOf(n: Node, depth = 0, out: Cut[] = []): Cut[] {
  if (!n.kids || !n.axis || !n.cuts) return out;
  const a = n.axis;
  for (const at of n.cuts) {
    out.push({ axis: a, at, depth, from: a === 'x' ? n.box.y0 : n.box.x0, to: a === 'x' ? n.box.y1 : n.box.x1 });
  }
  n.kids.forEach((k) => cutsOf(k, depth + 1, out));
  return out;
}

const centre = (b: Box): Pt => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];

/** Which way a group leaves: away from the middle of the cut it sits beside. */
function sideOf(b: Box, parent: Box, axis: Axis): { axis: Axis; side: number } {
  const i = axis === 'x' ? 0 : 1;
  const diff = centre(b)[i] - centre(parent)[i];
  if (Math.abs(diff) < 40) return { axis: axis === 'x' ? 'y' : 'x', side: -1 };   // the middle of three
  return { axis, side: Math.sign(diff) };
}

function part(d: string, box: Box, ink: number, axis: Axis, side: number, shapes: Shape[]): Part {
  const [cx, cy] = centre(box);
  return { d, box, cx, cy, ink, axis, side, shapes, strokes: [] };
}

interface Outline { font: string; advance: number; glyph: string; box: Box; pieces: Part[]; parts: Part[]; ids: string; cuts: Cut[] }

function analyse(pieces: Piece[], advance: number): Omit<Outline, 'font'> {
  const root = structure(pieces.map((_, i) => i), pieces);
  const pieceParts: Part[] = [];
  // Reading order, until stroke-order data says otherwise: left before right, top before bottom.
  const walk = (n: Node, axis: Axis, side: number) => {
    if (!n.kids) {
      [...n.items].sort((a, b) => pieces[a].box.y0 - pieces[b].box.y0 || pieces[a].box.x0 - pieces[b].box.x0)
        .forEach((i) => {
          const p = pieces[i];
          const s = n.items.length > 1 ? sideOf(p.box, n.box, axis) : { axis, side };
          pieceParts.push(part(p.d, p.box, p.ink, s.axis, s.side || side, [p.shape]));
        });
      return;
    }
    for (const k of n.kids) { const s = sideOf(k.box, n.box, n.axis!); walk(k, s.axis, s.side); }
  };
  walk(root, 'y', -1);

  const groups = root.kids ?? root.items.map((i) => ({ items: [i], box: pieces[i].box }) as Node);
  const parts = groups.map((g) => {
    const s = root.kids ? sideOf(g.box, root.box, root.axis!) : sideOf(g.box, root.box, 'y');
    const order = [...g.items].sort((a, b) => pieces[a].box.y0 - pieces[b].box.y0 || pieces[a].box.x0 - pieces[b].box.x0);
    return part(order.map((i) => pieces[i].d).join(''), g.box, g.items.reduce((n, i) => n + pieces[i].ink, 0),
      s.axis, s.side || -1, order.map((i) => pieces[i].shape));
  });
  return {
    advance, glyph: pieces.map((p) => p.d).join(''), box: pieces.length ? root.box : { x0: 0, y0: 0, x1: 1000, y1: 1000 },
    pieces: pieceParts, parts, ids: idsOf(root), cuts: cutsOf(root),
  };
}

const outlines = new Map<string, Promise<Outline | null>>();

function outline(fontId: string, ch: string): Promise<Outline | null> {
  const key = `${fontId}\u0000${ch}`;
  let p = outlines.get(key);
  if (!p) {
    p = cjkGlyphOrFallback(fontId, ch).then((g) => {
      if (!g) return null;
      // Font units, y up → em units, y down from the top of the em box.
      const X = (x: number) => x * g.k, Y = (y: number) => (g.emTop - y) * g.k;
      const cmds = g.glyph.path.commands.map((c): PathCommand => {
        switch (c.type) {
          case 'M': case 'L': return { ...c, x: X(c.x), y: Y(c.y) };
          case 'Q': return { ...c, x1: X(c.x1), y1: Y(c.y1), x: X(c.x), y: Y(c.y) };
          case 'C': return { ...c, x1: X(c.x1), y1: Y(c.y1), x2: X(c.x2), y2: Y(c.y2), x: X(c.x), y: Y(c.y) };
          default: return c;
        }
      });
      return { ...analyse(piecesOf(cmds), g.advance), font: g.font.id === fontId ? '' : g.font.name };
    });
    outlines.set(key, p);
  }
  return p;
}

// ---- stroke order -------------------------------------------------------------
// The order of strokes is fixed: hanzi, kanji and kana are taught stroke by
// stroke, in one order. Two open data sets carry it:
//   KanjiVG          Japanese order; kanji, hiragana and katakana; the pen's centre line
//   Make Me a Hanzi  Chinese order; 9,000+ hanzi; centre lines and stroke outlines
// Japanese fonts ask KanjiVG first, Chinese and Korean ones Make Me a Hanzi, each
// falling back to the other. Both are fetched one character at a time. Hangul
// has no stroke data here. The strokes are fitted onto the font's own glyph, and
// each part takes its place in the order from the first stroke that falls in it.

export const STROKE_CREDITS: Record<StrokeSource, string> = {
  kanjivg: 'KanjiVG (CC BY-SA 3.0)',
  mmah: 'Make Me a Hanzi (Arphic Public License)',
};

const KANJIVG_URL = (ch: string) =>
  `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@r20250816/kanji/${ch.codePointAt(0)!.toString(16).padStart(5, '0')}.svg`;
const MMAH_URL = (ch: string) => `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/${encodeURIComponent(ch)}.json`;

/** Stroke data in a nominal em (1000, y down), before it is fitted onto the font. */
interface RawStroke { median: Pt[] }
interface RawStrokes { source: StrokeSource; strokes: RawStroke[]; box: Box }

const PAIR = /(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)/g;
const STEP = 12;   // em units between points on a pen path

const boxOf = (pts: Pt[]): Box => polyBox(pts.length ? pts : [[0, 0]]);
const inflate = (b: Box, n: number): Box => ({ x0: b.x0 - n, y0: b.y0 - n, x1: b.x1 + n, y1: b.y1 + n });
const lengthOf = (pts: Pt[]) => pts.slice(1).reduce((n, p, i) => n + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

/** Evenly spaced points along a polyline. */
function resample(pts: Pt[]): Pt[] {
  if (pts.length < 2) return pts;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / STEP));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

let sampler: SVGPathElement | null = null;

/** Points along an SVG path (KanjiVG's strokes are curves), scaled by k. */
function samplePath(d: string, k: number): Pt[] {
  if (!sampler) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden';
    sampler = document.createElementNS(NS, 'path');
    svg.append(sampler);
    document.body.append(svg);
  }
  sampler.setAttribute('d', d);
  const len = sampler.getTotalLength();
  const n = Math.max(2, Math.ceil((len * k) / STEP));
  return Array.from({ length: n + 1 }, (_, i) => {
    const p = sampler!.getPointAtLength((len * i) / n);
    return [p.x * k, p.y * k] as Pt;
  });
}

async function fromKanjiVG(ch: string): Promise<RawStrokes | null> {
  if (!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]/u.test(ch)) return null;
  const r = await fetch(KANJIVG_URL(ch));
  if (!r.ok) return null;
  // Each stroke is a <path id="kvg:08a9e-s3" … d="…">, numbered in writing order.
  const strokes: { n: number; d: string }[] = [];
  for (const [tag] of (await r.text()).matchAll(/<path\b[^>]*>/g)) {
    const n = tag.match(/\bid="kvg:[^"]*-s(\d+)"/)?.[1], d = tag.match(/\sd="([^"]+)"/)?.[1];
    if (n && d) strokes.push({ n: +n, d });
  }
  if (!strokes.length) return null;
  strokes.sort((a, b) => a.n - b.n);
  const raw = strokes.map((s) => ({ median: samplePath(s.d, 1000 / 109) }));
  // A centre line stops about half a stroke short of the ink's edge.
  return { source: 'kanjivg', strokes: raw, box: inflate(boxOf(raw.flatMap((s) => s.median)), 32) };
}

async function fromMMAH(ch: string): Promise<RawStrokes | null> {
  if (!/\p{Script=Han}/u.test(ch)) return null;
  const r = await fetch(MMAH_URL(ch));
  if (!r.ok) return null;
  const data = await r.json() as { strokes: string[]; medians: Pt[][] };
  // The data sits in a 1024 box, y up, with its top at 900.
  const X = (x: number) => (x * 1000) / 1024, Y = (y: number) => ((900 - y) * 1000) / 1024;
  const all: Pt[] = [];
  // Its stroke outlines are in the Arphic fonts' shapes; they only measure the character's box.
  for (const d of data.strokes) for (const [, x, y] of d.matchAll(PAIR)) all.push([X(+x), Y(+y)]);
  const raw = data.medians.map((m) => ({ median: resample(m.map(([x, y]): Pt => [X(x), Y(y)])) }));
  return { source: 'mmah', strokes: raw, box: boxOf(all) };
}

const rawCache = new Map<string, Promise<RawStrokes | null>>();

function fetchStrokes(source: StrokeSource, ch: string) {
  const key = `${source}:${ch}`;
  let p = rawCache.get(key);
  if (!p) {
    p = (source === 'kanjivg' ? fromKanjiVG(ch) : fromMMAH(ch)).catch(() => null);
    rawCache.set(key, p);
  }
  return p;
}

async function loadStrokes(ch: string, lang: string): Promise<RawStrokes | null> {
  for (const source of (lang === 'ja' ? ['kanjivg', 'mmah'] : ['mmah', 'kanjivg']) as StrokeSource[]) {
    const raw = await fetchStrokes(source, ch);
    if (raw) return raw;
  }
  return null;
}

/** Fit the data's box onto the glyph's, axis by axis; an axis too thin to measure (一) borrows the other's scale. */
function fitStrokes(raw: RawStrokes, target: Box): Pt[][] {
  const ok = (v: number) => Number.isFinite(v) && v > 0.7 && v < 1.45;
  const fx = (target.x1 - target.x0) / (raw.box.x1 - raw.box.x0);
  const fy = (target.y1 - target.y0) / (raw.box.y1 - raw.box.y0);
  const sx = ok(fx) ? fx : ok(fy) ? fy : 1, sy = ok(fy) ? fy : ok(fx) ? fx : 1;
  const tx = (target.x0 + target.x1) / 2 - ((raw.box.x0 + raw.box.x1) / 2) * sx;
  const ty = (target.y0 + target.y1) / 2 - ((raw.box.y0 + raw.box.y1) / 2) * sy;
  return raw.strokes.map((s) => s.median.map(([x, y]): Pt => [x * sx + tx, y * sy + ty]));
}

// ---- registration: warp the data onto the font --------------------------------
// A kai brush and a Song or Gothic font put the same strokes in different places
// (牛's long bar sits lower in Song), more than a box fit or a nudge can fix. So the
// data's centre lines, drawn at the font's average stroke width, are registered
// onto the font's glyph with Thirion's demons: a smooth displacement field, found
// coarse to fine on a 64-pixel grid, that carries one image onto the other.
const REG_N = 64;

function gauss(img: Float32Array, n: number, sigma: number) {
  const r = Math.ceil(sigma * 3), k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)));
  const sum = k.reduce((a, b) => a + b, 0);
  const tmp = new Float32Array(n * n), out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let v = 0;
      for (let i = -r; i <= r; i++) v += img[y * n + clamp(x + i, 0, n - 1)] * k[i + r];
      tmp[y * n + x] = v / sum;
    }
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let v = 0;
      for (let i = -r; i <= r; i++) v += tmp[clamp(y + i, 0, n - 1) * n + x] * k[i + r];
      out[y * n + x] = v / sum;
    }
  }
  return out;
}

function bilinear(img: Float32Array, n: number, x: number, y: number) {
  x = clamp(x, 0, n - 1.001); y = clamp(y, 0, n - 1.001);
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = y0 * n + x0;
  return (img[i] * (1 - fx) + img[i + 1] * fx) * (1 - fy) + (img[i + n] * (1 - fx) + img[i + n + 1] * fx) * fy;
}

function register(glyph: string, medians: Pt[][], target: Box): Pt[][] {
  const n = REG_N;
  const size = Math.max(target.x1 - target.x0, target.y1 - target.y0) + 240;
  const ox = (target.x0 + target.x1) / 2 - size / 2, oy = (target.y0 + target.y1) / 2 - size / 2, k = n / size;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const raster = (draw: () => void) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, n, n);
    ctx.setTransform(k, 0, 0, k, -ox * k, -oy * k);
    draw();
    const d = ctx.getImageData(0, 0, n, n).data, out = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) out[i] = d[i * 4 + 3] / 255;
    return out;
  };
  const font = raster(() => ctx.fill(new Path2D(glyph)));
  // The font's average stroke width: its ink spread along the data's strokes.
  const inkArea = font.reduce((a, b) => a + b, 0) / (k * k);
  const total = medians.reduce((a, m) => a + lengthOf(m), 0) || 1;
  const data = raster(() => {
    ctx.lineWidth = clamp(inkArea / total, 20, 160);
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const m of medians) {
      ctx.beginPath();
      m.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
  });

  let ux = new Float32Array(n * n), uy = new Float32Array(n * n);
  for (const [sigma, iters] of [[3, 40], [1.5, 40]]) {
    const A = gauss(data, n, sigma), B = gauss(font, n, sigma);
    const gx = new Float32Array(n * n), gy = new Float32Array(n * n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        gx[y * n + x] = (B[y * n + clamp(x + 1, 0, n - 1)] - B[y * n + clamp(x - 1, 0, n - 1)]) / 2;
        gy[y * n + x] = (B[clamp(y + 1, 0, n - 1) * n + x] - B[clamp(y - 1, 0, n - 1) * n + x]) / 2;
      }
    }
    for (let it = 0; it < iters; it++) {
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const i = y * n + x;
          const diff = bilinear(A, n, x + ux[i], y + uy[i]) - B[i];
          const den = gx[i] * gx[i] + gy[i] * gy[i] + diff * diff;
          if (den < 1e-6) continue;
          ux[i] -= (diff * gx[i]) / den;
          uy[i] -= (diff * gy[i]) / den;
        }
      }
      ux = gauss(ux, n, 2);
      uy = gauss(uy, n, 2);
    }
  }
  // The field takes a font point to its data point (x + u(x)); invert it for each data point.
  return medians.map((m) => m.map(([px, py]): Pt => {
    const qx = (px - ox) * k, qy = (py - oy) * k;
    let x = qx, y = qy;
    for (let i = 0; i < 12; i++) { x = qx - bilinear(ux, n, x, y); y = qy - bilinear(uy, n, x, y); }
    return [x / k + ox, y / k + oy];
  }));
}

const insideShape = (pt: Pt, s: Shape) => inside(pt, s.outer) && !s.holes.some((h) => inside(pt, h));

/** Put each stroke in the part holding most of its centre line, then order the parts by their first stroke. */
function inWritingOrder(base: Part[], strokes: Stroke[]): Part[] {
  const parts = base.map((p) => ({ ...p, strokes: [] as number[] }));
  const home = strokes.map((s, i) => {
    const votes = parts.map((p) => s.median.filter((pt) => p.shapes.some((sh) => insideShape(pt, sh))).length);
    let best = votes.indexOf(Math.max(...votes));
    if (!votes[best]) {
      // The data and the font disagree here: take the part nearest the middle of the stroke.
      const [mx, my] = s.median[Math.floor(s.median.length / 2)];
      best = parts.reduce((b, p, j) => (Math.hypot(p.cx - mx, p.cy - my) < Math.hypot(parts[b].cx - mx, parts[b].cy - my) ? j : b), 0);
    }
    parts[best].strokes.push(i);
    return parts[best];
  });
  const first = (p: Part) => (p.strokes.length ? p.strokes[0] : Infinity);
  const sorted = [...parts].sort((a, b) => first(a) - first(b));
  home.forEach((p, i) => { strokes[i].part = sorted.indexOf(p); });
  return sorted;
}

const warped = new Map<string, Pt[][]>();

function strokesFor(key: string, raw: RawStrokes, o: Outline): Stroke[] {
  let medians = warped.get(key);
  if (!medians) { medians = register(o.glyph, fitStrokes(raw, o.box), o.box); warped.set(key, medians); }
  return medians.map((median) => ({ median, part: -1 }));
}

// ---- the one entry point ----------------------------------------------------------

export async function breakdown(fontId: string, ch: string, split: Split, lang: string): Promise<Breakdown> {
  const [o, raw] = await Promise.all([outline(fontId, ch), loadStrokes(ch, lang)]);
  const counts = { parts: o?.parts.length ?? 0, pieces: o?.pieces.length ?? 0 };
  if (!o) {
    return { ch, advance: 1000, glyph: '', fallback: '', parts: [], strokes: null, strokeSource: null, ids: '', cuts: [], source: 'missing', counts };
  }
  const strokes = raw && o.pieces.length ? strokesFor(`${fontId}\u0000${ch}\u0000${raw.source}`, raw, o) : null;
  const common = { ch, advance: o.advance, glyph: o.glyph, fallback: o.font, ids: o.ids, source: 'outline' as const, counts, strokes, strokeSource: strokes ? raw!.source : null };
  const base = split === 'parts' ? o.parts : o.pieces;
  return {
    ...common,
    parts: strokes ? inWritingOrder(base, strokes) : base.map((p) => ({ ...p, strokes: [] })),
    cuts: split === 'parts' ? o.cuts.filter((c) => c.depth === 0) : o.cuts,
  };
}
