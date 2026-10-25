# Roadmap

## Built

- Lab shell: playground tabs, settings corner (palettes), ? notes toggle.
- Glyph: Sculpt brush (soft falloff, wheel or [ ] to size), Points tool (handles
  follow), weight and contrast across the alphabet (offset along outline normals),
  drag the lines to stretch, drag the advance; slant, width; gesture-based
  undo/redo; type in the strip; use it in every playground (in-browser only; no download).
- Family: ten variable families (Roboto Flex, Fraunces, Recursive, Anybody, Bricolage, Source Serif,
  Literata, Inter, EB Garamond, Noto Serif SC); 2-axis design-space pad, every axis, style grid,
  masters overlay, optical size following text size, wander.
- Anatomy (parts measured on outlines), Motion.
- Grid: one page, five scripts (Latin, 简, 繁, 日, mixed). Latin: baseline grid with a heading that
  snaps or not, the measure (45–75), justification, hyphenation, rivers. CJK: the character grid,
  line-end rules per locale (Japanese small kana), hang / squeeze / push out, paired marks squeezed,
  indent (two squares in Chinese, one in Japanese), quarter-em gaps and justification in mixed text,
  vertical with locale vertical forms and 縦中横. Drag margins and gutters; a loupe shows any
  character in its em square across locales.

## Next

- **Glyph**: cleaner weight at extremes (true outline offsetting), add/delete points, marquee-select several points,
  kerning pairs by dragging one letter toward another, save sessions.
- **Playful entry**: a landing that is itself a playground (type a word; it reacts).

- **Grid**: editable text; a second page for spreads; Hangul (word spacing on the grid); ruby;
  break Latin runs inside CJK; real hyphenation patterns instead of marked points.
- **Lineage** chapter: interactive Garamond timeline, comparing revivals glyph by
  glyph (the same `a` from each, overlaid), with notes on the Jannon misattribution.
- **Fonts**
  - WOFF2 inspection (bundle a WOFF2 decompressor).
  - Family: compare two families side by side; a family's static styles vs its variable axes; upload a variable font.
  - Kerning and OpenType features: show GPOS kerning pairs, toggle liga / smcp / onum.
  - More CJK families (LXGW WenKai TC is installed but unused; Noto Sans SC / JP).
- **CJK** beyond the page: Hangul syllable composition from jamo; the parts of a character's strokes in Anatomy.
- **Text**: kerning vs. tracking widget.
- Anatomy regions are tuned to EB Garamond; generalising them to any font would need
  outline-based part detection.
- Mobile layout pass on the SVG figures; keyboard access for glyph selection.
