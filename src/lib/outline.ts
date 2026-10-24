// Geometry on glyph outlines, in font units (y up): flatten curves to
// polygons, then ask where the ink is along a line, or where the counters are.
import type { Glyph, PathCommand } from 'opentype.js';

export type Poly = [number, number][];
export type Box = { x0: number; y0: number; x1: number; y1: number };

/** Each contour as a polygon, curves sampled finely enough for measuring. */
export function flatten(cmds: PathCommand[], steps = 16): Poly[] {
  const polys: Poly[] = [];
  let cur: Poly = [];
  let x = 0, y = 0;
  for (const c of cmds) {
    if (c.type === 'M') { if (cur.length) polys.push(cur); cur = [[c.x, c.y]]; x = c.x; y = c.y; }
    else if (c.type === 'L') { cur.push([c.x, c.y]); x = c.x; y = c.y; }
    else if (c.type === 'Q') {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        cur.push([u * u * x + 2 * u * t * c.x1 + t * t * c.x, u * u * y + 2 * u * t * c.y1 + t * t * c.y]);
      }
      x = c.x; y = c.y;
    } else if (c.type === 'C') {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        cur.push([
          u ** 3 * x + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t ** 3 * c.x,
          u ** 3 * y + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t ** 3 * c.y,
        ]);
      }
      x = c.x; y = c.y;
    }
  }
  if (cur.length) polys.push(cur);
  return polys.filter((p) => p.length > 2);
}

export const area = (p: Poly) =>
  p.reduce((a, [x, y], i) => { const [nx, ny] = p[(i + 1) % p.length]; return a + x * ny - nx * y; }, 0) / 2;

export function box(p: Poly): Box {
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Where a horizontal line at height y passes through ink: [enter, leave] pairs, left to right. */
export function spansAt(polys: Poly[], y: number): [number, number][] {
  const xs: number[] = [];
  for (const p of polys) {
    p.forEach(([ax, ay], i) => {
      const [bx, by] = p[(i + 1) % p.length];
      if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
    });
  }
  xs.sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}

/** A glyph's outline, ready to measure: its contours, overall box, and enclosed counters (bottom to top). */
export function analyse(g: Glyph) {
  const polys = flatten(g.path.commands);
  const outer = polys.reduce((a, p) => (Math.abs(area(p)) > Math.abs(area(a)) ? p : a), polys[0] ?? []);
  const sign = Math.sign(area(outer));
  const counters = polys.filter((p) => Math.sign(area(p)) === -sign).map(box).sort((a, b) => a.y0 - b.y0);
  const all = polys.flat();
  return { polys, counters, box: box(all.length ? all : [[0, 0]]), spansAt: (y: number) => spansAt(polys, y) };
}
export type Outline = ReturnType<typeof analyse>;
