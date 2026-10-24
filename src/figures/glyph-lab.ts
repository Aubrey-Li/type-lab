// Glyph playground: mutate a real font.
//
// Every edit is a delta on the original font, never a rewrite of it:
//   1. point edits: per glyph, per point key, an offset in font units
//   2. the font's lines (descender, x-height, cap height, ascender): moving one
//      remaps y piecewise-linearly between the lines, so the whole alphabet stretches
//   3. slant and width: a shear and a horizontal scale
// The original outline stays available as a ghost, and the result can be built
// into a real font file.
import { Font, Glyph, Path, type PathCommand } from 'opentype.js';
import { button, row, slider } from '../lib/controls';
import { clamp, fmt, h, s } from '../lib/dom';
import { fontPicker } from '../lib/font-picker';
import { addFont, fontStore, loadUpload, metricTables, type LoadedFont } from '../lib/fonts';

type LineName = 'asc' | 'cap' | 'x' | 'desc';
type Lines = Record<LineName, number>;
type Delta = [number, number];

interface State {
  lines: Lines;                                  // where the lines are now (font units)
  slant: number;                                 // degrees
  width: number;                                 // percent
  points: Map<number, Map<string, Delta>>;       // glyph index → point key → offset
  advance: Map<number, number>;                  // glyph index → advance offset
}

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
function pointsOf(c: PathCommand, i: number): { key: string; x: number; y: number; on: boolean }[] {
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

/** Points that travel with an on-curve point: its handles, and its twin where a contour closes on itself. */
function followers(cmds: PathCommand[], key: string): string[] {
  if (key.includes('c')) return [];
  const i = Number(key);
  const ends = [i];
  // A contour's last point often sits exactly on its first.
  let start = i;
  while (start > 0 && cmds[start].type !== 'M') start--;
  let end = i;
  while (end + 1 < cmds.length && cmds[end + 1].type !== 'M' && cmds[end + 1].type !== 'Z') end++;
  const at = (j: number) => cmds[j] as { x: number; y: number };
  if (i === start && end !== start && at(end).x === at(start).x && at(end).y === at(start).y) ends.push(end);
  if (i === end && end !== start && at(end).x === at(start).x && at(end).y === at(start).y) ends.push(start);

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

export function mountGlyphLab(root: HTMLElement) {
  let font: LoadedFont = fontStore.get();
  let original: Lines;
  let state: State;
  let current = 0;                 // glyph index being edited
  let text = 'Hamburgefonstiv';
  const history: string[] = [];

  // ---- the model ---------------------------------------------------------

  function reset(f: LoadedFont) {
    font = f;
    const ot = f.ot;
    original = ot ? measureLines(ot) : { asc: 700, cap: 680, x: 450, desc: -220 };
    state = { lines: { ...original }, slant: 0, width: 100, points: new Map(), advance: new Map() };
    current = ot ? Math.max(0, ot.charToGlyphIndex('a')) : 0;
    history.length = 0;
    slantCtl.set(0);
    widthCtl.set(100);
  }

  const snapshot = () => JSON.stringify({
    lines: state.lines, slant: state.slant, width: state.width,
    points: [...state.points].map(([g, m]) => [g, [...m]]), advance: [...state.advance],
  });
  function restore(json: string) {
    const o = JSON.parse(json);
    state = {
      lines: o.lines, slant: o.slant, width: o.width,
      points: new Map(o.points.map(([g, m]: [number, [string, Delta][]]) => [g, new Map(m)])),
      advance: new Map(o.advance),
    };
    slantCtl.set(state.slant);
    widthCtl.set(state.width);
  }
  const remember = () => { history.push(snapshot()); if (history.length > 200) history.shift(); };

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

  /** Original point → where it is drawn now, in font units. */
  function transformer(g: Glyph) {
    const map = mapY(g);
    const deltas = state.points.get(g.index);
    const tan = Math.tan((state.slant * Math.PI) / 180), w = state.width / 100;
    return (x: number, y: number, key: string): [number, number] => {
      const d = deltas?.get(key);
      if (d) { x += d[0]; y += d[1]; }
      const Y = map(y);
      return [(x + Y * tan) * w, Y];
    };
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
    const adv = ((g.advanceWidth ?? 0) + (state.advance.get(g.index) ?? 0)) * (state.width / 100);
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

  const slantCtl = slider({ label: 'Slant', min: -20, max: 20, value: 0, format: (v) => `${v}°`,
    onInput: (v) => { state.slant = v; draw(); } });
  const widthCtl = slider({ label: 'Width', min: 50, max: 180, value: 100, format: (v) => `${v}%`,
    onInput: (v) => { state.width = v; draw(); } });
  // One undo step per slider gesture.
  for (const ctl of [slantCtl, widthCtl]) ctl.el.addEventListener('pointerdown', remember);

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
      slantCtl.el, widthCtl.el,
      h('span', { class: 'tool-group' },
        button('Glyphs', () => toggleDrawer()),
        button('Undo', () => undo()),
        button('Reset', () => { remember(); reset(font); draw(); })),
      h('span', { class: 'tool-group tool-end' },
        button('Download', () => download()),
        button('Use everywhere', () => void useEverywhere())),
    ),
  );

  // ---- the editor --------------------------------------------------------

  const editor = s('svg', { class: 'glyph-editor', role: 'application', 'aria-label': 'Glyph editor: drag points and lines' });
  const strip = s('svg', { class: 'glyph-strip', tabindex: 0, role: 'textbox', 'aria-label': 'Specimen text: type to change it, click a letter to edit it' });
  const drawer = h('div', { class: 'glyph-drawer', hidden: true });
  const meta = h('dl', { class: 'meta info-only' });
  const stage = h('div', { class: 'glyph-stage' }, editor, drawer, meta);
  root.append(tools, stage, h('div', { class: 'strip-wrap' }, strip), notice);

  let view = { W: 800, H: 500, k: 0.4, base: 300, ox: 0 };
  let drag: null | { kind: 'point'; key: string } | { kind: 'line'; name: LineName } | { kind: 'adv'; ox: number } = null;

  function layout() {
    const r = editor.getBoundingClientRect();
    const W = Math.max(320, r.width), H = Math.max(240, r.height);
    editor.setAttribute('viewBox', `0 0 ${W} ${H}`);
    // Scale from the original lines, so dragging a line does not rescale the view.
    const span = original.asc - original.desc;
    const k = (H * 0.8) / span;
    view = { ...view, W, H, k, base: H * 0.1 + original.asc * k };
  }

  function draw() {
    drawEditor();
    drawStrip();
  }

  function drawEditor() {
    const ot = font.ot;
    if (!ot) {
      editor.replaceChildren(s('text', { x: 24, y: 40, class: 'svg-label is-hl' }, (font.parseError ?? 'This font cannot be edited').toUpperCase()));
      return;
    }
    const g = ot.glyphs.get(current);
    const { cmds, adv } = mutate(g);
    const { W, k, base } = view;
    const ox = drag?.kind === 'adv' ? drag.ox : (W - adv * k) / 2;
    view.ox = ox;
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

    // Handles and points.
    const P = (x: number, y: number): [number, number] => [ox + x * k, base - y * k];
    const handles: SVGElement[] = [], dots: SVGElement[] = [];
    let prev: [number, number] | null = null;
    cmds.forEach((c, i) => {
      if (c.type === 'Z') return;
      const end = P(c.x, c.y);
      const link = (a: [number, number], b: [number, number]) =>
        handles.push(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'handle' }));
      if (c.type === 'Q') { const c1 = P(c.x1, c.y1); if (prev) link(prev, c1); link(c1, end); }
      if (c.type === 'C') { const c1 = P(c.x1, c.y1), c2 = P(c.x2, c.y2); if (prev) link(prev, c1); link(c2, end); }
      for (const p of pointsOf(c, i)) {
        const [x, y] = P(p.x, p.y);
        const hot = drag?.kind === 'point' && drag.key === p.key;
        dots.push(p.on
          ? s('rect', { x: x - 4.5, y: y - 4.5, width: 9, height: 9, class: `pt-on${hot ? ' is-hot' : ''}`, 'data-key': p.key })
          : s('circle', { cx: x, cy: y, r: 4.5, class: `pt-off${hot ? ' is-hot' : ''}`, 'data-key': p.key }));
      }
      prev = end;
    });
    editor.replaceChildren(...els, ...handles, ...dots);
    renderMeta(g, adv);
  }

  function renderMeta(g: Glyph, adv: number) {
    const ot = font.ot!;
    const rows: [string, string][] = [
      ['Glyph', `${g.name ?? '—'}${g.unicode != null ? ` · U+${g.unicode.toString(16).toUpperCase().padStart(4, '0')}` : ''}`],
      ['Advance', `${fmt(adv, 0)} of ${ot.unitsPerEm} units per em`],
      ['Points', `${g.path.commands.filter((c) => c.type !== 'Z').length} commands`],
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
    shaped.forEach((sh, i) => {
      total += sh.adv + (i ? ot.getKerningValue(glyphs[i - 1], sh.g) * w : 0);
    });
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
    const x = (e.clientX - strip.getBoundingClientRect().left) * (Number(strip.viewBox.baseVal.width) / strip.getBoundingClientRect().width);
    const hit = stripHits.find((s) => x >= s.x0 && x <= s.x1);
    if (hit) { current = hit.index; draw(); }
  });
  strip.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Backspace') { text = Array.from(text).slice(0, -1).join(''); e.preventDefault(); }
    else if (e.key.length === 1 || [...e.key].length === 1) {
      text = (text + e.key).slice(-40);
      const g = font.ot?.charToGlyph(e.key);
      if (g && g.index !== 0) current = g.index;
      e.preventDefault();
    } else return;
    draw();
  });

  // ---- dragging ----------------------------------------------------------

  const toSvg = (e: PointerEvent): [number, number] => {
    const r = editor.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  editor.addEventListener('pointerdown', (e) => {
    const t = e.target as SVGElement;
    if (t.dataset.key) drag = { kind: 'point', key: t.dataset.key };
    else if (t.dataset.line) drag = { kind: 'line', name: t.dataset.line as LineName };
    else if (t.dataset.adv != null) drag = { kind: 'adv', ox: view.ox };
    else return;
    remember();
    editor.setPointerCapture(e.pointerId);
    root.classList.add('is-dragging');
    e.preventDefault();
    drawEditor();
  });

  editor.addEventListener('pointermove', (e) => {
    const ot = font.ot;
    if (!drag || !ot) return;
    const [px, py] = toSvg(e);
    const { k, base } = view;
    const fy = (base - py) / k;
    const g = ot.glyphs.get(current);

    if (drag.kind === 'line') {
      const L = state.lines, o = 20;
      // Lines keep their order, so the stretch stays a stretch.
      const range: Record<LineName, [number, number]> = {
        desc: [-ot.unitsPerEm, -o],
        x: [o * 2, L.asc - o],
        cap: [o * 2, ot.unitsPerEm * 1.4],
        asc: [L.x + o, ot.unitsPerEm * 1.4],
      };
      L[drag.name] = Math.round(clamp(fy, ...range[drag.name]));
    } else if (drag.kind === 'adv') {
      const orig = g.advanceWidth ?? 0;
      const want = (px - drag.ox) / k / (state.width / 100);
      state.advance.set(current, Math.round(Math.max(0, want) - orig));
    } else {
      // Undo the line stretch, slant and width to find where the point must be in the original.
      const fx = (px - view.ox) / k;
      const tan = Math.tan((state.slant * Math.PI) / 180), w = state.width / 100;
      const oy = unmapY(g)(fy);
      const ox = fx / w - fy * tan;
      const key = drag.key;
      const base0 = pointsOf(g.path.commands[parseInt(key)], parseInt(key)).find((p) => p.key === key)!;
      let deltas = state.points.get(current);
      if (!deltas) state.points.set(current, (deltas = new Map()));
      const old = deltas.get(key) ?? [0, 0];
      const next: Delta = [ox - base0.x, oy - base0.y];
      deltas.set(key, next);
      const move: Delta = [next[0] - old[0], next[1] - old[1]];
      for (const f of followers(g.path.commands, key)) {
        const d = deltas.get(f) ?? [0, 0];
        deltas.set(f, [d[0] + move[0], d[1] + move[1]]);
      }
    }
    draw();
  });

  const endDrag = () => {
    if (!drag) return;
    drag = null;
    root.classList.remove('is-dragging');
    draw();
  };
  editor.addEventListener('pointerup', endDrag);
  editor.addEventListener('pointercancel', endDrag);
  // Double-click a line to put it back.
  editor.addEventListener('dblclick', (e) => {
    const name = (e.target as SVGElement).dataset.line as LineName | undefined;
    if (!name) return;
    remember();
    state.lines[name] = original[name];
    draw();
  });

  function undo() {
    const last = history.pop();
    if (last) { restore(last); draw(); }
  }
  root.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); }
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

  reset(font);
  fontStore.subscribe((f) => { if (f !== font) { reset(f); layout(); draw(); } });
  new ResizeObserver(() => { layout(); draw(); }).observe(stage);
  layout();
  draw();
}
