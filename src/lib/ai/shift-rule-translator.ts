import Anthropic from "@anthropic-ai/sdk";

/**
 * シフト作成ルールの翻訳器（戦略レポート §5 の設計A「翻訳器」）
 *
 * 店長の日本語ルールを Claude が構造化した ShiftRule(JSON) に変換する。
 * 生成AIには割当て（シフト表）を作らせず、ルールの言語化のみを担わせる。
 * 法令由来はハード、営業判断はソフトに区別させる。
 *
 * 出力スキーマは構造化出力（output_config.format）で強制し、型崩れを防ぐ。
 */

export type ShiftRuleType =
  | "SPACING" // 同じ人の出勤間隔を空ける
  | "MAX_SHIFTS_PER_WEEK" // 週あたりの最大出勤数
  | "MIN_SHIFTS_PER_WEEK" // 週あたりの最小出勤数
  | "SALES_PRIORITY" // 売上上位を優先配置（売上接続が前提・保存のみ）
  | "PAIR_AVOID" // 特定の組み合わせを避ける（保存のみ）
  | "OTHER"; // 上記に当てはまらない

export type ShiftRuleWeight = "HARD" | "SOFT";

export interface TranslatedShiftRule {
  ruleType: ShiftRuleType;
  weight: ShiftRuleWeight;
  /** type ごとに形が異なる構造化パラメータ */
  params: Record<string, unknown>;
  /** 店長に見せて確認するための人間可読の説明 */
  description: string;
  /** 構造化しきれない・入力が曖昧な場合の補足（任意） */
  note?: string;
}

const MODEL = "claude-opus-4-8";

const SYSTEM_PROMPT = `あなたは飲食・ナイト業態のシフト作成ルールを、ソルバーが読める構造化ルールに翻訳する専門家です。
店長が日本語で書いたルールを、次のJSONスキーマに沿った1件のルールへ変換してください。

ruleType の種類と params の形:
- SPACING: 同じスタッフの出勤間隔を空ける。params: { "minGapDays": 整数 }
- MAX_SHIFTS_PER_WEEK: 週あたりの最大出勤数。params: { "maxPerWeek": 整数 }
- MIN_SHIFTS_PER_WEEK: 週あたりの最小出勤数。params: { "minPerWeek": 整数 }
- SALES_PRIORITY: 売上上位のスタッフを優先配置。params: {} （売上接続が前提のため保存のみ）
- PAIR_AVOID: 特定の組み合わせを避ける。params: {} （名前の指定があれば "names": [文字列] に入れる）
- OTHER: 上記に当てはまらない場合。params: {}

weight の判定:
- HARD: 法令や絶対に守るべき条件（例: 必ず、絶対に、法律で）
- SOFT: 営業上の希望・努力目標（例: なるべく、できれば、優先的に）
迷ったら SOFT にしてください。

description は、店長が確認できる簡潔な日本語一文にしてください（例:「同じ人の出勤間隔を2日以上空けます（努力目標）」）。
数値が明示されていない場合は常識的な既定値を補い、note にその旨を書いてください。`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    ruleType: {
      type: "string",
      enum: [
        "SPACING",
        "MAX_SHIFTS_PER_WEEK",
        "MIN_SHIFTS_PER_WEEK",
        "SALES_PRIORITY",
        "PAIR_AVOID",
        "OTHER",
      ],
    },
    weight: { type: "string", enum: ["HARD", "SOFT"] },
    params: { type: "object", additionalProperties: true },
    description: { type: "string" },
    note: { type: "string" },
  },
  required: ["ruleType", "weight", "params", "description"],
  additionalProperties: false,
} as const;

/**
 * 日本語ルールを構造化ルールに翻訳する。
 * APIキー未設定・API失敗時は例外を投げる（呼び出し側でハンドリング）。
 */
export async function translateShiftRule(
  sourceText: string
): Promise<TranslatedShiftRule> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY が設定されていません。ルールの自動翻訳には Claude API キーが必要です。"
    );
  }

  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    output_config: {
      format: {
        type: "json_schema",
        schema: OUTPUT_SCHEMA,
      },
    },
    messages: [
      {
        role: "user",
        content: `次のシフトルールを構造化してください:\n\n「${sourceText}」`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("ルールの翻訳が拒否されました。内容を見直してください。");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("翻訳結果を取得できませんでした。");
  }

  let parsed: TranslatedShiftRule;
  try {
    parsed = JSON.parse(textBlock.text) as TranslatedShiftRule;
  } catch {
    throw new Error("翻訳結果の解析に失敗しました。もう一度お試しください。");
  }

  return parsed;
}
