// Glyph playground: mutate a real font.
//
// Every edit is a delta on the original font, never a rewrite of it. A point is
// drawn at:
//
//   original + edit offset + normal · (weight ± contrast)   (font units)
//     → y remapped between the font's lines                 (stretch)
//     → x sheared and scaled                                 (slant, width)
//
// Edits come from two tools: Sculpt moves every point near the cursor with a
// smooth falloff; Points moves one point and its handles. The original outline
// stays visible as a ghost, and the result can be built into a real font file.
import { Font, Glyph, Path, type PathCommand } from 'opentype.js';
import { button, row, segmented, slider } from '../lib/controls';
import { clamp, fmt, h, s } from '../lib/dom';
import { fontPicker } from '../lib/font-picker';
import { addFont, fontStore, loadUpload, metricTables, type LoadedFont } from '../lib/fonts';

type LineName = 'asc' | 'cap' | 'x' | 'desc';
type Lines = Record<LineName, number>;
type Vec = [number, number];
type Tool = 'sculpt' | 'points';

interface State {
  lines: Lines;                                  // where the lines are now (font units)
  slant: number;                                 // degrees
  width: number;                                 // percent
  weight: number;                                // font units added to every stroke edge
  contrast: number;                              // font units moved from horizontal to vertical strokes
  points: Map<number, Map<string, Vec>>;         // glyph index → point key → offset
  advance: Map<number, number>;                  // glyph index → advance offset
}

interface Pt { key: string; x: number; y: number; on: boolean }

const LINE_LABELS: Record<LineName | 'base', string> = {
  asc: 'Ascender', cap: 'Cap height', x: 'x-height', base: 'Baseline', desc: 'Descender',
};

/** The font's own lines, measured from its letters where the tables are silent. */
function measureLines(ot: Font): Lines {
  const ys = (chars: string, pick: 'y1' | 'y2') => Array.from(chars)
    .map((c) => ot.charToGlyph(c))
    .filter((g) => g.index !== 0)
    .map((g) => g.getBoundingBox()[pick])
    .filter(Number.isFinite);
  const { os2 } = metricTables(ot);
  const em = ot.unitsPerEm;
  const top = (chars: string, fallback: number) => Math.max(...ys(chars, 'y2'), 0) || fallback;
  const bottom = ys('pqgjy', 'y1');
  return {
    asc: top('bdhkl', em * 0.72),
    cap: os2?.sCapHeight || top('HIE', em * 0.68),
    x: os2?.sxHeight || top('xvwz', em * 0.45),
    desc: bottom.length ? Math.min(...bottom) : -em * 0.22,
  };
}

/** Piecewise-linear map through matching anchor lists; beyond the ends it translates. */
function piecewise(from: number[], to: number[]) {
  const n = from.length - 1;
  return (y: number) => {
    if (y <= from[0]) return to[0] + (y - from[0]);
    if (y >= from[n]) return to[n] + (y - from[n]);
    let i = 0;
    while (y > from[i + 1]) i++;
    return to[i] + ((y - from[i]) / (from[i + 1] - from[i])) * (to[i + 1] - to[i]);
  };
}

const isLowercase = (g: Glyph) => g.unicode != null && /\p{Ll}/u.test(String.fromCodePoint(g.unicode));

/** Point keys: "7" is the end point of command 7; "7c1" / "7c2" its control points. */
function pointsOf(c: PathCommand, i: number): Pt[] {
  switch (c.type) {
    case 'M': case 'L': return [{ key: `${i}`, x: c.x, y: c.y, on: true }];
    case 'Q': return [{ key: `${i}c1`, x: c.x1, y: c.y1, on: false }, { key: `${i}`, x: c.x, y: c.y, on: true }];
    case 'C': return [
      { key: `${i}c1`, x: c.x1, y: c.y1, on: false }, { key: `${i}c2`, x: c.x2, y: c.y2, on: false },
      { key: `${i}`, x: c.x, y: c.y, on: true },
    ];
    default: return [];
  }
}

/** The points of each contour, in drawing order. */
function contoursOf(cmds: PathCommand[]): Pt[][] {
  const out: Pt[][] = [];
  cmds.forEach((c, i) => {
    if (c.type === 'M') out.push([]);
    if (out.length) out[out.length - 1].push(...pointsOf(c, i));
  });
  return out.filter((c) => c.length > 1);
}

/**
 * A unit normal per point, pointing away from the ink, so pushing points along
 * it thickens strokes. TrueType draws outer contours clockwise (ink on the
 * right), PostScript counter-clockwise; the largest contour tells us which.
 */
function normalsOf(cmds: PathCommand[]): Map<string, Vec> {
  const contours = contoursOf(cmds);
  const area = (pts: Pt[]) => pts.reduce((a, p, i) => {
    const q = pts[(i + 1) % pts.length];
    return a + (p.x * q.y - q.x * p.y);
  }, 0) / 2;
  const outer = contours.reduce<Pt[] | null>((best, c) => (!best || Math.abs(area(c)) > Math.abs(area(best)) ? c : best), null);
  const inkOnRight = outer ? area(outer) < 0 : true;

  const normals = new Map<string, Vec>();
  for (const pts of contours) {
    // A closing point that repeats the first would give a zero tangent; skip it and share the normal.
    const first = pts[0], last = pts[pts.length - 1];
    const closed = pts.length > 2 && last.x === first.x && last.y === first.y;
    const ring = closed ? pts.slice(0, -1) : pts;
    ring.forEach((p, i) => {
      const a = ring[(i - 1 + ring.length) % ring.length], b = ring[(i + 1) % ring.length];
      let tx = b.x - a.x, ty = b.y - a.y;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len; ty /= len;
      normals.set(p.key, inkOnRight ? [-ty, tx] : [ty, -tx]);
    });
    if (closed) normals.set(last.key, normals.get(first.key)!);
  }
  return normals;
}

/** Points that travel with an on-curve point: its handles, and its twin where a contour closes on itself. */
function followers(cmds: PathCommand[], key: string): string[] {
  if (key.includes('c')) return [];
  const i = Number(key);
  const ends = [i];
  let start = i;
  while (start > 0 && cmds[start].type !== 'M') start--;
  let end = i;
  while (end + 1 < cmds.length && cmds[end + 1].type !== 'M' && cmds[end + 1].type !== 'Z') end++;
  const at = (j: number) => cmds[j] as { x: number; y: number };
  const twins = end !== start && at(end).x === at(start).x && at(end).y === at(start).y;
  if (twins && i === start) ends.push(end);
  if (twins && i === end) ends.push(start);

  const out = new Set<string>();
  for (const e of ends) {
    if (e !== i) out.add(`${e}`);
    const c = cmds[e];
    if (c.type === 'C') out.add(`${e}c2`);
    if (c.type === 'Q') out.add(`${e}c1`);
    const next = cmds[e + 1];
    if (next && (next.type === 'C' || next.type === 'Q')) out.add(`${e + 1}c1`);
  }
  out.delete(key);
  return [...out];
}

/** Brush falloff: 1 at the centre, easing to 0 at the rim. */
const falloff = (d: number) => (d >= 1 ? 0 : (1 - d * d) ** 2);

export function mountGlyphLab(root: HTMLElement) {
  let font: LoadedFont = fontStore.get();
  let original: Lines;
  let state: State;
  let current = 0;                 // glyph index being edited
  let text = 'Hamburgefonstiv';
  let tool: Tool = 'sculpt';
  let brush = 70;                  // sculpt radius, screen px
  const normalCache = new Map<number, Map<string, Vec>>();

  // ---- history: one entry per gesture, and only if the gesture changed something

  const undoStack: string[] = [];
  const redoStack: string[] = [];
  let gestureStart: string | null = null;

  const snapshot = () => JSON.stringify({
    ...state, points: [...state.points].map(([g, m]) => [g, [...m]]), advance: [...state.advance],
  });
  function restore(json: string) {
    const o = JSON.parse(json);
    state = {
      ...o,
      points: new Map(o.points.map(([g, m]: [number, [string, Vec][]]) => [g, new Map(m)])),
      advance: new Map(o.advance),
    };
    syncSliders();
  }
  const begin = () => { gestureStart ??= snapshot(); };
  function end() {
    if (gestureStart === null) return;
    if (gestureStart !== snapshot()) {
      undoStack.push(gestureStart);
      if (undoStack.length > 300) undoStack.shift();
      redoStack.length = 0;
    }
    gestureStart = null;
    syncHistoryButtons();
  }
  /** Wrap a one-shot change (reset, double-click) as a gesture. */
  const change = (fn: () => void) => { begin(); fn(); end(); draw(); };
  function undo() {
    const prev = undoStack.pop();
    if (prev === undefined) return;
    redoStack.push(snapshot());
    restore(prev);
    syncHistoryButtons();
    draw();
  }
  function redo() {
    const next = redoStack.pop();
    if (next === undefined) return;
    undoStack.push(snapshot());
    restore(next);
    syncHistoryButtons();
    draw();
  }

  // ---- the model ---------------------------------------------------------

  const fresh = (): State => ({
    lines: { ...original }, slant: 0, width: 100, weight: 0, contrast: 0, points: new Map(), advance: new Map(),
  });

  function load(f: LoadedFont) {
    font = f;
    const ot = f.ot;
    original = ot ? measureLines(ot) : { asc: 700, cap: 680, x: 450, desc: -220 };
    state = fresh();
    normalCache.clear();
    current = ot ? Math.max(0, ot.charToGlyphIndex('a')) : 0;
    undoStack.length = 0;
    redoStack.length = 0;
    syncSliders();
    syncHistoryButtons();
  }

  function normals(g: Glyph) {
    let n = normalCache.get(g.index);
    if (!n) normalCache.set(g.index, (n = normalsOf(g.path.commands)));
    return n;
  }

  /** How far weight and contrast push a point along its normal. */
  function offsetOf(g: Glyph, key: string): Vec {
    if (!state.weight && !state.contrast) return [0, 0];
    const n = normals(g).get(key);
    if (!n) return [0, 0];
    // Contrast feeds vertical strokes (horizontal normals) and starves horizontal ones.
    const amount = state.weight + state.contrast * (Math.abs(n[0]) - Math.abs(n[1]));
    // Shift right by the weight so the left side bearing keeps its room.
    return [n[0] * amount + state.weight, n[1] * amount];
  }

  function mapY(g: Glyph) {
    const o = original, t = state.lines;
    return isLowercase(g)
      ? piecewise([o.desc, 0, o.x, o.asc], [t.desc, 0, t.x, t.asc])
      : piecewise([o.desc, 0, o.cap], [t.desc, 0, t.cap]);
  }
  function unmapY(g: Glyph) {
    const o = original, t = state.lines;
    return isLowercase(g)
      ? piecewise([t.desc, 0, t.x, t.asc], [o.desc, 0, o.x, o.asc])
      : piecewise([t.desc, 0, t.cap], [o.desc, 0, o.cap]);
  }

  /** Original point → where it is drawn, in font units. */
  function transformer(g: Glyph) {
    const map = mapY(g);
    const deltas = state.points.get(g.index);
    const tan = Math.tan((state.slant * Math.PI) / 180), w = state.width / 100;
    return (x: number, y: number, key: string): Vec => {
      const d = deltas?.get(key);
      if (d) { x += d[0]; y += d[1]; }
      const o = offsetOf(g, key);
      const Y = map(y + o[1]);
      return [(x + o[0] + Y * tan) * w, Y];
    };
  }

  /** The edit offset that puts a point of g at (fx, fy), drawn font units. */
  function deltaFor(g: Glyph, p: Pt, fx: number, fy: number): Vec {
    const tan = Math.tan((state.slant * Math.PI) / 180), w = state.width / 100;
    const o = offsetOf(g, p.key);
    const y = unmapY(g)(fy) - o[1];
    const x = fx / w - fy * tan - o[0];
    return [x - p.x, y - p.y];
  }

  function mutate(g: Glyph): { cmds: PathCommand[]; adv: number } {
    const T = transformer(g);
    const cmds = g.path.commands.map((c, i): PathCommand => {
      switch (c.type) {
        case 'M': case 'L': { const [x, y] = T(c.x, c.y, `${i}`); return { type: c.type, x, y }; }
        case 'Q': {
          const [x1, y1] = T(c.x1, c.y1, `${i}c1`), [x, y] = T(c.x, c.y, `${i}`);
          return { type: 'Q', x1, y1, x, y };
        }
        case 'C': {
          const [x1, y1] = T(c.x1, c.y1, `${i}c1`), [x2, y2] = T(c.x2, c.y2, `${i}c2`), [x, y] = T(c.x, c.y, `${i}`);
          return { type: 'C', x1, y1, x2, y2, x, y };
        }
        default: return c;
      }
    });
    const adv = ((g.advanceWidth ?? 0) + (state.advance.get(g.index) ?? 0) + 2 * state.weight) * (state.width / 100);
    return { cmds, adv };
  }

  /** SVG path data for font-unit commands placed at (ox, baseline) with scale k. */
  function pathData(cmds: PathCommand[], ox: number, base: number, k: number) {
    const X = (x: number) => (ox + x * k).toFixed(1), Y = (y: number) => (base - y * k).toFixed(1);
    return cmds.map((c) => {
      switch (c.type) {
        case 'M': case 'L': return `${c.type}${X(c.x)} ${Y(c.y)}`;
        case 'Q': return `Q${X(c.x1)} ${Y(c.y1)} ${X(c.x)} ${Y(c.y)}`;
        case 'C': return `C${X(c.x1)} ${Y(c.y1)} ${X(c.x2)} ${Y(c.y2)} ${X(c.x)} ${Y(c.y)}`;
        default: return 'Z';
      }
    }).join('');
  }

  // ---- the tool rail -----------------------------------------------------

  /** A slider bound to one numeric field of the state; a drag is one undo step. */
  function stateSlider(label: string, key: 'slant' | 'width' | 'weight' | 'contrast', min: number, max: number, unit: string) {
    const ctl = slider({ label, min, max, value: 0, format: (v) => `${v}${unit}`,
      onInput: (v) => { begin(); state[key] = v; draw(); } });
    ctl.el.addEventListener('change', end);
    ctl.el.addEventListener('dblclick', () => change(() => { state[key] = fresh()[key]; syncSliders(); }));
    return ctl;
  }
  const sliders = {
    weight: stateSlider('Weight', 'weight', -60, 90, ''),
    contrast: stateSlider('Contrast', 'contrast', -50, 50, ''),
    slant: stateSlider('Slant', 'slant', -20, 20, '°'),
    width: stateSlider('Width', 'width', 50, 180, '%'),
  };
  function syncSliders() {
    for (const [key, ctl] of Object.entries(sliders)) ctl.set(state[key as keyof typeof sliders]);
  }

  const zoomLabel = h('button', { type: 'button', class: 'seg-btn zoom-label', title: 'Fit (0)', onclick: () => fit() }, '100%');
  const zoomCtl = h('span', { class: 'tool-group zoom' },
    h('button', { type: 'button', class: 'seg-btn', 'aria-label': 'Zoom out', onclick: () => zoomAt(centre(), 0.8) }, '−'),
    zoomLabel,
    h('button', { type: 'button', class: 'seg-btn', 'aria-label': 'Zoom in', onclick: () => zoomAt(centre(), 1.25) }, '+'));
  const brushCtl = slider({ label: 'Brush', min: 20, max: 240, value: brush, onInput: (v) => { brush = v; drawEditor(); } });
  const toolCtl = segmented<Tool>({ options: [{ value: 'sculpt', label: 'Sculpt' }, { value: 'points', label: 'Points' }],
    value: tool, onChange: (v) => { tool = v; brushCtl.el.classList.toggle('is-off', v !== 'sculpt'); drawEditor(); } });
  toolCtl.el.classList.add('tool-switch');

  const undoBtn = button('Undo', undo);
  const redoBtn = button('Redo', redo);
  function syncHistoryButtons() {
    undoBtn.disabled = !undoStack.length;
    redoBtn.disabled = !redoStack.length;
  }

  const fileInput = h('input', { type: 'file', accept: '.ttf,.otf,.woff,.woff2', hidden: true, onchange: () => {
    const file = fileInput.files?.[0];
    if (file) void loadUpload(file).then((f) => fontStore.select(f.key)).catch((e) => flash(`Could not load: ${e.message}`));
    fileInput.value = '';
  } });
  const notice = h('p', { class: 'notice' });
  const flash = (msg: string) => { notice.textContent = msg; notice.classList.add('is-on'); setTimeout(() => notice.classList.remove('is-on'), 3200); };

  const tools = h('div', { class: 'controls' },
    row(
      fontPicker(''),
      h('button', { type: 'button', class: 'file-btn', onclick: () => fileInput.click() }, 'Upload'),
      fileInput,
      toolCtl.el, brushCtl.el, zoomCtl,
      h('span', { class: 'tool-group tool-end' },
        button('Glyphs', () => toggleDrawer()), undoBtn, redoBtn,
        button('Reset', () => change(() => { state = fresh(); syncSliders(); }))),
    ),
    row(
      sliders.weight.el, sliders.contrast.el, sliders.slant.el, sliders.width.el,
      h('span', { class: 'tool-group tool-end' },
        button('Download', () => download()),
        button('Use everywhere', () => void useEverywhere())),
    ),
  );

  // ---- the editor --------------------------------------------------------

  const editor = s('svg', { class: 'glyph-editor', role: 'application', 'aria-label': 'Glyph editor: sculpt the letter, or drag points and lines' });
  const strip = s('svg', { class: 'glyph-strip', tabindex: 0, role: 'textbox', 'aria-label': 'Specimen text: type to change it, click a letter to edit it' });
  const drawer = h('div', { class: 'glyph-drawer', hidden: true });
  const meta = h('dl', { class: 'meta info-only' });
  const stage = h('div', { class: 'glyph-stage' }, editor, drawer, meta);
  root.append(tools, stage, h('div', { class: 'strip-wrap' }, strip), notice);

  // k0/base0: the unzoomed fit. k/base/ox: what is on screen after zoom and pan.
  let view = { W: 800, H: 500, k0: 0.4, base0: 300, k: 0.4, base: 300, ox: 0 };
  let zoom = 1;
  let pan: Vec = [0, 0];
  let spaceHeld = false;
  let cursor: Vec | null = null;   // last pointer position over the editor
  type Drag =
    | { kind: 'point'; key: string }
    | { kind: 'sculpt'; start: Vec; grabbed: { p: Pt; w: number; at: Vec }[] }
    | { kind: 'line'; name: LineName }
    | { kind: 'adv'; ox: number }
    | { kind: 'pan'; start: Vec; pan0: Vec };
  let drag: Drag | null = null;

  function layout() {
    const r = editor.getBoundingClientRect();
    const W = Math.max(320, r.width), H = Math.max(240, r.height);
    editor.setAttribute('viewBox', `0 0 ${W} ${H}`);
    // Scale from the original lines, so dragging a line does not rescale the view.
    const k0 = (H * 0.8) / (original.asc - original.desc);
    view = { ...view, W, H, k0, base0: H * 0.1 + original.asc * k0 };
  }

  function draw() {
    drawEditor();
    drawStrip();
  }

  /** Where each point of the current glyph is drawn, in editor px. */
  function screenPoints(g: Glyph, ox: number): { p: Pt; at: Vec }[] {
    const T = transformer(g);
    const { k, base } = view;
    return g.path.commands.flatMap((c, i) => pointsOf(c, i).map((p) => {
      const [x, y] = T(p.x, p.y, p.key);
      return { p, at: [ox + x * k, base - y * k] as Vec };
    }));
  }

  function drawEditor() {
    const ot = font.ot;
    if (!ot) {
      editor.replaceChildren(s('text', { x: 24, y: 40, class: 'svg-label is-hl' }, (font.parseError ?? 'This font cannot be edited').toUpperCase()));
      return;
    }
    const g = ot.glyphs.get(current);
    const { cmds, adv } = mutate(g);
    // Zoom scales about the centre of the editor; pan shifts the result.
    const { W, H, k0, base0 } = view;
    const k = k0 * zoom;
    const base = (base0 - H / 2) * zoom + H / 2 + pan[1];
    const ox = drag?.kind === 'adv' ? drag.ox : ((W - adv * k0) / 2 - W / 2) * zoom + W / 2 + pan[0];
    view = { ...view, k, base, ox };
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    const yOf = (v: number) => base - v * k;
    const els: SVGElement[] = [];

    // Lines, full width, each with a grip.
    const lines: [LineName | 'base', number][] = [
      ['asc', state.lines.asc], ['cap', state.lines.cap], ['x', state.lines.x], ['base', 0], ['desc', state.lines.desc],
    ];
    let lastLabelY = -Infinity;
    for (const [name, v] of [...lines].sort((a, b) => b[1] - a[1])) {
      const y = yOf(v);
      const active = drag?.kind === 'line' && drag.name === name;
      const moved = name !== 'base' && Math.abs(v - original[name as LineName]) > 0.5;
      const ly = Math.max(y - 6, lastLabelY + 14);
      lastLabelY = ly;
      els.push(
        s('line', { x1: 0, x2: W, y1: y, y2: y, class: `guide${name === 'base' ? ' is-base' : ''}${active || moved ? ' is-hl' : ''}` }),
        s('text', { x: 14, y: ly, class: `svg-label${active || moved ? ' is-hl' : ''}` },
          LINE_LABELS[name].toUpperCase(), s('tspan', { class: 'svg-num', dx: 10 }, fmt(v, 0))),
      );
      if (name !== 'base') els.push(s('line', { x1: 0, x2: W, y1: y, y2: y, class: 'line-hit', 'data-line': name }));
    }

    // The advance: where the next letter would start.
    const top = yOf(state.lines.asc) - 40, bottom = yOf(state.lines.desc) + 40;
    els.push(
      s('line', { x1: ox, x2: ox, y1: top, y2: bottom, class: 'rule-line' }),
      s('line', { x1: ox + adv * k, x2: ox + adv * k, y1: top, y2: bottom, class: `rule-line${drag?.kind === 'adv' ? ' is-hl' : ''}` }),
      s('line', { x1: ox + adv * k, x2: ox + adv * k, y1: top, y2: bottom, class: 'adv-hit', 'data-adv': '' }),
      s('text', { x: ox + adv * k + 8, y: bottom, class: 'svg-num' }, fmt(adv, 0)),
    );

    // Ghost of the untouched glyph, then the live one.
    els.push(
      s('path', { d: pathData(g.path.commands, ox, base, k), class: 'glyph-ghost' }),
      s('path', { d: pathData(cmds, ox, base, k), class: 'glyph-live' }),
    );

    // Handles and points. In Sculpt they recede, lighting up inside the brush.
    const pts = screenPoints(g, ox);
    const at = new Map(pts.map(({ p, at }) => [p.key, at]));
    const handles: SVGElement[] = [], dots: SVGElement[] = [];
    let prev: Vec | null = null;
    const link = (a: Vec, b: Vec) => handles.push(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'handle' }));
    cmds.forEach((c, i) => {
      if (c.type === 'Z') return;
      const end = at.get(`${i}`)!;
      if (c.type === 'Q') { const c1 = at.get(`${i}c1`)!; if (prev) link(prev, c1); link(c1, end); }
      if (c.type === 'C') { if (prev) link(prev, at.get(`${i}c1`)!); link(at.get(`${i}c2`)!, end); }
      prev = end;
    });
    const sculpting = tool === 'sculpt';
    const centre = drag?.kind === 'sculpt' ? null : cursor;
    const weightOf = new Map(drag?.kind === 'sculpt' ? drag.grabbed.map((e) => [e.p.key, e.w]) : []);
    for (const { p, at: [x, y] } of pts) {
      const w = weightOf.get(p.key) ?? (sculpting && centre ? falloff(Math.hypot(x - centre[0], y - centre[1]) / brush) : 0);
      const hot = (drag?.kind === 'point' && drag.key === p.key) || w > 0;
      const style = sculpting ? `opacity:${(0.25 + 0.75 * w).toFixed(2)}` : null;
      dots.push(p.on
        ? s('rect', { x: x - 4.5, y: y - 4.5, width: 9, height: 9, class: `pt-on${hot ? ' is-hot' : ''}`, 'data-key': p.key, style })
        : s('circle', { cx: x, cy: y, r: 4.5, class: `pt-off${hot ? ' is-hot' : ''}`, 'data-key': p.key, style }));
    }
    els.push(...handles, ...dots);

    if (sculpting && cursor) {
      els.push(s('circle', { cx: cursor[0], cy: cursor[1], r: brush, class: `brush${drag?.kind === 'sculpt' ? ' is-down' : ''}` }));
    }
    editor.classList.toggle('is-sculpt', sculpting);
    editor.replaceChildren(...els);
    renderMeta(g, adv);
  }

  function renderMeta(g: Glyph, adv: number) {
    const ot = font.ot!;
    const rows: [string, string][] = [
      ['Glyph', `${g.name ?? '—'}${g.unicode != null ? ` · U+${g.unicode.toString(16).toUpperCase().padStart(4, '0')}` : ''}`],
      ['Advance', `${fmt(adv, 0)} of ${ot.unitsPerEm} units per em`],
      ['Commands', `${g.path.commands.filter((c) => c.type !== 'Z').length}`],
      ['Outlines', ot.outlinesFormat === 'cff' ? 'cubic Béziers' : 'quadratic Béziers'],
    ];
    if (font.entry) rows.unshift(['Typeface', `${font.entry.name}, ${font.entry.designer}, ${font.entry.year}`]);
    meta.replaceChildren(...rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
  }

  // ---- the strip: type here, click a letter to edit it -------------------

  let stripHits: { x0: number; x1: number; index: number }[] = [];

  function drawStrip() {
    const ot = font.ot;
    const r = strip.getBoundingClientRect();
    const W = Math.max(320, r.width), H = Math.max(80, r.height);
    strip.setAttribute('viewBox', `0 0 ${W} ${H}`);
    if (!ot) { strip.replaceChildren(); return; }

    const glyphs = ot.stringToGlyphs(text);
    const shaped = glyphs.map((g) => ({ g, ...mutate(g) }));
    const w = state.width / 100;
    let total = 0;
    shaped.forEach((sh, i) => { total += sh.adv + (i ? ot.getKerningValue(glyphs[i - 1], sh.g) * w : 0); });
    const pad = 24;
    const k = Math.min((H * 0.62) / (state.lines.asc - state.lines.desc), (W - 2 * pad) / Math.max(total, 1));
    const base = H * 0.5 + ((state.lines.asc + state.lines.desc) / 2) * k;
    let pen = Math.max(pad, (W - total * k) / 2);
    const els: SVGElement[] = [];
    stripHits = [];
    shaped.forEach((sh, i) => {
      if (i) pen += ot.getKerningValue(glyphs[i - 1], sh.g) * w * k;
      els.push(s('path', { d: pathData(sh.cmds, pen, base, k), class: `strip-glyph${sh.g.index === current ? ' is-current' : ''}` }));
      stripHits.push({ x0: pen, x1: pen + sh.adv * k, index: sh.g.index });
      pen += sh.adv * k;
    });
    els.push(s('line', { x1: pen + 3, x2: pen + 3, y1: base - state.lines.asc * k, y2: base - state.lines.desc * k, class: 'caret' }));
    strip.replaceChildren(...els);
  }

  strip.addEventListener('click', (e) => {
    const x = e.clientX - strip.getBoundingClientRect().left;
    const hit = stripHits.find((s) => x >= s.x0 && x <= s.x1);
    if (hit) { current = hit.index; draw(); }
  });
  strip.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Backspace') { text = Array.from(text).slice(0, -1).join(''); e.preventDefault(); }
    else if ([...e.key].length === 1) {
      text = (text + e.key).slice(-40);
      const g = font.ot?.charToGlyph(e.key);
      if (g && g.index !== 0) current = g.index;
      e.preventDefault();
    } else return;
    draw();
  });

  // ---- pointer -----------------------------------------------------------

  const local = (e: PointerEvent | WheelEvent | MouseEvent): Vec => {
    const r = editor.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  editor.addEventListener('pointerdown', (e) => {
    const ot = font.ot;
    if (!ot || (e.button !== 0 && e.button !== 1)) return;
    const t = e.target as SVGElement;
    const here = local(e);
    const startPan = () => { drag = { kind: 'pan', start: here, pan0: [...pan] }; };
    if (spaceHeld || e.button === 1) startPan();
    else if (t.dataset.line) drag = { kind: 'line', name: t.dataset.line as LineName };
    else if (t.dataset.adv != null) drag = { kind: 'adv', ox: view.ox };
    else if (tool === 'points' && t.dataset.key) drag = { kind: 'point', key: t.dataset.key };
    else if (tool === 'sculpt') {
      // Grab every point inside the brush, weighted by distance from its centre.
      const grabbed = screenPoints(ot.glyphs.get(current), view.ox)
        .map(({ p, at }) => ({ p, at, w: falloff(Math.hypot(at[0] - here[0], at[1] - here[1]) / brush) }))
        .filter((e) => e.w > 0);
      if (grabbed.length) drag = { kind: 'sculpt', start: here, grabbed };
      else startPan();
    } else startPan();
    if (drag?.kind !== 'pan') begin();
    editor.setPointerCapture(e.pointerId);
    root.classList.add('is-dragging');
    e.preventDefault();
    drawEditor();
  });

  editor.addEventListener('pointermove', (e) => {
    const ot = font.ot;
    cursor = local(e);
    if (!ot) return;
    if (!drag) { if (tool === 'sculpt') drawEditor(); return; }
    const [px, py] = cursor;
    const { k, base } = view;
    const toFont = (x: number, y: number): Vec => [(x - view.ox) / k, (base - y) / k];
    const g = ot.glyphs.get(current);
    const deltas = () => {
      let d = state.points.get(current);
      if (!d) state.points.set(current, (d = new Map()));
      return d;
    };

    if (drag.kind === 'pan') {
      pan = [drag.pan0[0] + px - drag.start[0], drag.pan0[1] + py - drag.start[1]];
      drawEditor();
      return;
    }
    if (drag.kind === 'line') {
      const L = state.lines, o = 20;
      // Lines keep their order, so the stretch stays a stretch.
      const range: Record<LineName, [number, number]> = {
        desc: [-ot.unitsPerEm, -o],
        x: [o * 2, L.asc - o],
        cap: [o * 2, ot.unitsPerEm * 1.4],
        asc: [L.x + o, ot.unitsPerEm * 1.4],
      };
      L[drag.name] = Math.round(clamp(toFont(px, py)[1], ...range[drag.name]));
    } else if (drag.kind === 'adv') {
      const want = (px - drag.ox) / k / (state.width / 100) - 2 * state.weight;
      state.advance.set(current, Math.round(Math.max(0, want) - (g.advanceWidth ?? 0)));
    } else if (drag.kind === 'sculpt') {
      const [dx, dy] = [px - drag.start[0], py - drag.start[1]];
      const d = deltas();
      for (const { p, w, at } of drag.grabbed) {
        d.set(p.key, deltaFor(g, p, ...toFont(at[0] + dx * w, at[1] + dy * w)));
      }
    } else {
      const key = drag.key;
      const p = pointsOf(g.path.commands[parseInt(key)], parseInt(key)).find((q) => q.key === key)!;
      const d = deltas();
      const old = d.get(key) ?? [0, 0];
      const next = deltaFor(g, p, ...toFont(px, py));
      d.set(key, next);
      const move: Vec = [next[0] - old[0], next[1] - old[1]];
      for (const f of followers(g.path.commands, key)) {
        const fd = d.get(f) ?? [0, 0];
        d.set(f, [fd[0] + move[0], fd[1] + move[1]]);
      }
    }
    draw();
  });

  const endDrag = () => {
    if (!drag) return;
    const wasPan = drag.kind === 'pan';
    drag = null;
    root.classList.remove('is-dragging');
    if (!wasPan) end();
    draw();
  };
  editor.addEventListener('pointerup', endDrag);
  editor.addEventListener('pointercancel', endDrag);
  editor.addEventListener('pointerleave', () => { if (!drag) { cursor = null; drawEditor(); } });
  // Double-click a line to put it back.
  editor.addEventListener('dblclick', (e) => {
    const name = (e.target as SVGElement).dataset.line as LineName | undefined;
    if (name) change(() => { state.lines[name] = original[name]; });
  });
  // Pinch or ⌘/Ctrl-scroll zooms at the cursor; Alt-scroll sizes the brush; plain scroll pans.
  editor.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // A mouse-wheel notch arrives as one large delta, a trackpad pinch as many small ones.
      const notch = e.deltaMode !== 0 || Math.abs(e.deltaY) >= 40;
      zoomAt(local(e), notch ? (e.deltaY < 0 ? 1.2 : 1 / 1.2) : Math.exp(-e.deltaY * 0.01));
    }
    else if (e.altKey) setBrush(brush * (e.deltaY > 0 ? 0.92 : 1.08));
    else { pan = [pan[0] - e.deltaX, pan[1] - e.deltaY]; drawEditor(); }
  }, { passive: false });

  /** Zoom by `factor`, keeping the font point under `at` (editor px) where it is. */
  function zoomAt(at: Vec, factor: number) {
    const next = clamp(zoom * factor, 0.25, 16);
    const c: Vec = [view.W / 2, view.H / 2];
    pan = [0, 1].map((i) => at[i] - c[i] - (at[i] - c[i] - pan[i]) * (next / zoom)) as Vec;
    zoom = next;
    drawEditor();
  }
  const centre = (): Vec => [view.W / 2, view.H / 2];
  function fit() { zoom = 1; pan = [0, 0]; drawEditor(); }
  function setBrush(v: number) {
    brush = Math.round(clamp(v, 20, 240));
    brushCtl.set(brush);
    drawEditor();
  }

  // Keys work whenever this playground is on screen, not only when something in it has focus.
  document.addEventListener('keydown', (e) => {
    if (!root.classList.contains('is-active') && !root.closest('.is-active')) return;
    const target = e.target as HTMLElement;
    if (target.closest('input:not([type="range"]), textarea, select, [contenteditable]')) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    const inStrip = !!target.closest('.glyph-strip');
    if (mod || !inStrip) {
      if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomAt(cursor ?? centre(), 1.25); return; }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAt(cursor ?? centre(), 0.8); return; }
      if (e.key === '0') { e.preventDefault(); fit(); return; }
    }
    if (inStrip || mod) return;
    if (e.key === ' ') { e.preventDefault(); spaceHeld = true; editor.classList.add('is-panning'); return; }
    if (e.key === '[') setBrush(brush * 0.85);
    if (e.key === ']') setBrush(brush * 1.15);
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === ' ') { spaceHeld = false; editor.classList.remove('is-panning'); }
  });

  // ---- glyph drawer ------------------------------------------------------

  function toggleDrawer() {
    drawer.hidden = !drawer.hidden;
    if (drawer.hidden || !font.ot) return;
    const ot = font.ot;
    drawer.replaceChildren(...Array.from({ length: Math.min(ot.numGlyphs, 600) }, (_, i) => {
      const g = ot.glyphs.get(i);
      const { cmds, adv } = mutate(g);
      const em = ot.unitsPerEm;
      return h('button', {
        type: 'button', class: 'glyph-cell', 'aria-pressed': String(i === current), title: g.name ?? `#${i}`,
        onclick: () => { current = i; drawer.hidden = true; draw(); },
      }, s('svg', { viewBox: `${(adv - em) / 2} ${-em * 0.85} ${em} ${em * 1.1}` },
        s('path', { d: pathData(cmds, 0, 0, 1) })));
    }));
  }

  // ---- output ------------------------------------------------------------

  function buildFont(): { built: Font; family: string } {
    const ot = font.ot!;
    const glyphs: Glyph[] = [];
    for (let i = 0; i < ot.numGlyphs; i++) {
      const g = ot.glyphs.get(i);
      const { cmds, adv } = mutate(g);
      const path = new Path();
      path.commands = cmds;
      const unicodes = (g.unicodes ?? []).filter((u) => u !== 0);   // 0 is reserved for .null
      glyphs.push(new Glyph({
        name: i === 0 ? '.notdef' : g.name && g.name !== '.null' ? g.name : `glyph${i}`,
        unicode: unicodes[0], unicodes, advanceWidth: Math.round(adv), path,
      }));
    }
    const { hhea } = metricTables(ot);
    const family = `${(ot.names.fontFamily?.en ?? font.name).replace(/ Lab( \d+)?$/, '')} Lab`;
    const built = new Font({
      familyName: family, styleName: 'Regular', unitsPerEm: ot.unitsPerEm,
      ascender: hhea.ascender, descender: hhea.descender, glyphs,
    });
    return { built, family };
  }

  function download() {
    if (!font.ot) return;
    const { built, family } = buildFont();
    const blob = new Blob([built.toArrayBuffer()], { type: 'font/otf' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `${family.replace(/\s+/g, '')}.otf` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  let builds = 0;
  async function useEverywhere() {
    if (!font.ot) return;
    const { built, family } = buildFont();
    const added = await addFont(`${family} ${++builds}`, built.toArrayBuffer());
    await fontStore.select(added.key);
    flash(`“${added.name}” is now the typeface in every playground.`);
  }

  // ---- wiring ------------------------------------------------------------

  load(font);
  fontStore.subscribe((f) => { if (f !== font) { load(f); layout(); draw(); } });
  new ResizeObserver(() => { layout(); draw(); }).observe(stage);
  layout();
  draw();
}
