// Latin setting by the line: words are filled into a measure, broken at
// discretionary hyphens when hyphenation is on, and justified by stretching
// the spaces between words.

export const SHY = '\u00ad';

export interface LWord { text: string; x: number; w: number }
export interface LLine { words: LWord[]; last: boolean; hyphen: boolean; para: number }

export interface LatinOptions {
  measure: number;               // px
  width: (s: string) => number;  // px at the text size
  justify: boolean;
  hyphenate: boolean;
  indent: number;                // px, on every paragraph but the first
}

export function setLatin(paras: string[], o: LatinOptions): LLine[] {
  const space = o.width(' ');
  const lines: LLine[] = [];
  paras.forEach((para, p) => {
    const queue = para.split(/\s+/).filter(Boolean);
    const indent = p ? o.indent : 0;
    let words: LWord[] = [], used = indent, hyphen = false;
    const close = (last: boolean) => {
      lines.push({ words, last, hyphen, para: p });
      words = []; used = 0; hyphen = false;
    };
    while (queue.length) {
      const word = queue.shift()!;
      const text = word.replaceAll(SHY, '');
      const w = o.width(text);
      if (!words.length) { words.push({ text, x: used, w }); used += w; continue; }
      if (used + space + w <= o.measure) { words.push({ text, x: used + space, w }); used += space + w; continue; }
      // Try the longest piece that still fits, with its hyphen.
      const pieces = word.split(SHY);
      let split = 0;
      if (o.hyphenate) {
        for (let k = pieces.length - 1; k > 0; k--) {
          if (used + space + o.width(`${pieces.slice(0, k).join('')}-`) <= o.measure) { split = k; break; }
        }
      }
      if (split) {
        const head = `${pieces.slice(0, split).join('')}-`;
        words.push({ text: head, x: used + space, w: o.width(head) });
        queue.unshift(pieces.slice(split).join(SHY));
        hyphen = true;
      } else queue.unshift(word);
      close(false);
    }
    if (words.length) close(true);
  });
  if (o.justify) {
    for (const line of lines) {
      if (line.last || line.words.length < 2) continue;
      const start = line.words[0].x;
      const ink = line.words.reduce((sum, w) => sum + w.w, 0);
      const gap = (o.measure - start - ink) / (line.words.length - 1);
      let x = start;
      for (const w of line.words) { w.x = x; x += w.w + gap; }
    }
  }
  return lines;
}

/** The spaces of a line, as [left, right] in px. */
export const gapsOf = (line: LLine) =>
  line.words.slice(1).map((w, i) => [line.words[i].x + line.words[i].w, w.x] as [number, number]);

/**
 * Rivers: wide spaces that sit almost on top of each other for three lines or
 * more. Returns, per line, the indices of its spaces that belong to one.
 */
export function rivers(lines: LLine[], space: number, tolerance: number): Set<number>[] {
  const wide = lines.map((l) => gapsOf(l).map(([a, b]) => b - a > space * 1.6));
  const hit = lines.map(() => new Set<number>());
  const mid = ([a, b]: [number, number]) => (a + b) / 2;
  // Follow each wide space downward through the lines below it.
  lines.forEach((_, i) => {
    gapsOf(lines[i]).forEach((g, k) => {
      if (!wide[i][k]) return;
      const chain: [number, number][] = [[i, k]];
      let x = mid(g);
      for (let j = i + 1; j < lines.length; j++) {
        const below = gapsOf(lines[j]);
        const m = below.findIndex((h, q) => wide[j][q] && Math.abs(mid(h) - x) < tolerance);
        if (m < 0) break;
        chain.push([j, m]);
        x = mid(below[m]);
      }
      if (chain.length >= 3) for (const [j, m] of chain) hit[j].add(m);
    });
  });
  return hit;
}
