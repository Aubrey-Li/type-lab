// Family playground: a type family as a space to move through.
//
// Each family here is a variable font: one file whose styles lie along axes
// (weight, width, optical size, slant, and whatever the designer invented).
// Drag a point across two axes, set any axis by hand, jump to a named style,
// or let the specimen wander. The masters overlay shows the two extremes of
// an axis behind the live instance: every style in between is interpolated.
import '@fontsource-variable/roboto-flex/full.css';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/recursive/full.css';
import '@fontsource-variable/source-serif-4/standard.css';
import '@fontsource-variable/source-serif-4/standard-italic.css';
import '@fontsource-variable/literata/standard.css';
import '@fontsource-variable/literata/standard-italic.css';
import '@fontsource-variable/eb-garamond/wght.css';
import '@fontsource-variable/eb-garamond/wght-italic.css';
import '@fontsource-variable/inter/standard.css';
import '@fontsource-variable/inter/standard-italic.css';
import '@fontsource-variable/bricolage-grotesque/standard.css';
import '@fontsource-variable/anybody/standard.css';
import '@fontsource-variable/anybody/standard-italic.css';
import '@fontsource-variable/noto-serif-sc/wght.css';

import robotoFlex from '@fontsource-variable/roboto-flex/metadata.json';
import fraunces from '@fontsource-variable/fraunces/metadata.json';
import recursive from '@fontsource-variable/recursive/metadata.json';
import sourceSerif from '@fontsource-variable/source-serif-4/metadata.json';
import literata from '@fontsource-variable/literata/metadata.json';
import ebGaramond from '@fontsource-variable/eb-garamond/metadata.json';
import inter from '@fontsource-variable/inter/metadata.json';
import bricolage from '@fontsource-variable/bricolage-grotesque/metadata.json';
import anybody from '@fontsource-variable/anybody/metadata.json';
import notoSerifSc from '@fontsource-variable/noto-serif-sc/metadata.json';

import { button, checkbox, row, segmented, select, slider } from '../lib/controls';
import { clamp, h, s } from '../lib/dom';

interface Axis { tag: string; min: number; max: number; def: number; step: number }
interface Family {
  id: string;
  name: string;
  css: string;             // the CSS family the variable font is registered under
  italic: boolean;         // has italic files (fontsource exposes `ital` as separate files)
  axes: Axis[];
  sample: string;
  paragraph: string;
  lang?: string;
}

interface Metadata {
  id: string;
  family: string;
  styles: string[];
  variable: Record<string, { default: string; min: string; max: string; step: string }>;
}

const LATIN = { sample: 'Hamburgefonstiv', paragraph: 'Sphinx of black quartz, judge my vow. A family is a set of decisions made once and kept: the same skeleton, dressed thin or heavy, narrow or wide, for a caption or a headline.' };

function family(m: Metadata, extra: Partial<Family> = {}): Family {
  const axes = Object.entries(m.variable)
    .filter(([tag]) => tag !== 'ital')
    .map(([tag, a]) => ({ tag, min: +a.min, max: +a.max, def: +a.default, step: +a.step || 1 }))
    // Registered axes (lowercase tags) first, in a familiar order, then the designer's own.
    .sort((a, b) => order(a.tag) - order(b.tag));
  return { id: m.id, name: m.family, css: `${m.family} Variable`, italic: m.styles.includes('italic'), axes, ...LATIN, ...extra };
}
const REGISTERED = ['wght', 'wdth', 'opsz', 'slnt'];
const order = (tag: string) => (REGISTERED.includes(tag) ? REGISTERED.indexOf(tag) : tag === tag.toUpperCase() ? 10 : 5);

const FAMILIES: Family[] = [
  family(robotoFlex as Metadata),
  family(fraunces as Metadata),
  family(recursive as Metadata),
  family(anybody as Metadata),
  family(bricolage as Metadata),
  family(sourceSerif as Metadata),
  family(literata as Metadata),
  family(inter as Metadata),
  family(ebGaramond as Metadata),
  family(notoSerifSc as Metadata, {
    sample: '永字八法', lang: 'zh-Hans',
    paragraph: '汉字在方格中排列，每个字占据一个全角的位置。同一套字形，可以细，可以粗：这就是一个字族。',
  }),
];

const AXIS_NAMES: Record<string, string> = {
  wght: 'Weight', wdth: 'Width', opsz: 'Optical size', slnt: 'Slant',
  GRAD: 'Grade', XOPQ: 'Thick stroke', YOPQ: 'Thin stroke', XTRA: 'Counter width',
  YTAS: 'Ascender height', YTDE: 'Descender depth', YTFI: 'Figure height', YTLC: 'Lowercase height', YTUC: 'Uppercase height',
  SOFT: 'Softness', WONK: 'Wonky', CASL: 'Casual', CRSV: 'Cursive', MONO: 'Monospace',
};

const WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium',
  600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black', 1000: 'ExtraBlack',
};

const fmtAxis = (v: number, step: number) => (step < 1 ? v.toFixed(step < 0.1 ? 2 : 1) : String(Math.round(v)));

export function mountFamilyLab(root: HTMLElement) {
  let fam = FAMILIES[0];
  let values: Record<string, number> = {};
  let italic = false;
  let opszFollows = true;
  let masters = false;
  let edited = false;
  let padX = 'wght', padY = 'wdth';

  // ---- rail ------------------------------------------------------------------

  const famSelect = select({
    groups: [{ options: FAMILIES.map((f) => ({ value: f.id, label: `${f.name} · ${f.axes.length + (f.italic ? 1 : 0)} ${f.axes.length + (f.italic ? 1 : 0) === 1 ? 'axis' : 'axes'}` })) }],
    value: fam.id, onChange: (id) => setFamily(FAMILIES.find((f) => f.id === id)!),
  });
  const styleCtl = segmented({ options: ['Roman', 'Italic'], value: 'Roman', onChange: (v) => { italic = v === 'Italic'; stop(); fit(); render(); } });
  const opszCtl = checkbox({ label: 'Optical size follows size', checked: true, onChange: (v) => { opszFollows = v; render(); } });
  const mastersCtl = checkbox({ label: 'Masters', checked: false, onChange: (v) => { masters = v; render(); } });
  const wanderBtn = button('Wander', () => (raf ? stop() : wander()));

  root.append(h('div', { class: 'controls' }, row(
    famSelect.el, styleCtl.el, opszCtl.el, mastersCtl.el,
    h('span', { class: 'tool-group tool-end' }, wanderBtn, button('Reset', () => { stop(); setFamily(fam); })),
  )));

  // ---- stage: specimen on the left, the design space on the right -----------

  const ghostLo = h('div', { class: 'fam-ghost', 'aria-hidden': 'true' });
  const ghostHi = h('div', { class: 'fam-ghost', 'aria-hidden': 'true' });
  const big = h('div', { class: 'fam-big', contenteditable: 'plaintext-only', spellcheck: 'false', oninput: () => { edited = true; fit(); render(); } });
  const measurer = h('span', { class: 'fam-measure', 'aria-hidden': 'true' });
  const para = h('p', { class: 'fam-para' });
  const caption = h('p', { class: 'fam-caption' });

  const pad = s('svg', { class: 'fam-pad', viewBox: '0 0 200 200', role: 'slider', 'aria-label': 'Design space: drag across two axes' });
  const xSel = select<string>({ groups: [], value: '', onChange: (v) => { padX = v; render(); } });
  const ySel = select<string>({ groups: [], value: '', onChange: (v) => { padY = v; render(); } });
  const sliders = h('div', { class: 'fam-sliders' });
  const strip = h('div', { class: 'fam-strip' });

  root.append(
    h('div', { class: 'fam-stage' },
      h('div', { class: 'fam-specimen' }, h('div', { class: 'fam-big-wrap' }, ghostLo, ghostHi, big, measurer), para, caption),
      h('aside', { class: 'fam-space' },
        h('div', { class: 'fam-pad-wrap' }, pad, h('div', { class: 'fam-pad-axes' }, xSel.el, ySel.el)),
        sliders)),
    strip,
  );

  // ---- model -----------------------------------------------------------------

  const axis = (tag: string) => fam.axes.find((a) => a.tag === tag);

  function setFamily(f: Family) {
    fam = f;
    values = Object.fromEntries(f.axes.map((a) => [a.tag, a.def]));
    italic = false;
    styleCtl.set('Roman');
    styleCtl.el.classList.toggle('is-off', !f.italic);
    opszCtl.el.classList.toggle('is-off', !axis('opsz'));
    const tags = f.axes.map((a) => a.tag);
    padX = tags.includes('wght') ? 'wght' : tags[0];
    padY = tags.find((t) => t !== padX && t !== 'opsz') ?? tags.find((t) => t !== padX) ?? padX;
    const options = f.axes.map((a) => ({ value: a.tag, label: AXIS_NAMES[a.tag] ?? a.tag }));
    xSel.setGroups([{ options }], padX);
    ySel.setGroups([{ options }], padY);
    if (!edited) big.textContent = f.sample;
    if (f.lang) { big.textContent = f.sample; edited = false; }
    buildSliders();
    fit();
    render();
  }

  /**
   * One line, sized so the widest style of the family still fits: the masters
   * line up with the live text, and the size holds still while values change.
   */
  function fit() {
    big.style.fontSize = '';
    const base = parseFloat(getComputedStyle(big).fontSize);
    measurer.style.fontSize = `${base}px`;
    measurer.textContent = big.textContent;
    const widthWith = (o: Record<string, number>) => { styleText(measurer, base, o); return measurer.getBoundingClientRect().width; };
    // Any axis can widen the text (Monospace, Counter width...): push each, one at a time,
    // to whichever end is wider, keeping what the earlier axes chose.
    const widest: Record<string, number> = {};
    let natural = widthWith(widest);
    for (const a of fam.axes) {
      for (const v of [a.min, a.max]) {
        const w = widthWith({ ...widest, [a.tag]: v });
        if (w > natural) { natural = w; widest[a.tag] = v; }
      }
    }
    const avail = big.parentElement!.clientWidth;
    const size = natural > avail ? (base * avail) / natural * 0.98 : base;
    for (const el of [big, ghostLo, ghostHi]) el.style.fontSize = `${size}px`;
  }

  /** font-variation-settings for the current values, with optical size optionally tied to `px`. */
  function variations(px?: number, override: Record<string, number> = {}) {
    return fam.axes.map((a) => {
      let v = override[a.tag] ?? values[a.tag];
      if (a.tag === 'opsz' && opszFollows && px) v = clamp(px * 0.75, a.min, a.max);   // px → pt
      return `"${a.tag}" ${v}`;
    }).join(', ');
  }

  function styleText(el: HTMLElement, px?: number, override?: Record<string, number>) {
    el.style.fontFamily = `"${fam.css}"`;
    el.style.fontStyle = italic ? 'italic' : 'normal';
    el.style.fontVariationSettings = variations(px, override);
    el.lang = fam.lang ?? 'en';
  }

  const sliderCtls = new Map<string, ReturnType<typeof slider>>();
  function buildSliders() {
    sliderCtls.clear();
    sliders.replaceChildren(...fam.axes.map((a) => {
      const ctl = slider({ label: AXIS_NAMES[a.tag] ?? a.tag, min: a.min, max: a.max, step: a.step, value: a.def,
        format: (v) => fmtAxis(v, a.step), onInput: (v) => { stop(); values[a.tag] = v; render(); } });
      ctl.el.title = `${a.tag}: ${a.min}–${a.max}, default ${a.def}${a.tag === a.tag.toUpperCase() ? ' (an axis the designer invented)' : ''}`;
      ctl.el.prepend(h('span', { class: 'axis-tag' }, a.tag));
      ctl.el.addEventListener('dblclick', () => { values[a.tag] = a.def; render(); });
      sliderCtls.set(a.tag, ctl);
      return ctl.el;
    }));
  }

  // ---- render ----------------------------------------------------------------

  function render() {
    const bigPx = parseFloat(getComputedStyle(big).fontSize);
    styleText(big, bigPx);
    styleText(para, parseFloat(getComputedStyle(para).fontSize));
    para.textContent = fam.paragraph;
    for (const [tag, ctl] of sliderCtls) {
      ctl.set(values[tag]);
      // With optical size tied to the text size, its slider would lie; show it as automatic.
      ctl.el.classList.toggle('is-auto', tag === 'opsz' && opszFollows);
    }
    syncGhosts();
    drawPad();
    // The style grid is rebuilt when something settles, not on every wandering frame.
    if (!raf) drawStrip();
    caption.textContent = `${fam.name}${italic ? ' Italic' : ''} — ${fam.axes.map((a) => `${a.tag} ${fmtAxis(a.tag === 'opsz' && opszFollows ? clamp(bigPx * 0.75, a.min, a.max) : values[a.tag], a.step)}`).join(' · ')}`;
  }

  /** The two masters of the pad's horizontal axis, outlined behind the live text. */
  function syncGhosts() {
    const a = axis(padX);
    const on = masters && !!a && a.min !== a.max;
    for (const [ghost, v] of [[ghostLo, a?.min], [ghostHi, a?.max]] as const) {
      ghost.hidden = !on;
      if (!on || v === undefined) continue;
      ghost.textContent = big.textContent;
      styleText(ghost, parseFloat(getComputedStyle(big).fontSize), { [padX]: v });
    }
  }

  const norm = (a: Axis, v: number) => (a.max === a.min ? 0.5 : (v - a.min) / (a.max - a.min));
  function drawPad() {
    const ax = axis(padX)!, ay = axis(padY)!;
    const px = 10 + norm(ax, values[ax.tag]) * 180, py = 190 - norm(ay, values[ay.tag]) * 180;
    const grid: SVGElement[] = [];
    for (let i = 0; i <= 4; i++) {
      const t = 10 + i * 45;
      grid.push(s('line', { x1: t, x2: t, y1: 10, y2: 190, class: 'guide' }), s('line', { x1: 10, x2: 190, y1: t, y2: t, class: 'guide' }));
    }
    // A tiny specimen at each corner of the space, so the pad shows where it leads.
    const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => {
      const t = s('text', { x: u ? 186 : 14, y: v ? 30 : 184, 'text-anchor': u ? 'end' : 'start', class: 'fam-corner' }, fam.lang ? '永' : 'Ag');
      t.setAttribute('style', `font-family:"${fam.css}";font-style:${italic ? 'italic' : 'normal'};font-variation-settings:${variations(undefined, { [ax.tag]: u ? ax.max : ax.min, [ay.tag]: v ? ay.max : ay.min })}`);
      return t;
    });
    pad.replaceChildren(
      s('rect', { x: 10, y: 10, width: 180, height: 180, class: 'fam-pad-box' }),
      ...grid, ...corners,
      s('line', { x1: px, x2: px, y1: 10, y2: 190, class: 'fam-cross' }),
      s('line', { x1: 10, x2: 190, y1: py, y2: py, class: 'fam-cross' }),
      s('circle', { cx: px, cy: py, r: 7, class: 'fam-dot' }),
    );
  }

  function drawStrip() {
    const w = axis('wght');
    const weights = w ? Object.keys(WEIGHT_NAMES).map(Number).filter((v) => v >= w.min && v <= w.max) : [];
    const wd = axis('wdth');
    // Rows: widths if the family has them, else roman and italic, else a single row.
    const rows: { label: string; set: Record<string, number>; italic: boolean }[] = wd
      ? [wd.min, wd.def, wd.max].filter((v, i, all) => all.indexOf(v) === i)
        .map((v) => ({ label: v < 100 ? 'Condensed' : v > 100 ? 'Expanded' : 'Normal', set: { wdth: v }, italic }))
      : fam.italic
        ? [{ label: 'Roman', set: {}, italic: false }, { label: 'Italic', set: {}, italic: true }]
        : [{ label: '', set: {}, italic }];
    const cols = weights.length ? weights : [NaN];
    const near = (a?: number, b?: number) => a === undefined || b === undefined || Math.abs(a - b) < 1;
    strip.style.setProperty('--cols', String(cols.length));
    strip.replaceChildren(...rows.flatMap((r) => [
      h('span', { class: 'fam-row-label' }, r.label),
      ...cols.map((wv) => {
        const set: Record<string, number> = { ...r.set, ...(Number.isNaN(wv) ? {} : { wght: wv }) };
        const current = r.italic === italic && near(values.wght, set.wght) && near(values.wdth, set.wdth);
        const cell = h('button', { type: 'button', class: 'fam-cell', 'aria-pressed': String(current),
          title: `${WEIGHT_NAMES[wv] ?? ''} ${r.label}`.trim(),
          onclick: () => { stop(); Object.assign(values, set); italic = r.italic; styleCtl.set(italic ? 'Italic' : 'Roman'); render(); } },
        h('span', { class: 'fam-cell-glyph' }, fam.lang ? '永' : 'Ag'),
        h('span', { class: 'fam-cell-name' }, Number.isNaN(wv) ? '' : WEIGHT_NAMES[wv]));
        const g = cell.firstElementChild as HTMLElement;
        g.style.fontFamily = `"${fam.css}"`;
        g.style.fontStyle = r.italic ? 'italic' : 'normal';
        g.style.fontVariationSettings = variations(undefined, set);
        return cell;
      }),
    ]));
  }

  // ---- the pad: drag across two axes ---------------------------------------

  function padAt(e: PointerEvent) {
    const r = pad.getBoundingClientRect();
    const u = clamp(((e.clientX - r.left) / r.width * 200 - 10) / 180, 0, 1);
    const v = clamp(1 - ((e.clientY - r.top) / r.height * 200 - 10) / 180, 0, 1);
    const ax = axis(padX)!, ay = axis(padY)!;
    const snap = (a: Axis, t: number) => Math.round((a.min + t * (a.max - a.min)) / a.step) * a.step;
    values[ax.tag] = snap(ax, u);
    if (ay !== ax) values[ay.tag] = snap(ay, v);
    render();
  }
  pad.addEventListener('pointerdown', (e) => { stop(); pad.setPointerCapture(e.pointerId); padAt(e); });
  pad.addEventListener('pointermove', (e) => { if (pad.hasPointerCapture(e.pointerId)) padAt(e); });

  // ---- wander: drift through the whole space --------------------------------

  let raf = 0;
  function wander() {
    wanderBtn.textContent = 'Stop';
    const start = performance.now();
    const seeds = fam.axes.map((_, i) => ({ f: 0.00011 + i * 0.000037, p: i * 1.7 }));
    const tick = (now: number) => {
      if (!root.classList.contains('is-active')) { stop(); return; }
      const t = now - start;
      fam.axes.forEach((a, i) => {
        if (a.max - a.min <= 1 && a.step >= 1) return;     // leave on/off axes alone
        const u = 0.5 - 0.5 * Math.cos(t * seeds[i].f * Math.PI * 2 + seeds[i].p);
        values[a.tag] = a.min + u * (a.max - a.min);
      });
      render();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
    wanderBtn.textContent = 'Wander';
    drawStrip();
  }

  // Re-render when the playground's width changes (optical size follows the specimen's size).
  let lastWidth = 0;
  new ResizeObserver(([entry]) => {
    if (Math.abs(entry.contentRect.width - lastWidth) < 1) return;
    lastWidth = entry.contentRect.width;
    fit();
    render();
  }).observe(root);
  setFamily(fam);
  // Variable fonts arrive lazily; redraw once they have.
  document.fonts.addEventListener('loadingdone', () => { fit(); render(); });
}
