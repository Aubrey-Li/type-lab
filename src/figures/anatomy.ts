// The book's anatomy plate: grey words with the named part shown in red.
// Each part is the same <text> drawn again in the accent color, clipped to a
// region. Regions are given per character, as fractions of that character's
// advance box horizontally and as font lines vertically, and are tuned to
// EB Garamond.
import { h, s, uid } from '../lib/dom';
import { measureText } from '../lib/fonts';

const FAMILY = 'EB Garamond';
const SIZE = 112;

type Line = 'base' | 'x' | 'cap' | 'asc' | 'desc';
/** A font line, or a height in em above the baseline. */
type Y = Line | number;

interface Part {
  id: string;
  label: string;
  /** Character index, or [first, last] for a region spanning several. */
  glyph: number | [number, number];
  x: [number, number];
  y: [Y, Y];
  /** Where the callout sits; `dx` nudges the leader along the part. */
  at: 'above' | 'below' | 'right';
  dx?: number;
  /** Mark a point (e.g. the empty counter) instead of clipping ink. */
  dot?: boolean;
}

interface Plate {
  text: string;
  italic?: boolean;
  /** Characters [start, end) set as small capitals. */
  smallCaps?: [number, number];
  cx: number;
  base: number;
  guides?: boolean;
  parts: Part[];
}

const PLATES: Plate[] = [
  {
    text: 'Fancy', cx: 300, base: 170, guides: true, parts: [
      { id: 'stem', label: 'Stem', glyph: 0, x: [0, 0.33], y: ['base', 'cap'], at: 'below', dx: 0.3 },
      { id: 'bowl', label: 'Bowl', glyph: 1, x: [0, 0.62], y: [-0.02, 0.27], at: 'below', dx: 0.3 },
      { id: 'serif', label: 'Serif', glyph: 2, x: [0.58, 1.02], y: [-0.02, 0.05], at: 'below', dx: 0.5 },
      { id: 'descender', label: 'Descender', glyph: 4, x: [-0.1, 1], y: ['desc', 'base'], at: 'right' },
    ],
  },
  {
    text: 'flesh', italic: true, cx: 735, base: 170, parts: [
      { id: 'ligature', label: 'Ligature', glyph: [0, 1], x: [0, 1.08], y: ['x', 'asc'], at: 'above', dx: 0.35 },
      { id: 'finial', label: 'Finial', glyph: 2, x: [0.45, 1], y: [-0.02, 0.2], at: 'below', dx: 0.4 },
      { id: 'ascender', label: 'Ascender', glyph: 4, x: [0, 0.6], y: ['x', 'asc'], at: 'above', dx: 0.6 },
    ],
  },
  {
    text: 'fresh', cx: 300, base: 425, parts: [
      { id: 'terminal', label: 'Terminal', glyph: 0, x: [0.45, 1.25], y: [0.56, 'asc'], at: 'above', dx: 0.3 },
      { id: 'spine', label: 'Spine', glyph: 3, x: [0.12, 0.88], y: [0.13, 0.3], at: 'below', dx: 0.5 },
      { id: 'ascender', label: 'Ascender', glyph: 4, x: [0, 0.5], y: ['x', 'asc'], at: 'above', dx: 0.5 },
    ],
  },
  {
    text: 'Blood', smallCaps: [1, 4], cx: 735, base: 425, parts: [
      { id: 'crossbar', label: 'Cross bar', glyph: 0, x: [0.12, 0.72], y: [0.29, 0.37], at: 'below', dx: 0.2 },
      { id: 'small-capital', label: 'Small capital', glyph: 1, x: [0, 1], y: ['desc', 'asc'], at: 'above', dx: 0.3 },
      { id: 'counter', label: 'Counter', glyph: 3, x: [0.5, 0.5], y: [0.24, 0.24], at: 'below', dot: true },
      { id: 'lowercase', label: 'Lowercase', glyph: 4, x: [0, 1], y: ['desc', 'asc'], at: 'above', dx: 0.6 },
    ],
  },
];

const DEFINITIONS: Record<string, string> = {
  stem: '<strong>Stem</strong>: the main vertical stroke of a letter.',
  bowl: '<strong>Bowl</strong>: a curved stroke enclosing a counter, like the belly of a, b or p.',
  serif: '<strong>Serif</strong>: the small finishing stroke at the end of a main stroke, a trace of the pen and the chisel.',
  descender: '<strong>Descender</strong>: the part of a lowercase letter that drops below the baseline, as in g, p and y.',
  ligature: '<strong>Ligature</strong>: two letters fused into one glyph. The hood of the f would otherwise collide with the l. A layout engine substitutes it; the text still holds two characters.',
  finial: '<strong>Finial</strong>: a tapered or curved end to a stroke, like the flick that closes the italic e.',
  ascender: '<strong>Ascender</strong>: the part of a lowercase letter that rises above the x-height, as in b, d, h and l.',
  terminal: '<strong>Terminal</strong>: the end of a stroke that has no serif. Here, the ball at the top of the f.',
  spine: '<strong>Spine</strong>: the curving central stroke of the s.',
  crossbar: '<strong>Cross bar</strong>: a horizontal stroke. In the B it is where the two bowls meet.',
  'small-capital': '<strong>Small capital</strong>: a capital drawn near the x-height with stroke weights matched to the lowercase. A shrunken capital looks too light.',
  counter: '<strong>Counter</strong>: the space, fully or partly enclosed, inside a letter. Type is drawn as much in its white as in its black.',
  lowercase: '<strong>Lowercase</strong>: named for the lower case of a compositor’s type case, where these letters were kept.',
};

const DEFAULT_CAPTION = '';

export function mountAnatomy(root: HTMLElement) {
  const svg = s('svg', { viewBox: '0 0 960 520', class: 'anatomy', role: 'img', 'aria-label': 'Annotated letterforms: Fancy, flesh, fresh, Blood' });
  const defs = s('defs');
  svg.append(defs);
  const caption = h('p', { class: 'caption live' });
  root.append(h('div', { class: 'stage' }, svg), caption);

  const lines = (style: string): Record<Line, number> => ({
    base: 0,
    x: measureText(FAMILY, SIZE, 'x', style).actualBoundingBoxAscent,
    cap: measureText(FAMILY, SIZE, 'H', style).actualBoundingBoxAscent + 0.02 * SIZE,
    asc: measureText(FAMILY, SIZE, 'bdhkl', style).actualBoundingBoxAscent + 0.03 * SIZE,
    desc: -measureText(FAMILY, SIZE, 'gjpqy', style).actualBoundingBoxDescent - 0.03 * SIZE,
  });
  const romanLines = lines('normal');
  const italicLines = lines('italic');

  for (const plate of PLATES) drawPlate(plate, plate.italic ? italicLines : romanLines);

  // Hover previews a part, click pins it.
  let pinned: string | null = null;
  function show(id: string | null) {
    svg.querySelectorAll<SVGElement>('[data-part]').forEach((el) =>
      el.classList.toggle('is-dim', id !== null && el.dataset.part !== id));
    caption.innerHTML = id ? DEFINITIONS[id] : DEFAULT_CAPTION;
  }
  svg.addEventListener('pointerover', (e) => {
    const id = (e.target as Element).closest<SVGElement>('[data-part]')?.dataset.part;
    if (id && (e.target as Element).closest('.callout, .hit')) show(id);
  });
  svg.addEventListener('pointerleave', () => show(pinned));
  svg.addEventListener('click', (e) => {
    const id = (e.target as Element).closest<SVGElement>('.callout, .hit')?.dataset.part ?? null;
    pinned = id === pinned ? null : id;
    show(pinned ?? id);
  });
  show(null);

  function drawPlate(plate: Plate, y: Record<Line, number>) {
    const text = s('text', {
      x: plate.cx, y: plate.base, 'text-anchor': 'middle', class: 'ghost',
      'font-family': FAMILY, 'font-size': SIZE, 'font-style': plate.italic ? 'italic' : null,
    });
    if (plate.smallCaps) {
      const [a, b] = plate.smallCaps;
      text.append(plate.text.slice(0, a),
        s('tspan', { style: 'font-variant-caps: small-caps' }, plate.text.slice(a, b)),
        plate.text.slice(b));
    } else {
      text.textContent = plate.text;
    }
    svg.append(text);

    const yOf = (v: Y) => plate.base - (typeof v === 'number' ? v * SIZE : y[v]);

    if (plate.guides) {
      const left = text.getExtentOfChar(0).x - 26;
      const marks: [string, Line][] = [['Cap height', 'cap'], ['x-height', 'x'], ['Baseline', 'base']];
      const top = yOf('cap'), bottom = yOf('base');
      svg.append(s('line', { x1: left + 14, x2: left + 14, y1: top, y2: bottom, class: 'leader' }));
      for (const [label, line] of marks) {
        const ly = line === 'cap' ? top : yOf(line);
        svg.append(
          s('line', { x1: left, x2: left + 14, y1: ly, y2: ly, class: 'leader' }),
          s('text', { x: left - 6, y: ly + 4, 'text-anchor': 'end', class: 'svg-label is-hl' }, label.toUpperCase()),
        );
      }
    }

    for (const part of plate.parts) {
      const [i0, i1] = Array.isArray(part.glyph) ? part.glyph : [part.glyph, part.glyph];
      const a = text.getExtentOfChar(i0), b = text.getExtentOfChar(i1);
      const span = b.x + b.width - a.x;
      const x0 = a.x + part.x[0] * span, x1 = a.x + part.x[1] * span;
      const top = yOf(part.y[1]), bottom = yOf(part.y[0]);

      const g = s('g', { 'data-part': part.id });
      if (part.dot) {
        g.append(s('circle', { cx: x0, cy: top, r: 5, class: 'accent-fill part', 'data-part': part.id }));
      } else {
        const clipId = uid('anatomy-clip');
        defs.append(s('clipPath', { id: clipId }, s('rect', { x: x0, y: top, width: x1 - x0, height: bottom - top })));
        const red = text.cloneNode(true) as SVGTextElement;
        red.setAttribute('class', 'accent-fill');
        g.append(s('g', { 'clip-path': `url(#${clipId})`, class: 'part', 'data-part': part.id }, red));
      }
      g.append(s('rect', { x: x0 - 4, y: top - 4, width: x1 - x0 + 8, height: bottom - top + 8, class: 'hit', 'data-part': part.id }));
      g.append(callout(part, x0, x1, top, bottom, plate.base, y));
      svg.append(g);
    }
  }

  function callout(part: Part, x0: number, x1: number, top: number, bottom: number, base: number, y: Record<Line, number>) {
    const g = s('g', { class: 'callout', 'data-part': part.id });
    const label = part.label.toUpperCase();
    if (part.at === 'right') {
      const my = (top + bottom) / 2;
      g.append(
        s('line', { x1: x1 + 4, x2: x1 + 34, y1: my, y2: my, class: 'leader' }),
        s('text', { x: x1 + 40, y: my + 4, class: 'svg-label is-hl' }, label),
      );
      return g;
    }
    const lx = x0 + (part.dx ?? 0) * (x1 - x0);
    if (part.at === 'above') {
      const ly = base - y.asc - 30;
      g.append(
        s('line', { x1: lx, x2: lx, y1: ly - 11, y2: top - 3, class: 'leader' }),
        s('text', { x: lx + 6, y: ly, class: 'svg-label is-hl' }, label),
      );
    } else {
      const ly = base - y.desc + 34;
      g.append(
        s('line', { x1: lx, x2: lx, y1: bottom + 3, y2: ly + 3, class: 'leader' }),
        s('text', { x: lx + 6, y: ly, class: 'svg-label is-hl' }, label),
      );
    }
    return g;
  }
}
