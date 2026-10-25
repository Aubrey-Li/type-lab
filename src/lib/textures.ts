// Collage textures, painted on a canvas so letters can be cut out of them.
// They come in genres (botanical plates, the cosmos, ink and gold, the
// archive, modernism, early-web pixels, a wild card), each with a few
// variants; every painter is a function of a seed, so no two cuts repeat.

type Rand = () => number;
type Ctx = CanvasRenderingContext2D;
type Painter = (ctx: Ctx, w: number, h: number, rand: Rand) => void;

/** Small, fast, seedable PRNG (mulberry32). */
function seeded(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;
const pick = <T>(rand: Rand, list: readonly T[]) => list[Math.floor(rand() * list.length)];
const between = (rand: Rand, a: number, b: number) => a + rand() * (b - a);
/** Roughly normal, mean 0, sd ~0.5. */
const gauss = (rand: Rand) => rand() + rand() + rand() - 1.5;
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Paper grain: jitter every pixel's brightness. */
function grain(ctx: Ctx, w: number, h: number, rand: Rand, amount = 14) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** Old stock: a base tone, darker toward the edges, freckled with foxing. */
function agedPaper(ctx: Ctx, w: number, h: number, rand: Rand, base: string, spots = 40) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.75);
  v.addColorStop(0, 'rgba(120,80,30,0)'); v.addColorStop(1, 'rgba(110,70,25,.35)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < spots; i++) {
    ctx.fillStyle = `rgba(140,90,40,${between(rand, 0.04, 0.14)})`;
    ctx.beginPath(); ctx.arc(rand() * w, rand() * h, between(rand, 1.5, 16), 0, TAU); ctx.fill();
  }
}

// ---- botanical ------------------------------------------------------------

/** A leaf along +x from (x, y), tinted with a wash and drawn over in ink. */
function leaf(ctx: Ctx, x: number, y: number, len: number, wid: number, angle: number, wash: string, ink: string, veins = true) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.25, -wid, len * 0.7, -wid * 0.8, len, 0);
  ctx.bezierCurveTo(len * 0.7, wid * 0.8, len * 0.25, wid, 0, 0);
  ctx.fillStyle = wash; ctx.fill();
  ctx.strokeStyle = ink; ctx.lineWidth = 1.1; ctx.stroke();
  if (veins) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len * 0.94, 0);
    for (let i = 1; i < 6; i++) {
      const t = (i / 6) * len, v = wid * 0.6 * Math.sin((Math.PI * i) / 6);
      ctx.moveTo(t, 0); ctx.lineTo(t + len * 0.12, -v);
      ctx.moveTo(t, 0); ctx.lineTo(t + len * 0.12, v);
    }
    ctx.lineWidth = 0.6; ctx.stroke();
  }
  ctx.restore();
}

/** A flower head: petals around a stippled centre. */
function bloom(ctx: Ctx, x: number, y: number, r: number, petals: number, wash: string, ink: string, heart: string, rand: Rand) {
  for (let i = 0; i < petals; i++) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate((i / petals) * TAU + rand() * 0.25);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(r * 0.3, -r * 0.48, r * 0.9, -r * 0.42, r, 0);
    ctx.bezierCurveTo(r * 0.9, r * 0.42, r * 0.3, r * 0.48, 0, 0);
    ctx.fillStyle = wash; ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.2, 0); ctx.lineTo(r * 0.8, 0); ctx.lineWidth = 0.5; ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(x, y, r * 0.2, 0, TAU);
  ctx.fillStyle = heart; ctx.fill(); ctx.strokeStyle = ink; ctx.stroke();
  ctx.fillStyle = ink;
  for (let i = 0; i < 14; i++) {
    const a = rand() * TAU, d = rand() * r * 0.17;
    ctx.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.2, 1.2);
  }
}

const quad = (p0: number[], p1: number[], p2: number[], t: number) => {
  const u = 1 - t;
  return {
    x: u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    y: u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    a: Math.atan2(2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]), 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])),
  };
};

const PETALS = ['rgba(200,85,61,.72)', 'rgba(217,139,106,.72)', 'rgba(181,87,122,.7)', 'rgba(226,176,74,.75)', 'rgba(120,110,170,.65)'];
const GREENS = ['rgba(110,135,80,.7)', 'rgba(85,115,75,.7)', 'rgba(150,160,95,.68)'];

const botanical: Painter[] = [
  // A plate from a flora: stems of alternate leaves, flowers, and a label.
  (ctx, w, h, rand) => {
    agedPaper(ctx, w, h, rand, '#efe5cb', 18);
    const ink = '#2f2a1f', petals = pick(rand, PETALS);
    for (let k = 0; k < 3; k++) {
      const p0 = [w * between(rand, 0.15, 0.85), h + 10], p1 = [w * between(rand, 0.1, 0.9), h * 0.55];
      const p2 = [w * between(rand, 0.2, 0.8), h * between(rand, 0.12, 0.45)];
      ctx.strokeStyle = ink; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); ctx.stroke();
      for (let t = 0.1, side = 1; t < 0.88; t += between(rand, 0.08, 0.12), side = -side) {
        const q = quad(p0, p1, p2, t), len = between(rand, 100, 160) * (1 - t * 0.45);
        leaf(ctx, q.x, q.y, len, len * 0.3, q.a + side * between(rand, 0.7, 1.1), pick(rand, GREENS), ink);
      }
      bloom(ctx, p2[0], p2[1], between(rand, 70, 100), 5 + Math.floor(rand() * 4), petals, ink, 'rgba(226,176,74,.9)', rand);
    }
    ctx.fillStyle = ink;
    ctx.font = 'italic 15px "EB Garamond", serif';
    ctx.fillText(`Fig. ${1 + Math.floor(rand() * 48)}`, w * 0.08, h * 0.94);
    grain(ctx, w, h, rand, 12);
  },

  // Fern fronds: a curved rachis with pinnae shrinking toward the tip.
  (ctx, w, h, rand) => {
    agedPaper(ctx, w, h, rand, '#ebe2c7', 14);
    const ink = '#33452a';
    for (let f = 0; f < 3; f++) {
      const p0 = [w * between(rand, 0.1, 0.9), h + 20], lean = between(rand, -0.5, 0.5);
      const p2 = [p0[0] + lean * w * 0.8, h * between(rand, -0.05, 0.25)], p1 = [(p0[0] + p2[0]) / 2 + between(rand, -80, 80), h * 0.5];
      ctx.strokeStyle = ink; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); ctx.stroke();
      for (let i = 2; i < 26; i++) {
        const t = i / 26, q = quad(p0, p1, p2, t), len = 70 * Math.sin(Math.PI * (1 - t) * 0.9 + 0.15);
        for (const side of [1, -1]) leaf(ctx, q.x, q.y, len, len * 0.22, q.a + side * 1.05, 'rgba(95,125,70,.5)', ink, false);
      }
    }
    grain(ctx, w, h, rand, 12);
  },

  // Printed wallpaper: a repeat of blooms on scrolling vines, on a dark ground.
  (ctx, w, h, rand) => {
    const ground = pick(rand, ['#22362c', '#1e2b45', '#3a2230']);
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, w, h);
    const tile = between(rand, 110, 150), ink = 'rgba(15,15,10,.55)';
    const blooms = [pick(rand, ['#d9a441', '#e7dcc1']), pick(rand, ['#c4573f', '#b5577a'])];
    for (let row = -1; row * tile < h + tile; row++) {
      for (let col = -1; col * tile < w + tile; col++) {
        const x = col * tile + (row % 2 ? tile / 2 : 0), y = row * tile;
        ctx.strokeStyle = '#6f8f5a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x + tile / 2, y + tile / 2, tile * 0.42, Math.PI * 0.9, Math.PI * 1.9); ctx.stroke();
        for (let k = 0; k < 4; k++) {
          const a = Math.PI * (0.95 + k * 0.25);
          leaf(ctx, x + tile / 2 + Math.cos(a) * tile * 0.42, y + tile / 2 + Math.sin(a) * tile * 0.42, tile * 0.28, tile * 0.09,
            a + (k % 2 ? 0.9 : -0.9), '#7fa06a', ink);
        }
        bloom(ctx, x, y, tile * 0.22, 6, blooms[(row + col) & 1], ink, '#e8c46a', rand);
        ctx.fillStyle = blooms[0];
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + tile * (0.55 + k * 0.06), y + tile * (0.1 + k * 0.05), 3, 0, TAU); ctx.fill(); }
      }
    }
    grain(ctx, w, h, rand, 10);
  },
];

// ---- cosmos ---------------------------------------------------------------

function stars(ctx: Ctx, w: number, h: number, rand: Rand, n: number) {
  for (let i = 0; i < n; i++) {
    const x = rand() * w, y = rand() * h, r = 0.3 + rand() ** 6 * 1.8;
    ctx.fillStyle = `rgba(255,${235 + rand() * 20},${220 + rand() * 35},${between(rand, 0.35, 1)})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (r > 1.5) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
      glow.addColorStop(0, 'rgba(200,220,255,.45)'); glow.addColorStop(1, 'rgba(200,220,255,0)');
      ctx.fillStyle = glow; ctx.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
      ctx.strokeStyle = 'rgba(220,230,255,.5)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(x - r * 6, y); ctx.lineTo(x + r * 6, y); ctx.moveTo(x, y - r * 6); ctx.lineTo(x, y + r * 6); ctx.stroke();
    }
  }
}

function blob(ctx: Ctx, x: number, y: number, r: number, [cr, cg, cb]: number[], a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

const NEBULA = [[255, 80, 140], [90, 120, 255], [130, 60, 210], [255, 160, 80], [60, 200, 220]];

const cosmos: Painter[] = [
  // A nebula: glowing clouds drifting along a path, stars over the top.
  (ctx, w, h, rand) => {
    ctx.fillStyle = '#04050b';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    const hues = [pick(rand, NEBULA), pick(rand, NEBULA), pick(rand, NEBULA)];
    let x = rand() * w, y = rand() * h;
    for (let i = 0; i < 34; i++) {
      x = (x + gauss(rand) * 120 + w) % w; y = (y + gauss(rand) * 120 + h) % h;
      blob(ctx, x, y, between(rand, 50, 200), hues[i % 3], between(rand, 0.08, 0.22));
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 12; i++) blob(ctx, rand() * w, rand() * h, between(rand, 30, 90), [4, 5, 11], 0.5);   // dust lanes
    ctx.globalCompositeOperation = 'lighter';
    stars(ctx, w, h, rand, 650);
    ctx.globalCompositeOperation = 'source-over';
  },

  // A spiral galaxy, tilted: a warm core and blue arms of scattered stars.
  (ctx, w, h, rand) => {
    ctx.fillStyle = '#03040a';
    ctx.fillRect(0, 0, w, h);
    stars(ctx, w, h, rand, 300);
    ctx.save();
    ctx.translate(w * between(rand, 0.4, 0.6), h * between(rand, 0.4, 0.6));
    ctx.rotate(rand() * TAU); ctx.scale(1, between(rand, 0.45, 0.8));
    ctx.globalCompositeOperation = 'lighter';
    blob(ctx, 0, 0, w * 0.4, [255, 210, 160], 0.35);
    blob(ctx, 0, 0, w * 0.12, [255, 240, 220], 0.9);
    const arms = 2 + Math.floor(rand() * 2), wind = between(rand, 3, 4.4) * Math.PI;
    for (let i = 0; i < 9000; i++) {
      const arm = i % arms, t = rand() ** 0.8, a = t * wind + (arm * TAU) / arms;
      const r = 16 + t * w * 0.8, spread = 10 + t * 46;
      const x = Math.cos(a) * r + gauss(rand) * spread, y = Math.sin(a) * r + gauss(rand) * spread;
      const al = between(rand, 0.25, 0.8);
      ctx.fillStyle = t < 0.25 ? `rgba(255,214,170,${al})` : rand() < 0.06 ? `rgba(255,120,170,${al})` : `rgba(150,185,255,${al})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  },

  // A ringed planet, banded and shaded, against the stars.
  (ctx, w, h, rand) => {
    ctx.fillStyle = '#06070f';
    ctx.fillRect(0, 0, w, h);
    stars(ctx, w, h, rand, 450);
    const R = w * between(rand, 0.24, 0.34), tilt = between(rand, -0.45, -0.15);
    const bands = pick(rand, [['#d9b98a', '#b88a5a', '#e8d5b0', '#9c6b45'], ['#9fc6d9', '#6f9fbf', '#cfe4ec', '#4f7fa8'], ['#e0a37a', '#c4674a', '#f0cfa8', '#8e4a3a']]);
    ctx.translate(w * between(rand, 0.35, 0.65), h * between(rand, 0.38, 0.62));
    ctx.rotate(tilt);
    const ring = (from: number, to: number) => {
      ctx.save(); ctx.scale(1, 0.26);
      for (let k = 0; k < 22; k++) {
        ctx.strokeStyle = `rgba(230,210,170,${between(rand, 0.15, 0.6)})`; ctx.lineWidth = between(rand, 1, 4);
        ctx.beginPath(); ctx.arc(0, 0, R * (1.35 + k * 0.03), from, to); ctx.stroke();
      }
      ctx.restore();
    };
    ring(Math.PI, TAU);
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();
    for (let y = -R; y < R;) {
      const band = between(rand, 5, 22);
      ctx.fillStyle = pick(rand, bands); ctx.fillRect(-R, y, R * 2, band + 1);
      y += band;
    }
    const shade = ctx.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R * 1.05);
    shade.addColorStop(0, 'rgba(255,250,240,.15)'); shade.addColorStop(0.6, 'rgba(0,0,0,.1)'); shade.addColorStop(1, 'rgba(0,0,0,.85)');
    ctx.fillStyle = shade; ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.restore();
    ring(0, Math.PI);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },
];

// ---- ink & gold (East Asian) ----------------------------------------------

const eastAsian: Painter[] = [
  // Seigaiha: fans of concentric waves, row over row.
  (ctx, w, h, rand) => {
    const { bg, line } = pick(rand, [
      { bg: '#1c2c55', line: '#e9dfc6' }, { bg: '#efe6d2', line: '#26408a' }, { bg: '#8e2a22', line: '#e8c46a' },
    ]);
    const r = between(rand, 32, 50);
    ctx.lineWidth = r * 0.07;
    for (let row = 0; row * (r / 2) < h + r; row++) {
      for (let x = row % 2 ? -r : 0; x < w + r; x += r * 2) {
        for (let k = 0; k < 5; k++) {
          ctx.beginPath(); ctx.arc(x, row * (r / 2), r * (1 - k * 0.2), 0, TAU);
          if (!k) { ctx.fillStyle = bg; ctx.fill(); }
          ctx.strokeStyle = line; ctx.stroke();
        }
      }
    }
    grain(ctx, w, h, rand, 12);
  },

  // Sumi-e: ink mountains fading into mist, a pale moon, a red seal.
  (ctx, w, h, rand) => {
    ctx.fillStyle = '#ece4d1';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = rand() < 0.5 ? 'rgba(192,57,43,.8)' : 'rgba(210,198,172,.9)';
    ctx.beginPath(); ctx.arc(w * between(rand, 0.2, 0.8), h * between(rand, 0.12, 0.3), between(rand, 30, 55), 0, TAU); ctx.fill();
    for (let L = 0; L < 4; L++) {
      const base = h * (0.38 + L * 0.15), amp = h * (0.22 - L * 0.04);
      const f1 = between(rand, 60, 140), f2 = between(rand, 18, 40), p1 = rand() * 10, p2 = rand() * 10;
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) {
        ctx.lineTo(x, base - amp * (Math.abs(Math.sin(x / f1 + p1)) * 0.75 + Math.sin(x / f2 + p2) * 0.12 + rand() * 0.04));
      }
      ctx.lineTo(w, h); ctx.closePath();
      const mist = ctx.createLinearGradient(0, base - amp, 0, base + h * 0.12);
      mist.addColorStop(0, `rgba(28,28,32,${0.22 + L * 0.2})`); mist.addColorStop(1, 'rgba(236,228,209,0)');
      ctx.fillStyle = mist; ctx.fill();
    }
    ctx.strokeStyle = 'rgba(28,28,32,.8)'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      const x = w * between(rand, 0.3, 0.8), y = h * between(rand, 0.1, 0.3), s = between(rand, 5, 9);
      ctx.beginPath(); ctx.moveTo(x - s, y - s * 0.4); ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.6, x, y); ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.6, x + s, y - s * 0.4); ctx.stroke();
    }
    const sx = w * between(rand, 0.1, 0.75), sy = h * between(rand, 0.5, 0.8);
    ctx.fillStyle = '#b23a2c'; ctx.fillRect(sx, sy, 48, 48);
    ctx.fillStyle = '#ece4d1'; ctx.font = '36px "Noto Serif SC", serif'; ctx.textAlign = 'center';
    ctx.fillText(pick(rand, ['山', '文', '永', '雲']), sx + 24, sy + 37);
    ctx.textAlign = 'start';
    grain(ctx, w, h, rand, 14);
  },

  // A gold-leaf screen: squares of leaf, bands of cloud, a malachite hill.
  (ctx, w, h, rand) => {
    const cell = 64;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        ctx.fillStyle = `hsl(${between(rand, 40, 47)} ${between(rand, 55, 68)}% ${between(rand, 50, 60)}%)`;
        ctx.fillRect(x, y, cell, cell);
        ctx.strokeStyle = 'rgba(90,60,20,.25)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, cell, cell);
      }
    }
    const sheen = ctx.createLinearGradient(0, 0, w, h);
    sheen.addColorStop(0, 'rgba(255,245,200,.25)'); sheen.addColorStop(0.5, 'rgba(255,245,200,0)'); sheen.addColorStop(1, 'rgba(120,80,20,.2)');
    ctx.fillStyle = sheen; ctx.fillRect(0, 0, w, h);
    ctx.beginPath(); ctx.moveTo(0, h);
    const hill = h * between(rand, 0.6, 0.78), peak = w * rand();
    for (let x = 0; x <= w; x += 6) ctx.lineTo(x, hill + Math.abs(x - peak) * 0.35 + Math.sin(x / 30) * 6);
    ctx.lineTo(w, h); ctx.closePath();
    ctx.fillStyle = '#3f6b4f'; ctx.fill(); ctx.strokeStyle = '#c9a043'; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const y = h * between(rand, 0.1, 0.6), x = w * between(rand, -0.3, 0.5), len = w * between(rand, 0.5, 0.9), t = between(rand, 34, 60);
      ctx.beginPath(); ctx.roundRect(x, y, len, t, t / 2);
      ctx.fillStyle = '#f3ecd9'; ctx.fill(); ctx.strokeStyle = '#b8913f'; ctx.lineWidth = 2; ctx.stroke();
    }
    grain(ctx, w, h, rand, 10);
  },
];

// ---- archive --------------------------------------------------------------

const LATIN = 'in principio erat verbum et lux in tenebris lucet littera scripta manet ars longa vita brevis de natura rerum quod erat demonstrandum'.split(' ');

const archive: Painter[] = [
  // A manuscript leaf: ruled margins, a rubricated initial, foxing.
  (ctx, w, h, rand) => {
    agedPaper(ctx, w, h, rand, '#e6d3a8', 50);
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.rotate((rand() - 0.5) * 0.08); ctx.translate(-w / 2, -h / 2);
    const left = w * 0.1;
    ctx.strokeStyle = 'rgba(160,60,40,.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(left - 8, 0); ctx.lineTo(left - 8, h); ctx.stroke();
    ctx.font = 'italic 16px "EB Garamond", serif';
    for (let y = 22, line = 0; y < h; y += 20, line++) {
      const indent = line < 5 ? 96 : 0;
      let x = left + indent;
      while (x < w * 0.95) {
        const word = rand() < 0.04 ? '¶' : pick(rand, LATIN);
        ctx.fillStyle = word === '¶' ? '#9b2d1f' : '#2e2216';
        ctx.fillText(word, x, y);
        x += ctx.measureText(`${word} `).width;
      }
    }
    ctx.fillStyle = '#9b2d1f'; ctx.font = '112px "EB Garamond", serif';
    ctx.fillText(pick(rand, [...'ABDEGMPRST']), left, 104);
    ctx.strokeStyle = '#2e2216'; ctx.lineWidth = 1.2; ctx.strokeRect(left - 4, 12, 92, 98);
    ctx.restore();
    grain(ctx, w, h, rand, 16);
  },

  // A sea chart: a coast, rhumb lines out of a compass rose.
  (ctx, w, h, rand) => {
    agedPaper(ctx, w, h, rand, '#e4d2a6', 30);
    const cx = w * between(rand, 0.3, 0.7), cy = h * between(rand, 0.3, 0.7);
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU;
      ctx.strokeStyle = ['rgba(40,30,20,.5)', 'rgba(160,50,35,.5)', 'rgba(50,110,70,.5)'][i % 3];
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * w * 1.5, cy + Math.sin(a) * w * 1.5); ctx.stroke();
    }
    // The coast: a wandering closed line, with water lines echoing it.
    const ox = w * pick(rand, [-0.1, 1.1]), oy = h * between(rand, 0.2, 0.8);
    const pts: [number, number][] = [];
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * TAU, r = w * 0.45 * (1 + Math.sin(a * 5 + oy) * 0.12 + Math.sin(a * 13) * 0.05 + gauss(rand) * 0.04);
      pts.push([ox + Math.cos(a) * r, oy + Math.sin(a) * r]);
    }
    const coast = (s: number) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => { const px = ox + (x - ox) * s, py = oy + (y - oy) * s; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      ctx.closePath();
    };
    for (let k = 4; k > 0; k--) { coast(1 + k * 0.035); ctx.strokeStyle = `rgba(60,45,30,${0.35 - k * 0.07})`; ctx.lineWidth = 1; ctx.stroke(); }
    coast(1); ctx.fillStyle = 'rgba(196,160,96,.55)'; ctx.fill(); ctx.strokeStyle = '#4a3622'; ctx.lineWidth = 1.6; ctx.stroke();
    // Compass rose.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU - Math.PI / 2, long = i % 4 === 0 ? 70 : i % 2 ? 26 : 44;
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * long, cy + Math.sin(a) * long);
        ctx.lineTo(cx + Math.cos(a + side * 0.2) * long * 0.25, cy + Math.sin(a + side * 0.2) * long * 0.25);
        ctx.closePath();
        ctx.fillStyle = side < 0 ? '#2e2216' : i % 4 === 0 ? '#9b2d1f' : '#efe2c0'; ctx.fill();
        ctx.strokeStyle = '#2e2216'; ctx.lineWidth = 0.6; ctx.stroke();
      }
    }
    ctx.fillStyle = '#2e2216'; ctx.font = 'italic 20px "EB Garamond", serif';
    ctx.fillText(pick(rand, ['Mare Incognitum', 'Oceanus', 'Terra Australis', 'Sinus Magnus']), w * 0.12, h * between(rand, 0.15, 0.9));
    grain(ctx, w, h, rand, 14);
  },

  // Newsprint: a page of tiny type, slightly askew, under a headline rule.
  (ctx, w, h, rand) => {
    ctx.fillStyle = '#e9e3d5';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.rotate((rand() - 0.5) * 0.25); ctx.translate(-w * 0.7, -h * 0.7);
    ctx.fillStyle = '#2b2925';
    ctx.font = '400 11px "EB Garamond", serif';
    const words = 'the quick brown fox jumps over a lazy dog sphinx of black quartz judge my vow type set leading kerning glyph em baseline serif'.split(' ');
    for (let y = 0; y < h * 1.4; y += 13) {
      let line = '';
      while (line.length < 120) line += `${pick(rand, words)} `;
      ctx.fillText(line, 0, y);
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(30,28,25,.85)';
    ctx.fillRect(0, h * (0.2 + rand() * 0.5), w, 5);
    grain(ctx, w, h, rand, 14);
  },
];

// ---- modernism ------------------------------------------------------------

const PRIMARY = { red: '#d1382b', yellow: '#efb62f', blue: '#1f4e9c', black: '#1b1a19' };

const modern: Painter[] = [
  // Bauhaus: circles, quarter discs, triangles and bars snapped to a grid.
  (ctx, w, h, rand) => {
    ctx.fillStyle = '#ece3cf';
    ctx.fillRect(0, 0, w, h);
    const u = w / 4, colors = Object.values(PRIMARY);
    ctx.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = pick(rand, colors);
      const x = Math.floor(rand() * 4) * u, y = Math.floor(rand() * 4) * u, s = u * (1 + Math.floor(rand() * 2));
      ctx.beginPath();
      switch (Math.floor(rand() * 4)) {
        case 0: ctx.arc(x + s / 2, y + s / 2, s / 2, 0, TAU); break;
        case 1: { const q = Math.floor(rand() * 4); ctx.moveTo(x, y); ctx.arc(x, y, s, (q * Math.PI) / 2, ((q + 1) * Math.PI) / 2); break; }
        case 2: ctx.moveTo(x, y + s); ctx.lineTo(x + s / 2, y); ctx.lineTo(x + s, y + s); break;
        default: rand() < 0.5 ? ctx.rect(x, y, s * 2, u / 4) : ctx.rect(x, y, u / 4, s * 2);
      }
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    grain(ctx, w, h, rand, 8);
  },

  // Constructivist: diagonal bands of red and black, a disc, a date.
  (ctx, w, h, rand) => {
    ctx.fillStyle = '#e8dcc4';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = PRIMARY.red;
    ctx.beginPath(); ctx.arc(w * between(rand, 0.25, 0.75), h * between(rand, 0.25, 0.75), w * between(rand, 0.18, 0.3), 0, TAU); ctx.fill();
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.rotate(-between(rand, 0.35, 0.7));
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? PRIMARY.red : PRIMARY.black;
      ctx.fillRect(-w, between(rand, -h * 0.6, h * 0.5), w * 2, between(rand, 10, 60));
    }
    ctx.fillStyle = PRIMARY.black;
    ctx.font = '700 120px "Source Sans 3", system-ui, sans-serif';
    ctx.fillText(String(1919 + Math.floor(rand() * 14)), -w * 0.35, h * 0.1);
    ctx.restore();
    grain(ctx, w, h, rand, 12);
  },

  // De Stijl: a rectangle split and split again, a few cells in primaries.
  (ctx, w, h, rand) => {
    const cells: number[][] = [];
    const split = (x: number, y: number, cw: number, ch: number, depth: number) => {
      if (depth > 0 && (cw > 90 || ch > 90) && rand() < 0.88) {
        const t = between(rand, 0.3, 0.7);
        if (cw > ch) { split(x, y, cw * t, ch, depth - 1); split(x + cw * t, y, cw * (1 - t), ch, depth - 1); }
        else { split(x, y, cw, ch * t, depth - 1); split(x, y + ch * t, cw, ch * (1 - t), depth - 1); }
      } else cells.push([x, y, cw, ch]);
    };
    split(-10, -10, w + 20, h + 20, 5);
    ctx.lineWidth = 10; ctx.strokeStyle = PRIMARY.black;
    for (const [x, y, cw, ch] of cells) {
      ctx.fillStyle = rand() < 0.35 ? pick(rand, [PRIMARY.red, PRIMARY.yellow, PRIMARY.blue, PRIMARY.black]) : '#f2efe6';
      ctx.fillRect(x, y, cw, ch); ctx.strokeRect(x, y, cw, ch);
    }
    grain(ctx, w, h, rand, 8);
  },
];

// ---- early-web pixels -----------------------------------------------------

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Paint at a coarse resolution, then blow it up with hard pixel edges. */
function pixels(ctx: Ctx, w: number, h: number, size: number, draw: (c: Ctx, W: number, H: number) => void) {
  const W = Math.ceil(w / size), H = Math.ceil(h / size);
  const small = document.createElement('canvas');
  small.width = W; small.height = H;
  const c = small.getContext('2d')!;
  draw(c, W, H);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, W * size, H * size);
}

/** An ordered-dither gradient, the way a 256-colour screen faked one. */
function dither(c: Ctx, x0: number, y0: number, W: number, H: number, stops: string[], horizontal = false) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = ((horizontal ? x / W : y / H) * (stops.length - 1));
      const i = Math.min(stops.length - 2, Math.floor(t));
      c.fillStyle = t - i > BAYER[((y0 + y) % 4) * 4 + ((x0 + x) % 4)] / 16 ? stops[i + 1] : stops[i];
      c.fillRect(x0 + x, y0 + y, 1, 1);
    }
  }
}

const SPRITES = {
  star: ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '##...##'],
  heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  smile: ['.#####.', '#.....#', '#.#.#.#', '#.....#', '##...##', '#.###.#', '.#####.'],
  spark: ['...#...', '...#...', '..###..', '#######', '..###..', '...#...', '...#...'],
  cursor: ['#.....', '##....', '#.#...', '#..#..', '#...#.', '#..###', '#.#...', '##....'],
};
function sprite(c: Ctx, rows: string[], x: number, y: number, color: string) {
  c.fillStyle = color;
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') c.fillRect(x + i, y + j, 1, 1); }));
}

const pixel: Painter[] = [
  // A desktop: dithered sky, pixel clouds, a bevelled window, a cursor.
  (ctx, w, h, rand) => pixels(ctx, w, h, 6, (c, W, H) => {
    dither(c, 0, 0, W, H, ['#0a4f9a', '#3d8fd1', '#a9d8f2']);
    c.fillStyle = '#ffffff';
    for (let k = 0; k < 4; k++) {
      const cx = rand() * W, cy = rand() * H * 0.6;
      for (let b = 0; b < 4; b++) {
        const bx = cx + b * 4 - 6, by = cy + (b % 2 ? -2 : 0), r = 3 + rand() * 3;
        for (let y = -r; y <= r; y++) for (let x = -r * 1.5; x <= r * 1.5; x++) if ((x / 1.5) ** 2 + y * y <= r * r) c.fillRect(Math.round(bx + x), Math.round(by + y), 1, 1);
      }
    }
    const ww = Math.floor(W * between(rand, 0.55, 0.75)), wh = Math.floor(H * between(rand, 0.4, 0.55));
    const x = Math.floor(rand() * (W - ww)), y = Math.floor(H * 0.3 + rand() * (H * 0.65 - wh));
    c.fillStyle = '#c0c0c0'; c.fillRect(x, y, ww, wh);
    c.fillStyle = '#ffffff'; c.fillRect(x, y, ww, 1); c.fillRect(x, y, 1, wh);
    c.fillStyle = '#000000'; c.fillRect(x, y + wh - 1, ww, 1); c.fillRect(x + ww - 1, y, 1, wh);
    c.fillStyle = '#808080'; c.fillRect(x + 1, y + wh - 2, ww - 2, 1); c.fillRect(x + ww - 2, y + 1, 1, wh - 2);
    dither(c, x + 2, y + 2, ww - 4, 5, ['#000080', '#1084d0'], true);
    for (let b = 0; b < 3; b++) { c.fillStyle = '#c0c0c0'; c.fillRect(x + ww - 9 - b * 6 + 2, y + 3, 5, 3); }
    c.fillStyle = '#ffffff'; c.fillRect(x + 3, y + 9, ww - 6, wh - 12);
    c.fillStyle = '#9a9a9a';
    for (let ly = y + 11; ly < y + wh - 5; ly += 3) c.fillRect(x + 5, ly, Math.floor((ww - 12) * between(rand, 0.4, 1)), 1);
    sprite(c, SPRITES.cursor, Math.floor(x + ww * 0.6), Math.floor(y + wh * 0.6), '#000000');
  }),

  // Vaporwave: a dithered sunset, a striped sun, a neon grid to the horizon.
  (ctx, w, h, rand) => pixels(ctx, w, h, 5, (c, W, H) => {
    const horizon = Math.floor(H * between(rand, 0.52, 0.66));
    dither(c, 0, 0, W, horizon, ['#2b0b4a', '#7a1f8f', '#ff4f9a', '#ffb36b']);
    const sx = W * between(rand, 0.3, 0.7), r = W * 0.22;
    for (let y = -r; y < 0; y++) {
      if (y > -r * 0.5 && Math.floor(-y) % 4 < 1 + Math.floor((r * 0.5 + y) / 6)) continue;   // the cuts widen downward
      const half = Math.sqrt(r * r - y * y);
      dither(c, Math.round(sx - half), horizon + y, Math.round(half * 2), 1, ['#ffe46b', '#ff7a59'], true);
    }
    c.fillStyle = '#14062a'; c.fillRect(0, horizon, W, H - horizon);
    c.strokeStyle = '#ff3fd0'; c.lineWidth = 1;
    for (let k = 1; horizon + k * k * 0.6 < H; k++) { const y = Math.round(horizon + k * k * 0.6) + 0.5; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    for (let k = -12; k <= 12; k++) { c.beginPath(); c.moveTo(W / 2 + k * 2, horizon); c.lineTo(W / 2 + k * 14, H); c.stroke(); }
    for (let i = 0; i < 30; i++) { c.fillStyle = '#ffffff'; c.fillRect(Math.floor(rand() * W), Math.floor(rand() * horizon * 0.5), 1, 1); }
  }),

  // A homepage background: a checkerboard tiled with blinking-era sprites.
  (ctx, w, h, rand) => pixels(ctx, w, h, 4, (c, W, H) => {
    const [a, b] = pick(rand, [['#000033', '#000055'], ['#1a0033', '#2a0055'], ['#002b2b', '#004040']]);
    for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) { c.fillStyle = (x + y) % 16 ? a : b; c.fillRect(x, y, 8, 8); }
    const brights = ['#ffff00', '#ff00ff', '#00ffff', '#ff6600', '#66ff33'];
    const kinds = [SPRITES.star, SPRITES.heart, SPRITES.smile, SPRITES.spark];
    for (let i = 0; i < 70; i++) sprite(c, pick(rand, kinds), Math.floor(rand() * W), Math.floor(rand() * H), pick(rand, brights));
    const bar = Math.floor(H * between(rand, 0.3, 0.7));
    dither(c, 0, bar, W, 4, ['#ff0000', '#ff9900', '#ffff00', '#00ff00', '#0099ff', '#9900ff'], true);
  }),
];

// ---- wild card: psychedelia -----------------------------------------------

/** Colour every pixel by a field: the integer part of f(x, y) picks the band. */
function bands(ctx: Ctx, w: number, h: number, palette: string[], f: (x: number, y: number) => number) {
  const cols = palette.map(rgb);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      const n = palette.length, c = cols[((Math.floor(f(x, y)) % n) + n) % n];
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const GROOVY = [
  ['#f2c14e', '#f78154', '#d1495b', '#6b2d5c', '#2e86ab'],
  ['#ffbe0b', '#fb5607', '#ff006e', '#8338ec', '#3a86ff'],
  ['#e9c46a', '#f4a261', '#e76f51', '#264653', '#2a9d8f'],
];

const wild: Painter[] = [
  // Op-art ripples: rings that twist as they spread.
  (ctx, w, h, rand) => {
    const cx = w * rand(), cy = h * rand(), period = between(rand, 14, 26), twist = 2 + Math.floor(rand() * 5), wob = between(rand, 0.6, 1.6);
    bands(ctx, w, h, pick(rand, GROOVY), (x, y) => {
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
      return r / period + wob * Math.sin(Math.atan2(dy, dx) * twist + r / 45);
    });
    grain(ctx, w, h, rand, 10);
  },

  // Marbled paper: stripes combed and swirled through each other.
  (ctx, w, h, rand) => {
    const p = Array.from({ length: 4 }, () => rand() * 10), f = Array.from({ length: 3 }, () => between(rand, 25, 70));
    bands(ctx, w, h, pick(rand, [['#1d3557', '#e9d8a6', '#ae2012', '#f3ead7', '#ee9b00'], ['#0b3c49', '#f1e3c8', '#7d5a50', '#e9b44c', '#f1e3c8']]), (x, y) => {
      const wx = x + 40 * Math.sin(y / f[0] + p[0]) + 18 * Math.sin((x + y) / f[1] + p[1]);
      const wy = y + 30 * Math.sin(wx / f[2] + p[2]);
      return (wx + 25 * Math.sin(wy / 22 + p[3])) / 16;
    });
    grain(ctx, w, h, rand, 12);
  },

  // A lava lamp: blobs that melt into each other, in posterised rings.
  (ctx, w, h, rand) => {
    const balls = Array.from({ length: 7 }, () => [rand() * w, rand() * h, between(rand, 40, 110)]);
    const pal = pick(rand, [['#2a0a3a', '#ff4d6d', '#ffb703', '#fb8500', '#ffe5a0'], ['#081c15', '#2d6a4f', '#95d5b2', '#ffd166', '#ef476f']]);
    bands(ctx, w, h, pal, (x, y) => {
      let v = 0;
      for (const [bx, by, r] of balls) v += (r * r) / ((x - bx) ** 2 + (y - by) ** 2 + 1);
      return Math.min(pal.length - 1, v * 2.2);
    });
    grain(ctx, w, h, rand, 8);
  },
];

// ---- the catalogue --------------------------------------------------------

export const GENRES = [
  { id: 'botanical', name: 'Botanical plates', painters: botanical },
  { id: 'cosmos', name: 'Cosmos', painters: cosmos },
  { id: 'ink-gold', name: 'Ink & gold', painters: eastAsian },
  { id: 'archive', name: 'Archive', painters: archive },
  { id: 'modern', name: 'Modernism', painters: modern },
  { id: 'pixel', name: 'Pixels, c. 2001', painters: pixel, lossless: true },
  { id: 'wild', name: 'Wild card', painters: wild },
] as const;
export type Genre = (typeof GENRES)[number];

/** Paint variant `variant` of a genre with `seed`, and return it as a data URL. */
export function texture(genre: Genre, variant: number, seed: number, size = 520): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  genre.painters[variant % genre.painters.length](ctx, size, size, seeded(seed));
  // Pixel art keeps its hard edges; everything else is fine as a JPEG.
  return 'lossless' in genre ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.86);
}
