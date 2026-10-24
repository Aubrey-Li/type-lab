// The lab's playgrounds. Each is a full-screen tool; `note` is the short
// explanation shown only when the visitor asks for it (the ? in the corner).
import { mountAnatomy } from './figures/anatomy';
import { mountCjkDirection } from './figures/cjk-direction';
import { mountCjkEmBox } from './figures/cjk-embox';
import { mountCjkLineBreak } from './figures/cjk-linebreak';
import { mountGlyphLab } from './figures/glyph-lab';
import { mountTransformStack } from './figures/transform-stack';
import { mountVerticalMetrics } from './figures/vertical-metrics';
import { segmented } from './lib/controls';
import { h } from './lib/dom';

export interface Playground {
  id: string;
  name: string;
  note: string;
  mount?: (root: HTMLElement) => void;
  soon?: boolean;
}

/** Several tools in one playground, switched by a small tab row. Each mounts when first shown. */
function tools(items: { label: string; mount: (root: HTMLElement) => void }[]) {
  return (root: HTMLElement) => {
    const panes = items.map(() => h('div', { class: 'tool-pane', hidden: true }));
    const mounted = new Set<number>();
    const show = (label: string) => {
      const i = items.findIndex((t) => t.label === label);
      panes.forEach((p, j) => { p.hidden = j !== i; });
      if (!mounted.has(i)) { mounted.add(i); items[i].mount(panes[i]); }
    };
    const tabs = segmented({ options: items.map((t) => t.label), value: items[0].label, onChange: show });
    tabs.el.classList.add('tool-tabs');
    root.append(tabs.el, ...panes);
    show(items[0].label);
  };
}

export const PLAYGROUNDS: Playground[] = [
  {
    id: 'glyph', name: 'Glyph', mount: mountGlyphLab,
    note: `<strong>Sculpt</strong>: grab the letter anywhere; everything inside the brush moves with you,
      most at the centre. ⌥-scroll or [ ] sizes the brush. <strong>Zoom</strong> with a pinch, ⌘-scroll or + − 0; pan by scrolling, dragging empty space, or holding Space. <strong>Points</strong>: move one point and its
      handles. <strong>Weight</strong> and <strong>Contrast</strong> push every outline in or out across the
      whole alphabet. Drag a <strong>line</strong> to stretch every letter drawn to it, and the right edge to change
      the letter’s width. Type in the strip; click a letter to edit it. ⌘Z undoes, ⇧⌘Z redoes, double-click a line
      or slider to reset it. <em>Download</em> saves your font; <em>Use everywhere</em> sets the other playgrounds in it.`,
  },
  {
    id: 'anatomy', name: 'Anatomy', mount: mountAnatomy,
    note: `The parts of a letter have names older than print, and they mean the same thing in a punchcutter’s shop
      and a font editor. Hover a label to isolate the part; click to pin it.`,
  },
  {
    id: 'leading', name: 'Leading', mount: mountVerticalMetrics,
    note: `Layout engines stack lines using the font’s numbers, not its ink: the ascent decides where the first
      baseline falls, and leading is the distance from one baseline to the next.`,
  },
  {
    id: 'motion', name: 'Motion', mount: mountTransformStack,
    note: `Every glyph is drawn with one matrix, the product of the levels above it: frame, line, segment, glyph,
      <code>M = F · L · W · P · S</code>. An animation is one more term inserted at the level it moves. Click a glyph
      to read its matrices.`,
  },
  {
    id: 'cjk', name: 'CJK',
    mount: tools([
      { label: 'Square', mount: mountCjkEmBox },
      { label: 'Line breaks', mount: mountCjkLineBreak },
      { label: 'Direction', mount: mountCjkDirection },
    ]),
    note: `Chinese, Japanese and Korean type is drawn inside a square, one em per character. Punctuation shares the
      square, and where its ink sits differs by locale. Lines may break almost anywhere, except where punctuation
      would start or end a line wrongly (禁则).`,
  },
  { id: 'grid', name: 'Grid', soon: true, note: 'Columns, gutters and the baseline grid.' },
  { id: 'lineage', name: 'Lineage', soon: true, note: 'One letter morphing through five centuries of Garamonds.' },
];
