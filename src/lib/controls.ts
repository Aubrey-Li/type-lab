import { h, s } from './dom';

export interface Control<T> {
  el: HTMLElement;
  set(value: T): void;
}

export type Option<T extends string> = T | { value: T; label: string };

const norm = <T extends string>(o: Option<T>) => (typeof o === 'string' ? { value: o, label: o } : o);

export const row = (...els: (HTMLElement | null | false)[]) =>
  h('div', { class: 'ctl-row' }, ...els);

/** A row of underlined buttons, one active. */
export function segmented<T extends string>(opts: {
  label?: string;
  options: readonly Option<T>[];
  value: T;
  onChange(value: T): void;
}): Control<T> {
  const options = opts.options.map(norm);
  const buttons = options.map((o) =>
    h('button', { type: 'button', class: 'seg-btn', onclick: () => pick(o.value, true) }, o.label),
  );
  const el = h('div', { class: 'seg', role: 'group', 'aria-label': opts.label ?? null },
    opts.label && h('span', { class: 'ctl-label' }, opts.label), buttons);

  function pick(value: T, fire: boolean) {
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i].value === value)));
    if (fire) opts.onChange(value);
  }
  pick(opts.value, false);
  return { el, set: (v) => pick(v, false) };
}

export function slider(opts: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  format?: (v: number) => string;
  onInput(value: number): void;
}): Control<number> & { disable(disabled: boolean): void } {
  const format = opts.format ?? String;
  const input = h('input', { type: 'range', min: opts.min, max: opts.max, step: opts.step ?? 1, 'aria-label': opts.label });
  input.value = String(opts.value);
  const out = h('output', { class: 'ctl-value' });
  const el = h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, opts.label), input, out);

  const paint = () => {
    const v = Number(input.value);
    input.style.setProperty('--p', `${((v - opts.min) / (opts.max - opts.min)) * 100}%`);
    out.textContent = format(v);
  };
  input.addEventListener('input', () => { paint(); opts.onInput(Number(input.value)); });
  paint();

  return {
    el,
    set(v) { input.value = String(v); paint(); },
    disable(d) { input.disabled = d; el.classList.toggle('is-disabled', d); },
  };
}

export function checkbox(opts: { label: string; checked: boolean; onChange(checked: boolean): void }): Control<boolean> {
  const input = h('input', { type: 'checkbox', onchange: () => opts.onChange(input.checked) });
  input.checked = opts.checked;
  const el = h('label', { class: 'chk' }, input, opts.label);
  return { el, set: (v) => { input.checked = v; } };
}

export interface OptionGroup<T extends string> {
  label?: string;
  options: { value: T; label: string }[];
}

export function select<T extends string>(opts: {
  label?: string;
  groups: OptionGroup<T>[];
  value: T;
  onChange(value: T): void;
}): Control<T> & { setGroups(groups: OptionGroup<T>[], value: T): void } {
  const sel = h('select', { 'aria-label': opts.label ?? null, onchange: () => opts.onChange(sel.value as T) });
  const chevron = s('svg', { width: 14, height: 14, viewBox: '0 0 14 14', fill: 'none', 'stroke-width': 1.5 },
    s('path', { d: 'M2 5l5 5 5-5' }));
  const el = h('label', { class: 'ctl' },
    opts.label && h('span', { class: 'ctl-label' }, opts.label),
    h('span', { class: 'select-wrap' }, sel, chevron));

  function setGroups(groups: OptionGroup<T>[], value: T) {
    sel.replaceChildren(...groups.map((g) => {
      const options = g.options.map((o) => h('option', { value: o.value }, o.label));
      return g.label ? h('optgroup', { label: g.label }, options) : options;
    }).flat());
    sel.value = value;
  }
  setGroups(opts.groups, opts.value);
  return { el, set: (v) => { sel.value = v; }, setGroups };
}

export function button(label: string, onClick: () => void) {
  return h('button', { type: 'button', class: 'seg-btn', onclick: onClick }, label);
}
