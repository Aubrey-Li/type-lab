# Type Lab

An interactive field guide to digital type: letter anatomy, font files and their
vertical metrics, how glyphs are placed and animated in a line, CJK typesetting,
and the lineage of a type family. The look borrows from Ellen Lupton's
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
src/app.ts                  full-screen scenes, chapter strip, progress, ←/→ navigation, hash routing
src/content.ts              the sequence: cover, chapter cards, scenes (prose + figure)
src/lib/
  dom.ts                    h() / s() element builders, fmt, uid
  controls.ts               segmented, slider, checkbox, select: the shared control voice
  fonts.ts                  open-source font catalog, upload, shared current font, vertical metrics
  font-picker.ts            a select bound to the current font
  matrix.ts                 2D affine matrices (SVG order)
  theme.ts                  palettes: presets, custom colors, contrast check
  settings.ts               the settings corner (bottom left); palette is its first section
src/figures/
  anatomy.ts                I    named parts of letters (tuned to EB Garamond)
  font-explorer.ts          II   specimen, tables, glyph grid, outline with points
  vertical-metrics.ts       II   ascent, cap height, x-height, leading, em box
  transform-stack.ts        III  frame · line · segment · glyph matrices and animation
  cjk-embox.ts              IV   em square, baselines, punctuation by locale
  cjk-linebreak.ts          IV   line-breaking rules: hang, squeeze, push out
  cjk-direction.ts          IV   vertical setting, quarter-em spacing, upright numbers
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
- **Scenes, not a page**: the experience is one full-screen scene at a time
  (`#/chapter/scene`). Add a scene by adding it to `content.ts`. Figures mount
  the first time their scene is shown, because they measure rendered text.
- **Figures** are `mountX(root: HTMLElement)` functions that own their state and
  re-render on change; ones that use the current font subscribe to `fontStore`.

See [docs/ROADMAP.md](docs/ROADMAP.md) for what's next.
