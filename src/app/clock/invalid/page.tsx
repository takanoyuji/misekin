import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "URLが無効です",
};

export default function ClockInvalidPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center bg-white rounded-3xl shadow-xl p-10">
        {/* アイコン */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center justify-center size-20 rounded-full bg-yellow-100">
            <AlertTriangle
              className="size-10 text-yellow-500"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* タイトル */}
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          この打刻URLは無効です
        </h1>

        {/* 説明 */}
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          URLの有効期限が切れているか、無効なURLです。
          <br />
          管理者に新しい打刻URLの発行を依頼してください。
        </p>

        {/* 補足 */}
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-left space-y-1">
          <p className="text-xs font-semibold text-gray-700">
            考えられる原因:
          </p>
          <ul className="text-xs text-gray-500 space-y-0.5 list-disc list-inside">
            <li>URLの有効期限が切れた</li>
            <li>URLが無効化された</li>
            <li>URLが正しくない</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
