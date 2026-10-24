// The sequence of the experience: a cover, then for each chapter a title card
// followed by its scenes. Prose is HTML; figures are mount functions.
import { mountAnatomy } from './figures/anatomy';
import { mountCjkDirection } from './figures/cjk-direction';
import { mountCjkEmBox } from './figures/cjk-embox';
import { mountCjkLineBreak } from './figures/cjk-linebreak';
import { mountFontExplorer } from './figures/font-explorer';
import { mountTransformStack } from './figures/transform-stack';
import { mountVerticalMetrics } from './figures/vertical-metrics';

export interface SceneDef {
  id: string;
  title: string;
  prose: string;
  /** An interactive figure, or static HTML for scenes that are only reading. */
  figure?: (root: HTMLElement) => void;
  html?: string;
}

export interface ChapterDef {
  id: string;
  num: string;
  title: string;
  /** Shown beside the title on the card, e.g. 方块字. */
  aside?: { text: string; lang: string };
  epigraph: string;
  scenes: SceneDef[];
}

export const COVER = {
  title: 'Letters, <em>lines,</em><br>and the space between.',
  lede: 'A field guide to type, in six rooms: the parts of a letter, the lines a font is drawn to, how glyphs are placed and moved, how Chinese, Japanese and Korean type sits in its square, and how one family descends through five centuries of revivals.',
};

export const CHAPTERS: ChapterDef[] = [
  {
    id: 'letter', num: 'I', title: 'Letter',
    epigraph: 'Every letter is a set of named parts, older than print.',
    scenes: [{
      id: 'anatomy', title: 'The anatomy of a letter', figure: mountAnatomy,
      prose: `Typographers name the parts of letters the way anatomists name bones. The names are old,
        and they persist because the parts do: a <strong>stem</strong>, a <strong>bowl</strong>, a
        <strong>serif</strong> mean the same thing in a punchcutter’s shop and in a font editor.
        <p class="hint">Hover a label to isolate the part; click to pin it.</p>`,
    }],
  },
  {
    id: 'font', num: 'II', title: 'Font',
    epigraph: 'A font is drawings and numbers. The numbers decide where the drawings land.',
    scenes: [
      {
        id: 'inside', title: 'Inside a font file', figure: mountFontExplorer,
        prose: `A font file is a set of drawings and a set of numbers. Pick one of the open-source
          families, or drop in a font of your own: it stays in your browser.
          <p class="hint">Click any glyph to see its outline, its points and the box it is set in.</p>`,
      },
      {
        id: 'lines', title: 'The lines a font is drawn to', figure: mountVerticalMetrics,
        prose: `A font never says how tall its letters are. It says where its lines are: an
          <strong>ascent</strong> and <strong>descent</strong> reserved around a baseline, and a cap
          height and x-height the designer drew to. Layout engines stack lines of text using those
          numbers, not the ink.
          <p class="hint">Pick a line to see where it falls, and how the first baseline and the leading follow from it.</p>`,
      },
    ],
  },
  {
    id: 'text', num: 'III', title: 'Text',
    epigraph: 'Layout is a tree of transforms. Motion is one more term in it.',
    scenes: [{
      id: 'matrix', title: 'One matrix per glyph', figure: mountTransformStack,
      prose: `Laid-out text is a tree: a <strong>frame</strong> holds lines, a <strong>line</strong> holds
        segments, a <strong>segment</strong> holds glyphs. Every glyph is drawn with one matrix, the
        product of every level above it: <code>M = F · L · W · P · S</code>.
        <p>An animation is one more term, <code>A</code>, inserted at the level it moves. Store it as a
        delta keyed by index at that level, not as a final matrix: when text reflows, the layout terms
        change, and a stored <code>M</code> would be stale.</p>
        <p class="hint">Click a glyph to read its matrices.</p>`,
    }],
  },
  {
    id: 'cjk', num: 'IV', title: 'CJK', aside: { text: '方块字', lang: 'zh-Hans' },
    epigraph: 'Square characters: each one fills the same square, across or down the page.',
    scenes: [
      {
        id: 'square', title: 'One square, three conventions', figure: mountCjkEmBox,
        prose: `Chinese, Japanese and Korean type is designed inside a square. Each character occupies
          one <strong>em</strong>, and text is a grid of these squares. Punctuation shares the square
          too, and where its ink sits inside it differs between Simplified Chinese, Traditional
          Chinese and Japanese, even for the same code point.`,
      },
      {
        id: 'breaking', title: 'Breaking lines on a grid', figure: mountCjkLineBreak,
        prose: `Because every character is the same width, a line can break almost anywhere, but not
          quite. <strong>Line-breaking rules</strong> (禁则, 禁則処理) keep closing punctuation off the
          start of a line and opening punctuation off its end.
          <p>The fixes: hang the mark in the margin, squeeze punctuation so one more character fits,
          or push a character down and spread the rest.</p>`,
      },
      {
        id: 'direction', title: 'Direction and spacing', figure: mountCjkDirection,
        prose: `The same text can run top to bottom, right to left. In vertical setting, punctuation
          takes vertical forms, Latin turns on its side, and short numbers can stand upright in a single
          square. Where CJK meets Latin, a quarter-em gap keeps the two scripts from colliding.`,
      },
    ],
  },
  {
    id: 'grid', num: 'V', title: 'Grid',
    epigraph: 'Columns, gutters, and the baseline every line agrees on. This room is still being built.',
    scenes: [],
  },
  {
    id: 'lineage', num: 'VI', title: 'Lineage',
    epigraph: 'One name, five centuries, many hands.',
    scenes: [{
      id: 'garamond', title: 'The Garamonds',
      prose: `A typeface is rarely one design. “Garamond” names a family of interpretations, and some
        of them are not based on Garamond at all.
        <p class="hint">Draft: this room will compare the revivals glyph by glyph.</p>`,
      html: `<ol class="timeline">
        <li><span class="year">1540s</span><span>Claude Garamont cuts the romans in Paris that printers would copy for two centuries.</span></li>
        <li><span class="year">1615</span><span>Jean Jannon, in Sedan, cuts types in the same tradition. They are later misattributed to Garamond.</span></li>
        <li><span class="year">1917</span><span>American Type Founders’ Garamond, drawn by Morris Fuller Benton and T. M. Cleland from Jannon’s types.</span></li>
        <li><span class="year">1926</span><span>Beatrice Warde, writing as Paul Beaujon, shows that the “Garamond” revivals are Jannon’s work.</span></li>
        <li><span class="year">1967</span><span>Jan Tschichold’s Sabon, a Garamond design built to look the same on hand, Monotype and Linotype machines.</span></li>
        <li><span class="year">1989</span><span>Adobe Garamond by Robert Slimbach, drawn from Garamond’s romans and Granjon’s italics.</span></li>
        <li><span class="year">2011</span><span>EB Garamond by Georg Duffner, an open-source revival and the serif in these rooms.</span></li>
      </ol>`,
    }],
  },
];
