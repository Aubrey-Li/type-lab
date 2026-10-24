// Collage textures, painted on a canvas so letters can be cut out of them.
// Each is a function of a seed, so a letter can ask for a fresh variation.

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number) => void;

/** Small, fast, seedable PRNG (mulberry32). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Paper grain: jitter every pixel's brightness. */
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number, amount = 14) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** A hand-drawn line: many short segments with a little wobble. */
function wobble(ctx: CanvasRenderingContext2D, pts: [number, number][], rand: () => number, jitter: number) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const jx = x + (rand() - 0.5) * jitter, jy = y + (rand() - 0.5) * jitter;
    if (i) ctx.lineTo(jx, jy); else ctx.moveTo(jx, jy);
  });
  ctx.stroke();
}

const PAINTERS: Record<string, Painter> = {
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
  newsprint(ctx, w, h, rand) {
    ctx.fillStyle = '#e9e3d5';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.rotate((rand() - 0.5) * 0.25); ctx.translate(-w * 0.7, -h * 0.7);
    ctx.fillStyle = '#2b2925';
    ctx.font = '400 11px "EB Garamond", serif';
    const words = 'the quick brown fox jumps over a lazy dog sphinx of black quartz judge my vow type set leading kerning glyph em baseline serif'.split(' ');
    for (let y = 0; y < h * 1.4; y += 13) {
      let line = '';
      while (line.length < 120) line += `${words[Math.floor(rand() * words.length)]} `;
      ctx.fillText(line, 0, y);
    }
    ctx.restore();
    // A headline rule and a smudge of ink.
    ctx.fillStyle = 'rgba(30,28,25,.85)';
    ctx.fillRect(0, h * (0.2 + rand() * 0.5), w, 5);
    grain(ctx, w, h, rand, 14);
  },
};

export const TEXTURES = Object.keys(PAINTERS);

/** Paint texture `name` with `seed` and return it as a data URL. */
export function texture(name: string, seed: number, size = 520): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  PAINTERS[name](ctx, size, size, seeded(seed));
  return canvas.toDataURL('image/jpeg', 0.86);
}
