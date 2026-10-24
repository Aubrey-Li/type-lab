// The landing: "TypeLab" cut out of collage textures, the mark and one line,
// and a door into each playground.
import { PLAYGROUNDS } from './playgrounds';
import { h } from './lib/dom';
import { measureText } from './lib/fonts';
import { mark } from './lib/mark';
import { TEXTURES, texture } from './lib/textures';

const WORD = 'TypeLab';
const FAMILY = 'EB Garamond';
const WEIGHT = 800;

export function buildHome() {
  const logo = mark({ angle: -45 });

  // Each letter holds two stacked layers so a new texture can fade in over the old.
  const letters = Array.from(WORD).map((ch) => {
    const layers = [0, 1].map(() => h('span', { class: 'cut-layer', 'aria-hidden': 'true' }, ch));
    const el = h('span', { class: 'cut-letter' }, ...layers);
    return { ch, el, layers, front: 0, texture: '' };
  });
  const word = h('h1', { class: 'home-word', 'aria-label': 'Type Lab' }, letters.map((l) => l.el));

  const home = h('section', { class: 'home', 'aria-label': 'Type Lab' },
    h('div', { class: 'home-hero' },
      word,
      h('div', { class: 'home-sub' },
        h('div', { class: 'home-mark' }, logo.svg),
        h('p', { class: 'home-line' }, 'Playgrounds for letters'))),
    h('nav', { class: 'home-doors', 'aria-label': 'Playgrounds' }, PLAYGROUNDS.map((p) =>
      h('a', { class: 'door', href: p.soon ? null : `#/${p.id}`, 'aria-disabled': p.soon ? 'true' : null },
        h('span', { class: 'door-glyph', lang: p.specimenLang ?? null }, p.specimen),
        h('span', { class: 'door-name' }, p.name, p.soon && h('span', { class: 'soon' }, 'soon')),
        h('span', { class: 'door-hook' }, p.hook)))),
  );

  // ---- textures ------------------------------------------------------------

  let seed = Math.floor(Math.random() * 1e6);
  /** Give letter i a texture its neighbours are not wearing, fading it in. */
  function retexture(i: number) {
    const l = letters[i];
    const taken = new Set([letters[i - 1]?.texture, l.texture, letters[i + 1]?.texture]);
    const choices = TEXTURES.filter((t) => !taken.has(t));
    l.texture = choices[Math.floor(Math.random() * choices.length)];
    const back = l.layers[1 - l.front];
    back.style.backgroundImage = `url(${texture(l.texture, seed++)})`;
    // Random framing, so the same texture never sits the same way twice.
    back.style.backgroundPosition = `${Math.round(Math.random() * 100)}% ${Math.round(Math.random() * 100)}%`;
    l.front = 1 - l.front;
    l.layers.forEach((layer, j) => layer.classList.toggle('is-front', j === l.front));
  }
  // Deal the first hand without repeats.
  const deck = [...TEXTURES].sort(() => Math.random() - 0.5);
  letters.forEach((l, i) => {
    l.texture = deck[i % deck.length];
    l.layers[0].style.backgroundImage = `url(${texture(l.texture, seed++)})`;
    l.layers[0].style.backgroundPosition = `${Math.round(Math.random() * 100)}% ${Math.round(Math.random() * 100)}%`;
    l.layers[0].classList.add('is-front');
    l.el.addEventListener('pointerenter', () => retexture(i));
  });

  // Every few seconds one letter changes on its own, while the home page is showing.
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  setInterval(() => {
    if (!home.classList.contains('is-active') || still.matches || document.hidden) return;
    retexture(Math.floor(Math.random() * letters.length));
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
