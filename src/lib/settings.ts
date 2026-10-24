// The settings corner: a button in the bottom left that opens a panel of
// sections. Palette is the first; add sections here as they appear.
import { h, s } from './dom';
import { paletteSettings } from './theme';

export function settingsCorner() {
  const panel = h('div', { id: 'settings-panel', popover: 'auto', class: 'settings-panel', 'aria-label': 'Settings' },
    paletteSettings(),
  );
  const trigger = h('button', {
    type: 'button', class: 'corner-btn settings-trigger', popovertarget: 'settings-panel',
    'aria-label': 'Settings', title: 'Settings',
  }, gear());
  panel.addEventListener('toggle', (e) =>
    trigger.setAttribute('aria-expanded', String((e as ToggleEvent).newState === 'open')));
  return h('div', { class: 'settings' }, trigger, panel);
}

/** A gear: eight teeth around a ring, drawn in the current text color. */
function gear() {
  const teeth = Array.from({ length: 8 }, (_, i) =>
    s('rect', { x: 10.6, y: 1.6, width: 2.8, height: 4.4, rx: 0.8, transform: `rotate(${i * 45} 12 12)` }));
  return s('svg', { viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': 'true', class: 'gear' },
    s('g', { class: 'gear-teeth' }, teeth),
    s('circle', { cx: 12, cy: 12, r: 6.6, class: 'gear-ring' }),
    s('circle', { cx: 12, cy: 12, r: 2.6, class: 'gear-hole' }));
}
