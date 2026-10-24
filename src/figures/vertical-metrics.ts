// Where a font's lines fall, and how the first baseline and the leading of a
// text frame are derived from them.
import { checkbox, row, segmented, select, slider } from '../lib/controls';
import { fmt, h, s } from '../lib/dom';
import { fontPicker } from '../lib/font-picker';
import { fontStore, measureText, verticalMetrics } from '../lib/fonts';

const SIZE = 72;
const LARGE = 108;          // the "larger run" size
const EM_TOP = 0.88;        // CJK em box: top 0.88 em above the Roman baseline, bottom 0.12 below
const ICF_INSET = 0.06;     // approximate ideographic character face inset

type Line = 'ascent' | 'cap' | 'x' | 'baseline' | 'descent' | 'leading' | 'em';
type First = 'ascent' | 'cap' | 'x' | 'leading' | 'em';

const LINES: { value: Line; label: string }[] = [
  { value: 'ascent', label: 'Ascent' }, { value: 'cap', label: 'Cap height' }, { value: 'x', label: 'x-height' },
  { value: 'baseline', label: 'Baseline' }, { value: 'descent', label: 'Descent' },
  { value: 'leading', label: 'Leading' }, { value: 'em', label: 'Em box' },
];

const NOTES: Record<Line, string> = {
  ascent: '<strong>Ascent</strong>: the height the font reserves above the baseline (hhea ascender on macOS). It is a promise about the tallest accents, not a measurement of any one letter, which is why the first line often looks pushed down.',
  cap: '<strong>Cap height</strong>: the top of flat capitals such as H. Round letters like O overshoot it slightly so that they look the same height.',
  x: '<strong>x-height</strong>: the top of lowercase letters without ascenders. It decides how big a face looks: at the same point size, a face with a tall x-height reads larger.',
  baseline: '<strong>Baseline</strong>: the line letters sit on. Every other line is measured from it, positive upward.',
  descent: '<strong>Descent</strong>: the space reserved below the baseline for descenders such as g, p and y.',
  leading: '<strong>Leading</strong>: the distance from one baseline to the next, named for the strips of lead once set between lines of metal type. Auto leading is 120% of the largest size in the line.',
  em: '<strong>Em box</strong>: a square one em (the font size) on a side. CJK fonts design every ideograph inside it, with its bottom 0.12 em below the Roman baseline. The dashed box is the ideographic character face, the part the ink actually fills.',
};

export function mountVerticalMetrics(root: HTMLElement) {
  const state = {
    hl: 'em' as Line,
    first: 'ascent' as First,
    minimum: 0,
    auto: true,
    leading: 90,
    larger: false,
  };

  const leadingCtl = slider({ label: 'Leading', min: 40, max: 180, value: state.leading, format: (v) => fmt(v),
    onInput: (v) => { state.leading = v; render(); } });

  const controls = h('div', { class: 'controls' },
    row(segmented({ options: LINES, value: state.hl, onChange: (v) => { state.hl = v; render(); } }).el),
    row(
      fontPicker(),
      select<First>({
        label: 'First baseline',
        groups: [{ options: [
          { value: 'ascent', label: 'Ascent' }, { value: 'cap', label: 'Cap height' }, { value: 'x', label: 'x-height' },
          { value: 'leading', label: 'Leading' }, { value: 'em', label: 'Em box height' },
        ] }],
        value: state.first,
        onChange: (v) => { state.first = v; render(); },
      }).el,
    ),
    row(
      slider({ label: 'Minimum', min: 0, max: 140, value: 0, onInput: (v) => { state.minimum = v; render(); } }).el,
      checkbox({ label: 'Auto leading', checked: state.auto, onChange: (v) => { state.auto = v; render(); } }).el,
      leadingCtl.el,
      checkbox({ label: 'Add a larger run', checked: state.larger, onChange: (v) => { state.larger = v; render(); } }).el,
    ),
  );

  const svg = s('svg', { viewBox: '0 0 960 340', role: 'img', 'aria-label': 'Vertical lines of a font around two lines of text' });
  const caption = h('p', { class: 'caption' });
  const readout = h('div', { class: 'readout' });
  root.append(controls, h('div', { class: 'stage' }, svg), caption, readout);

  function render() {
    const font = fontStore.get();
    const family = `"${font.family}"`;
    const m = verticalMetrics(font, SIZE);
    const big = state.larger ? verticalMetrics(font, LARGE) : null;
    const maxSize = big ? LARGE : SIZE;
    // A line's metrics are the largest of its runs.
    const line = {
      ascent: Math.max(m.ascent, big?.ascent ?? 0),
      cap: Math.max(m.cap, big?.cap ?? 0),
      x: Math.max(m.x, big?.x ?? 0),
      descent: Math.max(m.descent, big?.descent ?? 0),
    };
    const leading = state.auto ? 1.2 * maxSize : state.leading;
    leadingCtl.disable(state.auto);
    if (state.auto) leadingCtl.set(Math.round(leading));

    const choices: Record<First, number> = { ...line, leading, em: EM_TOP * maxSize };
    const firstBaseline = Math.max(choices[state.first], state.minimum);

    const Y0 = 40;
    const b1 = Y0 + firstBaseline;
    const b2 = b1 + leading;
    const TEXT_X = 210;
    const runA = state.larger ? 'Fan' : 'Fancy';
    const wA = measureText(font.family, SIZE, runA).width;
    const wB = state.larger ? measureText(font.family, LARGE, 'cy').width : 0;
    const emX = TEXT_X + wA + wB + 34;
    const RX = Math.max(emX + SIZE + 70, 720);
    const height = b2 + line.descent + 36;
    svg.setAttribute('viewBox', `0 0 960 ${Math.max(300, height)}`);

    const hl = (l: Line) => (state.hl === l ? ' is-hl' : '');
    const els: SVGElement[] = [];
    const rule = (y: number, l: Line | null, x2 = RX - 20) =>
      els.push(s('line', { x1: TEXT_X - 14, x2, y1: y, y2: y, class: `guide${l ? hl(l) : ''}` }));

    // Frame top and the lines of line 1.
    rule(Y0, null, RX + 150);
    const marks: [Line, string, number][] = [
      ['ascent', 'Ascent', b1 - line.ascent], ['cap', 'Cap height', b1 - line.cap], ['x', 'x-height', b1 - line.x],
      ['baseline', 'Baseline', b1], ['descent', 'Descent', b1 + line.descent],
    ];
    for (const [l, , y] of marks) rule(y, l);
    rule(b2, 'baseline');

    // Labels on the left, nudged apart where lines crowd together.
    let lastY = -Infinity;
    const bx = TEXT_X - 26;
    els.push(s('line', { x1: bx, x2: bx, y1: marks[0][2], y2: marks[4][2], class: 'rule-line' }));
    for (const [l, label, y] of marks) {
      const ly = Math.max(y + 4, lastY + 15);
      lastY = ly;
      els.push(
        s('line', { x1: bx, x2: bx + 8, y1: y, y2: y, class: `rule-line${hl(l)}` }),
        s('text', { x: bx - 8, y: ly, 'text-anchor': 'end', class: `svg-label${hl(l)}` }, label.toUpperCase()),
      );
    }

    // The text itself.
    const t1 = s('text', { x: TEXT_X, y: b1, 'font-family': family, 'font-size': SIZE, class: 'ghost' }, runA);
    if (state.larger) t1.append(s('tspan', { 'font-size': LARGE }, 'cy'));
    els.push(t1, s('text', { x: TEXT_X, y: b2, 'font-family': family, 'font-size': SIZE, class: 'ghost' }, 'fresh'));

    // Em box with an ideograph.
    const emTop = b1 - EM_TOP * SIZE;
    const isEm = state.hl === 'em';
    els.push(
      s('rect', { x: emX, y: emTop, width: SIZE, height: SIZE, class: isEm ? 'accent-stroke' : 'guide', 'stroke-width': 1.2 }),
      s('rect', { x: emX + ICF_INSET * SIZE, y: emTop + ICF_INSET * SIZE, width: SIZE * (1 - 2 * ICF_INSET), height: SIZE * (1 - 2 * ICF_INSET),
        class: isEm ? 'accent-stroke' : 'guide', 'stroke-dasharray': '4 3' }),
      s('text', { x: emX, y: b1, style: 'font-family: var(--cjk-sc)', 'font-size': SIZE, class: isEm ? 'accent-fill' : 'ghost' }, '永'),
      s('text', { x: emX, y: emTop - 10, class: `svg-label${hl('em')}` }, 'EM BOX'),
    );

    // Scale on the right: frame top → first baseline → second baseline.
    const isLead = state.hl === 'leading';
    els.push(
      s('line', { x1: RX, x2: RX, y1: Y0, y2: b1, class: 'rule-line' }),
      s('line', { x1: RX, x2: RX, y1: b1, y2: b2, class: `rule-line${isLead ? ' is-hl' : ''}` }),
      ...[Y0, b1, b2].map((y) => s('line', { x1: RX - 6, x2: RX + 6, y1: y, y2: y, class: 'rule-line' })),
      s('text', { x: RX + 22, y: Y0 + 4, class: 'svg-label' }, 'FRAME TOP'),
      s('text', { x: RX + 22, y: (Y0 + b1) / 2, class: 'svg-label' }, 'FIRST BASELINE'),
      s('text', { x: RX + 22, y: (Y0 + b1) / 2 + 18, class: 'svg-num' }, fmt(firstBaseline)),
      s('text', { x: RX + 22, y: (b1 + b2) / 2, class: `svg-label${isLead ? ' is-hl' : ''}` }, 'LEADING'),
      s('text', { x: RX + 22, y: (b1 + b2) / 2 + 18, class: 'svg-num' }, fmt(leading)),
    );
    svg.replaceChildren(...els);

    caption.innerHTML = NOTES[state.hl];
    const firstLabel = { ascent: 'ascent', cap: 'cap height', x: 'x-height', leading: 'leading', em: 'em box height' }[state.first];
    const k = (t: string) => h('span', { class: 'k' }, t);
    readout.replaceChildren(
      k('line 1   '), `first baseline = ${fmt(firstBaseline)}   ← max(${firstLabel} ${fmt(choices[state.first])}, minimum ${state.minimum})\n`,
      `         leading        = ${fmt(leading)}   ← ${state.auto ? `auto: 120% of the largest size (${maxSize})` : 'fixed'}\n`,
      `         ascent ${fmt(line.ascent)} · cap ${fmt(line.cap)} · x ${fmt(line.x)} · descent ${fmt(line.descent)}   (${m.source}${m.unitsPerEm ? `, ${m.unitsPerEm} units/em` : ''})\n`,
      k('em box   '), `${SIZE} × ${SIZE}; top ${fmt(EM_TOP * SIZE)} above the baseline, bottom ${fmt((1 - EM_TOP) * SIZE)} below`,
    );
  }

  fontStore.subscribe(render);
  render();
}
