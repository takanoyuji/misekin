"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Separator from "@radix-ui/react-separator";
import {
  LayoutDashboard,
  Clock,
  Users,
  Store,
  FileEdit,
  Lock,
  Download,
  Key,
  Shield,
  Settings,
  HelpCircle,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const mainNavItems: NavItem[] = [
  { label: "ホーム", href: "/dashboard", icon: LayoutDashboard },
  { label: "勤怠管理", href: "/attendance", icon: Clock },
  { label: "スタッフ", href: "/staff", icon: Users },
  { label: "店舗", href: "/stores", icon: Store },
  { label: "修正申請", href: "/correction-requests", icon: FileEdit },
  { label: "締め処理", href: "/closing", icon: Lock },
  { label: "CSVエクスポート", href: "/export", icon: Download },
  { label: "APIキー", href: "/api-keys", icon: Key },
  { label: "監査ログ", href: "/audit-logs", icon: Shield },
];

const secondaryNavItems: NavItem[] = [
  { label: "アカウント設定", href: "/account", icon: Settings },
  { label: "ヘルプ", href: "/help", icon: HelpCircle },
];

interface NavLinkProps {
  item: NavItem;
  pathname: string;
  onClick?: () => void;
}

function NavLink({ item, pathname, onClick }: NavLinkProps) {
  const isActive =
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

interface SidebarContentProps {
  pathname: string;
  onNavClick?: () => void;
}

function SidebarContent({ pathname, onNavClick }: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto px-3 py-4">
      <nav aria-label="メインナビゲーション" className="flex flex-col gap-0.5">
        {mainNavItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            onClick={onNavClick}
          />
        ))}
      </nav>

      <Separator.Root
        className="my-2 h-px bg-sidebar-border"
        aria-hidden="true"
      />

      <nav aria-label="サブナビゲーション" className="flex flex-col gap-0.5">
        {secondaryNavItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            onClick={onNavClick}
          />
        ))}
      </nav>
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* デスクトップサイドバー (PC: 240px固定) */}
      <aside
        className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex"
        aria-label="サイドバー"
      >
        <SidebarContent pathname={pathname} />
      </aside>

      {/* モバイルサイドバー (Sheet) */}
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        {/* トリガーボタン (ヘッダーから呼び出されるため data-mobile-sidebar-trigger を付与) */}
        <Dialog.Trigger asChild>
          <button
            id="mobile-sidebar-trigger"
            aria-label="メニューを開く"
            aria-expanded={mobileOpen}
            className="inline-flex items-center justify-center rounded-md p-2 text-foreground/70 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=closed]:animate-[fadeOut_150ms_ease] data-[state=open]:animate-[fadeIn_150ms_ease]" />
          <Dialog.Content
            aria-label="ナビゲーションメニュー"
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-72 bg-sidebar shadow-xl",
              "data-[state=closed]:animate-[slideOutLeft_200ms_ease] data-[state=open]:animate-[slideInLeft_200ms_ease]",
              "focus:outline-none"
            )}
          >
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
              <span className="text-base font-semibold">みせ勤</span>
              <Dialog.Close
                aria-label="メニューを閉じる"
                className="inline-flex items-center justify-center rounded-md p-1.5 text-foreground/70 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" aria-hidden="true" />
              </Dialog.Close>
            </div>
            <SidebarContent
              pathname={pathname}
              onNavClick={() => setMobileOpen(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
