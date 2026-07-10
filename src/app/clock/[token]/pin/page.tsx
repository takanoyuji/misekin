"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { Delete, ChevronLeft } from "lucide-react";

const PIN_MIN_LENGTH = 4;
const PIN_MAX_LENGTH = 8;

export default function PinPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const staffId = searchParams.get("staffId");
  const token = params.token;

  const [pin, setPin] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // スタッフIDがない場合はスタッフ選択へ戻す
  useEffect(() => {
    if (!staffId) {
      router.replace(`/clock/${token}`);
    }
  }, [staffId, token, router]);

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= PIN_MAX_LENGTH) return;
      setError(null);
      const newPin = pin + digit;
      setPin(newPin);

      // 4桁以上で自動送信
      if (newPin.length >= PIN_MIN_LENGTH) {
        // 少し待ってから遷移（最後の桁が見えるように）
        setTimeout(() => {
          router.push(
            `/clock/${token}/status?staffId=${staffId}&pin=${encodeURIComponent(newPin)}`
          );
        }, 150);
      }
    },
    [pin, staffId, token, router]
  );

  const handleBackspace = useCallback(() => {
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // キーボード入力
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Escape") {
        handleBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDigit, handleBackspace, handleBack]);

  const digits = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8">
        {/* タイトル */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">PIN入力</h1>
          <p className="text-gray-500 text-sm">4〜8桁のPINを入力してください</p>
        </div>

        {/* PIN表示 */}
        <div
          className="flex justify-center gap-3 mb-6"
          role="status"
          aria-live="polite"
          aria-label={`PIN ${pin.length}桁入力済み`}
        >
          {Array.from({ length: PIN_MAX_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={`size-4 rounded-full border-2 transition-all duration-150 ${
                i < pin.length
                  ? "bg-blue-500 border-blue-500 scale-110"
                  : i === pin.length
                    ? "border-blue-300 bg-transparent"
                    : "border-gray-200 bg-transparent"
              }`}
              aria-hidden="true"
            />
          ))}
        </div>

        {/* エラー */}
        {error && (
          <p
            className="text-center text-red-500 text-sm mb-4"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </p>
        )}

        {/* テンキー */}
        <div
          className="grid grid-cols-3 gap-3"
          role="group"
          aria-label="数字テンキー"
        >
          {digits.map((row) =>
            row.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDigit(d)}
                className="h-20 w-full rounded-2xl bg-gray-50 border border-gray-200 text-2xl font-semibold text-gray-800 hover:bg-blue-50 hover:border-blue-300 active:scale-95 active:bg-blue-100 transition-all duration-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 focus-visible:ring-offset-1"
                aria-label={d}
              >
                {d}
              </button>
            ))
          )}

          {/* 最下行: 空 / 0 / バックスペース */}
          <div aria-hidden="true" />
          <button
            type="button"
            onClick={() => handleDigit("0")}
            className="h-20 w-full rounded-2xl bg-gray-50 border border-gray-200 text-2xl font-semibold text-gray-800 hover:bg-blue-50 hover:border-blue-300 active:scale-95 active:bg-blue-100 transition-all duration-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 focus-visible:ring-offset-1"
            aria-label="0"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            disabled={pin.length === 0}
            className="h-20 w-full rounded-2xl bg-gray-50 border border-gray-200 text-xl text-gray-600 hover:bg-red-50 hover:border-red-300 active:scale-95 active:bg-red-100 transition-all duration-100 disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 focus-visible:ring-offset-1 flex items-center justify-center"
            aria-label="バックスペース"
          >
            <Delete className="size-6" aria-hidden="true" />
          </button>
        </div>

        {/* 戻るボタン */}
        <button
          type="button"
          onClick={handleBack}
          className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-400"
          aria-label="スタッフ選択に戻る"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
          <span className="text-sm font-medium">戻る</span>
        </button>
      </div>
    </div>
  );
}
