// The landing: "TypeLab" cut out of collage textures, the mark and one line,
// and a door into each playground. The textures come in genres; the whole
// word moves from one genre to the next, letter by letter.
import { PLAYGROUNDS } from './playgrounds';
import { h } from './lib/dom';
import { measureText } from './lib/fonts';
import { mark } from './lib/mark';
import { GENRES, texture, type Genre } from './lib/textures';

const WORD = 'TypeLab';
const FAMILY = 'EB Garamond';
const WEIGHT = 800;

export function buildHome() {
  const logo = mark({ angle: -45 });

  // Each letter holds two stacked layers so a new texture can fade in over the old.
  const letters = Array.from(WORD).map((ch) => {
    const layers = [0, 1].map(() => h('span', { class: 'cut-layer', 'aria-hidden': 'true' }, ch));
    const el = h('span', { class: 'cut-letter' }, ...layers);
    return { ch, el, layers, front: 0, genre: null as Genre | null, variant: -1 };
  });
  const word = h('h1', { class: 'home-word', 'aria-label': 'Type Lab' }, letters.map((l) => l.el));

  const genreLabel = h('p', { class: 'home-genre info-only', 'aria-live': 'polite' });
  const home = h('section', { class: 'home', 'aria-label': 'Type Lab' },
    h('div', { class: 'home-hero' },
      word,
      h('div', { class: 'home-sub' },
        h('div', { class: 'home-mark' }, logo.svg),
        h('p', { class: 'home-line' }, 'Playgrounds for letters'),
        genreLabel)),
    h('nav', { class: 'home-doors', 'aria-label': 'Playgrounds' }, PLAYGROUNDS.map((p) =>
      h('a', { class: 'door', href: p.soon ? null : `#/${p.id}`, 'aria-disabled': p.soon ? 'true' : null },
        h('span', { class: 'door-glyph', lang: p.specimenLang ?? null }, p.specimen),
        h('span', { class: 'door-name' }, p.name, p.soon && h('span', { class: 'soon' }, 'soon')),
        h('span', { class: 'door-hook' }, p.hook)))),
  );

  // ---- textures ------------------------------------------------------------

  const genres = [...GENRES].sort(() => Math.random() - 0.5);
  let showing = 0, seed = Math.floor(Math.random() * 1e6);

  /** Give letter i another variant of the current genre, one its neighbours are not wearing, fading it in. */
  function retexture(i: number) {
    const l = letters[i], genre = genres[showing];
    const taken = new Set([letters[i - 1], l, letters[i + 1]].filter((n) => n?.genre === genre).map((n) => n!.variant));
    const free = genre.painters.map((_, v) => v).filter((v) => !taken.has(v));
    l.genre = genre;
    l.variant = free.length ? free[Math.floor(Math.random() * free.length)] : Math.floor(Math.random() * genre.painters.length);
    const back = l.layers[1 - l.front];
    back.style.backgroundImage = `url(${texture(genre, l.variant, seed++)})`;
    // Random framing, so the same texture never sits the same way twice.
    back.style.backgroundPosition = `${Math.round(Math.random() * 100)}% ${Math.round(Math.random() * 100)}%`;
    l.front = 1 - l.front;
    l.layers.forEach((layer, j) => layer.classList.toggle('is-front', j === l.front));
  }

  /** Move the word on to the next genre, sweeping left to right. */
  function nextGenre(step = 1) {
    showing = (showing + step) % genres.length;
    genreLabel.textContent = genres[showing].name;
    letters.forEach((_, i) => setTimeout(() => retexture(i), i * 110));
  }
  nextGenre(0);
  letters.forEach((l, i) => l.el.addEventListener('pointerenter', () => retexture(i)));

  // While the home page is showing, a letter changes every few seconds, and
  // every fourth change the whole word moves to the next genre.
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let ticks = 0;
  setInterval(() => {
    if (!home.classList.contains('is-active') || still.matches || document.hidden) return;
    if (++ticks % 4) retexture(Math.floor(Math.random() * letters.length));
    else nextGenre();
  }, 3200);

  // Kerning is lost between separate spans; put it back from the font's own pairs.
  void document.fonts.load(`${WEIGHT} 100px "${FAMILY}"`).then(() => {
    const w = (s: string) => measureText(FAMILY, 100, s, 'normal', WEIGHT).width;
    letters.forEach((l, i) => {
      if (!i) return;
      const pair = letters[i - 1].ch + l.ch;
      l.el.style.marginLeft = `${((w(pair) - w(letters[i - 1].ch) - w(l.ch)) / 100).toFixed(3)}em`;
    });
  });

  // ---- the mark turns to face the pointer ------------------------------------

  let target = -45, angle = -45, raf = 0;
  const step = () => {
    const diff = ((target - angle + 540) % 360) - 180;   // the short way round
    angle += diff * 0.12;
    logo.setAngle(angle);
    raf = Math.abs(diff) > 0.1 ? requestAnimationFrame(step) : 0;
  };
  home.addEventListener('pointermove', (e) => {
    const r = logo.svg.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    target = (Math.atan2(dy, dx) * 180) / Math.PI - 90;
    if (!raf) raf = requestAnimationFrame(step);
  });
  return home;
}
