# Type Lab

A lab of typographic playgrounds: mutate a real font by dragging its points and
lines, isolate the parts of letters, travel through a variable font family, animate text at every level of
layout, set a page of Latin or Chinese and Japanese on its grid, and take CJK characters apart to
animate their parts. Explanations stay out of the way until you
press the ? in the corner. The look borrows from Ellen Lupton's
*Thinking with Type*: grey specimen letters, a single red accent, tracked
small-capital labels and monospaced readouts.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run build      # typecheck + production build into dist/
```

Requires Node 20.19+ (installed here with `brew install node`).

## Layout

```
index.html                  an empty shell (#app)
src/main.ts                 loads interface fonts and theme, then mounts the app
src/app.ts                  the lab shell: playground tabs, settings corner, ? notes toggle, hash routing
src/playgrounds.ts          the list of playgrounds: name, short note, mount function
src/lib/
  dom.ts                    h() / s() element builders, fmt, uid
  controls.ts               segmented, slider, checkbox, select: the shared control voice
  fonts.ts                  open-source font catalog, upload, shared current font, vertical metrics
  font-picker.ts            a select bound to the current font
  matrix.ts                 2D affine matrices (SVG order)
  theme.ts                  palettes: presets, custom colors, contrast check
  settings.ts               the settings corner (bottom left); palette is its first section
  latin-setting.ts          Latin lines: fill a measure, hyphenate at ~, justify, find rivers
  cjk-rules.ts              CJK on the character grid: locale rules, 禁则 by hang / squeeze / push, justification
  cjk-fonts.ts              CJK outlines: find the Fontsource subset that holds a character, fetch and parse it
  woff.ts                   WOFF → SFNT with the browser's zlib (opentype.js can't inflate the CJK subsets)
  bunkai.ts                 take a character apart: pieces (connected outlines), parts (cut along empty
                            channels: 語 → 言 | 吾), ordered by stroke order (KanjiVG for Japanese and kana,
                            Make Me a Hanzi for Chinese; fetched per character, warped onto the font)
src/figures/
  glyph-lab.ts              Glyph    drag points, lines and advance; slant/width; use the result in every playground
  anatomy.ts                Anatomy  named parts of letters (tuned to EB Garamond)
  family-lab.ts             Family   variable families: design-space pad, every axis, style grid, masters, wander
  transform-stack.ts        Motion   frame · line · segment · glyph matrices and animation
  grid-lab.ts               Grid     a page in Latin (baseline grid, measure, rivers) or CJK (squares, line-end
                                     rules, vertical, mixed scripts); drag margins and gutter; a loupe per character
  grid-texts.ts             Grid     the sample text for each script
  pieces-lab.ts             Pieces   CJK characters taken apart; parts assemble, explode, slide, drop or swirl,
                                     staggered, in writing order or not; drag a part out
src/styles/
  tokens.css                palette tokens; every tone is mixed from bg / ink / accent
  base.css, controls.css, figures.css
```

## Conventions

- **Palette**: three colors (`--bg`, `--ink`, `--accent`). Derived tones
  (`--ink-2`, `--ghost`, `--rule`…) come from `color-mix`, so user palettes
  restyle everything. Never hard-code a color in a figure; use the tokens or the
  shared SVG classes (`.guide`, `.svg-label`, `.ghost`, `.accent-fill`…).
- **Fonts**: every font, catalog or uploaded, goes through `register()` in
  `fonts.ts`: one `FontFace` for rendering, one opentype.js parse for outlines
  and tables. To add a family, `npm i @fontsource/<id>` and add a `CATALOG` entry.
  WOFF2 uploads render but can't be inspected yet (opentype.js needs a
  decompressor).
- **Playgrounds, not pages**: one full-screen playground at a time (`#/glyph`).
  Add one in `playgrounds.ts`. They mount the first time they are shown, because
  they measure rendered text.
- **Progressive disclosure**: `.readout`, `.caption` and `.info-only` are hidden
  until the ? toggle is on. Use `.caption.live` for text that appears in response
  to the visitor (e.g. hovering an anatomy label).
- **Edits are deltas**: the glyph playground never rewrites the font; it stores
  point offsets, line positions, slant and width, and builds a new font on demand.
- **Figures** are `mountX(root: HTMLElement)` functions that own their state and
  re-render on change; ones that use the current font subscribe to `fontStore`.

See [docs/ROADMAP.md](docs/ROADMAP.md) for what's next.
