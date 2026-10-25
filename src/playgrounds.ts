// The lab's playgrounds. Each is a full-screen tool; `note` is the short
// explanation shown only when the visitor asks for it (the ? in the corner).
import { mountAnatomy } from './figures/anatomy';
import { mountCjkDirection } from './figures/cjk-direction';
import { mountCjkEmBox } from './figures/cjk-embox';
import { mountCjkLineBreak } from './figures/cjk-linebreak';
import { mountFamilyLab } from './figures/family-lab';
import { mountGlyphLab } from './figures/glyph-lab';
import { mountTransformStack } from './figures/transform-stack';
import { segmented } from './lib/controls';
import { h } from './lib/dom';

export interface Playground {
  id: string;
  name: string;
  /** One line for the home page, and a character that stands for the playground. */
  hook: string;
  specimen: string;
  specimenLang?: string;
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
    hook: 'Sculpt the curves of a real font, then keep it.', specimen: 'g',
    note: `<strong>Sculpt</strong>: grab the letter anywhere; everything inside the brush moves with you,
      most at the centre. ⌥-scroll or [ ] sizes the brush. <strong>Zoom</strong> with a pinch, ⌘-scroll or + − 0; pan by scrolling, dragging empty space, or holding Space. <strong>Points</strong>: move one point and its
      handles. <strong>Weight</strong> and <strong>Contrast</strong> push every outline in or out across the
      whole alphabet. Drag a <strong>line</strong> to stretch every letter drawn to it, and the right edge to change
      the letter’s width. Type in the strip; click a letter to edit it. ⌘Z undoes, ⇧⌘Z redoes, double-click a line
      or slider to reset it. <em>Use everywhere</em> sets the other playgrounds in your edited font, in this browser only.`,
  },
  {
    id: 'anatomy', name: 'Anatomy', mount: mountAnatomy,
    hook: 'Every part of a letter has a name.', specimen: 'R',
    note: `The parts of a letter have names older than print, and they mean the same thing in a punchcutter’s shop
      and a font editor. Hover a label to isolate the part; click to pin it.`,
  },
  {
    id: 'family', name: 'Family', mount: mountFamilyLab,
    hook: 'One skeleton, every weight and width between.', specimen: 'Aa',
    note: `A <strong>family</strong> is one design drawn many ways: thin to black, narrow to wide, upright and
      italic. A <strong>variable font</strong> holds the whole family in one file, along <strong>axes</strong>.
      Lowercase axes are standard (<code>wght</code> weight, <code>wdth</code> width, <code>opsz</code> optical
      size, <code>slnt</code> slant); uppercase ones are the designer’s own inventions. Drag the dot to move across
      two axes, click a style in the grid, or let it <em>Wander</em>. <strong>Masters</strong> outlines the two
      extremes of the horizontal axis: every style between them is interpolated. With optical size following size,
      the headline and the paragraph each get the cut drawn for their size.`,
  },
  {
    id: 'motion', name: 'Motion', mount: mountTransformStack,
    hook: 'Move text by frame, line, word or glyph.', specimen: '&',
    note: `Every glyph is drawn with one matrix, the product of the levels above it: frame, line, segment, glyph,
      <code>M = F · L · W · P · S</code>. An animation is one more term inserted at the level it moves. Click a glyph
      to read its matrices.`,
  },
  {
    id: 'cjk', name: 'CJK',
    hook: 'Square characters, their grid and their rules.', specimen: '永', specimenLang: 'zh-Hans',
    mount: tools([
      { label: 'Square', mount: mountCjkEmBox },
      { label: 'Line breaks', mount: mountCjkLineBreak },
      { label: 'Direction', mount: mountCjkDirection },
    ]),
    note: `Chinese, Japanese and Korean type is drawn inside a square, one em per character. Punctuation shares the
      square, and where its ink sits differs by locale. Lines may break almost anywhere, except where punctuation
      would start or end a line wrongly (禁则).`,
  },
  { id: 'grid', name: 'Grid', soon: true, hook: 'Columns, gutters, a baseline grid.', specimen: '#', note: 'Columns, gutters and the baseline grid.' },
  { id: 'lineage', name: 'Lineage', soon: true, hook: 'One letter across five centuries.', specimen: 'ſ', note: 'One letter morphing through five centuries of Garamonds.' },
];
