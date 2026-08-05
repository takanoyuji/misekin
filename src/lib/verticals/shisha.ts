/** シーシャ版 */

import hero from "../../../public/lp/shisha/hero.jpg";
import pains from "../../../public/lp/shisha/pains.jpg";
import band from "../../../public/lp/shisha/band.jpg";
import pricing from "../../../public/lp/shisha/pricing.jpg";
import founderA from "../../../public/lp/shisha/founder-a.jpg";
import founderB from "../../../public/lp/shisha/founder-b.jpg";

import { BRANDS } from "./brands";
import { VERTICAL_DEFAULTS } from "./defaults";
import { SHISHA_LP } from "./themes";
import type { Vertical } from "./types";

export const SHISHA: Vertical = {
  slug: "shisha",
  label: "シーシャ版",
  industry: "シーシャ屋",
  themeKey: "shisha",
  terms: { staff: "スタッフ" },
  defaultStaffTerm: "STAFF",
  lpTheme: SHISHA_LP,

  images: {
    hero,
    pains,
    band,
    pricing,
    founderA,
    founderB,
    alt: {
      pains: "キャンドルの灯りに照らされたシーシャ",
      pricing: "煙をまとったシーシャのシルエット",
      founderA: "琥珀色のランプとベルベットのソファが置かれたラウンジ",
      founderB: "緑の光と立ちのぼる煙",
    },
  },

  brands: BRANDS,

  content: {
    title: "みせ勤 — 売上から逆算する、シーシャ屋のAIシフト",
    description:
      "シーシャ屋専門のシフト＆勤怠管理。お店の売上から忙しい時間を読んで、AIがシフトを自動作成。シーシャ屋でよく使うルールは12種類あらかじめ用意。スタッフはアプリ不要、今は無料。",

    hero: {
      eyebrow: "シーシャ屋専門のAIシフト＆勤怠管理",
      line1: "混む時間に、",
      line2: "作れる人がいる。",
      sub: "みせ勤は、お店の売上から忙しい時間を先に読んで、AIがシフトを組みます。スタッフの希望も、シーシャ屋ならではのルールも、ぜんぶ入れたうえで。",
      chips: [
        "シーシャ屋専門",
        "ルール12種が最初から",
        "自社6店舗で毎日稼働",
        "今は無料",
      ],
    },

    mock: {
      slotLabel: "夜",
      days: [
        { label: "金 12", need: 3, filled: 3 },
        { label: "土 13", need: 3, filled: 3 },
        { label: "日 14", need: 2, filled: 1 },
      ],
      people: [
        { name: "田中", on: [true, true, false] },
        { name: "佐藤", on: [true, true, true] },
        { name: "鈴木", on: [true, false, false] },
        { name: "高橋", on: [false, true, false] },
      ],
      note: "売上の傾向から、日14は2人を提案しています",
    },

    pains: [
      "金土の夜に人が足りず、提供までお客さんを待たせてしまう",
      "静かな平日に3人立っていて、人件費だけが出ていく",
      "LINEに届いた希望を、カレンダーに手で並べ直している",
      "組み直すのが大変で、結局いつも先月のコピーになる",
      "作れる人が休みの日に、シフトが薄くなっていた",
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
      "他の業態のことは考えなくていいので、シーシャ屋でよく使うルールを12種そのまま用意しました。ボタンを押すと文章が入るので、数字だけ自分のお店に合わせて直してください。足りなければ日本語で書き足せます。法令に関わるものは必ず守る条件、お店の判断によるものはできるだけ守る目標として、自動で分けて扱います。",

    sales: {
      title: "混む時間を、AIが先に知っている",
      lead: "日ごと・時間帯ごとの売上を取り込むと、曜日と時間帯の傾向を読んで必要人数の目安を出します。店長がやるのは、その数字を見て決めることだけです。",
      points: [
        {
          title: "売上の山を、先に読む",
          body: "過去の売上から、曜日と時間帯ごとの傾向を出します。「金土の22時以降だけ2.4倍、月曜は静か」。感覚で決めていた人数に、根拠がつきます。",
        },
        {
          title: "必要人数を、提案する",
          body: "その日の見込みに対して何人立てばいいかをAIが提案します。最後に決めるのは店長です。提案の数字は、そのまま上書きできます。",
        },
        {
          title: "作れる人を、山の時間に",
          body: "回転の速い時間帯に、慣れているスタッフを優先して配置します。同じ人だけに偏らないよう、ならしながら組みます。",
        },
      ],
      sample: [
        { day: "月", index: 40, need: 2 },
        { day: "火", index: 36, need: 2 },
        { day: "水", index: 44, need: 2 },
        { day: "木", index: 55, need: 2 },
        { day: "金", index: 92, need: 3 },
        { day: "土", index: 100, need: 3 },
        { day: "日", index: 58, need: 2 },
      ],
      caption: "曜日ごとの売上（先月の平均）",
      summary: {
        before: "金土の売上は平日の",
        strong: "約2.4倍",
        after: "。だから夜の時間帯は3人を提案しています。",
      },
      band: "取りこぼしも、余った人件費も、シフトを組んだ時点で減らせます。",
    },

    compareColumns: { legacy: "Excel＋LINE", generic: "一般的な勤怠アプリ" },

    founderChips: [
      "自社6店舗で日々稼働中",
      "シーシャ屋を実際に運営",
      "現場の要望から機能を追加",
      "困ったときは開発者に直接届く",
    ],

    extraFaqs: [
      {
        q: "「作れる人を各時間帯に1人」のようなルールも入っていますか？",
        a: "入っています。仕込みや締めの担当を必ず1人入れるルール、新人をひとりにしないルール、慣れているスタッフをピーク時間に寄せるルールなど、シーシャ屋で実際に使われるものを揃えました。数字の部分だけ、自分のお店に合わせて直してください。",
      },
    ],
  },

  defaults: VERTICAL_DEFAULTS.shisha,

  translatorHint:
    "対象はシーシャ屋（水たばこのラウンジ）です。従業員は「スタッフ」と呼びます。「作れる人」「回せる人」はシーシャの調製に慣れたスタッフを指す技能の話で、「仕込み」は開店前の準備、「締め」は閉店作業を指します。ピークは夜から深夜にかけてです。",
};
