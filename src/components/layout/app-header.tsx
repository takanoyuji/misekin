"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "next-auth";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, ChevronDown, LogOut, Settings, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  session: Session;
  organizationName?: string | null;
  unreadCount?: number;
}

export function AppHeader({
  session,
  organizationName,
  unreadCount = 0,
}: AppHeaderProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const userName = session.user?.name ?? "ユーザー";
  const userEmail = session.user?.email ?? "";

  const userInitial = userName.charAt(0).toUpperCase();

  async function handleSignOut() {
    // next-auth の signOut はクライアントサイドで実行
    const { signOut } = await import("next-auth/react");
    await signOut({ callbackUrl: "/login" });
  }

  function openMobileSidebar() {
    // AppSidebar の Dialog.Trigger をプログラムから開く
    const trigger = document.getElementById("mobile-sidebar-trigger");
    trigger?.click();
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 lg:px-6">
      {/* 左側: モバイルハンバーガー + ロゴ */}
      <div className="flex items-center gap-3">
        {/* モバイルメニューボタン */}
        <button
          type="button"
          aria-label="サイドバーを開く"
          onClick={openMobileSidebar}
          className="inline-flex items-center justify-center rounded-md p-2 text-foreground/70 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>

        {/* ロゴ/ブランド名 */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <span className="text-lg font-bold tracking-tight text-primary">
            みせ勤
          </span>
        </Link>

        {/* 組織名 */}
        {organizationName && (
          <>
            <span className="text-muted-foreground/40 hidden sm:inline">/</span>
            <span className="hidden sm:inline text-sm font-medium text-muted-foreground truncate max-w-[200px]">
              {organizationName}
            </span>
          </>
        )}
      </div>

      {/* 右側: 通知ベル + アカウントメニュー */}
      <div className="flex items-center gap-1">
        {/* 通知ベル */}
        <Link
          href="/notifications"
          aria-label={
            unreadCount > 0
              ? `通知 (未読${unreadCount}件)`
              : "通知"
          }
          className="relative inline-flex items-center justify-center rounded-md p-2 text-foreground/70 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
        >
          <Bell className="size-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute right-1 top-1 flex items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white",
                unreadCount > 9 ? "size-4.5 text-[9px]" : "size-4"
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        {/* アカウントドロップダウン */}
        <DropdownMenu.Root open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="アカウントメニュー"
              aria-expanded={dropdownOpen}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
            >
              {/* アバター */}
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                aria-hidden="true"
              >
                {userInitial}
              </span>
              <span className="hidden max-w-[120px] truncate sm:inline text-foreground/80">
                {userName}
              </span>
              <ChevronDown
                className="size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className={cn(
                "z-50 min-w-[220px] rounded-lg border border-border bg-popover p-1 shadow-lg",
                "data-[state=closed]:animate-[fadeOut_100ms_ease] data-[state=open]:animate-[fadeIn_100ms_ease]",
                "focus:outline-none"
              )}
            >
              {/* ユーザー情報 */}
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-foreground truncate">
                  {userName}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {userEmail}
                </p>
              </div>

              <DropdownMenu.Separator className="my-1 h-px bg-border" />

              <DropdownMenu.Item asChild>
                <Link
                  href="/account"
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground/80",
                    "hover:bg-muted hover:text-foreground",
                    "focus:bg-muted focus:text-foreground focus:outline-none",
                    "transition-colors"
                  )}
                >
                  <Settings className="size-4 shrink-0" aria-hidden="true" />
                  アカウント設定
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="my-1 h-px bg-border" />

              <DropdownMenu.Item asChild>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm",
                    "text-destructive hover:bg-destructive/10",
                    "focus:bg-destructive/10 focus:outline-none",
                    "transition-colors"
                  )}
                >
                  <LogOut className="size-4 shrink-0" aria-hidden="true" />
                  ログアウト
                </button>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
