"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { createCorrectionRequest } from "@/actions/attendance";
import { Plus, Trash2, ChevronLeft } from "lucide-react";

interface AttendanceOption {
  id: string;
  businessDate: string;
  storeName: string;
  timezone: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  breaks: { startAt: string; endAt: string | null }[];
}

interface Props {
  userId: string;
  organizationId: string;
  staffId: string;
  attendances: AttendanceOption[];
  preselectedAttendanceId?: string;
}

function toLocalDatetime(isoString: string | null, timezone: string): string {
  if (!isoString) return "";
  try {
    const d = toZonedTime(new Date(isoString), timezone);
    return format(d, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

function formatTimeDisplay(
  isoString: string | null,
  timezone: string
): string {
  if (!isoString) return "—";
  try {
    return format(toZonedTime(new Date(isoString), timezone), "HH:mm");
  } catch {
    return "—";
  }
}

export function MyCorrectionRequestForm({
  userId,
  organizationId,
  staffId,
  attendances,
  preselectedAttendanceId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedId, setSelectedId] = useState(
    preselectedAttendanceId ?? attendances[0]?.id ?? ""
  );
  const [requestedClockInAt, setRequestedClockInAt] = useState("");
  const [requestedClockOutAt, setRequestedClockOutAt] = useState("");
  const [requestedBreaks, setRequestedBreaks] = useState<
    { startAt: string; endAt: string }[]
  >([]);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedAttendance = attendances.find((a) => a.id === selectedId);

  // 選択した勤怠が変わったら初期値をセット
  useEffect(() => {
    if (!selectedAttendance) return;
    const tz = selectedAttendance.timezone;
    setRequestedClockInAt(
      toLocalDatetime(selectedAttendance.clockInAt, tz)
    );
    setRequestedClockOutAt(
      toLocalDatetime(selectedAttendance.clockOutAt, tz)
    );
    setRequestedBreaks(
      selectedAttendance.breaks.map((b) => ({
        startAt: toLocalDatetime(b.startAt, tz),
        endAt: toLocalDatetime(b.endAt, tz),
      }))
    );
  }, [selectedId]);

  function addBreak() {
    setRequestedBreaks((prev) => [...prev, { startAt: "", endAt: "" }]);
  }

  function removeBreak(index: number) {
    setRequestedBreaks((prev) => prev.filter((_, i) => i !== index));
  }

  function updateBreak(
    index: number,
    field: "startAt" | "endAt",
    value: string
  ) {
    setRequestedBreaks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, [field]: value } : b))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedId) {
      setError("申請する勤怠を選択してください");
      return;
    }
    if (!reason.trim()) {
      setError("申請理由を入力してください");
      return;
    }

    startTransition(async () => {
      const result = await createCorrectionRequest(userId, organizationId, {
        attendanceId: selectedId,
        requestedClockInAt: requestedClockInAt
          ? new Date(requestedClockInAt)
          : null,
        requestedClockOutAt: requestedClockOutAt
          ? new Date(requestedClockOutAt)
          : null,
        requestedBreaks: requestedBreaks
          .filter((b) => b.startAt)
          .map((b) => ({
            startAt: new Date(b.startAt),
            endAt: b.endAt ? new Date(b.endAt) : null,
          })),
        reason: reason.trim(),
        notes: notes.trim() || null,
      });

      if (result.error) {
        setError(result.error);
      } else {
        router.push("/my-correction-requests");
        router.refresh();
      }
    });
  }

  const tz = selectedAttendance?.timezone ?? "Asia/Tokyo";

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ヘッダー */}
      <div>
        <Link
          href="/my-correction-requests"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          修正申請一覧に戻る
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">修正申請</h1>
        <p className="text-sm text-muted-foreground mt-1">
          勤怠の修正を申請します。管理者が確認後に承認または却下します。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 対象勤怠の選択 */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="attendanceId" className="text-sm font-medium">
            対象勤怠
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          {attendances.length === 0 ? (
            <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              申請可能な勤怠がありません。（すでに申請中か、締め処理済みの勤怠は申請できません）
            </div>
          ) : (
            <select
              id="attendanceId"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">選択してください</option>
              {attendances.map((att) => (
                <option key={att.id} value={att.id}>
                  {att.businessDate} — {att.storeName} (出勤:{" "}
                  {formatTimeDisplay(att.clockInAt, att.timezone)} / 退勤:{" "}
                  {formatTimeDisplay(att.clockOutAt, att.timezone)})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 変更前・変更後の比較 */}
        {selectedAttendance && (
          <div className="rounded-xl border border-border bg-muted/30 p-5">
            <h2 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              変更前 / 変更後の比較
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium mb-2">現在</p>
                <dl className="space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">出勤</dt>
                    <dd className="font-numeric text-xs">
                      {formatTimeDisplay(selectedAttendance.clockInAt, tz)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">退勤</dt>
                    <dd className="font-numeric text-xs">
                      {formatTimeDisplay(selectedAttendance.clockOutAt, tz)}
                    </dd>
                  </div>
                  {selectedAttendance.breaks.map((b, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">休憩{i + 1}</dt>
                      <dd className="font-numeric text-xs">
                        {formatTimeDisplay(b.startAt, tz)}〜
                        {formatTimeDisplay(b.endAt, tz)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <p className="font-medium mb-2 text-primary">修正希望（入力中）</p>
                <dl className="space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">出勤</dt>
                    <dd className="font-numeric text-xs text-primary">
                      {requestedClockInAt
                        ? format(new Date(requestedClockInAt), "HH:mm")
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">退勤</dt>
                    <dd className="font-numeric text-xs text-primary">
                      {requestedClockOutAt
                        ? format(new Date(requestedClockOutAt), "HH:mm")
                        : "—"}
                    </dd>
                  </div>
                  {requestedBreaks.map((b, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">休憩{i + 1}</dt>
                      <dd className="font-numeric text-xs text-primary">
                        {b.startAt
                          ? format(new Date(b.startAt), "HH:mm")
                          : "—"}
                        〜
                        {b.endAt ? format(new Date(b.endAt), "HH:mm") : "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        )}

        {/* 修正希望の出勤時刻 */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="requestedClockInAt" className="text-sm font-medium">
            修正希望の出勤時刻
          </label>
          <input
            id="requestedClockInAt"
            type="datetime-local"
            value={requestedClockInAt}
            onChange={(e) => setRequestedClockInAt(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* 修正希望の退勤時刻 */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="requestedClockOutAt" className="text-sm font-medium">
            修正希望の退勤時刻
          </label>
          <input
            id="requestedClockOutAt"
            type="datetime-local"
            value={requestedClockOutAt}
            onChange={(e) => setRequestedClockOutAt(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* 休憩 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">修正希望の休憩</span>
            <button
              type="button"
              onClick={addBreak}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              追加
            </button>
          </div>
          {requestedBreaks.length === 0 ? (
            <p className="text-xs text-muted-foreground">休憩なし</p>
          ) : (
            <div className="space-y-2">
              {requestedBreaks.map((brk, i) => (
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

        {/* 申請理由 */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reason" className="text-sm font-medium">
            申請理由
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
            placeholder="申請理由を入力してください（必須）"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* 補足メモ */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="notes" className="text-sm font-medium">
            補足メモ
            <span className="ml-1.5 text-xs text-muted-foreground">
              （任意）
            </span>
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="補足があればこちらに記入してください"
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
            disabled={isPending || !selectedId}
            className={cn(
              "inline-flex items-center rounded-md px-6 py-2 text-sm font-medium transition-colors",
              isPending || !selectedId
                ? "cursor-not-allowed bg-primary/60 text-primary-foreground"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {isPending ? "申請中..." : "申請する"}
          </button>
          <Link
            href="/my-correction-requests"
            className="inline-flex items-center rounded-md border border-input px-5 py-2 text-sm font-medium hover:bg-muted"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}
