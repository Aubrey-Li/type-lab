# Roadmap

## Built (v0.1)

- I Letter: anatomy plate (Fancy / flesh / fresh / Blood) with hover and pin.
- II Font: catalog of 18 open-source families plus upload; specimen, table values,
  glyph grid and outline view; the lines a font is drawn to (first baseline,
  leading, larger run, em box).
- III Text: frame → line → segment → glyph matrix chain; animation at any level;
  text on a path.
- IV CJK: em square and baselines, punctuation by locale (SC / TC / JP),
  line-breaking rules on a grid, vertical setting with quarter-em spacing and
  upright numbers.
- Palettes: Ink, Paper, Blueprint, Riso, Moss, plus custom colors with a contrast check.

## Next

- **Grid** chapter: columns, gutters, a baseline grid the text snaps to, the measure.
- **Lineage** chapter: interactive Garamond timeline, comparing revivals glyph by
  glyph (the same `a` from each, overlaid), with notes on the Jannon misattribution.
- **Fonts**
  - WOFF2 inspection (bundle a WOFF2 decompressor).
  - Variable fonts: axis sliders (`@fontsource-variable/*`), named instances.
  - Kerning and OpenType features: show GPOS kerning pairs, toggle liga / smcp / onum.
  - More CJK families (LXGW WenKai TC is installed but unused; Noto Sans SC / JP).
- **CJK**
  - Punctuation compression between adjacent marks (。」 → one square).
  - Korean: Hangul syllable composition from jamo; word spacing vs. CJK spacing.
  - Ruby (furigana / zhuyin) positioning.
  - Justification on the grid: where extra space goes (between characters vs. after punctuation).
- **Text**: kerning vs. tracking widget; justification and hyphenation; rivers.
- Anatomy regions are tuned to EB Garamond; generalising them to any font would need
  outline-based part detection.
- Mobile layout pass on the SVG figures; keyboard access for glyph selection.
