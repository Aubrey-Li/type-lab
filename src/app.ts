// The lab: playground tabs along the top, one full-screen playground at a time,
// settings in the bottom-left corner and an info toggle in the bottom-right.
// The hash names the playground (#/glyph), so playgrounds can be linked.
import { PLAYGROUNDS } from './playgrounds';
import { h } from './lib/dom';
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
  const note = h('aside', { class: 'info-card', 'aria-live': 'polite' });
  const infoBtn = h('button', { type: 'button', class: 'info-toggle', 'aria-label': 'Show notes', onclick: () => setInfo(!lab.classList.contains('info-on')) }, '?');

  lab.append(
    h('header', { class: 'lab-top' },
      h('a', { class: 'wordmark', href: '#/' }, 'Type Lab'),
      h('nav', { class: 'pg-tabs', 'aria-label': 'Playgrounds' }, tabs)),
    h('main', { class: 'playgrounds' }, panes),
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
  let current = -1;
  function show() {
    const id = location.hash.replace(/^#\/?/, '');
    let i = PLAYGROUNDS.findIndex((p) => p.id === id && !p.soon);
    if (i < 0) i = 0;
    if (i === current) return;
    panes[current]?.classList.remove('is-active');
    current = i;
    panes[i].classList.add('is-active');
    tabs.forEach((t, j) => t.toggleAttribute('aria-current', j === i));
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
