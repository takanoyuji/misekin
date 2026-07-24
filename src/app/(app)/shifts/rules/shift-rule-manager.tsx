"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  translateRule,
  saveShiftRule,
  toggleShiftRule,
  deleteShiftRule,
} from "@/actions/shift-rule";
import type { TranslatedShiftRule } from "@/lib/ai/shift-rule-translator";
import { Check, Loader2, Sparkles, Trash2, TriangleAlert } from "lucide-react";

interface RuleRow {
  id: string;
  ruleType: string;
  weight: string;
  params: Record<string, unknown>;
  sourceText: string;
  description: string;
  enabled: boolean;
}

interface Props {
  organizationId: string;
  storeId: string;
  aiEnabled: boolean;
  rules: RuleRow[];
}

const TYPE_LABEL: Record<string, string> = {
  SPACING: "出勤間隔",
  MAX_SHIFTS_PER_WEEK: "週の最大出勤",
  MIN_SHIFTS_PER_WEEK: "週の最小出勤",
  SALES_PRIORITY: "売上優先",
  PAIR_AVOID: "組み合わせ回避",
  OTHER: "その他",
};

// 今の段階で警告評価できるタイプ（ソルバー未実装のため）
const EVALUABLE = new Set(["SPACING", "MAX_SHIFTS_PER_WEEK"]);

export function ShiftRuleManager({
  organizationId,
  storeId,
  aiEnabled,
  rules,
}: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<TranslatedShiftRule | null>(null);
  const [draftSource, setDraftSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isTranslating, startTranslate] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [isMutating, startMutate] = useTransition();

  function handleTranslate() {
    setError(null);
    setDraft(null);
    const src = text.trim();
    if (!src) return;
    startTranslate(async () => {
      const result = await translateRule(organizationId, storeId, src);
      if (result.error || !result.rule) {
        setError(result.error ?? "翻訳に失敗しました");
        return;
      }
      setDraft(result.rule);
      setDraftSource(src);
    });
  }

  function handleSave() {
    if (!draft) return;
    setError(null);
    startSave(async () => {
      const result = await saveShiftRule(
        organizationId,
        storeId,
        draftSource,
        draft
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setText("");
      setDraft(null);
      setDraftSource("");
      router.refresh();
    });
  }

  function handleToggle(id: string, enabled: boolean) {
    startMutate(async () => {
      await toggleShiftRule(organizationId, id, enabled);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startMutate(async () => {
      await deleteShiftRule(organizationId, id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* 入力 → 翻訳 → 確認 */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          ルールを追加
        </h2>

        {!aiEnabled ? (
          <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              ルールの自動翻訳には Claude API キーが必要です。サーバーの環境変数{" "}
              <code className="rounded bg-amber-100 px-1 font-mono text-xs">
                ANTHROPIC_API_KEY
              </code>{" "}
              を設定してください。
            </p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              例:「同じ人はなるべく連続しないで」「1人あたり週4回まで」
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTranslate();
                }}
                maxLength={300}
                placeholder="日本語でルールを入力"
                disabled={isTranslating}
                className="min-h-11 flex-1 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleTranslate}
                disabled={isTranslating || !text.trim()}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              >
                {isTranslating ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
                変換
              </button>
            </div>

            {/* 確認 */}
            {draft && (
              <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-xs font-medium text-primary">
                  この内容で登録しますか？
                </p>
                <p className="mt-2 text-sm font-medium">{draft.description}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-background px-2 py-0.5">
                    種別: {TYPE_LABEL[draft.ruleType] ?? draft.ruleType}
                  </span>
                  <span className="rounded-full bg-background px-2 py-0.5">
                    {draft.weight === "HARD" ? "必須" : "努力目標"}
                  </span>
                  {!EVALUABLE.has(draft.ruleType) && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                      自動生成の実装後に反映
                    </span>
                  )}
                </div>
                {draft.note && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {draft.note}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Check className="size-3.5" aria-hidden="true" />
                    )}
                    登録する
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft(null)}
                    disabled={isSaving}
                    className="inline-flex min-h-9 items-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    やめる
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </section>

      {/* 登録済みルール */}
      <section>
        <h2 className="mb-3 text-base font-semibold">登録済みルール</h2>
        {rules.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            まだルールがありません。
          </div>
        ) : (
          <ul className="space-y-2">
            {rules.map((r) => (
              <li
                key={r.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card p-4 shadow-sm ${
                  r.enabled ? "" : "opacity-60"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.description}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{TYPE_LABEL[r.ruleType] ?? r.ruleType}</span>
                    <span>・{r.weight === "HARD" ? "必須" : "努力目標"}</span>
                    {!EVALUABLE.has(r.ruleType) && (
                      <span className="text-amber-700">
                        （自動生成の実装後に反映）
                      </span>
                    )}
                    <span className="truncate">・入力:「{r.sourceText}」</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggle(r.id, !r.enabled)}
                  disabled={isMutating}
                  role="switch"
                  aria-checked={r.enabled}
                  aria-label={r.enabled ? "無効にする" : "有効にする"}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                    r.enabled ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform ${
                      r.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  disabled={isMutating}
                  aria-label="ルールを削除"
                  className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
