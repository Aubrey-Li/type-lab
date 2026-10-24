// The landing: the mark, one line about the lab, and a door into each playground.
import { PLAYGROUNDS } from './playgrounds';
import { h } from './lib/dom';
import { mark } from './lib/mark';

export function buildHome() {
  const logo = mark({ angle: -45 });
  const home = h('section', { class: 'home', 'aria-label': 'Type Lab' },
    h('div', { class: 'home-hero' },
      h('div', { class: 'home-mark' }, logo.svg),
      h('div', { class: 'home-words' },
        h('h1', { class: 'home-title' }, 'Type Lab'),
        h('p', { class: 'home-line' }, 'Playgrounds for letters'))),
    h('nav', { class: 'home-doors', 'aria-label': 'Playgrounds' }, PLAYGROUNDS.map((p) =>
      h('a', { class: 'door', href: p.soon ? null : `#/${p.id}`, 'aria-disabled': p.soon ? 'true' : null },
        h('span', { class: 'door-glyph', lang: p.specimenLang ?? null }, p.specimen),
        h('span', { class: 'door-name' }, p.name, p.soon && h('span', { class: 'soon' }, 'soon')),
        h('span', { class: 'door-hook' }, p.hook)))),
  );

  // The dividing line turns to face the pointer, eased so it glides rather than snaps.
  let target = -45, angle = -45, raf = 0;
  const step = () => {
    // Shortest way round, so it never spins the long way.
    const diff = ((target - angle + 540) % 360) - 180;
    angle += diff * 0.12;
    logo.setAngle(angle);
    raf = Math.abs(diff) > 0.1 ? requestAnimationFrame(step) : 0;
  };
  home.addEventListener('pointermove', (e) => {
    const r = logo.svg.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    // The line runs perpendicular to the pointer: 文 turns to face it.
    target = (Math.atan2(dy, dx) * 180) / Math.PI - 90;
    if (!raf) raf = requestAnimationFrame(step);
  });
  return home;
}
