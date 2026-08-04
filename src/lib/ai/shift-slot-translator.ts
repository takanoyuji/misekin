import Anthropic from "@anthropic-ai/sdk";

/**
 * シフトの時間帯の翻訳器
 *
 * 店長が営業時間を日本語で書いたものを、ShiftSlot（名前・開始・終了）の候補に変換する。
 * シフトルールの翻訳器と同じ考え方で、AIには「言語化」だけをさせ、
 * 保存するかどうかは必ず人が決める。
 *
 * ShiftSlot は曜日を持たないので、曜日で開始時刻が変わる店でも
 * 「その時間帯が使われる日と使われない日がある」という形で表現する。
 * 例: 通常15時開始・土日祝12時開始なら、12:00-15:00 を独立した枠にして
 *     平日は必要人数0で運用する。
 */

export interface TranslatedShiftSlot {
  /** 早番 / 遅番 / 深夜 など */
  name: string;
  /** "HH:mm" */
  startTime: string;
  /** "HH:mm"。開始以下なら翌日にまたぐ */
  endTime: string;
  /** どんな日に使う枠かの補足（毎日 / 土日祝のみ など） */
  note: string;
}

export interface TranslatedShiftSlots {
  slots: TranslatedShiftSlot[];
  /** 店長に見せる要約。読み取った営業時間の理解を確認してもらう */
  summary: string;
  /** 前提を置いた点・確認してほしい点 */
  caution?: string;
}

const MODEL = "claude-opus-4-8";

const SYSTEM_PROMPT = `あなたは飲食・ナイト業態の営業時間を、シフトの「時間帯」に分解する専門家です。
店長が日本語で書いた営業時間を読み取り、シフトを組む単位となる時間帯の候補に変換してください。

守ること:
- 時間帯どうしを重ねない。連続させて、営業時間の全体を隙間なく覆う
- 1つの枠は3〜8時間程度にする。長すぎると人を割り当てにくい
- 深夜0時をまたぐ枠は endTime が startTime 以下になる（例 21:00〜05:00）。これは正しい表現
- 曜日で開始・終了が変わる場合は、その差分を独立した枠として切り出す。
  例:「通常15時開始、土日祝は12時開始」→ 12:00-15:00 を別枠にし、note に「土日祝のみ」と書く
- name は現場で通じる短い言葉にする（昼 / 早番 / 遅番 / 深夜 / 延長 など）
- 時刻は必ず "HH:mm" の24時間表記。24:00 は使わず 00:00 と書く

summary には、読み取った営業時間を1〜2文で書いてください。
前提を補った場合や、曜日差を枠で表現した場合は caution に書いてください。`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    slots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          startTime: { type: "string" },
          endTime: { type: "string" },
          note: { type: "string" },
        },
        required: ["name", "startTime", "endTime", "note"],
        additionalProperties: false,
      },
    },
    summary: { type: "string" },
    caution: { type: "string" },
  },
  required: ["slots", "summary"],
  additionalProperties: false,
} as const;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** AIの出力を検証する。時刻の形と枠の重なりだけは必ず確かめる */
export function validateSlots(slots: TranslatedShiftSlot[]): string | null {
  if (slots.length === 0) return "時間帯を読み取れませんでした";
  if (slots.length > 8) return "時間帯が多すぎます（8つまで）";

  for (const s of slots) {
    if (!s.name.trim()) return "名前が空の時間帯があります";
    if (!HHMM.test(s.startTime) || !HHMM.test(s.endTime)) {
      return `時刻の形式が正しくありません（${s.name}: ${s.startTime}〜${s.endTime}）`;
    }
    if (s.startTime === s.endTime) {
      return `開始と終了が同じ時間帯があります（${s.name}）`;
    }
  }

  // 営業日の開始からの経過分に直して重なりを見る（日跨ぎを一直線に伸ばす）
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const ranges = slots
    .map((s) => {
      const start = toMin(s.startTime);
      let end = toMin(s.endTime);
      if (end <= start) end += 24 * 60;
      return { name: s.name, start, end };
    })
    .sort((a, b) => a.start - b.start);

  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].start < ranges[i - 1].end) {
      return `「${ranges[i - 1].name}」と「${ranges[i].name}」の時間が重なっています`;
    }
  }
  return null;
}

/**
 * 日本語の営業時間を時間帯の候補に変換する。
 * APIキーが無い環境では呼び出し側で無効化する（画面側で判定）。
 */
export async function translateShiftSlots(
  input: string
): Promise<TranslatedShiftSlots> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY が設定されていません");

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: input }],
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
  } as Parameters<typeof client.messages.create>[0]);

  const block = (res as { content: { type: string; text?: string }[] }).content.find(
    (c) => c.type === "text"
  );
  if (!block?.text) throw new Error("時間帯を読み取れませんでした");

  const parsed = JSON.parse(block.text) as TranslatedShiftSlots;
  const error = validateSlots(parsed.slots);
  if (error) throw new Error(error);
  return parsed;
}
