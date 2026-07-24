"use client"; // エラーバウンダリはクライアントコンポーネントである必要がある

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

/**
 * 画面内で処理しきれなかったエラーの受け皿
 *
 * アプリを更新した直後は、ブラウザに残っている古い画面から送信すると
 * サーバー側の処理が見つからずエラーになる (Server Action のIDが変わるため)。
 * 再読み込みで復帰できるため、その案内を優先して出す。
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isStaleDeployment =
    error.message?.includes("Failed to find Server Action") ||
    error.message?.includes("older or newer deployment");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700"
      >
        <TriangleAlert className="size-6" />
      </span>

      <h1 className="mt-4 text-lg font-semibold">
        {isStaleDeployment
          ? "画面が最新ではありません"
          : "問題が発生しました"}
      </h1>

      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {isStaleDeployment
          ? "アプリが更新されたため、開いていた画面の情報が古くなっています。ページを再読み込みすると、そのまま操作を続けられます。"
          : "一時的なエラーの可能性があります。やり直しても改善しない場合は、しばらく経ってからお試しください。"}
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          ページを再読み込みする
        </button>
        {!isStaleDeployment && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-6 text-sm font-medium transition-colors hover:bg-muted"
          >
            もう一度試す
          </button>
        )}
      </div>

      {error.digest && (
        <p className="mt-6 font-mono text-xs text-muted-foreground">
          エラーID: {error.digest}
        </p>
      )}
    </div>
  );
}
