"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createAttendanceByAdmin } from "@/actions/attendance";
import { Plus, Trash2, ChevronLeft } from "lucide-react";

interface StoreOption {
  id: string;
  name: string;
  timezone: string;
  dayChangeHour: number;
  dayChangeMinute: number;
  staff: { id: string; displayName: string }[];
}

interface Props {
  organizationId: string;
  stores: StoreOption[];
  initial: { storeId: string; staffId: string; date: string };
}

/**
 * 入力中の出勤時刻から営業日を出す（サーバーと同じ規則: 店舗の日付切替時刻より前は前日扱い）。
 * datetime-local はブラウザのローカル時刻。店舗は全て Asia/Tokyo なので、そのまま読む。
 */
function previewBusinessDate(localDatetime: string, store: StoreOption | undefined): string {
  if (!localDatetime || !store) return "—";
  const d = new Date(localDatetime);
  if (Number.isNaN(d.getTime())) return "—";
  const minutes = d.getHours() * 60 + d.getMinutes();
  const change = store.dayChangeHour * 60 + store.dayChangeMinute;
  if (minutes < change) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AttendanceNewForm({ organizationId, stores, initial }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [storeId, setStoreId] = useState(
    stores.some((s) => s.id === initial.storeId) ? initial.storeId : (stores[0]?.id ?? "")
  );
  const store = useMemo(() => stores.find((s) => s.id === storeId), [stores, storeId]);
  const [staffId, setStaffId] = useState(initial.staffId);
  // 日付が指定されていれば、その日の 18:00〜23:00 を初期値にする（入力の手間を減らすだけ。必ず直してもらう）
  const [clockInAt, setClockInAt] = useState(initial.date ? `${initial.date}T18:00` : "");
  const [clockOutAt, setClockOutAt] = useState(initial.date ? `${initial.date}T23:00` : "");
  const [breaks, setBreaks] = useState<{ startAt: string; endAt: string }[]>([]);
  const [reason, setReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);

  const businessDate = previewBusinessDate(clockInAt, store);

  function addBreak() {
    setBreaks((prev) => [...prev, { startAt: "", endAt: "" }]);
  }
  function removeBreak(index: number) {
    setBreaks((prev) => prev.filter((_, i) => i !== index));
  }
  function updateBreak(index: number, field: "startAt" | "endAt", value: string) {
    setBreaks((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExistingId(null);

    if (!storeId) { setError("店舗を選んでください"); return; }
    if (!staffId) { setError("スタッフを選んでください"); return; }
    if (!clockInAt || !clockOutAt) { setError("出勤時刻と退勤時刻を入力してください"); return; }
    if (!reason.trim()) { setError("登録理由を入力してください"); return; }

    startTransition(async () => {
      const result = await createAttendanceByAdmin(organizationId, {
        storeId,
        staffId,
        clockInAt: new Date(clockInAt),
        clockOutAt: new Date(clockOutAt),
        breaks: breaks
          .filter((b) => b.startAt)
          .map((b) => ({ startAt: new Date(b.startAt), endAt: b.endAt ? new Date(b.endAt) : null })),
        reason: reason.trim(),
        adminNotes: adminNotes.trim() || null,
      });

      if (result.error) {
        setError(result.error);
        if (result.attendanceId) setExistingId(result.attendanceId);
      } else if (result.attendanceId) {
        router.push(`/attendance/${result.attendanceId}`);
        router.refresh();
      }
    });
  }

  const inputClass =
    "rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/attendance"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          勤怠一覧に戻る
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">勤怠を追加</h1>
        <p className="text-sm text-muted-foreground mt-1">
          打刻漏れ（その日の記録が無い）を管理者が代わりに登録します。退勤だけ忘れた場合は、勤怠一覧のその日から「修正する」を使ってください。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="storeId" className="text-sm font-medium">
              店舗<span className="ml-1 text-destructive" aria-hidden="true">*</span>
            </label>
            <select
              id="storeId"
              value={storeId}
              onChange={(e) => { setStoreId(e.target.value); setStaffId(""); }}
              className={inputClass}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="staffId" className="text-sm font-medium">
              スタッフ<span className="ml-1 text-destructive" aria-hidden="true">*</span>
            </label>
            <select
              id="staffId"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className={inputClass}
            >
              <option value="">選んでください</option>
              {(store?.staff ?? []).map((st) => (
                <option key={st.id} value={st.id}>{st.displayName}</option>
              ))}
            </select>
            {store && store.staff.length === 0 && (
              <p className="text-xs text-muted-foreground">この店舗に在籍中のスタッフがいません</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="clockInAt" className="text-sm font-medium">
              出勤時刻<span className="ml-1 text-destructive" aria-hidden="true">*</span>
            </label>
            <input
              id="clockInAt"
              type="datetime-local"
              value={clockInAt}
              onChange={(e) => setClockInAt(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="clockOutAt" className="text-sm font-medium">
              退勤時刻<span className="ml-1 text-destructive" aria-hidden="true">*</span>
            </label>
            <input
              id="clockOutAt"
              type="datetime-local"
              value={clockOutAt}
              onChange={(e) => setClockOutAt(e.target.value)}
              required
              className={inputClass}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground" data-testid="business-date-preview">
          営業日: <span className="font-numeric font-medium text-foreground">{businessDate}</span>
          {store && (
            <span className="ml-2">
              （{store.name} の日付切替は {String(store.dayChangeHour).padStart(2, "0")}:{String(store.dayChangeMinute).padStart(2, "0")}。それより前の出勤は前日の営業日になります）
            </span>
          )}
        </p>

        {/* 休憩 */}
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
                <div key={i} className="flex items-end gap-2 rounded-md border border-border bg-muted/30 p-3">
                  <div className="flex flex-1 items-end gap-2">
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs text-muted-foreground">開始</label>
                      <input
                        type="datetime-local"
                        value={brk.startAt}
                        onChange={(e) => updateBreak(i, "startAt", e.target.value)}
                        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      />
                    </div>
                    <span className="pb-2 text-muted-foreground">〜</span>
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs text-muted-foreground">終了</label>
                      <input
                        type="datetime-local"
                        value={brk.endAt}
                        onChange={(e) => updateBreak(i, "endAt", e.target.value)}
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

        {/* 登録理由 */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reason" className="text-sm font-medium">
            登録理由<span className="ml-1 text-destructive" aria-hidden="true">*</span>
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            rows={3}
            placeholder="例: 本人から打刻忘れの連絡。LINEで出退勤時刻を確認"
            className={cn(inputClass, "resize-none")}
          />
          <p className="text-xs text-muted-foreground">修正履歴と監査ログに残ります。誰の申告で入れたかが分かるように書いてください。</p>
        </div>

        {/* 管理者メモ */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="adminNotes" className="text-sm font-medium">
            管理者メモ<span className="ml-1.5 text-xs text-muted-foreground">（任意）</span>
          </label>
          <textarea
            id="adminNotes"
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            rows={2}
            placeholder="内部用メモ（スタッフには表示されません）"
            className={cn(inputClass, "resize-none")}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
            {existingId && (
              <>
                {" "}
                <Link href={`/attendance/${existingId}/edit`} className="underline">
                  その勤怠を修正する
                </Link>
              </>
            )}
          </div>
        )}

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
            {isPending ? "登録中…" : "勤怠を登録"}
          </button>
          <Link
            href="/attendance"
            className="inline-flex items-center rounded-md border border-input px-5 py-2 text-sm font-medium hover:bg-muted"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}
