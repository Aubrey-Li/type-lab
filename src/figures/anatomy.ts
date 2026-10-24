// The book's anatomy plate: grey words with the named part shown in red.
// Each part is the same <text> drawn again in the accent color, clipped to a
// region. Roman parts are found on EB Garamond's actual outlines (where a
// stroke crosses a line, where the counters sit); the italic ones are given as
// fractions of the character's advance box and font lines.
import type { Font } from 'opentype.js';
import { h, s, uid } from '../lib/dom';
import { loadCatalogFont, measureText } from '../lib/fonts';
import { analyse, type Outline } from '../lib/outline';

const FAMILY = 'EB Garamond';
const SIZE = 112;

type Line = 'base' | 'x' | 'cap' | 'asc' | 'desc';
/** A font line, or a height in em above the baseline. */
type Y = Line | number;

/** A region in font units, measured on the character's outline: [x0, y0, x1, y1], y up. */
type Shape = (o: Outline, m: { x: number; cap: number; asc: number }) => [number, number, number, number];

interface Part {
  id: string;
  label: string;
  /** Character index, or [first, last] for a region spanning several. */
  glyph: number | [number, number];
  /** Either a shape measured on the outline, or fractions of the advance box and font lines. */
  shape?: Shape;
  x?: [number, number];
  y?: [Y, Y];
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
      // The stem: the ink a line low on the letter crosses first (below the F's middle arm).
      // Its width, full height, serifs left out.
      { id: 'stem', label: 'Stem', glyph: 0, at: 'below', dx: 0.5,
        shape: (o, m) => { const [a, b] = o.spansAt(m.cap * 0.22)[0]; return [a, 0, b, m.cap]; } },
      // The bowl: the closed counter plus the stroke around it, up to the right-hand stem.
      { id: 'bowl', label: 'Bowl', glyph: 1, at: 'below', dx: 0.45,
        shape: (o) => {
          const c = o.counters[0];
          const stroke = c.y0 - o.box.y0;
          const stem = o.spansAt((c.y0 + c.y1) / 2).at(-1)!;
          return [o.box.x0, o.box.y0, stem[0], c.y1 + stroke];
        } },
      // The serif: the foot of the right stem, either side of it.
      { id: 'serif', label: 'Serif', glyph: 2, at: 'below', dx: 0.5,
        shape: (o, m) => {
          const [a, b] = o.spansAt(m.x / 2).at(-1)!;
          return [a - (b - a), o.box.y0, o.box.x1, 0.045 * 1000];
        } },
      { id: 'descender', label: 'Descender', glyph: 4, at: 'right',
        shape: (o) => [o.box.x0, o.box.y0, o.box.x1, 0] },
    ],
  },
  {
    text: 'flesh', italic: true, cx: 735, base: 170, parts: [
      { id: 'ligature', label: 'Ligature', glyph: [0, 1], x: [0, 1.08], y: ['x', 'asc'], at: 'above', dx: 0.35 },
      { id: 'finial', label: 'Finial', glyph: 2, x: [0.5, 1.6], y: [-0.03, 0.2], at: 'below', dx: 0.25 },
      { id: 'ascender', label: 'Ascender', glyph: 4, x: [0, 0.6], y: ['x', 'asc'], at: 'above', dx: 0.6 },
    ],
  },
  {
    text: 'fresh', cx: 300, base: 425, parts: [
      // The terminal: the hooked end of the f's top, right of its stem.
      { id: 'terminal', label: 'Terminal', glyph: 0, at: 'above', dx: 0.4,
        shape: (o, m) => { const [, b] = o.spansAt(m.x / 2)[0]; return [b, m.x + (m.asc - m.x) * 0.45, o.box.x1, o.box.y1]; } },
      // The spine: the middle third of the s, where its stroke crosses the letter.
      { id: 'spine', label: 'Spine', glyph: 3, at: 'below', dx: 0.5,
        shape: (o, m) => [o.box.x0, m.x * 0.3, o.box.x1, m.x * 0.7] },
      // The ascender: the stem above the x-height, flag and all.
      { id: 'ascender', label: 'Ascender', glyph: 4, at: 'above', dx: 0.5,
        shape: (o, m) => { const [, b] = o.spansAt((m.x + m.asc) / 2)[0]; return [o.box.x0, m.x, b, o.box.y1]; } },
    ],
  },
  {
    text: 'Blood', smallCaps: [1, 4], cx: 735, base: 425, parts: [
      // The cross bar: between the B's two counters, right of the stem, to where the bowls meet.
      { id: 'crossbar', label: 'Cross bar', glyph: 0, at: 'below', dx: 0.5,
        shape: (o, m) => {
          const [lower, upper] = o.counters;
          const [, stem] = o.spansAt(m.cap / 4)[0];
          // A little past the counters' edges, so the join reads as a stroke.
          return [stem, lower.y1 - 12, Math.max(lower.x1, upper.x1), upper.y0 + 12];
        } },
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

/** EB Garamond's lines in font units (OS/2 x-height and cap height; the top of b, d, h). */
const FONT_LINES = { x: 400, cap: 650, asc: 705 };

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

  let roman: Font | null = null;
  void loadCatalogFont('eb-garamond').then((f) => {
    roman = f.ot;
    for (const plate of PLATES) drawPlate(plate, plate.italic ? italicLines : romanLines);
    show(pinned);
  });

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
      let x0: number, x1: number, top: number, bottom: number;
      if (part.shape && roman && !plate.italic) {
        // Font units → px: the character's pen position is its origin.
        const k = SIZE / roman.unitsPerEm;
        const [fx0, fy0, fx1, fy1] = part.shape(analyse(roman.charToGlyph(plate.text[i0])), FONT_LINES);
        // A hair of padding so antialiased edges are not shaved off.
        x0 = a.x + fx0 * k - 0.5; x1 = a.x + fx1 * k + 0.5;
        top = plate.base - fy1 * k - 0.5; bottom = plate.base - fy0 * k + 0.5;
      } else {
        const span = b.x + b.width - a.x;
        x0 = a.x + part.x![0] * span; x1 = a.x + part.x![1] * span;
        top = yOf(part.y![1]); bottom = yOf(part.y![0]);
      }

      const g = s('g', { 'data-part': part.id });
      if (part.dot) {
        g.append(s('circle', { cx: x0, cy: top, r: 5, class: 'accent-fill part', 'data-part': part.id }));
      } else {
        const clipId = uid('anatomy-clip');
        defs.append(s('clipPath', { id: clipId }, s('rect', { x: x0, y: top, width: x1 - x0, height: bottom - top })));
        // Only this part's own letters go red, set at their exact pen position, so an
        // overhanging neighbour (italics overlap) can never show through the clip.
        const own = plate.text.slice(i0, i1 + 1);
        const small = plate.smallCaps && i0 >= plate.smallCaps[0] && i0 < plate.smallCaps[1];
        const red = s('text', {
          x: a.x, y: plate.base, class: 'accent-fill', 'font-family': FAMILY, 'font-size': SIZE,
          'font-style': plate.italic ? 'italic' : null, style: small ? 'font-variant-caps: small-caps' : null,
        }, own);
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
