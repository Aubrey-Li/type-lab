// The Pieces playground: take Chinese, Japanese and Korean characters apart
// (分解, bunkai) and animate the parts on their own. A character comes apart
// into its structural parts (語 → 言 | 吾) or the connected pieces of the font's
// outline, ordered by stroke order. Every effect is a loop: the parts
// arrive one after another, hold as the character, then leave in reverse.
// Drag any part out of its character; it stays where you put it.
import { button, checkbox, row, segmented, select, slider } from '../lib/controls';
import { clamp, fmt, h, s, uid } from '../lib/dom';
import { CJK_FONTS } from '../lib/cjk-fonts';
import { STROKE_CREDITS, breakdown, type Breakdown, type Part, type Split } from '../lib/bunkai';
import { about, apply, compose, rotate, scale, toSvg, translate, type Mat } from '../lib/matrix';

type Effect = 'assemble' | 'explode' | 'slide' | 'drop' | 'swirl';
type Order = 'writing' | 'random' | 'centre';

const LOOP_MS = 5600;
const GAP = 140;          // between characters, in em units (1000 to the em)
const LEAD = 1350;        // baseline to baseline
const PAD = 300;          // around the text
const TAU = Math.PI * 2;

const rand = (n: number, k: number) => {
  const v = Math.sin((n + 1) * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

const easeOutQuart = (p: number) => 1 - (1 - p) ** 4;
const easeInOut = (p: number) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
const easeOutBack = (p: number) => 1 + 2.4 * (p - 1) ** 3 + 1.4 * (p - 1) ** 2;
function easeOutBounce(p: number) {
  const n = 7.5625, d = 2.75;
  if (p < 1 / d) return n * p * p;
  if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
  if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
  return n * (p -= 2.625 / d) * p + 0.984375;
}

/** How built the text is at time t: arriving, holding, leaving in reverse, then a beat of empty page. */
function built(t: number) {
  if (t < 0.42) return t / 0.42;
  if (t < 0.66) return 1;
  if (t < 0.9) return 1 - (t - 0.66) / 0.24;
  return 0;
}

/**
 * A part's pose: its motion (about its home), how visible it is, and how far it is
 * from home along its journey (1 where it starts, 0 at rest; easing may overshoot
 * either way). A start and end moved by hand are blended by that same amount.
 */
interface Pose { m: Mat; opacity: number; away: number }

/** Where a part is when it is p of the way home (p = 1: in place). (cx, cy) is its character's centre. */
function pose(effect: Exclude<Effect, 'explode'>, part: Part, cx: number, cy: number, p: number, seed: number): Pose {
  const here = p > 0 ? 1 : 0;
  switch (effect) {
    case 'assemble': {
      // From anywhere, turned and resized; overshoots and settles.
      const w = 1 - easeOutBack(p);
      const a = rand(seed, 0) * TAU, d = (700 + 700 * rand(seed, 1)) * w;
      const spin = compose(rotate((rand(seed, 2) - 0.5) * 320 * w), scale(1 + (rand(seed, 3) - 0.5) * 0.9 * w));
      return { m: compose(translate(Math.cos(a) * d, Math.sin(a) * d), about(spin, part.cx, part.cy)), opacity: clamp(p * 2.5, 0, 1), away: w };
    }
    case 'slide': {
      // Out of the side of its own window, the way the structure divides it.
      const w = 1 - easeOutQuart(p);
      const span = part.axis === 'x' ? part.box.x1 - part.box.x0 : part.box.y1 - part.box.y0;
      const d = part.side * (span + 40) * w;
      return { m: part.axis === 'x' ? translate(d, 0) : translate(0, d), opacity: here, away: w };
    }
    case 'drop': {
      const w = 1 - easeOutBounce(p);
      return {
        m: compose(translate(0, -(part.cy + 700 + 400 * rand(seed, 0)) * w), about(rotate((rand(seed, 1) - 0.5) * 60 * w), part.cx, part.cy)),
        opacity: here, away: w,
      };
    }
    case 'swirl': {
      // Spun in around the middle of the character, growing as it lands.
      const w = 1 - easeInOut(p);
      const turn = (seed % 2 ? 1 : -1) * (160 + 140 * rand(seed, 0)) * w;
      return {
        m: compose(about(compose(rotate(turn), scale(1 + 0.7 * w)), cx, cy), about(scale(Math.max(0.05, 1 - 0.85 * w)), part.cx, part.cy)),
        opacity: clamp(1 - w, 0, 1), away: w,
      };
    }
  }
}

// ---- Explode: four beats, the way an explosion is cut in film --------------------
// The character holds, then trembles and draws in (the charge); bursts, every part
// flung out fast and braking hard, smeared along its path, the nearer ones growing
// and the farther ones dimming; drifts on in slow motion; and is pulled back
// together, winding up before it snaps home. A shockwave leaves each character as
// it bursts, and the whole frame takes the hit. With a stagger the bursts run
// across the text in the chosen order, a chain reaction.
const EXPLODE_MS = 6800;
const EX = { charge: 0.12, burst: 0.3, drift: 0.68, back: 0.94 };
const SHOCK = 0.14;                 // how long a shockwave takes to spread and fade

/** When a part bursts. */
const burstAt = (rank: number, S: number) => EX.burst + rank * S * 0.12;

/** How far out a part is, τ after it burst: most of the way at once, braking hard, then a slow drift. */
const flight = (tau: number) => 0.8 * (1 - Math.exp(-tau / 0.03)) + 0.2 * Math.min(1, tau / (EX.drift - EX.burst));

function easeInOutBack(p: number) {
  const c = 1.6 * 1.525;
  return p < 0.5 ? ((2 * p) ** 2 * ((c + 1) * 2 * p - c)) / 2 : ((2 * p - 2) ** 2 * ((c + 1) * (2 * p - 2) + c) + 2) / 2;
}

function explosion(part: Part, cx: number, cy: number, t: number, seed: number, rank: number, S: number): Pose & { out: number } {
  const len = Math.hypot(part.cx - cx, part.cy - cy);
  // Out from the middle of its character, not quite straight: debris scatters.
  const a = (len < 30 ? rand(seed, 0) * TAU : Math.atan2(part.cy - cy, part.cx - cx)) + (rand(seed, 4) - 0.5) * 0.7;
  const dx = Math.cos(a), dy = Math.sin(a);
  const z = rand(seed, 5) * 2 - 1;                        // depth: −1 away from the camera, +1 towards it
  const reach = (240 + 0.9 * Math.min(len, 500)) * (0.75 + 0.5 * rand(seed, 1)) * (1 + 0.3 * z);   // stays in shot
  const spin = (rand(seed, 2) < 0.5 ? -1 : 1) * (30 + 150 * rand(seed, 3));
  const t0 = burstAt(rank, S);

  if (t < t0) {
    // The charge: a tremble that grows, and a pull inward, just before it goes.
    const k = clamp((t - (t0 - EX.charge)) / EX.charge, 0, 1) ** 2;
    const j = 7 * k;
    return { m: translate(Math.sin(t * 2300 + seed * 7) * j - dx * 18 * k, Math.cos(t * 2900 + seed * 3) * j - dy * 18 * k), opacity: 1, out: 0, away: 0 };
  }
  const backFrom = EX.drift + rank * S * 0.14, backFor = EX.back - EX.drift - S * 0.14;
  let w: number, smear: number;
  if (t < backFrom) {
    w = flight(t - t0);
    smear = 0.7 * Math.exp(-(t - t0) / 0.025);         // stretched along its path while it is fast
  } else {
    const b = clamp((t - backFrom) / backFor, 0, 1);
    w = flight(backFrom - t0) * (1 - easeInOutBack(b));  // winds up past its farthest, then overshoots home
    smear = 0.35 * Math.sin(Math.PI * b);
  }
  const dir = (a * 180) / Math.PI, near = Math.min(Math.max(w, 0), 1);
  const body = compose(
    rotate(dir), scale(1 + smear, 1 / (1 + smear * 0.6)), rotate(-dir),
    rotate(spin * w), scale(Math.max(0.2, 1 + 0.35 * z * near)),
  );
  return {
    m: compose(translate(dx * reach * w, dy * reach * w), about(body, part.cx, part.cy)),
    opacity: clamp(1 - 0.45 * Math.max(0, -z) * near, 0, 1),
    out: near,
    away: w,
  };
}

interface Item {
  part: Part;
  key: string;
  seed: number;
  rank: number;
  x: number; y: number;          // the character's origin
  ccx: number; ccy: number;       // the character's centre, in its own coordinates
  ci: number; pi: number; of: number;
  pos: SVGGElement;               // at its character
  end: SVGGElement;               // moved to where it lands (its end), if moved by hand
  anim: SVGGElement;              // the effect's motion, and the way from its start to its end
  ink: SVGPathElement;
  win: string;                    // the window it slides out of
  leader: SVGLineElement;
}

type Pt = [number, number];
type Endpoint = 'start' | 'end';

interface Cell { ch: string; x: number; y: number; bd: Breakdown | null }

const SHAPES: Record<string, string> = {
  '⿰': 'left | right', '⿲': 'left | middle | right', '⿱': 'top / bottom', '⿳': 'top / middle / bottom',
};

const attr = (el: Element, name: string, value: string | false) =>
  (value === false ? el.removeAttribute(name) : el.setAttribute(name, value));
const show = (el: SVGElement, on: boolean) => attr(el, 'display', !on && 'none');

export function mountPiecesLab(root: HTMLElement) {
  const state = {
    text: '拆字解谜',
    font: 'noto-serif-sc',
    split: 'parts' as Split,
    effect: 'assemble' as Effect,
    order: 'writing' as Order,
    stagger: 0.55,
    ghost: true,
    t: 0.55,
    playing: false,
    sel: null as string | null,
    // Moved by hand, per part: where it starts and where it lands, as offsets
    // from the effect's own start and from home.
    starts: new Map<string, Pt>(),
    ends: new Map<string, Pt>(),
  };

  // ---- controls ----------------------------------------------------------

  const timeCtl = slider({ label: 'Time', min: 0, max: 1, step: 0.01, value: state.t, format: (v) => v.toFixed(2),
    onInput: (v) => { state.t = v; frame(); } });
  const playBtn = button('Play', () => toggle());
  const putBack = button('Put back', () => { forget(); frame(); describe(); });
  const textArea = h('textarea', { class: 'text-area pc-text', rows: 2, 'aria-label': 'Text', spellcheck: 'false' });
  textArea.value = state.text;
  let typing = 0;
  textArea.addEventListener('input', () => {
    clearTimeout(typing);
    typing = window.setTimeout(() => { state.text = textArea.value; forget(); state.sel = null; relayout(); }, 220);
  });

  const LANG_LABELS: Record<string, string> = { 'zh-Hans': '简体中文', 'zh-Hant': '繁體中文', ja: '日本語', ko: '한국어' };
  const fontCtl = select({
    label: 'Typeface',
    groups: Object.entries(LANG_LABELS).map(([lang, label]) => ({
      label, options: CJK_FONTS.filter((f) => f.lang === lang).map((f) => ({ value: f.id, label: f.name })),
    })),
    value: state.font,
    onChange: (v) => { state.font = v; forget(); relayout(); },
  });

  const orderCtl = segmented<Order>({ label: 'Order', options: [
    { value: 'writing', label: 'Writing' }, { value: 'random', label: 'Random' }, { value: 'centre', label: 'Centre out' },
  ], value: state.order, onChange: (v) => { state.order = v; ranks(); frame(); } });
  const staggerCtl = slider({ label: 'Stagger', min: 0, max: 1, step: 0.01, value: state.stagger, format: (v) => `${Math.round(v * 100)}%`,
    onInput: (v) => { state.stagger = v; frame(); } });

  const controls = h('div', { class: 'controls' },
    row(
      segmented<Split>({ label: 'Take apart into', options: [
        { value: 'parts', label: 'Parts' }, { value: 'pieces', label: 'Pieces' },
      ], value: state.split, onChange: (v) => { state.split = v; state.sel = null; relayout(); } }).el,
      checkbox({ label: 'Ghost', checked: state.ghost, onChange: (v) => { state.ghost = v; show(ghostLayer, v); } }).el,
      putBack,
    ),
    row(
      segmented<Effect>({ label: 'Effect', options: [
        { value: 'assemble', label: 'Assemble' }, { value: 'explode', label: 'Explode' }, { value: 'slide', label: 'Slide' },
        { value: 'drop', label: 'Drop' }, { value: 'swirl', label: 'Swirl' },
      ], value: state.effect, onChange: (v) => { state.effect = v; modes(); frame(); } }).el,
      timeCtl.el, playBtn,
    ),
    row(orderCtl.el, staggerCtl.el),
    row(fontCtl.el, h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Text'), textArea)),
  );

  const defs = s('defs');
  const shockLayer = s('g');
  const ghostLayer = s('g', { class: 'pc-ghosts' });
  const guideLayer = s('g', { class: 'info-only' });
  const partLayer = s('g');
  // The selected part's way: its whole path, its outline where it starts, and a handle at each end.
  const wayLine = s('path', { class: 'pc-way', 'vector-effect': 'non-scaling-stroke' });
  const startGhost = s('path', { class: 'pc-start-ghost', 'vector-effect': 'non-scaling-stroke' });
  const handle = (which: Endpoint) => s('circle', { class: `pc-handle is-${which}`, 'data-end': which, 'vector-effect': 'non-scaling-stroke' });
  const label = (text: string) => s('text', { class: 'pc-handle-label' }, text);
  const handles = { start: handle('start'), end: handle('end') };
  const labels = { start: label('start'), end: label('end') };
  // A handle whose end lies outside the drawing is pinned to its edge, with a tail pointing the real way.
  const tails = { start: s('line', { class: 'pc-tail', 'vector-effect': 'non-scaling-stroke' }), end: s('line', { class: 'pc-tail', 'vector-effect': 'non-scaling-stroke' }) };
  const wayLayer = s('g', { class: 'pc-way-layer' }, wayLine, startGhost, tails.start, tails.end, labels.start, labels.end, handles.start, handles.end);
  const svg = s('svg', { class: 'pieces', role: 'img', 'aria-label': 'Characters taken apart into moving parts' },
    defs, s('g', {}, ghostLayer, guideLayer, shockLayer, partLayer, wayLayer));
  const camera = svg.lastElementChild as SVGGElement;     // the whole frame, for the hit of a burst
  const readout = h('div', { class: 'readout' });
  const stats = h('div', { class: 'pc-stats' });
  root.append(controls, h('div', { class: 'split' }, h('div', { class: 'stage' }, svg), readout), stats);

  // ---- layout: load every character's breakdown, then build the scene once ----

  let items: Item[] = [];
  let shocks: { el: SVGCircleElement; ci: number }[] = [];
  let view = { x: 0, y: 0 };      // the middle of the frame
  let cells: Cell[] = [];
  let gen = 0;

  async function relayout() {
    const my = ++gen;
    const lines = state.text.split('\n').map((l) => Array.from(l.trim())).filter((l) => l.length).slice(0, 4);
    const font = CJK_FONTS.find((f) => f.id === state.font)!;
    textArea.lang = font.lang;
    const slow = window.setTimeout(() => { if (my === gen) stats.textContent = 'Loading outlines…'; }, 200);
    const bds = await Promise.all(lines.map((l) => Promise.all(l.map((ch) =>
      (/\s/.test(ch) ? null : breakdown(state.font, ch, state.split, font.lang))))));
    clearTimeout(slow);
    if (my !== gen) return;

    cells = [];
    let maxW = 0;
    lines.forEach((line, li) => {
      let x = 0;
      line.forEach((ch, ci) => {
        const bd = bds[li][ci];
        cells.push({ ch, x, y: li * LEAD, bd });
        x += (bd ? bd.advance : 500) + GAP;
      });
      maxW = Math.max(maxW, x - GAP);
    });
    const height = Math.max(1, lines.length) * LEAD - (LEAD - 1000);
    svg.setAttribute('viewBox', `${-PAD} ${-PAD} ${Math.max(maxW, 1000) + 2 * PAD} ${height + 2 * PAD}`);
    view = { x: Math.max(maxW, 1000) / 2, y: height / 2 };
    build();
    describe();
  }

  function build() {
    defs.replaceChildren();
    ghostLayer.replaceChildren();
    guideLayer.replaceChildren();
    partLayer.replaceChildren();
    shockLayer.replaceChildren();
    shocks = [];
    items = [];
    let seed = 0;
    cells.forEach((cell, ci) => {
      const bd = cell.bd;
      if (!bd) return;
      const at = `translate(${cell.x} ${cell.y})`;
      if (bd.source === 'missing') {
        ghostLayer.append(s('rect', { x: cell.x, y: cell.y, width: bd.advance, height: 1000, class: 'pc-missing', 'vector-effect': 'non-scaling-stroke' }));
        return;
      }
      ghostLayer.append(s('path', { d: bd.glyph, transform: at }));
      const ring = s('circle', { cx: cell.x + bd.advance / 2, cy: cell.y + 500, r: 0, class: 'pc-shock', 'vector-effect': 'non-scaling-stroke' });
      shockLayer.append(ring);
      shocks.push({ el: ring, ci });
      for (const c of bd.cuts) {
        const [x1, y1, x2, y2] = c.axis === 'x' ? [c.at, c.from - 30, c.at, c.to + 30] : [c.from - 30, c.at, c.to + 30, c.at];
        guideLayer.append(s('line', { x1, y1, x2, y2, transform: at, class: `guide${c.depth === 0 ? ' is-hl' : ''}`, 'vector-effect': 'non-scaling-stroke' }));
      }
      bd.parts.forEach((part, pi) => {
        const key = `${state.split}:${ci}:${pi}`;
        const win = uid('pc-win');
        const pad = 8;
        defs.append(s('clipPath', { id: win }, s('rect', { x: part.box.x0 - pad, y: part.box.y0 - pad,
          width: part.box.x1 - part.box.x0 + 2 * pad, height: part.box.y1 - part.box.y0 + 2 * pad })));
        const ink = s('path', { d: part.d, class: 'pc-ink' });
        const leader = s('line', { class: 'pc-leader', x1: part.cx, y1: part.cy, x2: part.cx, y2: part.cy, 'vector-effect': 'non-scaling-stroke' });
        const anim = s('g', {}, ink);
        const end = s('g', {}, leader, anim);
        const pos = s('g', { class: 'pc-pos', 'data-k': key, transform: at }, end);
        partLayer.append(pos);
        items.push({ part, key, seed: seed++, rank: 0, x: cell.x, y: cell.y, ccx: bd.advance / 2, ccy: 500,
          ci, pi, of: bd.parts.length, pos, end, anim, ink, win, leader });
      });
    });
    ranks();
    modes();
    frame();
  }

  /** When each part moves, from 0 (first) to 1 (last). */
  function ranks() {
    const n = items.length;
    if (!n) return;
    // Parts come in writing order already: ordered by their first stroke where the stroke order is known.
    if (state.order === 'writing') items.forEach((it, i) => { it.rank = n > 1 ? i / (n - 1) : 0; });
    else if (state.order === 'random') {
      [...items].sort((a, b) => rand(a.seed, 9) - rand(b.seed, 9)).forEach((it, i) => { it.rank = n > 1 ? i / (n - 1) : 0; });
    } else {
      const gx = items.map((it) => it.x + it.part.cx), gy = items.map((it) => it.y + it.part.cy);
      const mx = (Math.min(...gx) + Math.max(...gx)) / 2, my = (Math.min(...gy) + Math.max(...gy)) / 2;
      const d = items.map((_, i) => Math.hypot(gx[i] - mx, gy[i] - my));
      const far = Math.max(...d) || 1;
      items.forEach((it, i) => { it.rank = d[i] / far; });
    }
  }

  /** What each effect needs switched on: leaders, shockwaves and the camera for Explode (Slide's windows are set per part). */
  function modes() {
    const explode = state.effect === 'explode';
    for (const it of items) show(it.leader, explode);
    show(shockLayer, explode);
    camera.removeAttribute('transform');
  }

  const stagger = () => state.stagger * 0.92;
  const off = (map: Map<string, Pt>, key: string): Pt => map.get(key) ?? [0, 0];
  const forget = () => { state.starts.clear(); state.ends.clear(); };

  /** A part's pose at time t, in the current effect. */
  function poseAt(it: Item, t: number): Pose {
    const S = stagger();
    if (state.effect === 'explode') return explosion(it.part, it.ccx, it.ccy, t, it.seed, it.rank, S);
    const p = clamp((built(t) - it.rank * S) / (1 - S), 0, 1);
    return pose(state.effect, it.part, it.ccx, it.ccy, p, it.seed);
  }

  /** Where a part starts: the moment it is farthest from home. */
  function startPose(it: Item): Pose {
    if (state.effect !== 'explode') return pose(state.effect, it.part, it.ccx, it.ccy, 0, it.seed);
    const S = stagger();
    return explosion(it.part, it.ccx, it.ccy, EX.drift + it.rank * S * 0.14 - 1e-4, it.seed, it.rank, S);
  }

  /**
   * The motion inside the end layer: the effect's own, plus the way from the start to
   * the end. At its start (away 1) a part is moved by start − end, so it begins where
   * its start was put; at rest (away 0) by nothing, so it lands on its end.
   */
  function motion(it: Item, ps: Pose): Mat {
    const [sx, sy] = off(state.starts, it.key), [ex, ey] = off(state.ends, it.key);
    return compose(translate((sx - ex) * ps.away, (sy - ey) * ps.away), ps.m);
  }

  /** A part's centre in the drawing, at pose ps. */
  function centreAt(it: Item, ps: Pose): Pt {
    const [ex, ey] = off(state.ends, it.key);
    const [x, y] = apply(motion(it, ps), it.part.cx, it.part.cy);
    return [it.x + ex + x, it.y + ey + y];
  }

  function frame() {
    const explode = state.effect === 'explode';
    const firstBurst = new Map<number, number>();
    for (const it of items) {
      const ps = poseAt(it, state.t);
      const m = motion(it, ps);
      place(it);
      it.anim.setAttribute('transform', toSvg(m));
      it.anim.setAttribute('opacity', fmt(ps.opacity, 3));
      if (explode) {
        // Threads back to where each part lands, faint, while it is out.
        const [x2, y2] = apply(m, it.part.cx, it.part.cy);
        it.leader.setAttribute('x2', fmt(x2));
        it.leader.setAttribute('y2', fmt(y2));
        it.leader.setAttribute('opacity', fmt(0.7 * clamp(ps.away, 0, 1), 3));
        firstBurst.set(it.ci, Math.min(firstBurst.get(it.ci) ?? 1, burstAt(it.rank, stagger())));
      }
    }
    if (explode) frameExplode(firstBurst);
    drawWay();
  }

  function frameExplode(firstBurst: Map<number, number>) {
    const t = state.t;
    // Each character's shockwave, and the frame's jolt from every burst so far.
    let hit = 0;
    for (const { el, ci } of shocks) {
      const tau = t - (firstBurst.get(ci) ?? 2);
      const k = tau >= 0 && tau < SHOCK ? tau / SHOCK : -1;
      show(el, k >= 0);
      if (k >= 0) {
        el.setAttribute('r', fmt(1100 * (1 - (1 - k) ** 3)));
        el.setAttribute('opacity', fmt(0.6 * (1 - k) ** 1.5, 3));
      }
      if (tau >= 0) hit += Math.exp(-tau / 0.035);
    }
    hit = Math.min(1, hit);
    camera.setAttribute('transform', toSvg(compose(
      translate(Math.sin(t * 3100) * 14 * hit, Math.cos(t * 2700) * 14 * hit),
      about(scale(1 + 0.035 * hit), view.x, view.y),
    )));
  }

  function place(it: Item) {
    const [ex, ey] = off(state.ends, it.key);
    attr(it.end, 'transform', (ex || ey) ? `translate(${fmt(ex)} ${fmt(ey)})` : false);
    // Slide shows a part through a window where it lands; one whose start was moved by hand
    // travels the whole way in view instead.
    attr(it.end, 'clip-path', state.effect === 'slide' && !state.starts.has(it.key) && `url(#${it.win})`);
    it.pos.classList.toggle('is-sel', it.key === state.sel);
  }

  /** The selected part's way: the path it travels in this effect, its outline at the start, its two handles. */
  function drawWay() {
    const it = items.find((i) => i.key === state.sel);
    show(wayLayer, !!it);
    if (!it) return;
    // Handles and labels keep their size on screen, however the drawing is scaled.
    const px = 1 / (svg.getScreenCTM()?.a || 1);
    const pts: Pt[] = [];
    for (let i = 0; i <= 200; i++) pts.push(centreAt(it, poseAt(it, i / 200)));
    wayLine.setAttribute('d', `M${pts.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L')}`);
    const sp = startPose(it), [ex, ey] = off(state.ends, it.key);
    startGhost.setAttribute('d', it.part.d);
    startGhost.setAttribute('transform', toSvg(compose(translate(it.x + ex, it.y + ey), motion(it, sp))));
    const at: Record<Endpoint, Pt> = { start: centreAt(it, sp), end: [it.x + ex + it.part.cx, it.y + ey + it.part.cy] };
    // What of the drawing is on screen, less a margin: anything beyond sits under the controls or past the edge.
    const box = svg.getBoundingClientRect(), inv = svg.getScreenCTM()!.inverse();
    const tl = new DOMPoint(box.left, box.top).matrixTransform(inv), br = new DOMPoint(box.right, box.bottom).matrixTransform(inv);
    const m = 18 * px;
    for (const which of ['start', 'end'] as Endpoint[]) {
      const [tx, ty] = at[which];
      const x = clamp(tx, tl.x + m, br.x - m), y = clamp(ty, tl.y + m, br.y - m);
      const pinned = x !== tx || y !== ty;
      show(tails[which], pinned);
      if (pinned) {
        // Point the tail toward the real end, a short way.
        const d = Math.hypot(tx - x, ty - y) || 1, len = 40 * px;
        tails[which].setAttribute('x1', fmt(x)); tails[which].setAttribute('y1', fmt(y));
        tails[which].setAttribute('x2', fmt(x + ((tx - x) / d) * len)); tails[which].setAttribute('y2', fmt(y + ((ty - y) / d) * len));
      }
      handles[which].setAttribute('cx', fmt(x));
      handles[which].setAttribute('cy', fmt(y));
      handles[which].setAttribute('r', fmt(8 * px));
      labels[which].setAttribute('x', fmt(x + 13 * px));
      labels[which].setAttribute('y', fmt(y + 4 * px));
      labels[which].setAttribute('font-size', fmt(11 * px));
    }
  }

  // ---- what is shown: counts, sources, and the selected part ------------------

  function describe() {
    const font = CJK_FONTS.find((f) => f.id === state.font)!;
    const drawn = cells.filter((c) => c.bd && c.bd.source !== 'missing');
    const missing = cells.filter((c) => c.bd?.source === 'missing').map((c) => c.ch);
    const unordered = drawn.filter((c) => !c.bd!.strokes).map((c) => c.ch);
    const notes: string[] = [`${drawn.length} character${drawn.length === 1 ? '' : 's'}, ${items.length} ${state.split}`];
    const sources = [...new Set(drawn.map((c) => c.bd!.strokeSource).filter((x) => x != null))];
    if (sources.length) notes.push(`stroke order from ${sources.map((x) => STROKE_CREDITS[x]).join(' and ')}`);
    if (unordered.length && state.order === 'writing') {
      notes.push(drawn.length && unordered.length === drawn.length
        ? 'no stroke order reached the page (it loads from jsDelivr): reading order'
        : `no stroke order for ${unordered.join(' ')}: reading order`);
    }
    // Characters the chosen font doesn't draw come from the nearest font that does.
    const borrowed = new Map<string, string[]>();
    for (const c of drawn) if (c.bd!.fallback) borrowed.set(c.bd!.fallback, [...(borrowed.get(c.bd!.fallback) ?? []), c.ch]);
    for (const [name, chs] of borrowed) notes.push(`${[...new Set(chs)].join(' ')} from ${name}`);
    if (missing.length) notes.push(`no font here draws ${missing.join(' ')}`);
    const moved = new Set([...state.starts.keys(), ...state.ends.keys()]).size;
    if (moved) notes.push(`${moved} moved by hand`);
    stats.textContent = notes.join(' · ');

    readout.replaceChildren();
    const sel = items.find((it) => it.key === state.sel);
    const shown = sel ? cells[sel.ci] : drawn[0];
    if (!shown?.bd) return;
    const bd = shown.bd;
    const k = (t: string) => h('span', { class: 'k' }, t.padEnd(10));
    const op = bd.ids[0], shape = SHAPES[op];
    readout.append(k(shown.ch), shape ? h('span', { class: 'ids' }, op) : '', shape ? ` ${shape}\n` : 'no clean cut\n',
      k('parts'), `${bd.counts.parts}, cut along empty channels\n`,
      k('pieces'), `${bd.counts.pieces}, connected outlines\n`,
      k('strokes'), bd.strokes ? `${bd.strokes.length}, ${bd.strokeSource === 'kanjivg' ? 'KanjiVG' : 'Make Me a Hanzi'} order\n` : 'no stroke order\n',
      k('drawn'), `${bd.fallback || font.name}${bd.fallback ? ` (${font.name} doesn’t draw it)` : ''}\n`);
    if (sel) {
      const b = sel.part.box;
      const moved = (map: Map<string, Pt>, from: string, unmoved: string) => {
        const v = map.get(sel.key);
        return v ? `${fmt(v[0], 0)}, ${fmt(v[1], 0)} from ${from}` : unmoved;
      };
      const name = state.split === 'parts' ? 'part' : 'piece';
      readout.append('\n', k('selected'), h('span', { class: 'hl' }, `${name} ${sel.pi + 1} of ${sel.of}`), '\n',
        k('strokes'), sel.part.strokes.length ? `${sel.part.strokes.map((i) => i + 1).join(', ')}\n` : 'no stroke data\n',
        k('box'), `${fmt(b.x0, 0)}–${fmt(b.x1, 0)} × ${fmt(b.y0, 0)}–${fmt(b.y1, 0)}\n`,
        k('slides'), `${sel.part.axis === 'x' ? (sel.part.side < 0 ? 'from the left' : 'from the right') : (sel.part.side < 0 ? 'from above' : 'from below')}\n`,
        k('start'), moved(state.starts, 'the effect’s start', 'the effect’s own'), '\n',
        k('end'), moved(state.ends, 'home', 'home'), '\n');
    }
  }

  // ---- moving a part's start and end by hand ----------------------------------
  // Drag a part (or its end handle) to move where it lands; drag its start handle to
  // move where it comes from. Either way it travels the whole way between the two.

  let drag: { key: string; which: Endpoint; handle: boolean; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null;
  const toSvgPt = (e: PointerEvent) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
  const mapOf = (which: Endpoint) => (which === 'start' ? state.starts : state.ends);
  let lastPress: { time: number; key: string; which: Endpoint; handle: boolean } | null = null;

  svg.addEventListener('pointerdown', (e) => {
    const target = e.target as Element;
    const grip = target.closest<SVGElement>('.pc-handle');
    const which = (grip?.dataset.end as Endpoint | undefined) ?? 'end';
    const key = grip ? state.sel : target.closest<SVGGElement>('.pc-pos')?.dataset.k;
    if (!key) { state.sel = null; frame(); describe(); return; }
    // A second press soon on the same thing is a double-click (the pointer is captured, so the
    // browser's own dblclick lands on the drawing, not on what was pressed): put that end back,
    // or both ends of a part.
    const now = performance.now();
    if (lastPress && now - lastPress.time < 400 && lastPress.key === key && lastPress.which === which && lastPress.handle === !!grip) {
      lastPress = null;
      if (grip) mapOf(which).delete(key);
      else { state.starts.delete(key); state.ends.delete(key); }
      state.sel = key;
      frame(); describe();
      return;
    }
    lastPress = { time: now, key, which, handle: !!grip };
    const [ox, oy] = off(mapOf(which), key);
    const pt = toSvgPt(e);
    drag = { key, which, handle: !!grip, sx: pt.x, sy: pt.y, ox, oy, moved: false };
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const pt = toSvgPt(e);
    const dx = pt.x - drag.sx, dy = pt.y - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 12) return;
    if (!drag.moved) { drag.moved = true; root.closest('.lab')?.classList.add('is-dragging'); }
    mapOf(drag.which).set(drag.key, [drag.ox + dx, drag.oy + dy]);
    state.sel = drag.key;
    if (!state.playing) frame();
  });
  const endDrag = () => {
    if (!drag) return;
    // A click on a part (not a handle) selects it, or lets it go.
    if (!drag.moved && !drag.handle) state.sel = state.sel === drag.key ? null : drag.key;
    drag = null;
    root.closest('.lab')?.classList.remove('is-dragging');
    frame();
    describe();
  };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  // ---- time -----------------------------------------------------------------

  let raf = 0, last = 0;
  function toggle() {
    state.playing = !state.playing;
    playBtn.textContent = state.playing ? 'Pause' : 'Play';
    if (state.playing) { last = performance.now(); raf = requestAnimationFrame(tick); }
    else cancelAnimationFrame(raf);
  }
  function tick(now: number) {
    // Hold still while another playground is showing.
    if (root.closest('.playground')?.classList.contains('is-active')) {
      state.t = (state.t + (now - last) / (state.effect === 'explode' ? EXPLODE_MS : LOOP_MS)) % 1;
      timeCtl.set(state.t);
      frame();
    }
    last = now;
    if (state.playing) raf = requestAnimationFrame(tick);
  }

  void relayout();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) toggle();
}
