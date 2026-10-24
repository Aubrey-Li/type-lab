// The Type Lab mark: a Latin A and the ideograph 文 ("writing") sharing one
// em square, divided by a hairline. On each side one script is set solid and
// the other is a ghost outline, so both letters always read.
import { s, uid } from './dom';

const C = 50;          // centre of the 100-unit square

export function mark(opts: { size?: number; angle?: number } = {}) {
  const a = uid('mark-a'), b = uid('mark-b');
  const half = (side: 1 | -1) => s('polygon', { 'data-side': side });
  const clipA = s('clipPath', { id: a }, half(1));
  const clipB = s('clipPath', { id: b }, half(-1));

  // A: EB Garamond capitals are ~0.65 em tall, so this centres it optically.
  const latin = (cls: string) => s('text', { x: C, y: 79, 'text-anchor': 'middle', class: `mark-latin ${cls}` }, 'A');
  // 文: the CJK em box runs 0.88 em above the baseline, so the box is 8…88.
  const han = (cls: string) => s('text', { x: 10, y: 80.4, class: `mark-han ${cls}`, lang: 'zh-Hans' }, '文');
  const split = s('line', { class: 'mark-split' });

  const svg = s('svg', {
    viewBox: '0 0 100 100', class: 'mark', role: 'img', 'aria-label': 'Type Lab: A and 文 sharing one square',
    width: opts.size ?? null, height: opts.size ?? null,
  },
  s('defs', {}, clipA, clipB),
  s('rect', { x: 1, y: 1, width: 98, height: 98, class: 'mark-box' }),
  s('g', { 'clip-path': `url(#${a})` }, han('is-ghost'), latin('is-solid')),
  s('g', { 'clip-path': `url(#${b})` }, latin('is-ghost'), han('is-solid')),
  split);

  /** Turn the dividing line; degrees, 0 = horizontal. */
  function setAngle(deg: number) {
    const r = (deg * Math.PI) / 180;
    const d = [Math.cos(r), Math.sin(r)], n = [-d[1], d[0]];
    const L = 120;
    for (const poly of [clipA.firstChild, clipB.firstChild] as SVGPolygonElement[]) {
      const side = Number(poly.dataset.side);
      const pts = [[L, 0], [L, L], [-L, L], [-L, 0]].map(([u, v]) =>
        `${(C + d[0] * u + n[0] * v * side).toFixed(2)},${(C + d[1] * u + n[1] * v * side).toFixed(2)}`);
      poly.setAttribute('points', pts.join(' '));
    }
    // The hairline, clipped to the square by hand so it never pokes out.
    const t = Math.min(...[d[0], d[1]].map((c) => (Math.abs(c) < 1e-6 ? Infinity : 49 / Math.abs(c))));
    split.setAttribute('x1', String(C - d[0] * t));
    split.setAttribute('y1', String(C - d[1] * t));
    split.setAttribute('x2', String(C + d[0] * t));
    split.setAttribute('y2', String(C + d[1] * t));
  }
  setAngle(opts.angle ?? -45);
  return { svg, setAngle };
}
