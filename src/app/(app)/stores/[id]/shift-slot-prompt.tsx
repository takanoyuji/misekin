"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  translateSlotsFromText,
  replaceShiftSlots,
} from "@/actions/shift-slot";
import type { TranslatedShiftSlot } from "@/lib/ai/shift-slot-translator";

interface Props {
  organizationId: string;
  storeId: string;
  /** ANTHROPIC_API_KEY が無い環境では使えない */
  aiEnabled: boolean;
  /** いま設定されている時間帯の数。0のときは案内を強める */
  currentCount: number;
}

const EXAMPLE =
  "通常は15時から翌5時まで。土日祝は12時開始。翌日が土日祝のときは朝8時まで営業。";

export function ShiftSlotPrompt({
  organizationId,
  storeId,
  aiEnabled,
  currentCount,
}: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<TranslatedShiftSlot[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [caution, setCaution] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReading, startRead] = useTransition();
  const [isSaving, startSave] = useTransition();

  if (!aiEnabled) return null;

  function handleRead() {
    setError(null);
    setDraft(null);
    startRead(async () => {
      const r = await translateSlotsFromText(organizationId, storeId, text);
      if (r.error) {
        setError(r.error);
        return;
      }
      setDraft(r.slots ?? []);
      setSummary(r.summary ?? null);
      setCaution(r.caution ?? null);
    });
  }

  function handleSave() {
    if (!draft) return;
    setError(null);
    startSave(async () => {
      const r = await replaceShiftSlots(
        organizationId,
        storeId,
        draft.map(({ name, startTime, endTime }) => ({ name, startTime, endTime }))
      );
      if (r.error) {
        setError(r.error);
        return;
      }
      setDraft(null);
      setText("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">営業時間から時間帯を作る</h3>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        営業時間をふだんの言葉で書いてください。シフトを組む単位に分けて候補を出します。
        {currentCount === 0 && "（まだ時間帯が1つも設定されていません）"}
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder={EXAMPLE}
        disabled={isReading || isSaving}
        className="mt-3 w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
        aria-label="営業時間"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={handleRead} disabled={isReading || isSaving || !text.trim()}>
          {isReading ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              読み取り中…
            </>
          ) : (
            "読み取る"
          )}
        </Button>
        {!text && (
          <button
            type="button"
            onClick={() => setText(EXAMPLE)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            例を入れる
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {draft && (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          {summary && <p className="text-sm">{summary}</p>}

          <ul className="space-y-1.5">
            {draft.map((s) => (
              <li
                key={`${s.name}-${s.startTime}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md bg-background px-3 py-2 text-sm"
              >
                <span className="font-semibold">{s.name}</span>
                <span className="font-mono tabular-nums">
                  {s.startTime}〜{s.endTime}
                  {s.endTime <= s.startTime && (
                    <span className="ml-1 text-xs text-muted-foreground">（翌日）</span>
                  )}
                </span>
                {s.note && (
                  <span className="text-xs text-muted-foreground">{s.note}</span>
                )}
              </li>
            ))}
          </ul>

          {caution && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {caution}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            保存すると、いまの時間帯は使わない状態にして置き換えます。過去のシフトや希望は消えません。
          </p>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "保存中…" : "この内容で置き換える"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDraft(null)}
              disabled={isSaving}
            >
              やめる
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
