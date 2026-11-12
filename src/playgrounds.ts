// The lab's playgrounds. Each is a full-screen tool; `note` is the short
// explanation shown only when the visitor asks for it (the ? in the corner).
import { mountAnatomy } from './figures/anatomy';
import { mountFamilyLab } from './figures/family-lab';
import { mountGlyphLab } from './figures/glyph-lab';
import { mountGridLab } from './figures/grid-lab';
import { mountPiecesLab } from './figures/pieces-lab';
import { mountTransformStack } from './figures/transform-stack';

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

export const PLAYGROUNDS: Playground[] = [
  {
    id: 'glyph', name: 'Glyph', mount: mountGlyphLab,
    hook: 'Sculpt the curves of a real font, then set type in it.', specimen: 'g',
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
    id: 'grid', name: 'Grid', mount: mountGridLab,
    hook: 'Set a page in lines of Latin or squares of 汉字.', specimen: '田', specimenLang: 'zh-Hans',
    note: `<strong>Latin</strong> is measured in lines. A <strong>baseline grid</strong> keeps every column in step, the
      <strong>measure</strong> reads best between 45 and 75 characters, and justification stretches the spaces between
      words until they line up into <strong>rivers</strong>. <strong>Chinese and Japanese</strong> are measured in
      characters: each fills one square, so a line is a whole number of squares and there are no spaces to stretch.
      Punctuation does the work. Marks that may not start or end a line (禁则) are <em>hung</em> past the edge,
      <em>squeezed</em> into the empty half of their square, or <em>pushed out</em> to the next line. Drag the edges of
      the block or the gutter; click a character to see it in its square, and the rules it obeys.`,
  },
  {
    id: 'pieces', name: 'Pieces', mount: mountPiecesLab,
    hook: 'Take 汉字 apart and set the parts in motion.', specimen: '解', specimenLang: 'zh-Hans',
    note: `A character is built from parts; take it apart (分解) and each can move alone.
      <strong>Parts</strong>: cut where a line slices almost no ink, left from right
      (<span class="ids">⿰</span>) before top from bottom (<span class="ids">⿱</span>), so 語 splits into 言 and 吾;
      dashed lines show the cuts. <strong>Pieces</strong>: the font’s separate outlines (Hangul falls into jamo).
      <em>Writing</em> order follows the fixed stroke order, for kanji and kana as for hanzi: Japanese order from
      KanjiVG, Chinese from Make Me a Hanzi (loaded from the web). Click a part to see the way it travels; drag
      it, or its filled handle, to move where it lands, and its hollow handle to move where it starts. Double-click a
      handle to put that end back, or the part to put both back.`,
  },
  { id: 'lineage', name: 'Lineage', soon: true, hook: 'One letter across five centuries.', specimen: 'ſ', note: 'One letter morphing through five centuries of Garamonds.' },
];
