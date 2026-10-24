// Horizontal and vertical setting, mixed-script spacing, and upright numbers.
// This one is plain HTML: the browser's own vertical layout is the subject.
import { checkbox, row, segmented } from '../lib/controls';
import { h } from '../lib/dom';
import { LOCALES, type Locale } from './cjk-embox';

const SAMPLES: Record<Locale, string> = {
  sc: '2026年10月，我们用Vite和TypeScript搭了一个排版实验室。第3章讲的是CJK排版：“方块字”里的标点、行首行尾的规则，还有竖排。',
  tc: '2026年10月，我們用Vite和TypeScript搭了一個排版實驗室。第3章講的是CJK排版：「方塊字」裡的標點、行首行尾的規則，還有直排。',
  jp: '2026年10月、ViteとTypeScriptで組版の実験室をつくった。第3章はCJKの組版について：「正方形」の中の約物、行頭行末の禁則、そして縦組み。',
};

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const TOKEN = /([A-Za-z][A-Za-z0-9]*|\d+)/;

export function mountCjkDirection(root: HTMLElement) {
  const state = { locale: 'sc' as Locale, vertical: true, gap: true, upright: true, latinUpright: false };

  const controls = h('div', { class: 'controls' },
    row(
      segmented<Locale>({ label: 'Locale', options: (Object.keys(LOCALES) as Locale[]).map((k) => ({ value: k, label: LOCALES[k].label })),
        value: state.locale, onChange: (v) => { state.locale = v; render(); } }).el,
      segmented({ label: 'Direction', options: ['Horizontal', 'Vertical'], value: 'Vertical',
        onChange: (v) => { state.vertical = v === 'Vertical'; render(); } }).el,
    ),
    row(
      checkbox({ label: 'Quarter-em gap between scripts', checked: state.gap, onChange: (v) => { state.gap = v; render(); } }).el,
      checkbox({ label: 'Upright short numbers', checked: state.upright, onChange: (v) => { state.upright = v; render(); } }).el,
      checkbox({ label: 'Upright Latin', checked: state.latinUpright, onChange: (v) => { state.latinUpright = v; render(); } }).el,
    ),
  );
  const sample = h('div', { class: 'cjk-sample' });
  const caption = h('p', { class: 'caption' });
  root.append(controls, sample, caption);

  function render() {
    const loc = LOCALES[state.locale];
    const text = SAMPLES[state.locale];
    sample.lang = loc.lang;
    sample.style.fontFamily = loc.family;
    sample.classList.toggle('is-vertical', state.vertical);
    sample.style.textOrientation = state.latinUpright ? 'upright' : 'mixed';

    const parts = text.split(TOKEN);
    const nodes: Node[] = [];
    parts.forEach((part, i) => {
      if (!part) return;
      if (i % 2 === 0) { nodes.push(document.createTextNode(part)); return; }
      const before = parts[i - 1]?.slice(-1) ?? '';
      const after = parts[i + 1]?.slice(0, 1) ?? '';
      const isNumber = /^\d+$/.test(part);
      const tcy = state.vertical && state.upright && isNumber && part.length <= 2;
      if (state.gap && CJK.test(before)) nodes.push(h('span', { class: 'gap', 'aria-hidden': 'true' }));
      nodes.push(h('span', { class: tcy ? 'tcy' : 'latin' }, part));
      if (state.gap && CJK.test(after)) nodes.push(h('span', { class: 'gap', 'aria-hidden': 'true' }));
    });
    sample.replaceChildren(...nodes);

    caption.innerHTML = state.vertical
      ? '<strong>Vertical</strong> lines run top to bottom, and the lines themselves advance right to left. Punctuation switches to vertical forms: brackets turn, and the full stop moves to the upper right. Latin turns on its side unless set upright; one- and two-digit numbers can share a single square, 縦中横 (<em>tate-chū-yoko</em>).'
      : '<strong>Horizontal</strong> CJK text is still a grid of squares. The highlighted quarter-em gaps (四分空) separate Latin and numbers from ideographs; without them the two scripts crowd each other.';
  }

  render();
}
