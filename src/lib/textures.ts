// Collage textures, painted on a canvas so letters can be cut out of them.
// They come in genres (the studio's paper, paint, print and drafting cuts,
// ink and gold, the archive, modernism, a wild card), each with a few
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

// ---- the studio: the original collage cuts --------------------------------

/** A hand-drawn line: many short segments with a little wobble. */
function wobble(ctx: Ctx, pts: [number, number][], rand: Rand, jitter: number) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const jx = x + (rand() - 0.5) * jitter, jy = y + (rand() - 0.5) * jitter;
    if (i) ctx.lineTo(jx, jy); else ctx.moveTo(jx, jy);
  });
  ctx.stroke();
}

const STUDIO: Record<string, Painter> = {
  // Yellow stock with a pencil rule, a torn edge of kraft paper below a drawn curve.
  paper(ctx, w, h, rand) {
    ctx.fillStyle = '#e8b843';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(40,30,20,.75)';
    ctx.lineWidth = 1.6;
    const x = w * (0.45 + rand() * 0.3);
    wobble(ctx, Array.from({ length: 20 }, (_, i) => [x + i * 2.4, (i / 19) * h]), rand, 0.8);
    const lift = h * (0.62 + rand() * 0.12);
    const curve = (c: CanvasRenderingContext2D) => {
      c.moveTo(-10, lift + h * 0.18);
      c.quadraticCurveTo(w * 0.5, lift - h * 0.02, w + 10, lift - h * 0.12);
    };
    ctx.beginPath();
    curve(ctx);
    ctx.lineTo(w + 10, h + 10); ctx.lineTo(-10, h + 10); ctx.closePath();
    ctx.fillStyle = '#c9b28c';
    ctx.fill();
    grain(ctx, w, h, rand, 22);
    ctx.beginPath();
    curve(ctx);
    ctx.strokeStyle = '#1b1a18';
    ctx.lineWidth = 2;
    ctx.stroke();
  },

  // Oil paint: a dark sky of bristle strokes, a violet seam, ochre ground.
  paint(ctx, w, h, rand) {
    const seam = h * (0.5 + rand() * 0.15);
    const sky = ctx.createLinearGradient(0, 0, 0, seam);
    sky.addColorStop(0, '#1c1918'); sky.addColorStop(1, '#2b2433');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, seam);
    for (let i = 0; i < 900; i++) {
      const x = rand() * w, y = rand() * seam, len = 20 + rand() * 90;
      ctx.strokeStyle = `rgba(${90 + rand() * 60},${80 + rand() * 50},${110 + rand() * 60},${0.05 + rand() * 0.12})`;
      ctx.lineWidth = 0.6 + rand() * 1.4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rand() - 0.5) * 6, Math.min(seam, y + len)); ctx.stroke();
    }
    ctx.fillStyle = '#6f5694';
    ctx.fillRect(0, seam - 10, w, 22);
    const ground = ctx.createLinearGradient(0, seam, 0, h);
    ground.addColorStop(0, '#8a6232'); ground.addColorStop(1, '#d6c19b');
    ctx.fillStyle = ground;
    ctx.fillRect(0, seam + 12, w, h - seam);
    for (let i = 0; i < 700; i++) {
      const y = seam + 12 + rand() * (h - seam), x = rand() * w, len = 40 + rand() * 160;
      ctx.strokeStyle = `rgba(${200 + rand() * 55},${160 + rand() * 60},${100 + rand() * 60},${0.08 + rand() * 0.2})`;
      ctx.lineWidth = 0.8 + rand() * 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y + (rand() - 0.5) * 4); ctx.stroke();
    }
    grain(ctx, w, h, rand, 10);
  },

  // Cyanotype blue with chalk marks.
  blueprint(ctx, w, h, rand) {
    ctx.fillStyle = '#35568f';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, rand, 26);
    ctx.lineCap = 'round';
    for (let s = 0; s < 6; s++) {
      ctx.strokeStyle = `rgba(240,240,236,${0.65 + rand() * 0.3})`;
      ctx.lineWidth = 5 + rand() * 7;
      const x0 = rand() * w, y0 = rand() * h, a = rand() * Math.PI, len = 120 + rand() * 260;
      const n = 14;
      // Chalk skips: draw in dashes.
      ctx.setLineDash([8 + rand() * 30, 3 + rand() * 9]);
      wobble(ctx, Array.from({ length: n }, (_, i) => [x0 + Math.cos(a) * (len * i) / n, y0 + Math.sin(a) * (len * i) / n]), rand, 4);
    }
    ctx.setLineDash([]);
  },

  // Graph paper: a baseline grid, heavier every fourth line, and a red margin.
  grid(ctx, w, h, rand) {
    ctx.fillStyle = '#f1ece1';
    ctx.fillRect(0, 0, w, h);
    const step = 14 + Math.round(rand() * 6);
    for (let i = 0; i * step < Math.max(w, h); i++) {
      ctx.strokeStyle = i % 4 ? 'rgba(70,120,190,.28)' : 'rgba(70,120,190,.6)';
      ctx.lineWidth = i % 4 ? 0.8 : 1.4;
      ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(w, i * step); ctx.stroke();
    }
    ctx.strokeStyle = '#d8281b';
    ctx.lineWidth = 2.5;
    const m = w * (0.18 + rand() * 0.5);
    ctx.beginPath(); ctx.moveTo(m, 0); ctx.lineTo(m, h); ctx.stroke();
    grain(ctx, w, h, rand, 10);
  },

  // Halftone: dots that grow along a diagonal.
  halftone(ctx, w, h, rand) {
    ctx.fillStyle = '#efe4cf';
    ctx.fillRect(0, 0, w, h);
    const cell = 13 + Math.round(rand() * 5);
    const a = rand() * Math.PI * 2, cx = Math.cos(a), cy = Math.sin(a);
    ctx.fillStyle = rand() < 0.5 ? '#e0452c' : '#1f6f6a';
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.rotate(Math.PI / 4); ctx.translate(-w, -h);
    for (let y = 0; y < h * 2; y += cell) {
      for (let x = 0; x < w * 2; x += cell) {
        const t = ((x - w) * cx + (y - h) * cy) / Math.hypot(w, h) + 0.5;
        const r = (cell / 2) * Math.min(1.05, Math.max(0.06, t));
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    grain(ctx, w, h, rand, 12);
  },

  // Wood type: red ink over end grain, with specks where the ink missed.
  woodtype(ctx, w, h, rand) {
    ctx.fillStyle = '#b8402c';
    ctx.fillRect(0, 0, w, h);
    const phase = rand() * 10;
    for (let i = 0; i < 70; i++) {
      const y0 = (i / 70) * h * 1.2 - h * 0.1;
      ctx.strokeStyle = `rgba(${rand() < 0.5 ? '60,15,10' : '230,140,110'},${0.12 + rand() * 0.18})`;
      ctx.lineWidth = 1 + rand() * 3;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = y0 + Math.sin(x / 70 + phase + i * 0.3) * 10 + Math.sin(x / 23 + i) * 2;
        if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(245,232,215,.85)';
    for (let i = 0; i < 260; i++) {
      ctx.beginPath(); ctx.arc(rand() * w, rand() * h, rand() * 2.2, 0, Math.PI * 2); ctx.fill();
    }
    grain(ctx, w, h, rand, 16);
  },

  // Newsprint: a page of tiny type, slightly askew.
};

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
  { id: 'paper-paint', name: 'Paper & paint', painters: [STUDIO.paper, STUDIO.paint] },
  { id: 'print-shop', name: 'Print shop', painters: [STUDIO.woodtype, STUDIO.halftone] },
  { id: 'drafting', name: 'Drafting', painters: [STUDIO.blueprint, STUDIO.grid] },
  { id: 'ink-gold', name: 'Ink & gold', painters: eastAsian },
  { id: 'archive', name: 'Archive', painters: archive },
  { id: 'modern', name: 'Modernism', painters: modern },
  { id: 'wild', name: 'Wild card', painters: wild },
] as const;
export type Genre = (typeof GENRES)[number];

/** Paint variant `variant` of a genre with `seed`, and return it as a data URL. */
export function texture(genre: Genre, variant: number, seed: number, size = 520): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  genre.painters[variant % genre.painters.length](ctx, size, size, seeded(seed));
  return canvas.toDataURL('image/jpeg', 0.86);
}
