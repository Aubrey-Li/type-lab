# Roadmap

## Built

- Lab shell: playground tabs, settings corner (palettes), ? notes toggle.
- Glyph: Sculpt brush (soft falloff, wheel or [ ] to size), Points tool (handles
  follow), weight and contrast across the alphabet (offset along outline normals),
  drag the lines to stretch, drag the advance; slant, width; gesture-based
  undo/redo; type in the strip; download as .otf or use it in every playground.
- Anatomy, Leading, Motion, CJK (square, line breaks, direction).

## Next

- **Glyph**: cleaner weight at extremes (true outline offsetting), add/delete points, marquee-select several points,
  kerning pairs by dragging one letter toward another, save sessions.
- **Playful entry**: a landing that is itself a playground (type a word; it reacts).

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
