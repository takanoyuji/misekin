"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { correctAttendance } from "@/actions/attendance";
import { Plus, Trash2, ChevronLeft } from "lucide-react";

interface OriginalData {
  businessDate: string;
  staffName: string;
  storeName: string;
  timezone: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  adminNotes: string | null;
  breaks: { startAt: string; endAt: string | null }[];
}

interface Props {
  attendanceId: string;
  organizationId: string;
  original: OriginalData;
}

function toLocalDatetime(
  isoString: string | null,
  timezone: string
): string {
  if (!isoString) return "";
  try {
    const d = toZonedTime(new Date(isoString), timezone);
    return format(d, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

function displayDatetime(value: string): string {
  if (!value) return "—";
  try {
    return format(new Date(value), "yyyy/MM/dd HH:mm");
  } catch {
    return "—";
  }
}

export function AttendanceEditForm({
  attendanceId,
  organizationId,
  original,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const { timezone } = original;

  const [clockInAt, setClockInAt] = useState(
    toLocalDatetime(original.clockInAt, timezone)
  );
  const [clockOutAt, setClockOutAt] = useState(
    toLocalDatetime(original.clockOutAt, timezone)
  );
  const [breaks, setBreaks] = useState(
    original.breaks.map((b) => ({
      startAt: toLocalDatetime(b.startAt, timezone),
      endAt: toLocalDatetime(b.endAt, timezone),
    }))
  );
  const [reason, setReason] = useState("");
  const [adminNotes, setAdminNotes] = useState(original.adminNotes ?? "");
  const [error, setError] = useState<string | null>(null);

  function addBreak() {
    setBreaks((prev) => [...prev, { startAt: "", endAt: "" }]);
  }

  function removeBreak(index: number) {
    setBreaks((prev) => prev.filter((_, i) => i !== index));
  }

  function updateBreak(
    index: number,
    field: "startAt" | "endAt",
    value: string
  ) {
    setBreaks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, [field]: value } : b))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError("修正理由を入力してください");
      return;
    }

    startTransition(async () => {
      const result = await correctAttendance(organizationId, {
        attendanceId,
        clockInAt: clockInAt ? new Date(clockInAt) : null,
        clockOutAt: clockOutAt ? new Date(clockOutAt) : null,
        breaks: breaks
          .filter((b) => b.startAt)
          .map((b) => ({
            startAt: new Date(b.startAt),
            endAt: b.endAt ? new Date(b.endAt) : null,
          })),
        reason: reason.trim(),
        adminNotes: adminNotes.trim() || null,
      });

      if (result.error) {
        setError(result.error);
      } else {
        router.push(`/attendance/${attendanceId}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ヘッダー */}
      <div>
        <Link
          href={`/attendance/${attendanceId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          詳細に戻る
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">勤怠修正</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {original.staffName} / {original.storeName} / {original.businessDate}
        </p>
      </div>

      {/* 変更前・変更後の比較 */}
      <div className="rounded-xl border border-border bg-muted/30 p-5">
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          変更前 / 変更後の比較
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium mb-2">変更前</p>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">出勤</dt>
                <dd className="font-numeric text-xs">
                  {original.clockInAt
                    ? format(
                        toZonedTime(new Date(original.clockInAt), timezone),
                        "MM/dd HH:mm"
                      )
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">退勤</dt>
                <dd className="font-numeric text-xs">
                  {original.clockOutAt
                    ? format(
                        toZonedTime(new Date(original.clockOutAt), timezone),
                        "MM/dd HH:mm"
                      )
                    : "—"}
                </dd>
              </div>
              {original.breaks.map((b, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">休憩{i + 1}</dt>
                  <dd className="font-numeric text-xs">
                    {b.startAt
                      ? format(
                          toZonedTime(new Date(b.startAt), timezone),
                          "HH:mm"
                        )
                      : "—"}
                    〜
                    {b.endAt
                      ? format(
                          toZonedTime(new Date(b.endAt), timezone),
                          "HH:mm"
                        )
                      : "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <p className="font-medium mb-2">変更後（入力中）</p>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">出勤</dt>
                <dd className="font-numeric text-xs">
                  {clockInAt ? format(new Date(clockInAt), "MM/dd HH:mm") : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">退勤</dt>
                <dd className="font-numeric text-xs">
                  {clockOutAt ? format(new Date(clockOutAt), "MM/dd HH:mm") : "—"}
                </dd>
              </div>
              {breaks.map((b, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">休憩{i + 1}</dt>
                  <dd className="font-numeric text-xs">
                    {b.startAt ? format(new Date(b.startAt), "HH:mm") : "—"}
                    〜
                    {b.endAt ? format(new Date(b.endAt), "HH:mm") : "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* フォーム */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 出勤時刻 */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="clockInAt" className="text-sm font-medium">
            出勤時刻
          </label>
          <input
            id="clockInAt"
            type="datetime-local"
            value={clockInAt}
            onChange={(e) => setClockInAt(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* 退勤時刻 */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="clockOutAt" className="text-sm font-medium">
            退勤時刻
          </label>
          <input
            id="clockOutAt"
            type="datetime-local"
            value={clockOutAt}
            onChange={(e) => setClockOutAt(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* 休憩一覧 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">休憩</span>
            <button
              type="button"
              onClick={addBreak}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              追加
            </button>
          </div>
          {breaks.length === 0 ? (
            <p className="text-xs text-muted-foreground">休憩なし</p>
          ) : (
            <div className="space-y-2">
              {breaks.map((brk, i) => (
                <div
                  key={i}
                  className="flex items-end gap-2 rounded-md border border-border bg-muted/30 p-3"
                >
                  <div className="flex flex-1 items-end gap-2">
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs text-muted-foreground">
                        開始
                      </label>
                      <input
                        type="datetime-local"
                        value={brk.startAt}
                        onChange={(e) =>
                          updateBreak(i, "startAt", e.target.value)
                        }
                        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      />
                    </div>
                    <span className="pb-2 text-muted-foreground">〜</span>
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs text-muted-foreground">
                        終了
                      </label>
                      <input
                        type="datetime-local"
                        value={brk.endAt}
                        onChange={(e) =>
                          updateBreak(i, "endAt", e.target.value)
                        }
                        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBreak(i)}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`休憩${i + 1}を削除`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 修正理由 */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reason" className="text-sm font-medium">
            修正理由
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            rows={3}
            placeholder="修正理由を入力してください（必須）"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* 管理者メモ */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="adminNotes" className="text-sm font-medium">
            管理者メモ
            <span className="ml-1.5 text-xs text-muted-foreground">
              （任意）
            </span>
          </label>
          <textarea
            id="adminNotes"
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            rows={2}
            placeholder="内部用メモ（スタッフには表示されません）"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* エラー表示 */}
        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {/* ボタン */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className={cn(
              "inline-flex items-center rounded-md px-6 py-2 text-sm font-medium transition-colors",
              isPending
                ? "cursor-not-allowed bg-primary/60 text-primary-foreground"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {isPending ? "保存中..." : "修正を保存"}
          </button>
          <Link
            href={`/attendance/${attendanceId}`}
            className="inline-flex items-center rounded-md border border-input px-5 py-2 text-sm font-medium hover:bg-muted"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}
