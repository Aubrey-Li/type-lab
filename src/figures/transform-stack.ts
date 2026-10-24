// Frame → line → segment → glyph. Every glyph is drawn with
//   M = F · L · W · P · S
// and an animation term A is inserted at whichever level it animates.
import { button, checkbox, row, segmented, slider } from '../lib/controls';
import { clamp, fmt, h, s } from '../lib/dom';
import { fontPicker } from '../lib/font-picker';
import { fontStore, measureText } from '../lib/fonts';
import { IDENTITY, about, apply, compose, formatMat, rotate, scale, toSvg, translate, type Mat } from '../lib/matrix';

const SIZE = 80;            // point size the text is set at
const UNITS = 100;          // glyphs are drawn at this size, then scaled by S
const LEADING = 1.3 * SIZE;
const CENTER: [number, number] = [480, 240];

type Level = 'frame' | 'line' | 'segment' | 'glyph';
type Effect = 'none' | 'wave' | 'spin' | 'scatter' | 'pulse';

const LEVEL_SYMBOL: Record<Level, string> = { frame: 'F', line: 'L', segment: 'W', glyph: 'P' };

interface GlyphBox { ch: string; index: number; x: number; w: number }        // px within its segment, before hscale
interface Segment { text: string; index: number; x: number; w: number; glyphs: GlyphBox[] }
interface LineBox { index: number; w: number; segments: Segment[] }

// Deterministic per-index randomness so scatter looks the same every frame.
const rand = (n: number, k: number) => {
  const v = Math.sin((n + 1) * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

function effect(kind: Effect, n: number, t: number, cx: number, cy: number): Mat {
  const TAU = Math.PI * 2;
  switch (kind) {
    case 'wave': return translate(0, -12 * Math.sin(TAU * t + n * 0.7));
    case 'spin': return about(rotate(360 * clamp(t * 1.5 - n * 0.07, 0, 1)), cx, cy);
    case 'pulse': return about(scale(1 + 0.22 * Math.sin(TAU * t + n * 0.7)), cx, cy);
    case 'scatter': {
      const e = Math.sin(Math.PI * t);
      return compose(
        translate((rand(n, 0) - 0.5) * 120 * e, (rand(n, 1) - 0.5) * 90 * e),
        about(rotate((rand(n, 2) - 0.5) * 110 * e), cx, cy),
      );
    }
    default: return IDENTITY;
  }
}

export function mountTransformStack(root: HTMLElement) {
  const state = {
    text: 'Every glyph\nhas a matrix',
    level: 'glyph' as Level,
    effect: 'wave' as Effect,
    t: 0.3,
    frameRot: 0,
    hscale: 100,
    onPath: false,
    sel: 0,
    playing: false,
  };

  const timeCtl = slider({ label: 'Time', min: 0, max: 1, step: 0.01, value: state.t, format: (v) => v.toFixed(2),
    onInput: (v) => { state.t = v; render(); } });
  const playBtn = button('Play', () => toggle());
  const textArea = h('textarea', { class: 'text-area', rows: 2, 'aria-label': 'Text', spellcheck: 'false',
    oninput: () => { state.text = textArea.value; render(); } });
  textArea.value = state.text;

  const controls = h('div', { class: 'controls' },
    row(
      segmented<Level>({ label: 'Animate the', options: [
        { value: 'frame', label: 'Frame' }, { value: 'line', label: 'Line' },
        { value: 'segment', label: 'Segment' }, { value: 'glyph', label: 'Glyph' },
      ], value: state.level, onChange: (v) => { state.level = v; render(); } }).el,
    ),
    row(
      segmented<Effect>({ label: 'With', options: [
        { value: 'none', label: 'None' }, { value: 'wave', label: 'Wave' }, { value: 'spin', label: 'Spin' },
        { value: 'scatter', label: 'Scatter' }, { value: 'pulse', label: 'Pulse' },
      ], value: state.effect, onChange: (v) => { state.effect = v; render(); } }).el,
      timeCtl.el, playBtn,
    ),
    row(
      slider({ label: 'Frame rotation', min: -180, max: 180, value: 0, format: (v) => `${v}°`,
        onInput: (v) => { state.frameRot = v; render(); } }).el,
      slider({ label: 'Horizontal scale', min: 50, max: 200, value: 100, format: (v) => `${v}%`,
        onInput: (v) => { state.hscale = v; render(); } }).el,
      checkbox({ label: 'On a path', checked: false, onChange: (v) => { state.onPath = v; render(); } }).el,
    ),
    row(fontPicker(), h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Text'), textArea)),
  );

  const svg = s('svg', { viewBox: '170 80 620 320', class: 'tstack', role: 'img', 'aria-label': 'Text with per-glyph transforms' });
  const readout = h('div', { class: 'readout' });
  root.append(controls, h('div', { class: 'split' }, h('div', { class: 'stage' }, svg), readout));

  svg.addEventListener('click', (e) => {
    const i = (e.target as Element).closest<SVGElement>('.glyph')?.dataset.i;
    if (i != null) { state.sel = Number(i); render(); }
  });

  let raf = 0, last = 0;
  function toggle() {
    state.playing = !state.playing;
    playBtn.textContent = state.playing ? 'Pause' : 'Play';
    if (state.playing) { last = performance.now(); raf = requestAnimationFrame(tick); }
    else cancelAnimationFrame(raf);
  }
  function tick(now: number) {
    // Stop when the visitor has moved on to another scene.
    if (!root.closest('.scene')?.classList.contains('is-active')) { toggle(); return; }
    state.t = (state.t + (now - last) / 4000) % 1;
    last = now;
    timeCtl.set(state.t);
    render();
    if (state.playing) raf = requestAnimationFrame(tick);
  }

  function layout(family: string): LineBox[] {
    const space = measureText(family, UNITS, ' ').width;
    let segIndex = 0, glyphIndex = 0;
    return state.text.split('\n').filter((l) => l.trim()).slice(0, 4).map((lineText, li) => {
      let x = 0;
      const segments = lineText.trim().split(/\s+/).map((word) => {
        const chars = Array.from(word);
        let prefix = '';
        const glyphs = chars.map((ch) => {
          // Measuring prefixes keeps kerning between neighbours.
          const gx = measureText(family, UNITS, prefix).width;
          prefix += ch;
          return { ch, index: glyphIndex++, x: gx, w: measureText(family, UNITS, prefix).width - gx };
        });
        const w = measureText(family, UNITS, word).width;
        const seg = { text: word, index: segIndex++, x, w, glyphs };
        x += w + space;
        return seg;
      });
      return { index: li, w: x - space, segments };
    });
  }

  function render() {
    const font = fontStore.get();
    const lines = layout(font.family);
    const k = SIZE / UNITS;                     // font px → layout px
    const hs = state.hscale / 100;
    const S = scale(k * hs, k);
    const anim = (lvl: Level, n: number, cx: number, cy: number) =>
      state.level === lvl ? effect(state.effect, n, state.t, cx, cy) : IDENTITY;
    const glyphCount = lines.reduce((n, l) => n + l.segments.reduce((m, sg) => m + sg.glyphs.length, 0), 0);
    state.sel = clamp(state.sel, 0, Math.max(0, glyphCount - 1));

    const blockW = Math.max(...lines.map((l) => l.w * k * hs), 0);
    const blockH = (lines.length - 1) * LEADING + SIZE;
    const pad = 28;

    const F = compose(translate(...CENTER), rotate(state.frameRot));
    const Af = anim('frame', 0, 0, 0);
    const FA = compose(F, Af);
    const els: SVGElement[] = [];
    const frameBox = s('rect', { x: -blockW / 2 - pad, y: -blockH / 2 - pad, width: blockW + 2 * pad, height: blockH + 2 * pad,
      class: `box${state.level === 'frame' ? ' is-hl' : ''}`, transform: toSvg(FA) });
    els.push(frameBox);

    let selInfo: { rows: [string, string, Mat, boolean?][]; ch: string; line: number } | null = null;

    for (const line of lines) {
      const lw = line.w * k * hs;
      const L = translate(-lw / 2, -blockH / 2 + 0.78 * SIZE + line.index * LEADING);
      const Al = anim('line', line.index, lw / 2, -0.3 * SIZE);
      const FL = compose(FA, L, Al);
      const containsSel = line.segments.some((sg) => sg.glyphs.some((g) => g.index === state.sel));

      // The baseline: straight, or a gentle arc in line space.
      const bend = 0.16 * lw;
      const pathD = state.onPath ? `M 0 0 Q ${lw / 2} ${-2 * bend} ${lw} 0` : `M 0 0 L ${lw} 0`;
      const baseline = s('path', { d: pathD, class: `guide${state.level === 'line' && containsSel ? ' is-hl' : ''}`, transform: toSvg(FL) });
      els.push(baseline);
      svg.append(baseline);  // must be in the document to measure
      const len = baseline.getTotalLength();
      const startAt = (len - lw) / 2;
      const along = (d: number) => {
        const p = baseline.getPointAtLength(clamp(d, 0, len));
        const q = baseline.getPointAtLength(clamp(d + 0.5, 0, len));
        const r = baseline.getPointAtLength(clamp(d - 0.5, 0, len));
        return { x: p.x, y: p.y, deg: (Math.atan2(q.y - r.y, q.x - r.x) * 180) / Math.PI };
      };

      for (const seg of line.segments) {
        const sx = seg.x * k * hs, sw = seg.w * k * hs;
        // On a path a segment has no straight offset: its glyphs are placed by distance along the curve.
        const W = state.onPath ? IDENTITY : translate(sx, 0);
        const mid = state.onPath ? along(startAt + sx + sw / 2) : { x: sw / 2, y: 0 };
        const Aw = anim('segment', seg.index, mid.x, mid.y - 0.3 * SIZE);
        const FLW = compose(FL, W, Aw);
        const segSel = seg.glyphs.some((g) => g.index === state.sel);
        if (!state.onPath && state.level === 'segment') {
          els.push(s('rect', { x: 0, y: -0.78 * SIZE, width: sw, height: SIZE,
            class: `box${segSel ? ' is-hl' : ''}`, transform: toSvg(FLW) }));
        }

        for (const g of seg.glyphs) {
          const gx = g.x * k * hs, gw = g.w * k * hs;
          let P: Mat;
          let placement: string;
          if (state.onPath) {
            const p = along(startAt + sx + gx + gw / 2);
            P = compose(translate(p.x, p.y), rotate(p.deg), translate(-gw / 2, 0));
            placement = `on the path, ${fmt(sx + gx)} along it, tangent ${fmt(p.deg)}°`;
          } else {
            P = translate(gx, 0);
            placement = `${fmt(gx)} into its segment`;
          }
          const Ag = anim('glyph', g.index, gw / 2, -0.3 * SIZE);
          const M = compose(FLW, P, Ag, S);
          const isSel = g.index === state.sel;
          els.push(s('text', { class: `glyph${isSel ? ' is-sel' : ''}`, 'data-i': g.index, 'font-size': UNITS,
            style: `font-family:"${font.family}"`, transform: toSvg(M) }, g.ch));

          if (isSel) {
            // Glyph axes, in font units, mapped through M.
            const o = apply(M, 0, 0), ax = apply(M, 70, 0), ay = apply(M, 0, -70);
            els.push(
              s('line', { x1: o[0], y1: o[1], x2: ax[0], y2: ax[1], class: 'leader' }),
              s('line', { x1: o[0], y1: o[1], x2: ay[0], y2: ay[1], class: 'leader' }),
              s('circle', { cx: o[0], cy: o[1], r: 3.5, class: 'accent-fill' }),
              s('text', { x: ax[0] + 4, y: ax[1] + 4, class: 'svg-num', style: 'fill: var(--accent)' }, 'x'),
              s('text', { x: ay[0] - 4, y: ay[1] - 4, class: 'svg-num', style: 'fill: var(--accent)' }, 'y'),
            );
            const A = (lvl: Level, m: Mat): [string, string, Mat, boolean] =>
              [`A${LEVEL_SYMBOL[lvl].toLowerCase()}`, `animation on the ${lvl}: ${state.effect} at t = ${state.t.toFixed(2)}`, m, true];
            const rows: [string, string, Mat, boolean?][] = [
              ['F', `frame: centred at (${CENTER.join(', ')}), rotated ${state.frameRot}°`, F],
            ];
            if (state.level === 'frame') rows.push(A('frame', Af));
            rows.push(['L', `line ${line.index}: baseline ${fmt(L[5])} from the frame centre`, L]);
            if (state.level === 'line') rows.push(A('line', Al));
            rows.push(['W', state.onPath ? 'segment: folded into P on a path' : `segment “${seg.text}”: ${fmt(sx)} along the line`, W]);
            if (state.level === 'segment') rows.push(A('segment', Aw));
            rows.push(['P', `placement: ${placement}`, P]);
            if (state.level === 'glyph') rows.push(A('glyph', Ag));
            rows.push(['S', `glyph scale: ${SIZE} pt × ${state.hscale}% from a ${UNITS}-unit em`, S]);
            rows.push(['M', 'what the glyph outline is drawn with', M]);
            selInfo = { rows, ch: g.ch, line: line.index };
          }
        }
      }
    }
    svg.replaceChildren(...els);

    readout.replaceChildren();
    if (selInfo) {
      const { rows, ch, line } = selInfo;
      const chain = rows.filter(([sym]) => sym !== 'M').map(([sym]) => sym).join(' · ');
      readout.append(h('span', { class: 'k' }, `Glyph ${state.sel} “${ch}”, line ${line}`), `    M = ${chain}\n\n`);
      for (const [sym, desc, m, hot] of rows) {
        readout.append(h('span', { class: 'k' }, sym.padEnd(4)), h('span', { class: hot ? 'hl' : null }, desc), '\n',
          `    ${formatMat(m)}\n`);
      }
    }
  }

  fontStore.subscribe(render);
  render();
}
