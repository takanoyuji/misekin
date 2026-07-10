"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { format } from "date-fns";

const COUNTDOWN_SECONDS = 5;

interface CompleteClientProps {
  token: string;
  staffName: string;
  clockedAt: string;
  verb: string;
  statusLabel: string;
}

export function CompleteClient({
  token,
  staffName,
  clockedAt,
  verb,
  statusLabel,
}: CompleteClientProps) {
  const router = useRouter();
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (seconds <= 0) {
      router.push(`/clock/${token}`);
      return;
    }

    const timer = setTimeout(() => {
      setSeconds((s) => s - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [seconds, token, router]);

  const displayTime = (() => {
    try {
      return format(new Date(clockedAt), "HH:mm");
    } catch {
      return "--:--";
    }
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {/* チェックアイコン */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center justify-center size-24 rounded-full bg-green-100">
            <CheckCircle
              className="size-14 text-green-500"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* メッセージ */}
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{verb}</h1>

        {/* スタッフ名 */}
        {staffName && (
          <p className="text-xl text-gray-700 mb-4 font-medium">{staffName}</p>
        )}

        {/* 詳細情報 */}
        <div className="bg-white rounded-2xl shadow-md p-5 mb-8 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">打刻時刻</span>
            <span
              className="text-xl font-bold tabular-nums text-gray-900"
              aria-label={`打刻時刻 ${displayTime}`}
            >
              {displayTime}
            </span>
          </div>
          {statusLabel && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">現在の状態</span>
              <span className="text-base font-semibold text-blue-600">
                {statusLabel}
              </span>
            </div>
          )}
        </div>

        {/* カウントダウン */}
        <div className="space-y-3">
          <p
            className="text-gray-400 text-sm"
            aria-live="polite"
            aria-atomic="true"
          >
            {seconds}秒後にスタッフ選択に戻ります...
          </p>

          {/* 進捗バー */}
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full transition-all duration-1000 ease-linear"
              style={{
                width: `${(seconds / COUNTDOWN_SECONDS) * 100}%`,
              }}
              aria-hidden="true"
            />
          </div>

          <button
            type="button"
            onClick={() => router.push(`/clock/${token}`)}
            className="text-blue-500 hover:text-blue-700 text-sm underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 rounded"
          >
            今すぐ戻る
          </button>
        </div>
      </div>
    </div>
  );
}
