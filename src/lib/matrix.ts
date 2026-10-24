// 2D affine matrices in SVG order [a, b, c, d, e, f]:
//   x' = a·x + c·y + e
//   y' = b·x + d·y + f
export type Mat = [number, number, number, number, number, number];

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

/** m · n: apply n first, then m. */
export function mul(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export const compose = (...ms: Mat[]) => ms.reduce(mul, IDENTITY);
export const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
export const scale = (sx: number, sy = sx): Mat => [sx, 0, 0, sy, 0, 0];

/** Degrees; positive turns clockwise on screen (y points down). */
export function rotate(deg: number): Mat {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
}

/** Apply m around the point (cx, cy) instead of the origin. */
export const about = (m: Mat, cx: number, cy: number) =>
  compose(translate(cx, cy), m, translate(-cx, -cy));

export const apply = (m: Mat, x: number, y: number): [number, number] =>
  [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

export const toSvg = (m: Mat) => `matrix(${m.map((v) => +v.toFixed(5)).join(' ')})`;

/** Two rows, the way a matrix is read: [a c e │ b d f]. */
export function formatMat(m: Mat) {
  const n = (v: number) => String(Math.abs(v) < 5e-4 ? 0 : +v.toFixed(3)).padStart(7);
  return `[${n(m[0])} ${n(m[2])} ${n(m[4])}  │${n(m[1])} ${n(m[3])} ${n(m[5])}]`;
}
