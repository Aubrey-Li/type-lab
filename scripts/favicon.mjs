// Writes public/favicon.svg: the header mark (src/lib/mark.ts) at its resting
// angle, in the default Ink palette. A favicon cannot load web fonts, so the
// A and 文 are set from the same font files and saved as outlines.
//   node scripts/favicon.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';

const font = (path) => {
  const b = readFileSync(new URL(`../node_modules/${path}`, import.meta.url));
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const garamond = font('@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff');
const songti = font('@fontsource/noto-serif-sc/files/noto-serif-sc-118-400-normal.woff');

// Ink palette (tokens.css), and --ink-3 mixed the same way the CSS does.
const BG = '#141414', INK = '#e6e2dc', ACCENT = '#ef5b4b';
const INK_3 = mixOklab(INK, BG, 0.42);

// Geometry copied from mark.ts: same square, same baselines, same split.
const C = 50, ANGLE = -45, STROKE = 3;
const a = garamond.charToGlyph('A');
const latin = a.getPath(C - (a.advanceWidth / garamond.unitsPerEm) * 92 / 2, 79, 92).toPathData(2);
const han = songti.charToGlyph('文').getPath(10, 80.4, 80).toPathData(2);

const r = (ANGLE * Math.PI) / 180;
const d = [Math.cos(r), Math.sin(r)], n = [-d[1], d[0]];
const half = (side) => [[120, 0], [120, 120], [-120, 120], [-120, 0]]
  .map(([u, v]) => `${(C + d[0] * u + n[0] * v * side).toFixed(2)},${(C + d[1] * u + n[1] * v * side).toFixed(2)}`)
  .join(' ');
const t = Math.min(...d.map((c) => (Math.abs(c) < 1e-6 ? Infinity : 49 / Math.abs(c))));
const [x1, y1, x2, y2] = [C - d[0] * t, C - d[1] * t, C + d[0] * t, C + d[1] * t].map((v) => v.toFixed(2));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><clipPath id="a"><polygon points="${half(1)}"/></clipPath><clipPath id="b"><polygon points="${half(-1)}"/></clipPath></defs>
<rect x="1.5" y="1.5" width="97" height="97" fill="${BG}" stroke="${INK_3}" stroke-width="${STROKE}"/>
<path clip-path="url(#a)" fill="${INK}" d="${latin}"/>
<path clip-path="url(#b)" fill="${ACCENT}" d="${han}"/>
<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ACCENT}" stroke-width="${STROKE}"/>
</svg>
`;
writeFileSync(new URL('../public/favicon.svg', import.meta.url), svg);
console.log(`public/favicon.svg (${svg.length} bytes)`);

function mixOklab(p, q, w) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  const toLab = (hex) => {
    const [R, G, B] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  };
  const [A, B] = [toLab(p), toLab(q)];
  const [L, a2, b2] = A.map((v, i) => v * w + B[i] * (1 - w));
  const l = (L + 0.3963377774 * a2 + 0.2158037573 * b2) ** 3;
  const m = (L - 0.1055613458 * a2 - 0.0638541728 * b2) ** 3;
  const s = (L - 0.0894841775 * a2 - 1.291485548 * b2) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, gam(c))) * 255).toString(16).padStart(2, '0')).join('');
}
