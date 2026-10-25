// Sample text for the Grid playground, written about what the page is doing.
// In the Latin text, ~ marks where a word may be hyphenated.
import { SHY } from '../lib/latin-setting';

export const LATIN_HEADING = 'The grid';

export const LATIN = [
  `A page of text is a set of deci~sions about space. Before a sin~gle let~ter is placed, the type~set~ter has
  al~ready cho~sen the size of the page, the width of the margins, how many col~umns the text will run in, and the
  dis~tance from one base~line to the next. These choic~es are in~vis~i~ble when they are right and im~pos~si~ble to
  ignore when they are wrong.`,
  `The mea~sure, the length of a line, gov~erns how com~fort~ably the eye trav~els. Too short, and the read~er is pulled
  back to the left mar~gin every few words; too long, and the eye loses its place on the return jour~ney. Some~where
  be~tween forty-five and seventy-five char~ac~ters, most read~ers stop no~tic~ing the line at all.`,
  `Jus~ti~fied text squares both edges of the col~umn by stretch~ing the spaces be~tween words. In a nar~row measure the
  stretch~ing shows: gaps open up, line up with the gaps be~neath them, and run down the page like riv~ers through the
  grey. Hy~phen~a~tion gives the com~pos~i~tor more places to break, and the riv~ers close.`,
  `A base~line grid ties every line on the spread to one rhythm, so that text in neigh~bour~ing col~umns sits on shared
  lines. A head~ing set larg~er than the text must still pay its rent in whole lines of the grid, or every line be~neath
  it falls out of step with its neigh~bours across the gut~ter.`,
  `The grid is older than the com~put~er and older than the press. Scribes ruled their pages with a dry point before
  they wrote a word, and the ear~li~est print~ers in~her~it~ed those pro~por~tions along with the let~ter~forms. What the
  mod~ern grid adds is arith~me~tic: every measure a mul~ti~ple of the same small unit, every in~ter~val ac~count~ed for.`,
].map((p) => p.replace(/\s+/g, ' ').replaceAll('~', SHY));

export const CJK_TEXT = {
  sc: [
    '排版是一门关于间隔的艺术。汉字在方格中排列，每个字占据一个全角的位置，标点也不例外；整页文字因此成为一张看不见的网格。读者不会注意到这张网格，却能感觉到它：行与行对齐，字与字等距，版面便显得安静。',
    '一行将尽时，句号、逗号和右括号不能出现在行首，而左括号和左引号不能留在行尾。这些规则叫作“避头尾”（日文称为“禁则处理”）。为了遵守它们，排版者可以把标点悬挂在版心之外，可以挤压行内标点的空白，也可以把一个字推到下一行，再把剩下的空间平均分给这一行。',
    '标点连用时，例如句号紧跟着右引号：“就是这样。”两个符号各自只有半个字的墨迹，另一半是空白。把空白挤掉，标点就不会在行中留下一个突兀的洞。段落开头空两格，是中文排版最常见的段首标记。',
    '竖排时，行从上到下，行与行从右向左推进。标点换成竖排的字形：句号移到右上角，括号转了九十度。版心还是那张方格网，只是转了一个方向。',
  ],
  tc: [
    '排版是一門關於間隔的藝術。漢字在方格中排列，每個字佔據一個全形的位置，標點也不例外；整頁文字因此成為一張看不見的網格。讀者不會注意到這張網格，卻能感覺到它：行與行對齊，字與字等距，版面便顯得安靜。',
    '一行將盡時，句號、逗號和右括號不能出現在行首，而左括號和左引號不能留在行尾。這些規則叫作「避頭尾」（日文稱為「禁則處理」）。為了遵守它們，排版者可以把標點懸掛在版心之外，可以擠壓行內標點的空白，也可以把一個字推到下一行，再把剩下的空間平均分給這一行。',
    '標點連用時，例如句號緊跟著右引號：「就是這樣。」在臺灣的排法裡，句號和逗號置於方格正中，墨跡兩側都沒有空白可以擠掉，所以只有括號和引號能夠壓縮。段落開頭空兩格，是中文排版最常見的段首標記。',
    '直排時，行從上到下，行與行從右向左推進。標點換成直排的字形：括號轉了九十度，句號仍在方格正中。版心還是那張方格網，只是轉了一個方向。',
  ],
  jp: [
    '組版とは、間合いの技術である。漢字も仮名も正方形の枠の中に並び、一字が全角一つ分を占める。約物も例外ではない。こうして紙面には、目に見えない格子が生まれる。読者はその格子に気づかないが、行がそろい、字間が等しいとき、紙面は静かに見える。',
    '行の終わりでは、句点や読点、閉じ括弧を行頭に置いてはならず、開き括弧を行末に残してもならない。小さな「っ」や「ゃ」、長音の「ー」も行頭を避ける。これを「禁則処理」という。組版者は、句読点を版面の外へぶら下げることも、行内の約物のアキを詰めることも、一字を次の行へ追い出して残りの空きを行内に配分することもできる。',
    '約物が続くとき、たとえば句点のすぐあとに閉じかぎ括弧が来る「そうです。」のような場合、それぞれの約物は字幅の半分しか墨を持たない。残りの半分のアキを詰めれば、行の中に不自然な穴があかない。段落の始まりは一字下げるのが普通である。',
    '縦組みでは、行は上から下へ進み、行そのものは右から左へ送られる。約物は縦組み用の字形に替わり、句点は右上へ移り、括弧は九十度回転する。版面は同じ格子のまま、向きだけが変わる。',
  ],
  mixed: [
    '2026年10月，我们用Vite和TypeScript搭了一个排版实验室。中文里夹着English单词和数字时，两种文字之间通常留出四分之一个字的空隙（四分空），让西文不至于贴着汉字。',
    '西文单词的宽度不是整数个字，例如Garamond、CSS或者text-spacing，它们一出现，后面的汉字就离开了方格。好的排版会把多出来的零头分给这些空隙，让每一行仍然在版心的边上结束。',
    '竖排时，西文通常侧过来排，而像12这样的两位数字可以直立并排挤进一个方格，这就是日文所说的“纵中横”。CSS用text-combine-upright实现它，而不是把数字一个个竖起来。',
    '一行将尽时，句号、逗号和右括号不能出现在行首，左括号和左引号不能留在行尾。西文单词也不能从中间断开，所以它前面的那一行常常需要把空间分给更多的字。',
  ],
};
