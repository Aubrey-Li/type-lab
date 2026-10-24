// Tiny element builders. Attributes whose key starts with "on" become event
// listeners; null/false attributes and children are skipped.

type AttrValue = string | number | boolean | null | undefined | EventListener;
export type Attrs = Record<string, AttrValue>;
export type Child = Node | string | number | null | undefined | false | Child[];

const SVG_NS = 'http://www.w3.org/2000/svg';

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Attrs = {}, ...children: Child[]
): HTMLElementTagNameMap[K] {
  return build(document.createElement(tag), attrs, children);
}

export function s<K extends keyof SVGElementTagNameMap>(
  tag: K, attrs: Attrs = {}, ...children: Child[]
): SVGElementTagNameMap[K] {
  return build(document.createElementNS(SVG_NS, tag), attrs, children);
}

function build<E extends Element>(el: E, attrs: Attrs, children: Child[]): E {
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  appendAll(el, children);
  return el;
}

function appendAll(el: Element, children: Child[]) {
  for (const child of children) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) appendAll(el, child);
    else el.append(child instanceof Node ? child : String(child));
  }
}

let uidCounter = 0;
/** Unique ids for clipPaths and the like; figures can be mounted more than once. */
export const uid = (prefix: string) => `${prefix}-${++uidCounter}`;

/** Round for display: 66.0 → "66", 49.94 → "49.9". */
export const fmt = (n: number, digits = 1) => String(+n.toFixed(digits) || 0);

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
