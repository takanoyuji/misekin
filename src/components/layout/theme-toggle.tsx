"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "misekin-theme";

/**
 * ライト/ダークの切替ボタン
 *
 * 初期状態は layout.tsx のインラインスクリプトが確定させているため、
 * ここではマウント後に現在の状態を読み取って表示を合わせる。
 */
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // localStorage 利用不可でも切替自体は機能させる
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        mounted
          ? isDark
            ? "ライトモードに切り替える"
            : "ダークモードに切り替える"
          : "テーマを切り替える"
      }
      aria-pressed={mounted ? isDark : undefined}
      className="inline-flex size-9 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* アイコンはCSSで出し分け、初期表示のちらつきを避ける */}
      <Sun className="size-5 hidden dark:block" aria-hidden="true" />
      <Moon className="size-5 block dark:hidden" aria-hidden="true" />
    </button>
  );
}
