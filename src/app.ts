// The shell: one full-screen scene at a time, a chapter strip at the top, and
// settings, progress and next/previous along the bottom. The hash names the
// scene (#/font/lines), so scenes can be linked and the back button works.
import { CHAPTERS, COVER, type ChapterDef, type SceneDef } from './content';
import { h } from './lib/dom';
import { settingsCorner } from './lib/settings';

type Stop =
  | { kind: 'cover'; key: string; title: string }
  | { kind: 'card'; key: string; title: string; chapter: ChapterDef }
  | { kind: 'scene'; key: string; title: string; chapter: ChapterDef; scene: SceneDef; index: number };

const STOPS: Stop[] = [
  { kind: 'cover', key: '', title: 'Contents' },
  ...CHAPTERS.flatMap((chapter): Stop[] => [
    { kind: 'card', key: chapter.id, title: chapter.title, chapter },
    ...chapter.scenes.map((scene, index): Stop => (
      { kind: 'scene', key: `${chapter.id}/${scene.id}`, title: scene.title, chapter, scene, index })),
  ]),
];

const href = (stop: Stop) => `#/${stop.key}`;

function indexFromHash() {
  const key = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  return Math.max(0, STOPS.findIndex((s) => s.key === key));
}

/** Split a word into spans so letters can arrive one by one. */
const letters = (text: string) =>
  Array.from(text).map((ch, i) => h('span', { class: 'letter', style: `--i:${i}` }, ch));

function buildCover() {
  const title = h('h1', { class: 'cover-title' });
  title.innerHTML = COVER.title;
  return h('section', { class: 'scene scene-cover' },
    h('div', { class: 'cover-inner' },
      title,
      h('p', { class: 'cover-lede' }, COVER.lede),
      h('ol', { class: 'contents' }, CHAPTERS.map((ch) =>
        h('li', {}, h('a', { href: `#/${ch.id}` },
          h('span', { class: 'contents-num' }, ch.num),
          h('span', { class: 'contents-title' }, ch.title),
          h('span', { class: 'contents-epigraph' }, ch.epigraph))))),
      h('a', { class: 'begin', href: `#/${CHAPTERS[0].id}` }, 'Begin', h('span', { 'aria-hidden': 'true' }, ' →')),
    ));
}

function buildCard(chapter: ChapterDef) {
  const first = chapter.scenes[0];
  return h('section', { class: 'scene scene-card' },
    h('div', { class: 'card-inner' },
      h('div', { class: 'card-num' }, chapter.num),
      h('h2', { class: 'card-title' }, letters(chapter.title),
        chapter.aside && h('span', { class: 'card-aside', lang: chapter.aside.lang }, chapter.aside.text)),
      h('p', { class: 'card-epigraph' }, chapter.epigraph),
      first
        ? h('ol', { class: 'card-scenes' }, chapter.scenes.map((sc) =>
          h('li', {}, h('a', { href: `#/${chapter.id}/${sc.id}` }, sc.title))))
        : h('p', { class: 'card-soon' }, 'Coming soon'),
    ));
}

function buildScene(stop: Extract<Stop, { kind: 'scene' }>) {
  const { chapter, scene, index } = stop;
  const prose = h('div', { class: 'prose' });
  prose.innerHTML = scene.prose;
  const stage = h('div', { class: 'scene-stage' });
  if (scene.html) stage.innerHTML = scene.html;
  if (scene.figure) stage.append(h('figure', { class: 'fig' }));
  return h('section', { class: 'scene scene-figure' },
    h('div', { class: 'scene-text' },
      h('p', { class: 'scene-label' }, `${chapter.num} · ${chapter.title}`,
        chapter.scenes.length > 1 && h('span', { class: 'scene-count' }, `${index + 1} / ${chapter.scenes.length}`)),
      h('h2', { class: 'scene-title' }, scene.title),
      prose),
    stage);
}

export function mountApp(root: HTMLElement) {
  const scenes = STOPS.map((stop) =>
    stop.kind === 'cover' ? buildCover() : stop.kind === 'card' ? buildCard(stop.chapter) : buildScene(stop));
  const mounted = new Set<number>();

  const chapterLinks = CHAPTERS.map((ch) =>
    h('a', { href: `#/${ch.id}`, class: 'chapter-link', title: ch.title },
      h('span', { class: 'chapter-link-num' }, ch.num), h('span', { class: 'chapter-link-name' }, ch.title)));
  const ticks = STOPS.map((stop) =>
    h('a', { href: href(stop), class: `tick tick-${stop.kind}`, title: stop.title, 'aria-label': stop.title }));
  const prev = h('a', { class: 'step step-prev', 'aria-label': 'Previous' }, '←');
  const next = h('a', { class: 'step step-next' });

  root.append(
    h('header', { class: 'chrome chrome-top' },
      h('a', { class: 'wordmark', href: '#/' }, 'Type Lab'),
      h('nav', { class: 'chapters', 'aria-label': 'Chapters' }, chapterLinks)),
    h('main', { class: 'scenes' }, scenes),
    h('footer', { class: 'chrome chrome-bottom' },
      settingsCorner(),
      h('nav', { class: 'progress', 'aria-label': 'All scenes' }, ticks),
      h('div', { class: 'steps' }, prev, next)),
  );

  let current = -1;
  function show(i: number) {
    if (i === current) return;
    scenes[current]?.classList.remove('is-active');
    scenes[current]?.setAttribute('aria-hidden', 'true');
    current = i;
    const el = scenes[i];
    el.classList.add('is-active');
    el.removeAttribute('aria-hidden');
    el.scrollTop = 0;

    // Figures measure rendered text, so they mount the first time they are visible.
    const stop = STOPS[i];
    if (stop.kind === 'scene' && stop.scene.figure && !mounted.has(i)) {
      mounted.add(i);
      const fig = el.querySelector<HTMLElement>('.fig')!;
      try {
        stop.scene.figure(fig);
      } catch (err) {
        console.error(`scene "${stop.key}" failed`, err);
        fig.textContent = `This figure failed to load: ${(err as Error).message}`;
      }
    }

    const chapterId = stop.kind === 'cover' ? null : stop.chapter.id;
    chapterLinks.forEach((a, j) => a.toggleAttribute('aria-current', CHAPTERS[j].id === chapterId));
    ticks.forEach((t, j) => {
      t.classList.toggle('is-current', j === i);
      t.classList.toggle('is-past', j < i);
    });

    const before = STOPS[i - 1], after = STOPS[i + 1];
    prev.toggleAttribute('hidden', !before);
    if (before) prev.href = href(before);
    next.toggleAttribute('hidden', !after);
    if (after) {
      next.href = href(after);
      next.replaceChildren(h('span', { class: 'step-label' }, 'Next'), h('span', { class: 'step-title' }, after.title), ' →');
    }
    document.title = stop.kind === 'cover' ? 'Type Lab' : `${stop.title} · Type Lab`;
  }

  const go = (i: number) => {
    if (STOPS[i]) location.hash = href(STOPS[i]);
  };

  window.addEventListener('hashchange', () => show(indexFromHash()));
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    // Leave arrow keys to sliders, fields and editable text.
    if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(current + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(current - 1); }
    if (e.key === 'Home') go(0);
  });

  show(indexFromHash());
}
