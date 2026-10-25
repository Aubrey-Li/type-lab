// Chinese and Japanese setting on the character grid. Every character is one
// em square, so a line is a whole number of squares and there are no word
// spaces to stretch. Punctuation does the work instead: the line-start and
// line-end prohibitions (禁则 / 禁則処理) are met by hanging, squeezing or
// pushing out, and the leftover space is spread along the line.

export type Locale = 'sc' | 'tc' | 'jp';

export const LOCALES: Record<Locale, { label: string; name: string; lang: string; family: string; indent: number }> = {
  sc: { label: '简', name: 'Simplified Chinese', lang: 'zh-Hans', family: 'var(--cjk-sc)', indent: 2 },
  tc: { label: '繁', name: 'Traditional Chinese', lang: 'zh-Hant', family: 'var(--cjk-tc)', indent: 2 },
  jp: { label: '日', name: 'Japanese', lang: 'ja', family: 'var(--cjk-jp)', indent: 1 },
};

const OPENING = '（《「『“‘【〔〈';
const CLOSING = '）》」』”’】〕〉';
// Japanese also keeps small kana, the long-vowel mark and the repeat mark off the start of a line.
const SMALL_KANA = 'ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶー々ゝゞヽヾ';

export interface Rules {
  noStart: Set<string>;
  noEnd: Set<string>;
  hangable: Set<string>;
  /** Marks whose ink fills one half of the square, so the other half can be given up. */
  halfClosing: Set<string>;
  halfOpening: Set<string>;
}

export function rulesFor(locale: Locale): Rules {
  return {
    noStart: new Set(`，。、；：！？…·${CLOSING}${locale === 'jp' ? SMALL_KANA : ''}`),
    noEnd: new Set(OPENING),
    hangable: new Set('，。、'),
    // In Taiwan the full stop and commas sit in the middle of the square: no empty half to give up.
    halfClosing: new Set(locale === 'tc' ? CLOSING : `${CLOSING}，。、`),
    halfOpening: new Set(OPENING),
  };
}

export type Kind = 'han' | 'punct' | 'latin' | 'digits' | 'indent';
export type Mark = 'violation' | 'hang' | 'squeeze' | 'pair' | 'push';

export interface Tok {
  text: string;
  kind: Kind;
  w: number;        // advance along the line, in em
  dx: number;       // where the ink starts relative to the advance (a squeezed opening mark moves left)
  gap: number;      // space before it, in em: the gap between scripts, plus any justification
  at: number;       // position along the line, in em
  mark?: Mark;
  offGrid?: boolean;
}

export interface CjkLine { toks: Tok[]; hang?: Tok; spread: number; last: boolean; note?: string }

export type LineEnds = 'off' | 'hang' | 'squeeze' | 'push';

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const RUN = /([A-Za-z][A-Za-z0-9-]*|\d+)/;

export interface CjkOptions {
  rules: Rules;
  /** Width of a Latin run, in em of the CJK size. */
  measure: (text: string) => number;
  indent: number;
  scriptGap: boolean;
  pairs: boolean;
  vertical: boolean;
}

/** One paragraph as tokens: characters, Latin and number runs, the indent; with paired punctuation squeezed. */
export function tokenize(para: string, o: CjkOptions): Tok[] {
  const toks: Tok[] = [];
  if (o.indent) toks.push({ text: '', kind: 'indent', w: o.indent, dx: 0, gap: 0, at: 0 });
  para.split(RUN).forEach((part, i) => {
    if (!part) return;
    if (i % 2) {
      // Short numbers stand upright in one square when vertical (縦中横); other runs keep their own width.
      const tcy = o.vertical && /^\d{1,2}$/.test(part);
      toks.push({ text: part, kind: tcy ? 'digits' : 'latin', w: tcy ? 1 : o.measure(part), dx: 0, gap: 0, at: 0 });
    } else {
      for (const ch of part) {
        toks.push({ text: ch, kind: CJK.test(ch) ? 'han' : 'punct', w: 1, dx: 0, gap: 0, at: 0 });
      }
    }
  });
  if (o.scriptGap) {
    // A quarter em between ideographs and Latin (四分空), never beside punctuation or an upright number.
    toks.forEach((t, i) => {
      const prev = toks[i - 1];
      if (!prev || t.kind === 'digits' || prev.kind === 'digits') return;
      if ((t.kind === 'latin' && prev.kind === 'han') || (t.kind === 'han' && prev.kind === 'latin')) t.gap = 0.25;
    });
  }
  if (o.pairs) {
    const { halfClosing, halfOpening } = o.rules;
    toks.forEach((a, i) => {
      const b = toks[i + 1];
      if (!b || a.kind !== 'punct' || b.kind !== 'punct') return;
      if (halfClosing.has(a.text) && (halfClosing.has(b.text) || halfOpening.has(b.text))) { a.w = 0.5; a.mark = 'pair'; }
      else if (halfOpening.has(a.text) && halfOpening.has(b.text)) { b.w = 0.5; b.dx = -0.5; b.mark = 'pair'; }
    });
  }
  return toks;
}

/** Length of a run of tokens set on one line: the first token's leading gap falls away. */
const span = (toks: Tok[]) => toks.reduce((sum, t, i) => sum + t.w + (i ? t.gap : 0), 0);

/** Break one paragraph into lines of `n` squares, then justify every line but the last. */
export function breakParagraph(src: Tok[], n: number, mode: LineEnds, rules: Rules): CjkLine[] {
  const toks = src.map((t) => ({ ...t }));
  const lines: CjkLine[] = [];
  let i = 0;
  while (i < toks.length) {
    let j = i;
    while (j < toks.length && span(toks.slice(i, j + 1)) <= n + 1e-6) j++;
    if (j === i) j = i + 1;                         // a run longer than the line still has to go somewhere
    const line: CjkLine = { toks: toks.slice(i, j), spread: 0, last: false };
    const at = (k: number) => toks[k]?.text ?? '';

    if (mode === 'off') {
      const first = line.toks[0], end = line.toks[line.toks.length - 1];
      if (rules.noStart.has(first.text)) { first.mark = 'violation'; line.note = `“${first.text}” starts a line`; }
      if (j < toks.length && rules.noEnd.has(end.text)) { end.mark = 'violation'; line.note = `“${end.text}” ends a line`; }
    } else if (j < toks.length) {
      let push = false;
      const next = toks[j];
      if (rules.noStart.has(next.text)) {
        if (mode === 'hang' && rules.hangable.has(next.text)) {
          next.mark = 'hang'; line.hang = next; j++;
          line.note = `hangs “${next.text}”`;
        } else if (mode === 'squeeze') {
          // Take back the empty half of marks already on the line (and of the newcomer) until it fits.
          const over = span([...line.toks, next]) - n;
          const give = [...line.toks, next].filter((t) => t.kind === 'punct' && t.w === 1 &&
            (rules.halfClosing.has(t.text) || rules.halfOpening.has(t.text))).reverse();
          const need = Math.ceil(over / 0.5 - 1e-6);
          if (need <= give.length && !rules.noStart.has(at(j + 1))) {
            for (const t of give.slice(0, need)) {
              t.w = 0.5; t.mark = 'squeeze';
              if (rules.halfOpening.has(t.text)) t.dx = -0.5;
            }
            line.toks.push(next); j++;
            line.note = `squeezes ${need} mark${need > 1 ? 's' : ''} to fit “${next.text}”`;
          } else push = true;
        } else push = true;
      }
      if (!line.hang && rules.noEnd.has(line.toks[line.toks.length - 1].text)) push = true;
      if (push) {
        // Send characters down until this line ends, and the next begins, legally.
        let moved = 0;
        while (line.toks.length > 1 && moved < 4 &&
          (rules.noStart.has(at(j)) || rules.noEnd.has(line.toks[line.toks.length - 1].text))) {
          line.toks.pop(); j--; moved++;
        }
        if (moved) { toks[j].mark = 'push'; line.note = `pushes “${toks[j].text}” to the next line`; }
      }
    }
    lines.push(line);
    i = j;
  }
  lines[lines.length - 1].last = true;
  lines.forEach((line) => justify(line, n));
  return lines;
}

/** Spread what is left of the line: first into the gaps between scripts, then evenly between every character. */
function justify(line: CjkLine, n: number) {
  const toks = line.toks;
  toks[0].gap = 0;
  let left = line.last ? 0 : n - span(toks);
  if (left > 1e-6) {
    for (const t of toks.slice(1)) {
      if (t.gap > 0 && left > 0) { const add = Math.min(0.25, left); t.gap += add; left -= add; }
    }
    if (toks.length > 1 && left > 1e-6) {
      line.spread = left / (toks.length - 1);
      for (const t of toks.slice(1)) t.gap += line.spread;
    }
  }
  let pos = 0;
  for (const t of toks) {
    pos += t.gap;
    t.at = pos;
    // A full square that no longer starts on a square of the grid.
    t.offGrid = t.w === 1 && t.kind !== 'indent' && Math.abs(pos - Math.round(pos)) > 0.02;
    pos += t.w;
  }
  if (line.hang) { line.hang.at = n; line.hang.gap = 0; }
}
