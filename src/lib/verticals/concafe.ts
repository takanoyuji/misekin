/** コンカフェ版 */

import hero from "../../../public/lp/concafe/hero.jpg";
import pains from "../../../public/lp/concafe/pains.jpg";
import band from "../../../public/lp/concafe/band.jpg";
import pricing from "../../../public/lp/concafe/pricing.jpg";
import founderA from "../../../public/lp/concafe/founder-a.jpg";
import founderB from "../../../public/lp/concafe/founder-b.jpg";
import casts from "../../../public/lp/concafe/casts.jpg";

import { VERTICAL_DEFAULTS } from "./defaults";
import { CONCAFE_LP } from "./themes";
import type { Vertical } from "./types";

export const CONCAFE: Vertical = {
  slug: "concafe",
  label: "コンカフェ版",
  industry: "コンカフェ",
  themeKey: "concafe",
  terms: { staff: "キャスト" },
  defaultStaffTerm: "CAST",
  lpTheme: CONCAFE_LP,

  images: {
    hero,
    pains,
    band,
    pricing,
    founderA,
    founderB,
    cast: casts,
    castAlt: "自分たちの店のキャスト",
    alt: {
      pains: "ピンクのタイルで統一されたカフェのカウンター",
      pricing: "パステルカラーのカップケーキが並んだ様子",
      founderA: "ネオンサインと花で飾られた店内",
      founderB: "やわらかい光の入るカフェの店内",
    },
  },


  content: {
    title: "みせ勤 — 売上から逆算する、コンカフェのAIシフト",
    description:
      "コンカフェ専門のシフト＆勤怠管理。お店の売上から忙しい日を読んで、AIがシフトを自動作成。コンカフェでよく使うルールは12種類あらかじめ用意。キャストはアプリ不要、今は無料。",

    hero: {
      eyebrow: "コンカフェ専門のAIシフト＆勤怠管理",
      line1: "売上が伸びる日に、",
      line2: "人が足りている。",
      sub: "みせ勤は、お店の売上から忙しい日を先に読んで、AIがシフトを組みます。キャストの希望も、コンカフェならではのルールも、ぜんぶ入れたうえで。",
      chips: [
        "コンカフェ専門",
        "ルール12種が最初から",
        "自分たちの店で毎日稼働",
        "今は無料",
      ],
    },

    mock: {
      slotLabel: "遅番",
      days: [
        { label: "金 12", need: 4, filled: 4 },
        { label: "土 13", need: 4, filled: 4 },
        { label: "日 14", need: 3, filled: 2 },
      ],
      people: [
        { name: "あかり", on: [true, true, false] },
        { name: "ゆめ", on: [true, true, true] },
        { name: "りん", on: [true, false, true] },
        { name: "ももか", on: [true, true, false] },
      ],
      note: "売上の傾向から、日14は3人を提案しています",
    },

    pains: [
      "土日の遅番が薄くて、来てくれたお客さんを待たせてしまう",
      "静かな平日に4人立っていて、人件費だけが出ていく",
      "LINEに届いた希望を、カレンダーに手で並べ直している",
      "組み直すのが大変で、結局いつも先月のコピーになる",
      "人気の子が同じ日に固まって、他の日がさびしくなる",
      "連勤が続いていることに、誰も気づけていない",
    ],
    painsClosing: {
      before: "シフト作りは、",
      mark: "店長がいちばん時間を取られている仕事",
      after: "かもしれません。",
    },

    rulesHeading: {
      line1: "ゼロから設定しなくていい。",
      mark: "12種、入った状態で始まります。",
    },
    rulesBody:
      "他の業態のことは考えなくていいので、コンカフェでよく使うルールを12種そのまま用意しました。ボタンを押すと文章が入るので、数字だけ自分のお店に合わせて直してください。足りなければ日本語で書き足せます。法令に関わるものは必ず守る条件、お店の判断によるものはできるだけ守る目標として、自動で分けて扱います。",

    sales: {
      title: "忙しい日を、AIが先に知っている",
      lead: "日ごと・時間帯ごとの売上を取り込むと、曜日の傾向を読んで必要人数の目安を出します。店長がやるのは、その数字を見て決めることだけです。",
      points: [
        {
          title: "売上の山を、先に読む",
          body: "過去の売上から、曜日と時間帯ごとの傾向を出します。「金土だけ2.4倍、月曜は静か」。感覚で決めていた人数に、根拠がつきます。",
        },
        {
          title: "必要人数を、提案する",
          body: "その日の見込みに対して何人立てばいいかをAIが提案します。最後に決めるのは店長です。提案の数字は、そのまま上書きできます。",
        },
        {
          title: "売上をつくる子を、山の日に",
          body: "指名や売上の実績があるキャストを、忙しい日に優先して配置します。同じ子だけに偏らないよう、ならしながら組みます。",
        },
      ],
      sample: [
        { day: "月", index: 42, need: 2 },
        { day: "火", index: 38, need: 2 },
        { day: "水", index: 45, need: 2 },
        { day: "木", index: 52, need: 2 },
        { day: "金", index: 88, need: 4 },
        { day: "土", index: 100, need: 4 },
        { day: "日", index: 61, need: 3 },
      ],
      caption: "曜日ごとの売上（先月の平均）",
      summary: {
        before: "金土の売上は平日の",
        strong: "約2.4倍",
        after: "。だから遅番は4人を提案しています。",
      },
      band: "取りこぼしも、余った人件費も、シフトを組んだ時点で減らせます。",
    },

    compareColumns: { legacy: "Excel＋LINE", generic: "一般的な勤怠アプリ" },

    founderChips: [
      "自分たちの店で日々稼働中",
      "コンカフェを実際に運営",
      "現場の要望から機能を追加",
      "困ったときは開発者に直接届く",
    ],

    extraFaqs: [
      {
        q: "キャストのランクが毎月変わるのですが、時給の計算はどうなりますか？",
        a: "時給は「いつからいくら」を持った履歴として保存します。ランクが上がって7月から時給を変えても、6月ぶんの給与は6月の時給のまま締まります。さかのぼって全部が新しい時給に置き換わることはありません。変更した理由（ランクの昇格など）も一緒に残せます。",
      },
      {
        q: "「人気の子は同じ日に固めない」のようなルールも入っていますか？",
        a: "入っています。キャストの偏りを避けるルール、新人をひとりにしないルール、相性を避けるルールなど、コンカフェで実際に使われるものを揃えました。数字の部分だけ、自分のお店に合わせて直してください。",
      },
    ],
  },

  defaults: VERTICAL_DEFAULTS.concafe,

  translatorHint:
    "対象はコンカフェ（コンセプトカフェ）です。従業員は「キャスト」と呼ばれ、指名・イベント・コスプレデーなどの概念があります。「人気の子」「新人」はスタッフの属性を指し、「固めない」「バラす」は同じ日に集中させないという意味です。",
};
