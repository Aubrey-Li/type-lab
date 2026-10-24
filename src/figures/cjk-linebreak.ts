// Breaking CJK text on a grid of em squares, with and without line-breaking
// rules (禁则 / 禁則処理), and the three ways to satisfy them.
import { row, segmented, slider } from '../lib/controls';
import { fmt, h, s } from '../lib/dom';

type Mode = 'off' | 'hang' | 'squeeze' | 'push';

const TEXT = '排版是一门关于间隔的艺术。汉字在方格中排列，每个字占据一个全角的位置；标点也不例外。一行将尽时，句号、逗号和右括号不能出现在行首，而左括号和左引号不能留在行尾。这些规则，就叫作“禁则”（避头尾）。';

const NO_START = new Set('，。、；：！？）》」』”’】〕〉…·');
const NO_END = new Set('（《「『“‘【〔〈');
const HANGABLE = new Set('，。、');
// Punctuation whose ink fills only half the square, so it can give up the other half.
const CLOSING_HALF = new Set('，。、）》」』”’】〕〉');
const OPENING_HALF = new Set('（《「『“‘【〔〈');

interface Cell { ch: string; w: number; dx: number; flag?: boolean }
interface Line { cells: Cell[]; gap: number; hang?: Cell; note?: string }

function breakLines(chars: string[], n: number, mode: Mode): Line[] {
  const lines: Line[] = [];
  let i = 0;
  while (i < chars.length) {
    let take = Math.min(n, chars.length - i);
    const cells: Cell[] = chars.slice(i, i + take).map((ch) => ({ ch, w: 1, dx: 0 }));
    const line: Line = { cells, gap: 0 };
    const next = chars[i + take];

    if (mode === 'off') {
      if (NO_START.has(cells[0].ch)) { cells[0].flag = true; line.note = `starts with “${cells[0].ch}”, which may not begin a line`; }
      const last = cells[cells.length - 1];
      if (NO_END.has(last.ch) && next) { last.flag = true; line.note = `ends with “${last.ch}”, which may not end a line`; }
    } else if (next !== undefined) {
      let pushOut = false;
      if (NO_START.has(next)) {
        if (mode === 'hang' && HANGABLE.has(next)) {
          line.hang = { ch: next, w: 1, dx: 0, flag: true };
          take += 1;
          line.note = `hangs “${next}” in the margin`;
        } else if (mode === 'squeeze' && !NO_START.has(chars[i + take + 1] ?? '')) {
          const squeezable = cells.filter((c) => CLOSING_HALF.has(c.ch) || OPENING_HALF.has(c.ch));
          const extra: Cell = { ch: next, w: CLOSING_HALF.has(next) ? 0.5 : 1, dx: 0, flag: true };
          // Each squeezed mark gives back half a square; a half-width newcomer needs only one.
          const needed = extra.w === 0.5 ? 1 : 2;
          if (squeezable.length >= needed) {
            for (const c of squeezable.slice(-needed)) {
              c.w = 0.5;
              c.dx = OPENING_HALF.has(c.ch) ? -0.5 : 0;
              c.flag = true;
            }
            cells.push(extra);
            take += 1;
            line.note = `squeezes punctuation to half width to fit “${next}”`;
          } else pushOut = true;
        } else pushOut = true;
      }
      if (!pushOut && !line.hang && NO_END.has(cells[cells.length - 1].ch)) pushOut = true;

      if (pushOut) {
        // Send characters down until the next line starts, and this one ends, legally.
        let moved = 0;
        while (cells.length > 2 && moved < 3 &&
          (NO_START.has(chars[i + take] ?? '') || NO_END.has(cells[cells.length - 1].ch))) {
          cells.pop();
          take -= 1;
          moved += 1;
        }
        const used = cells.reduce((sum, c) => sum + c.w, 0);
        line.gap = (n - used) / Math.max(1, cells.length - 1);
        line.note = `pushes “${chars[i + take]}” to the next line; ${cells.length} characters spread over ${n} squares (+${fmt(line.gap, 2)} em per gap)`;
      }
    }
    lines.push(line);
    i += take;
  }
  return lines;
}

const NOTES: Record<Mode, string> = {
  off: 'With no rules, the grid breaks wherever it is full, and punctuation lands at the start of lines, cut off from the sentence it closes.',
  hang: '<strong>Hanging</strong> (悬挂, ぶら下げ) lets a full stop or comma sit just outside the measure. The grid stays intact; only the right edge is ragged by one mark.',
  squeeze: '<strong>Squeezing</strong> (挤进, 追い込み) takes back the empty half of two punctuation marks already in the line, which makes room for one more character.',
  push: '<strong>Pushing out</strong> (推出, 追い出し) moves a character down to join the mark that could not start a line, then spreads what is left across the full measure.',
};

export function mountCjkLineBreak(root: HTMLElement) {
  const state = { mode: 'push' as Mode, n: 13 };
  const controls = h('div', { class: 'controls' }, row(
    segmented<Mode>({ label: 'Rules', options: [
      { value: 'off', label: 'Off' }, { value: 'hang', label: 'Hang' },
      { value: 'squeeze', label: 'Squeeze' }, { value: 'push', label: 'Push out' },
    ], value: state.mode, onChange: (v) => { state.mode = v; render(); } }).el,
    slider({ label: 'Squares per line', min: 8, max: 24, value: state.n, onInput: (v) => { state.n = v; render(); } }).el,
  ));
  const svg = s('svg', { role: 'img', 'aria-label': 'Chinese text broken into lines on a square grid' });
  const caption = h('p', { class: 'caption' });
  const readout = h('div', { class: 'readout' });
  root.append(controls, h('div', { class: 'stage' }, svg), caption, readout);

  function render() {
    const lines = breakLines(Array.from(TEXT), state.n, state.mode);
    const C = Math.min(40, 820 / (state.n + 2));
    const x0 = 40, top = 20, lineStep = C * 1.6;
    const width = x0 * 2 + (state.n + 1.5) * C;
    const height = top * 2 + lines.length * lineStep;
    svg.setAttribute('viewBox', `0 0 ${Math.max(width, 600)} ${height}`);

    const els: SVGElement[] = [
      s('line', { x1: x0, x2: x0, y1: top - 6, y2: height - top, class: 'cjk-margin' }),
      s('line', { x1: x0 + state.n * C, x2: x0 + state.n * C, y1: top - 6, y2: height - top, class: 'cjk-margin' }),
    ];
    lines.forEach((line, j) => {
      const y = top + j * lineStep;
      for (let c = 0; c < state.n; c++) els.push(s('rect', { x: x0 + c * C, y, width: C, height: C, class: 'cjk-cell' }));
      let pos = 0;
      const draw = (cell: Cell, at: number) => {
        if (cell.flag) els.push(s('rect', { x: x0 + at * C, y, width: cell.w * C, height: C, class: 'cjk-cell is-flag' }));
        els.push(s('text', { x: x0 + (at + cell.dx) * C, y: y + 0.88 * C, 'font-size': C, lang: 'zh-Hans',
          style: 'font-family: var(--cjk-sc)', class: `cjk-char${cell.flag ? ' is-hl' : ''}` }, cell.ch));
      };
      for (const cell of line.cells) { draw(cell, pos); pos += cell.w + line.gap; }
      if (line.hang) draw(line.hang, state.n);
    });
    svg.replaceChildren(...els);

    caption.innerHTML = NOTES[state.mode];
    const notes = lines.map((l, j) => l.note && `line ${String(j + 1).padEnd(3)}${l.note}`).filter(Boolean);
    readout.replaceChildren(notes.length ? notes.join('\n') : 'every line already breaks legally at this width');
  }

  render();
  document.fonts.addEventListener('loadingdone', render);
}
