// The settings corner: a button in the bottom left that opens a panel of
// sections. Palette is the first; add sections here as they appear.
import { h } from './dom';
import { paletteSettings } from './theme';

export function settingsCorner() {
  const panel = h('div', { id: 'settings-panel', popover: 'auto', class: 'settings-panel', 'aria-label': 'Settings' },
    paletteSettings(),
  );
  const trigger = h('button', { type: 'button', class: 'seg-btn settings-trigger', popovertarget: 'settings-panel' },
    h('span', { class: 'palette-dot', 'aria-hidden': 'true' }), 'Settings');
  panel.addEventListener('toggle', (e) =>
    trigger.setAttribute('aria-expanded', String((e as ToggleEvent).newState === 'open')));
  return h('div', { class: 'settings' }, trigger, panel);
}
