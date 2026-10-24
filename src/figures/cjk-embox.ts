// The CJK em square: where an ideograph sits relative to the Roman baseline,
// and how the same punctuation code point is drawn differently by locale.
import { checkbox, row, segmented } from '../lib/controls';
import { figureTitle, h, s } from '../lib/dom';

export type Locale = 'sc' | 'tc' | 'jp';

export const LOCALES: Record<Locale, { label: string; lang: string; family: string }> = {
  sc: { label: 'Simplified', lang: 'zh-Hans', family: 'var(--cjk-sc)' },
  tc: { label: 'Traditional', lang: 'zh-Hant', family: 'var(--cjk-tc)' },
  jp: { label: 'Japanese', lang: 'ja', family: 'var(--cjk-jp)' },
};

const EM_TOP = 0.88;     // Noto CJK: the em box runs from 0.88 em above the Roman baseline to 0.12 below
const ICF = 0.06;        // approximate ideographic character face inset
const BOX = 280;
const CHARS = ['永', '国', '。', '，', '、', '：', '！', '「', '」'];
const PUNCT = ['。', '，', '、', '：', '！', '？', '「', '」'];

const NOTES: Record<Locale, string> = {
  sc: '<strong>Simplified Chinese</strong> sets the full stop, comma and enumeration comma in the lower left of the square, close to the character they follow. Quotation marks are curly “ ”.',
  tc: '<strong>Traditional Chinese</strong>, as set in Taiwan, centres the full stop, comma, colon and exclamation mark in the square. Quotation uses corner brackets 「 」.',
  jp: '<strong>Japanese</strong> sets 。 and 、 in the lower left like Simplified Chinese, but centres the colon and uses corner brackets 「 」. The comma ， is rare; 、 does its work.',
};

export function mountCjkEmBox(root: HTMLElement) {
  const state = { locale: 'sc' as Locale, ch: '永', icf: true, lines: true };

  const charPicker = segmented({ label: 'Character', options: CHARS, value: state.ch, onChange: (v) => { state.ch = v; render(); } }).el;
  charPicker.classList.add('is-glyphs');

  const controls = h('div', { class: 'controls' },
    row(
      segmented<Locale>({ label: 'Locale', options: (Object.keys(LOCALES) as Locale[]).map((k) => ({ value: k, label: LOCALES[k].label })),
        value: state.locale, onChange: (v) => { state.locale = v; render(); } }).el,
      checkbox({ label: 'Character face', checked: state.icf, onChange: (v) => { state.icf = v; render(); } }).el,
      checkbox({ label: 'Baselines', checked: state.lines, onChange: (v) => { state.lines = v; render(); } }).el,
    ),
    row(charPicker),
  );

  const svg = s('svg', { viewBox: '0 0 960 620', role: 'img', 'aria-label': 'An ideograph in its em box, and punctuation compared across locales' });
  const caption = h('p', { class: 'caption' });
  root.append(figureTitle('One square, three conventions'), controls, h('div', { class: 'stage' }, svg), caption);

  function render() {
    const loc = LOCALES[state.locale];
    const els: SVGElement[] = [];
    const x0 = 60, top = 50;
    const base = top + EM_TOP * BOX;

    // Big em box.
    els.push(s('rect', { x: x0, y: top, width: BOX, height: BOX, class: 'accent-stroke', 'stroke-width': 1.2 }));
    if (state.icf) {
      els.push(s('rect', { x: x0 + ICF * BOX, y: top + ICF * BOX, width: BOX * (1 - 2 * ICF), height: BOX * (1 - 2 * ICF),
        class: 'accent-stroke', 'stroke-dasharray': '5 4' }));
    }
    els.push(
      s('line', { x1: x0 + BOX / 2, x2: x0 + BOX / 2, y1: top, y2: top + BOX, class: 'guide' }),
      s('line', { x1: x0, x2: x0 + BOX, y1: top + BOX / 2, y2: top + BOX / 2, class: 'guide' }),
      s('text', { x: x0, y: base, 'font-size': BOX, lang: loc.lang, style: `font-family:${loc.family}`, class: 'cjk-char' }, state.ch),
    );

    // Latin set on the same Roman baseline, at the same size.
    const latinX = x0 + BOX + 30;
    els.push(s('text', { x: latinX, y: base, 'font-size': BOX, style: 'font-family: var(--serif)', class: 'ghost' }, 'Ag'));

    if (state.lines) {
      const lines: [string, number][] = [
        ['EM TOP', top], ['CENTRAL', top + BOX / 2], ['ROMAN BASELINE', base], ['IDEOGRAPHIC', top + BOX],
      ];
      for (const [label, y] of lines) {
        els.push(
          s('line', { x1: x0 - 20, x2: 760, y1: y, y2: y, class: `guide${label === 'ROMAN BASELINE' ? ' is-hl' : ''}` }),
          s('text', { x: 772, y: y + 4, class: `svg-label${label === 'ROMAN BASELINE' ? ' is-hl' : ''}` }, label),
        );
      }
      // The 0.12 em the em box hangs below the Roman baseline.
      const bx = x0 - 14;
      els.push(
        s('line', { x1: bx, x2: bx, y1: base, y2: top + BOX, class: 'leader' }),
        s('text', { x: bx - 8, y: (base + top + BOX) / 2 + 4, 'text-anchor': 'end', class: 'svg-num', style: 'fill: var(--accent)' }, '0.12'),
      );
    }

    // Punctuation across locales.
    const cell = 52, gx = 200, gy = 430;
    els.push(s('text', { x: x0, y: gy - 26, class: 'svg-label is-hl' }, 'THE SAME CODE POINTS, BY LOCALE'));
    (Object.keys(LOCALES) as Locale[]).forEach((key, r) => {
      const L = LOCALES[key];
      const y = gy + r * (cell + 14);
      els.push(s('text', { x: x0, y: y + cell / 2 + 5, class: `svg-label${key === state.locale ? ' is-hl' : ''}` }, L.label.toUpperCase()));
      PUNCT.forEach((p, c) => {
        const x = gx + c * (cell + 12);
        const hot = key === state.locale && p === state.ch;
        els.push(
          s('rect', { x, y, width: cell, height: cell, class: hot ? 'accent-stroke' : 'guide' }),
          s('line', { x1: x + cell / 2, x2: x + cell / 2, y1: y, y2: y + cell, class: 'guide', opacity: 0.5 }),
          s('line', { x1: x, x2: x + cell, y1: y + cell / 2, y2: y + cell / 2, class: 'guide', opacity: 0.5 }),
          s('text', { x, y: y + EM_TOP * cell, 'font-size': cell, lang: L.lang, style: `font-family:${L.family}`,
            class: `cjk-char${key === state.locale ? ' is-hl' : ''}` }, p),
        );
      });
    });
    PUNCT.forEach((p, c) => els.push(s('text', { x: gx + c * (cell + 12) + cell / 2, y: gy + 3 * (cell + 14) + 12, 'text-anchor': 'middle', class: 'svg-num' },
      `U+${p.codePointAt(0)!.toString(16).toUpperCase()}`)));

    svg.replaceChildren(...els);
    caption.innerHTML = NOTES[state.locale];
  }

  render();
  // CJK fonts arrive lazily per unicode range; redraw once they have.
  document.fonts.ready.then(render);
  document.fonts.addEventListener('loadingdone', render);
}
