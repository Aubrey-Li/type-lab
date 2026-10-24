// The lab: a home page, then playground tabs along the top, one full-screen
// playground at a time, settings in the bottom-left corner and an info toggle
// in the bottom-right. The hash names the playground (#/glyph); no hash is home.
import { buildHome } from './home';
import { PLAYGROUNDS } from './playgrounds';
import { h } from './lib/dom';
import { mark } from './lib/mark';
import { settingsCorner } from './lib/settings';

const INFO_KEY = 'type-lab:info';

function readInfo() {
  try { return localStorage.getItem(INFO_KEY) === '1'; } catch { return false; }
}

export function mountApp(root: HTMLElement) {
  const lab = h('div', { class: 'lab' });
  const tabs = PLAYGROUNDS.map((p) =>
    h('a', { href: p.soon ? null : `#/${p.id}`, class: 'pg-tab', 'aria-disabled': p.soon ? 'true' : null },
      p.name, p.soon && h('span', { class: 'soon' }, 'soon')));
  const panes = PLAYGROUNDS.map((p) => h('section', { class: 'playground', 'aria-label': p.name }));
  const home = buildHome();
  const note = h('aside', { class: 'info-card', 'aria-live': 'polite' });
  const infoBtn = h('button', { type: 'button', class: 'info-toggle', 'aria-label': 'Show notes', onclick: () => setInfo(!lab.classList.contains('info-on')) }, '?');

  lab.append(
    h('header', { class: 'lab-top' },
      h('a', { class: 'wordmark', href: '#/' }, mark({ size: 26 }).svg, 'Type Lab'),
      h('nav', { class: 'pg-tabs', 'aria-label': 'Playgrounds' }, tabs)),
    h('main', { class: 'playgrounds' }, home, panes),
    note,
    h('footer', { class: 'lab-bottom' }, settingsCorner(), infoBtn),
  );
  root.append(lab);

  function setInfo(on: boolean) {
    lab.classList.toggle('info-on', on);
    infoBtn.setAttribute('aria-pressed', String(on));
    try { localStorage.setItem(INFO_KEY, on ? '1' : '0'); } catch { /* not persisted */ }
  }
  setInfo(readInfo());

  const mounted = new Set<number>();
  const HOME = -1;
  let current: number | null = null;
  function show() {
    const id = location.hash.replace(/^#\/?/, '');
    const found = PLAYGROUNDS.findIndex((p) => p.id === id && !p.soon);
    const i = found < 0 ? HOME : found;
    if (i === current) return;
    current = i;
    home.classList.toggle('is-active', i === HOME);
    lab.classList.toggle('at-home', i === HOME);
    panes.forEach((pane, j) => pane.classList.toggle('is-active', j === i));
    tabs.forEach((t, j) => t.toggleAttribute('aria-current', j === i));
    if (i === HOME) {
      note.innerHTML = 'Each playground is a tool to play with. Notes like this one stay hidden until you press <strong>?</strong>.';
      document.title = 'Type Lab';
      return;
    }
    const p = PLAYGROUNDS[i];
    note.innerHTML = p.note;
    document.title = `${p.name} · Type Lab`;
    // Playgrounds measure rendered text, so they mount the first time they are visible.
    if (!mounted.has(i) && p.mount) {
      mounted.add(i);
      try {
        p.mount(panes[i]);
      } catch (err) {
        console.error(`playground "${p.id}" failed`, err);
        panes[i].textContent = `This playground failed to load: ${(err as Error).message}`;
      }
    }
  }
  window.addEventListener('hashchange', show);
  show();
}
