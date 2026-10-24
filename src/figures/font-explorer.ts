// Browse the catalog or an uploaded font: specimen, table values, every glyph,
// and one glyph's outline with its on- and off-curve points.
import type { Glyph } from 'opentype.js';
import { button, row } from '../lib/controls';
import { figureTitle, fmt, h, s } from '../lib/dom';
import { fontPicker } from '../lib/font-picker';
import { fontStore, loadUpload, metricTables, type LoadedFont } from '../lib/fonts';

const PAGE = 240;
const SPECIMEN = 'Hamburgefonstiv';

export function mountFontExplorer(root: HTMLElement) {
  const fileInput = h('input', { type: 'file', accept: '.ttf,.otf,.woff,.woff2', hidden: true, onchange: () => {
    const file = fileInput.files?.[0];
    if (file) void upload(file);
    fileInput.value = '';
  } });
  const uploadBtn = h('button', { type: 'button', class: 'file-btn', onclick: () => fileInput.click() }, 'Upload a font');
  const notice = h('p', { class: 'notice', hidden: true });

  const specimen = h('p', { class: 'specimen-line', contenteditable: 'plaintext-only', spellcheck: 'false' }, SPECIMEN);
  const meta = h('dl', { class: 'meta' });
  const grid = h('div', { class: 'glyph-grid', role: 'listbox', 'aria-label': 'Glyphs' });
  const more = button('Show more glyphs', () => renderGrid(shown + PAGE));
  more.classList.add('more-btn');
  const detail = s('svg', { viewBox: '0 0 520 580', class: 'glyph-detail', role: 'img' });
  const glyphInfo = h('div', { class: 'readout' });

  const body = h('div', { class: 'explorer' },
    h('div', {}, specimen, meta, grid, more),
    h('div', { class: 'stage' }, detail, glyphInfo),
  );

  root.append(
    figureTitle('Inside a font file'),
    h('div', { class: 'controls' }, row(fontPicker(), uploadBtn, fileInput), notice),
    body,
  );

  // Drop a font anywhere on the figure.
  root.addEventListener('dragover', (e) => { e.preventDefault(); body.classList.add('is-drop'); });
  root.addEventListener('dragleave', () => body.classList.remove('is-drop'));
  root.addEventListener('drop', (e) => {
    e.preventDefault();
    body.classList.remove('is-drop');
    const file = e.dataTransfer?.files[0];
    if (file) void upload(file);
  });

  async function upload(file: File) {
    try {
      const font = await loadUpload(file);
      await fontStore.select(font.key);
    } catch (err) {
      notice.hidden = false;
      notice.textContent = `Could not load ${file.name}: ${(err as Error).message}`;
    }
  }

  let font: LoadedFont = fontStore.get();
  let shown = PAGE;
  let selected = 0;

  function render() {
    font = fontStore.get();
    specimen.style.fontFamily = `"${font.family}"`;
    notice.hidden = !font.parseError;
    notice.textContent = font.parseError ?? '';
    renderMeta();
    const ot = font.ot;
    selected = ot ? Math.max(0, ot.charToGlyphIndex('a')) : 0;
    renderGrid(PAGE);
    renderDetail();
  }

  function renderMeta() {
    const ot = font.ot;
    const rows: [string, string, boolean?][] = [];
    rows.push(['Family', ot?.names.fontFamily?.en ?? font.name, true]);
    if (font.entry) rows.push(['Designer', `${font.entry.designer}, ${font.entry.year}`, true]);
    if (font.file) rows.push(['File', `${font.file.name} · ${font.file.format} · ${fmt(font.file.bytes / 1024, 0)} KB`, true]);
    if (ot) {
      const { hhea, os2 } = metricTables(ot);
      rows.push(
        ['Outlines', ot.outlinesFormat === 'cff' ? 'Cubic Béziers (CFF)' : 'Quadratic Béziers (TrueType)'],
        ['Units / em', String(ot.unitsPerEm)],
        ['Glyphs', String(ot.numGlyphs)],
        ['Ascender', `${hhea.ascender}  descender ${hhea.descender}  gap ${hhea.lineGap}`],
        ['Cap · x', `${os2?.sCapHeight ?? '—'} · ${os2?.sxHeight ?? '—'}`],
      );
      const license = ot.names.license?.en ?? ot.names.licenseURL?.en;
      if (license) rows.push(['License', license.length > 90 ? `${license.slice(0, 90)}…` : license, true]);
    }
    meta.replaceChildren(...rows.flatMap(([k, v, text]) => [h('dt', {}, k), h('dd', { class: text ? 'text' : null }, v)]));
  }

  function renderGrid(count: number) {
    const ot = font.ot;
    grid.replaceChildren();
    more.hidden = true;
    if (!ot) return;
    shown = Math.min(count, ot.numGlyphs);
    for (let i = 0; i < shown; i++) {
      const glyph = ot.glyphs.get(i);
      const cell = h('button', {
        type: 'button', class: 'glyph-cell', title: glyphName(glyph), 'aria-pressed': String(i === selected),
        onclick: () => { selected = i; renderDetail(); grid.querySelectorAll('.glyph-cell').forEach((c, j) => c.setAttribute('aria-pressed', String(j === selected))); },
      }, cellSvg(glyph, ot.unitsPerEm));
      grid.append(cell);
    }
    more.hidden = shown >= ot.numGlyphs;
  }

  function cellSvg(glyph: Glyph, upm: number) {
    // Font units, y up; flip so the em sits in a square viewBox.
    const d = glyph.getPath(0, 0, upm).toPathData(1);
    const adv = glyph.advanceWidth ?? upm;
    return s('svg', { viewBox: `${(adv - upm) / 2} ${-upm * 0.8} ${upm} ${upm}` }, s('path', { d }));
  }

  function renderDetail() {
    detail.replaceChildren();
    glyphInfo.replaceChildren();
    const ot = font.ot;
    if (!ot) return;
    const glyph = ot.glyphs.get(selected);
    const upm = ot.unitsPerEm;
    const size = 400;                  // px per em in the detail view
    const k = size / upm;
    const adv = (glyph.advanceWidth ?? 0) * k;
    const ox = (520 - adv) / 2, base = 440;
    const { hhea, os2 } = metricTables(ot);

    const lines: [string, number][] = [
      ['Ascender', hhea.ascender], ['Cap height', os2?.sCapHeight ?? 0], ['x-height', os2?.sxHeight ?? 0],
      ['Baseline', 0], ['Descender', hhea.descender],
    ];
    for (const [label, v] of lines) {
      if (!v && label !== 'Baseline') continue;
      const y = base - v * k;
      detail.append(
        s('line', { x1: 0, x2: 520, y1: y, y2: y, class: label === 'Baseline' ? 'rule-line' : 'guide' }),
        s('text', { x: 4, y: y - 5, class: 'svg-label' }, label.toUpperCase()),
      );
    }
    // Advance box: where the next glyph's origin will be.
    detail.append(
      s('line', { x1: ox, x2: ox, y1: base - hhea.ascender * k, y2: base - hhea.descender * k, class: 'rule-line is-hl' }),
      s('line', { x1: ox + adv, x2: ox + adv, y1: base - hhea.ascender * k, y2: base - hhea.descender * k, class: 'rule-line is-hl' }),
    );

    const path = glyph.getPath(ox, base, size);
    detail.append(s('path', { d: path.toPathData(2), class: 'outline-path' }));

    // Points: squares on the curve, circles off it, with handles to their anchors.
    let prev: [number, number] | null = null;
    let onCount = 0, offCount = 0, contours = 0;
    const pts: SVGElement[] = [];
    const handle = (a: [number, number], b: [number, number]) =>
      detail.append(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'handle' }));
    const on = (x: number, y: number) => { onCount++; pts.push(s('rect', { x: x - 3, y: y - 3, width: 6, height: 6, class: 'pt-on' })); };
    const off = (x: number, y: number) => { offCount++; pts.push(s('circle', { cx: x, cy: y, r: 3.2, class: 'pt-off' })); };
    for (const c of path.commands) {
      if (c.type === 'M') { contours++; on(c.x, c.y); prev = [c.x, c.y]; }
      else if (c.type === 'L') { on(c.x, c.y); prev = [c.x, c.y]; }
      else if (c.type === 'Q') {
        if (prev) handle(prev, [c.x1, c.y1]);
        handle([c.x1, c.y1], [c.x, c.y]);
        off(c.x1, c.y1); on(c.x, c.y); prev = [c.x, c.y];
      } else if (c.type === 'C') {
        if (prev) handle(prev, [c.x1, c.y1]);
        handle([c.x2, c.y2], [c.x, c.y]);
        off(c.x1, c.y1); off(c.x2, c.y2); on(c.x, c.y); prev = [c.x, c.y];
      }
    }
    detail.append(...pts);

    const bb = glyph.getBoundingBox();
    const uni = glyph.unicode != null ? `U+${glyph.unicode.toString(16).toUpperCase().padStart(4, '0')}` : 'unencoded';
    glyphInfo.append(
      h('span', { class: 'k' }, `glyph ${selected}  `), `${glyphName(glyph)} · ${uni}\n`,
      `advance ${glyph.advanceWidth ?? 0} · left side bearing ${fmt(glyph.leftSideBearing ?? bb.x1, 0)}\n`,
      `bounds x ${fmt(bb.x1, 0)}…${fmt(bb.x2, 0)}  y ${fmt(bb.y1, 0)}…${fmt(bb.y2, 0)}\n`,
      `${contours} contours · ${onCount} on-curve ■ · ${offCount} off-curve ○`,
    );
  }

  fontStore.subscribe(render);
  render();
}

function glyphName(g: Glyph) {
  if (g.name) return g.name;
  return g.unicode != null ? String.fromCodePoint(g.unicode) : `#${g.index}`;
}
