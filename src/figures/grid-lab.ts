// The Grid playground: a page of running text, set two ways. Latin is
// measured in lines (a baseline grid, the measure, justification between
// words); Chinese and Japanese in characters (a grid of em squares, line-end
// rules, punctuation squeezed instead of spaces stretched). Drag the edges of
// the text block and the gutter; click a character to look inside its square.
import { checkbox, row, segmented, slider } from '../lib/controls';
import { clamp, h, s } from '../lib/dom';
import { fontPicker } from '../lib/font-picker';
import { fontStore, measureText } from '../lib/fonts';
import { LOCALES, breakParagraph, rulesFor, tokenize, type CjkLine, type LineEnds, type Locale, type Tok } from '../lib/cjk-rules';
import { gapsOf, rivers, setLatin, type LLine } from '../lib/latin-setting';
import { CJK_TEXT, LATIN, LATIN_HEADING } from './grid-texts';

type Script = 'latin' | Locale | 'mixed';
type Drag = { kind: 'l' | 'r' | 'g'; start: number; g0: number };

const EM_TOP = 0.88;     // the CJK em box runs 0.88 em above the Roman baseline
const ICF = 0.06;        // approximate inset of the ideographic character face
const MIN_BLOCK = 160;   // px
const TOP = 30;          // room above the block for the measure labels

export function mountGridLab(root: HTMLElement) {
  const state = {
    script: 'latin' as Script,
    vertical: false,
    guides: true,
    size: 19,
    lead: { latin: 1.45, cjk: 1.7 },
    cols: 2,
    gutter: 36,
    margin: { l: 0.1, r: 0.1 },             // fractions of the page width
    justify: true, hyphenate: false, snap: false, rivers: true,
    ends: 'push' as LineEnds, pairs: true, indent: true, scriptGap: true,
    loupe: -1,                                // index of the character in the loupe, -1 for the first ideograph
  };
  const cjk = () => state.script !== 'latin';
  const locale = (): Locale => (state.script === 'latin' || state.script === 'mixed' ? 'sc' : state.script);

  // ---- controls ----------------------------------------------------------

  const leadCtl = slider({ label: 'Leading', min: 1, max: 2.4, step: 0.05, value: state.lead.latin, format: (v) => `${v.toFixed(2)}×`,
    onInput: (v) => { state.lead[cjk() ? 'cjk' : 'latin'] = v; render(); } });
  const dirCtl = segmented({ label: 'Direction', options: ['Horizontal', 'Vertical'], value: 'Horizontal',
    onChange: (v) => { state.vertical = v === 'Vertical'; state.loupe = -1; render(); } });
  const gapCtl = checkbox({ label: 'Quarter-em gap', checked: state.scriptGap, onChange: (v) => { state.scriptGap = v; render(); } });

  const latinRow = row(
    segmented({ label: 'Align', options: ['Ragged', 'Justified'], value: 'Justified',
      onChange: (v) => { state.justify = v === 'Justified'; render(); } }).el,
    checkbox({ label: 'Hyphenate', checked: state.hyphenate, onChange: (v) => { state.hyphenate = v; render(); } }).el,
    checkbox({ label: 'Snap to baseline grid', checked: state.snap, onChange: (v) => { state.snap = v; render(); } }).el,
    checkbox({ label: 'Rivers', checked: state.rivers, onChange: (v) => { state.rivers = v; render(); } }).el,
    fontPicker(),
  );
  const cjkRow = row(
    segmented<LineEnds>({ label: 'Line ends', options: [
      { value: 'off', label: 'No rules' }, { value: 'hang', label: 'Hang' },
      { value: 'squeeze', label: 'Squeeze' }, { value: 'push', label: 'Push out' },
    ], value: state.ends, onChange: (v) => { state.ends = v; render(); } }).el,
    checkbox({ label: 'Squeeze paired marks', checked: state.pairs, onChange: (v) => { state.pairs = v; render(); } }).el,
    checkbox({ label: 'Indent', checked: state.indent, onChange: (v) => { state.indent = v; render(); } }).el,
    gapCtl.el,
  );

  const controls = h('div', { class: 'controls' },
    row(
      segmented<Script>({ label: 'Script', options: [
        { value: 'latin', label: 'Latin' }, { value: 'sc', label: '简' }, { value: 'tc', label: '繁' },
        { value: 'jp', label: '日' }, { value: 'mixed', label: '中 + En' },
      ], value: state.script, onChange: (v) => { state.script = v; state.loupe = -1; leadCtl.set(state.lead[cjk() ? 'cjk' : 'latin']); render(); } }).el,
      dirCtl.el,
      checkbox({ label: 'Guides', checked: state.guides, onChange: (v) => { state.guides = v; render(); } }).el,
    ),
    row(
      slider({ label: 'Size', min: 12, max: 32, value: state.size, format: (v) => `${v}px`, onInput: (v) => { state.size = v; render(); } }).el,
      leadCtl.el,
      slider({ label: 'Columns', min: 1, max: 3, value: state.cols, onInput: (v) => { state.cols = v; render(); } }).el,
    ),
    latinRow, cjkRow,
  );

  const svg = s('svg', { class: 'gridpage', role: 'img', 'aria-label': 'A page of text on its grid' });
  const stage = h('div', { class: 'stage' }, svg);
  const loupeSvg = s('svg', { viewBox: '0 0 260 300', class: 'loupe-svg', role: 'img', 'aria-label': 'The selected character in its em square' });
  const loupeFacts = h('div', { class: 'loupe-facts' });
  const loupe = h('aside', { class: 'grid-loupe' }, loupeSvg, loupeFacts);
  const split = h('div', { class: 'split grid-split' }, stage, loupe);
  const stats = h('div', { class: 'grid-stats' });
  root.append(controls, split, stats);

  // ---- the page ----------------------------------------------------------

  let W = 800, H = 500;
  new ResizeObserver(() => {
    const r = stage.getBoundingClientRect();
    if (r.width && r.height && (r.width !== W || r.height !== H)) { W = r.width; H = r.height; render(); }
  }).observe(stage);

  const block = () => ({ x0: state.margin.l * W, x1: W - state.margin.r * W, y0: TOP, y1: H - 12 });

  let tokens: Tok[] = [];     // every CJK token on the page, for the loupe

  function render() {
    latinRow.hidden = cjk();
    cjkRow.hidden = !cjk();
    dirCtl.el.classList.toggle('is-off', !cjk());
    gapCtl.el.classList.toggle('is-off', state.script !== 'mixed');
    loupe.hidden = !cjk();
    split.classList.toggle('is-single', !cjk());
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const els: SVGElement[] = [];
    const facts = cjk() ? renderCjk(els) : renderLatin(els);
    els.push(...handles());
    svg.replaceChildren(...els);
    stats.textContent = facts;
    if (cjk()) renderLoupe();
  }

  /** The block's edges and gutters, to drag. */
  function handles(): SVGElement[] {
    const { x0, x1, y0, y1 } = block();
    const edge = (kind: 'l' | 'r', x: number) => s('g', { class: 'grid-drag', 'data-drag': kind },
      s('rect', { x: x - 8, y: y0 - 14, width: 16, height: y1 - y0 + 14, class: 'grid-hit' }),
      s('line', { x1: x, x2: x, y1: y0 - 8, y2: y1, class: 'grid-edge' }),
      s('circle', { cx: x, cy: y0 - 8, r: 4, class: 'grid-knob' }));
    const out = [edge('l', x0), edge('r', x1)];
    for (const g of gutters()) {
      const v = cjk() && state.vertical;
      out.push(s('g', { class: `grid-drag${v ? ' is-v' : ''}`, 'data-drag': 'g' },
        v ? s('rect', { x: x0, y: g[0], width: x1 - x0, height: g[1] - g[0], class: 'grid-hit grid-gutter' })
          : s('rect', { x: g[0], y: y0, width: g[1] - g[0], height: y1 - y0, class: 'grid-hit grid-gutter' })));
    }
    return out;
  }

  /** Columns across the block (or tiers down it, for vertical CJK), as [start, size] in px. */
  function columns(): [number, number][] {
    const { x0, x1, y0, y1 } = block();
    const vertical = cjk() && state.vertical;
    const [a, b] = vertical ? [y0, y1] : [x0, x1];
    const size = (b - a - state.gutter * (state.cols - 1)) / state.cols;
    return Array.from({ length: state.cols }, (_, c) => [a + c * (size + state.gutter), size]);
  }
  function gutters(): [number, number][] {
    return columns().slice(0, -1).map(([a, size]) => [a + size, a + size + state.gutter]);
  }

  // ---- Latin: lines on a baseline grid ------------------------------------

  const widths = new Map<string, number>();
  function renderLatin(els: SVGElement[]): string {
    const family = fontStore.get().family, S = state.size, G = Math.round(S * state.lead.latin);
    const { x0, x1, y0, y1 } = block();
    const cols = columns();
    const colW = cols[0][1];
    const width = (t: string) => {
      const key = `${family}|${S}|${t}`;
      let w = widths.get(key);
      if (w === undefined) { w = measureText(family, S, t).width; widths.set(key, w); }
      return w;
    };
    const space = width(' ');

    // The baseline grid: one line every G px from the top of the block.
    const grid = (k: number) => y0 + (k + 1) * G;
    const rows = Math.floor((y1 - y0) / G);
    if (state.guides) {
      for (let k = 0; k < rows; k++) els.push(s('line', { x1: x0, x2: x1, y1: grid(k), y2: grid(k), class: 'grid-base' }));
      for (const [x, w] of cols) els.push(s('rect', { x, y: y0, width: w, height: y1 - y0, class: 'grid-col' }));
    }

    // The heading. Snapped, it spends whole lines of the grid; set naturally, it shifts everything beneath it.
    const HS = Math.round(S * 1.9);
    let head: number, firstBody: number;
    if (state.snap) {
      const j = Math.max(0, Math.ceil((HS * 0.72) / G) - 1);
      head = grid(j); firstBody = grid(j + 2);
    } else {
      head = y0 + HS * 0.85;
      firstBody = head + HS * 0.5 + G;
    }
    els.push(s('text', { x: cols[0][0], y: head, 'font-size': HS, style: `font-family:"${family}"`, class: 'grid-heading' }, LATIN_HEADING));

    // Fill every column, repeating the text if the page is larger than it.
    const capacity = state.cols * rows;
    let paras = LATIN, lines: LLine[] = [];
    for (let reps = 0; reps < 6; reps++) {
      lines = setLatin(paras, { measure: colW, width, justify: state.justify, hyphenate: state.hyphenate, indent: S });
      if (lines.length >= capacity) break;
      paras = paras.concat(LATIN);
    }

    let li = 0, offBy = 0, riverCount = 0, hyphens = 0;
    const perLine: string[] = [];
    cols.forEach(([x], c) => {
      const placed: { line: LLine; y: number }[] = [];
      for (let y = c === 0 ? firstBody : grid(0); y <= y1 && li < lines.length; y += G) placed.push({ line: lines[li++], y });
      if (!placed.length) return;

      if (c === 0) offBy = (((firstBody - y0) % G) + G) % G;
      const off = c === 0 && offBy > 0.5 && G - offBy > 0.5;
      const full = placed.filter((p) => !p.line.last);
      const chars = full.length
        ? Math.round(full.reduce((n, p) => n + p.line.words.reduce((m, w) => m + w.text.length + 1, -1), 0) / full.length) : 0;
      perLine.push(String(chars));
      if (state.guides && chars) {
        const bad = chars < 45 || chars > 75;
        els.push(s('text', { x, y: y0 - 10, class: `svg-num${bad ? ' is-bad' : ''}` }, `${chars} characters`));
      }

      // Rivers, found within this column.
      const hit = state.justify && state.rivers ? rivers(placed.map((p) => p.line), space, S * 0.35) : [];
      placed.forEach(({ line, y }, k) => {
        if (line.hyphen) hyphens++;
        if (off && state.guides) els.push(s('line', { x1: x - 10, x2: x - 3, y1: y, y2: y, class: 'grid-tick' }));
        const gaps = gapsOf(line);
        hit[k]?.forEach((g) => {
          const [a, b] = gaps[g];
          els.push(s('rect', { x: x + a, y: y - S * 0.8, width: b - a, height: S * 1.05, class: 'grid-river' }));
        });
        for (const w of line.words) {
          els.push(s('text', { x: x + w.x, y, 'font-size': S, style: `font-family:"${family}"`, class: 'grid-word' }, w.text));
        }
      });
      riverCount += hit.reduce((n, set) => n + set.size, 0);
    });

    const parts = [`${S}px on a ${G}px grid`, `${perLine.join(' / ')} characters per line`];
    if (state.justify && state.rivers) parts.push(riverCount ? `${riverCount} spaces in rivers` : 'no rivers');
    if (state.hyphenate) parts.push(`${hyphens} hyphen${hyphens === 1 ? '' : 's'}`);
    if (!state.snap && offBy > 0.5 && G - offBy > 0.5) parts.push(`column 1 sits ${offBy.toFixed(1)}px off the grid`);
    return parts.join('  ·  ');
  }

  // ---- CJK: characters on a grid of squares -------------------------------

  function renderCjk(els: SVGElement[]): string {
    const loc = locale(), L = LOCALES[loc], rules = rulesFor(loc);
    const C = state.size, P = C * state.lead.cjk;
    const { x0, x1, y0, y1 } = block();
    const vertical = state.vertical;
    const cols = columns();
    const n = Math.max(4, Math.floor(cols[0][1] / C));
    const lineRoom = vertical ? x1 - x0 : y1 - y0;
    const perCol = Math.max(1, Math.floor((lineRoom - C) / P) + 1);

    const texts = state.script === 'mixed' ? CJK_TEXT.mixed : CJK_TEXT[loc];
    const opts = {
      rules, indent: state.indent ? L.indent : 0, pairs: state.pairs, vertical,
      scriptGap: state.script === 'mixed' && state.scriptGap,
      measure: (t: string) => measureText('EB Garamond', C, t).width / C,
    };
    const lines: CjkLine[] = [];
    for (let reps = 0; reps < 8 && lines.length < perCol * state.cols; reps++) {
      for (const p of texts) lines.push(...breakParagraph(tokenize(p, opts), n, state.ends, rules));
    }

    tokens = [];
    const counts = { violation: 0, hang: 0, squeeze: 0, pair: 0, push: 0, stretched: 0 };
    const face = `font-family:${L.family}`;
    cols.forEach(([a], c) => {
      const mine = lines.slice(c * perCol, (c + 1) * perCol);
      // Where square `at` of line `k` sits: its top-left corner.
      const cell = (k: number, at: number): [number, number] => vertical ? [x1 - C - k * P, a + at * C] : [a + at * C, y0 + k * P];

      if (state.guides) {
        let d = '';
        for (let k = 0; k < perCol; k++) {
          const [x, y] = cell(k, 0);
          d += vertical ? `M${x} ${y}h${C}v${n * C}h${-C}z` : `M${x} ${y}h${n * C}v${C}h${-n * C}z`;
          for (let i = 1; i < n; i++) d += vertical ? `M${x} ${y + i * C}h${C}` : `M${x + i * C} ${y}v${C}`;
        }
        els.push(s('path', { d, class: 'grid-cells' }));
        els.push(vertical
          ? s('text', { x: x1, y: a - 8, 'text-anchor': 'end', class: 'svg-num' }, `${n} × ${perCol}`)
          : s('text', { x: a, y: y0 - 10, class: 'svg-num' }, `${n} characters × ${perCol} lines`));
      }

      mine.forEach((line, k) => {
        // A line whose characters no longer sit on the squares: marked once, at its start.
        if (line.toks.some((t) => t.offGrid)) {
          counts.stretched++;
          if (state.guides) {
            const [x, y] = cell(k, 0);
            els.push(vertical
              ? s('line', { x1: x + 2, x2: x + C - 2, y1: y - 5, y2: y - 5, class: 'grid-tick' })
              : s('line', { x1: x - 5, x2: x - 5, y1: y + 2, y2: y + C - 2, class: 'grid-tick' }));
          }
        }
        for (const t of [...line.toks, ...(line.hang ? [line.hang] : [])]) {
          if (t.mark) counts[t.mark]++;
          if (t.kind === 'indent') {
            if (state.guides) {
              const [x, y] = cell(k, t.at);
              els.push(s('rect', { ...(vertical ? { x, y, width: C, height: t.w * C } : { x, y, width: t.w * C, height: C }), class: 'grid-indent' }));
            }
            continue;
          }
          const [x, y] = cell(k, t.at);
          if (state.guides && t.mark) {
            els.push(s('rect', { ...(vertical ? { x, y, width: C, height: t.w * C } : { x, y, width: t.w * C, height: C }), class: `cjk-mark is-${t.mark}` }));
          }
          const id = tokens.push(t) - 1;
          const cls = `cjk-char${state.guides && t.mark ? ' is-hl' : ''}${id === state.loupe ? ' is-sel' : ''}`;
          const ink = t.dx * C;
          if (t.kind === 'digits') {
            // 縦中横: a short number set upright, side by side, in one square.
            els.push(s('text', { x: x + C / 2, y: y + EM_TOP * C, 'font-size': C, 'text-anchor': 'middle', 'data-k': id, class: cls,
              style: 'font-family: var(--serif)', ...(t.text.length > 1 ? { textLength: C * 0.92, lengthAdjust: 'spacingAndGlyphs' } : {}) }, t.text));
          } else if (vertical) {
            els.push(s('text', { x: x + C / 2, y: y + ink, 'font-size': C, 'writing-mode': 'vertical-rl', lang: L.lang, 'data-k': id, class: cls,
              style: t.kind === 'latin' ? 'font-family: var(--serif)' : face }, t.text));
          } else {
            els.push(s('text', { x: x + ink, y: y + EM_TOP * C, 'font-size': C, lang: L.lang, 'data-k': id, class: cls,
              style: t.kind === 'latin' ? 'font-family: var(--serif)' : face }, t.text));
          }
        }
      });
    });
    if (!tokens[state.loupe]) {
      state.loupe = tokens.findIndex((t) => t.kind === 'han');
      els.find((el) => el.dataset.k === String(state.loupe))?.classList.add('is-sel');
    }

    const parts = [`${n} characters × ${perCol} lines`];
    const named: [keyof typeof counts, string][] = [
      ['violation', 'broken rules'], ['hang', 'hung'], ['squeeze', 'squeezed'], ['pair', 'paired marks squeezed'],
      ['push', 'pushed out'], ['stretched', 'lines stretched off the grid'],
    ];
    for (const [k, label] of named) if (counts[k]) parts.push(`${counts[k]} ${label}`);
    return parts.join('  ·  ');
  }

  // ---- the loupe: one character in its square -----------------------------

  function renderLoupe() {
    const t = tokens[state.loupe];
    if (!t) { loupeSvg.replaceChildren(); loupeFacts.replaceChildren(); return; }
    const loc = locale(), rules = rulesFor(loc);
    const B = 170, bx = 45, by = 10;
    const glyph = (ch: string, x: number, y: number, size: number, l: Locale, cls: string) => state.vertical
      ? s('text', { x: x + size / 2, y, 'font-size': size, 'writing-mode': 'vertical-rl', lang: LOCALES[l].lang, style: `font-family:${LOCALES[l].family}`, class: cls }, ch)
      : s('text', { x, y: y + EM_TOP * size, 'font-size': size, lang: LOCALES[l].lang, style: `font-family:${LOCALES[l].family}`, class: cls }, ch);
    const els: SVGElement[] = [
      s('rect', { x: bx, y: by, width: B, height: B, class: 'accent-stroke' }),
      s('rect', { x: bx + ICF * B, y: by + ICF * B, width: B * (1 - 2 * ICF), height: B * (1 - 2 * ICF), class: 'accent-stroke', 'stroke-dasharray': '4 4' }),
      s('line', { x1: bx + B / 2, x2: bx + B / 2, y1: by, y2: by + B, class: 'guide' }),
      s('line', { x1: bx, x2: bx + B, y1: by + B / 2, y2: by + B / 2, class: 'guide' }),
    ];
    if (!state.vertical) {
      els.push(
        s('line', { x1: bx - 10, x2: bx + B + 10, y1: by + EM_TOP * B, y2: by + EM_TOP * B, class: 'guide is-hl' }),
        s('text', { x: bx + B + 14, y: by + EM_TOP * B + 4, class: 'svg-num' }, '0.88'),
      );
    }
    els.push(glyph(t.text, bx, by, B, loc, 'cjk-char'));
    // The same code point in each locale.
    const cell = 52;
    (Object.keys(LOCALES) as Locale[]).forEach((l, i) => {
      const x = bx + i * (cell + 7), y = by + B + 34;
      els.push(
        s('rect', { x, y, width: cell, height: cell, class: l === loc ? 'accent-stroke' : 'guide' }),
        glyph(t.text, x, y, cell, l, `cjk-char${l === loc ? ' is-hl' : ''}`),
        s('text', { x: x + cell / 2, y: y + cell + 20, 'text-anchor': 'middle', lang: LOCALES[l].lang, class: `svg-label${l === loc ? ' is-hl' : ''}` }, LOCALES[l].label),
      );
    });
    loupeSvg.replaceChildren(...els);

    const facts: string[] = [`U+${t.text.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`];
    if (t.kind === 'han') facts.push('A full square; its ink keeps inside the character face.');
    if (rules.noStart.has(t.text)) facts.push('May not start a line.');
    if (rules.noEnd.has(t.text)) facts.push('May not end a line.');
    if (rules.hangable.has(t.text)) facts.push('May hang past the end of the line.');
    if (rules.halfClosing.has(t.text) || rules.halfOpening.has(t.text)) facts.push('Ink fills half the square: the empty half can be squeezed out.');
    else if (t.kind === 'punct' && '，。、：；！？'.includes(t.text)) facts.push('Set in the middle of the square here: no empty half to squeeze.');
    if (t.mark === 'squeeze' || t.mark === 'pair') facts.push('Squeezed to half width on this line.');
    if (t.mark === 'hang') facts.push('Hanging on this line.');
    if (t.mark === 'push') facts.push('Pushed to the start of this line.');
    if (t.offGrid) facts.push('Off the grid: the space before it was stretched.');
    loupeFacts.replaceChildren(...facts.map((f, i) => h('p', { class: i ? null : 'k' }, f)));
  }

  // ---- pointer -----------------------------------------------------------

  let drag: Drag | null = null;
  const at = (e: PointerEvent) => {
    const r = svg.getBoundingClientRect();
    return cjk() && state.vertical ? e.clientY - r.top : e.clientX - r.left;
  };
  svg.addEventListener('pointerdown', (e) => {
    const kind = (e.target as Element).closest('[data-drag]')?.getAttribute('data-drag') as Drag['kind'] | undefined;
    if (!kind) return;
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    const r = svg.getBoundingClientRect();
    drag = { kind, start: kind === 'g' ? at(e) : e.clientX - r.left, g0: state.gutter };
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const x = e.clientX - svg.getBoundingClientRect().left;
    const room = (other: number) => 1 - other - MIN_BLOCK / W;
    if (drag.kind === 'l') state.margin.l = clamp(x / W, 0.02, room(state.margin.r));
    else if (drag.kind === 'r') state.margin.r = clamp((W - x) / W, 0.02, room(state.margin.l));
    else state.gutter = clamp(drag.g0 + (at(e) - drag.start), 6, 160);
    render();
  });
  const end = () => { drag = null; };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('click', (e) => {
    const k = (e.target as Element).closest('[data-k]')?.getAttribute('data-k');
    if (k == null) return;
    state.loupe = Number(k);
    render();
  });

  fontStore.subscribe(() => { widths.clear(); render(); });
  // CJK fonts arrive by unicode range as characters appear; measure and draw again when they do.
  document.fonts.addEventListener('loadingdone', () => { widths.clear(); render(); });
  render();
}
