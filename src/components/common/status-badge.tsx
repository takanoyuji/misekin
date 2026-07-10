import { cn } from "@/lib/utils";

type AttendanceStatusType =
  | "IN_PROGRESS"
  | "COMPLETED"
  | "MISSING_CLOCK_OUT"
  | "MISSING_BREAK_END"
  | "ANOMALY";

type CorrectionStatusType = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

type StatusType = AttendanceStatusType | CorrectionStatusType;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<
  StatusType,
  {
    label: string;
    icon: string;
    colorClass: string;
    bgClass: string;
    textClass: string;
    ariaLabel: string;
  }
> = {
  // 勤怠ステータス
  IN_PROGRESS: {
    label: "勤務中",
    icon: "●",
    colorClass: "text-status-working",
    bgClass: "bg-status-working",
    textClass: "text-status-working",
    ariaLabel: "勤務中",
  },
  MISSING_BREAK_END: {
    label: "休憩中",
    icon: "⏸",
    colorClass: "text-status-break",
    bgClass: "bg-status-break",
    textClass: "text-status-break",
    ariaLabel: "休憩中",
  },
  COMPLETED: {
    label: "退勤済み",
    icon: "✓",
    colorClass: "text-status-off",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    ariaLabel: "退勤済み",
  },
  MISSING_CLOCK_OUT: {
    label: "退勤漏れ",
    icon: "⚠",
    colorClass: "text-status-missing",
    bgClass: "bg-status-missing",
    textClass: "text-status-missing",
    ariaLabel: "退勤漏れ",
  },
  ANOMALY: {
    label: "退勤漏れ",
    icon: "⚠",
    colorClass: "text-status-missing",
    bgClass: "bg-status-missing",
    textClass: "text-status-missing",
    ariaLabel: "異常あり",
  },
  // 修正申請ステータス
  PENDING: {
    label: "申請中",
    icon: "⏳",
    colorClass: "text-status-pending",
    bgClass: "bg-status-pending",
    textClass: "text-status-pending",
    ariaLabel: "申請中",
  },
  APPROVED: {
    label: "承認済み",
    icon: "✓",
    colorClass: "text-status-working",
    bgClass: "bg-status-working",
    textClass: "text-status-working",
    ariaLabel: "承認済み",
  },
  REJECTED: {
    label: "却下",
    icon: "✗",
    colorClass: "text-status-missing",
    bgClass: "bg-status-missing",
    textClass: "text-status-missing",
    ariaLabel: "却下",
  },
  CANCELLED: {
    label: "取消",
    icon: "✗",
    colorClass: "text-muted-foreground",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    ariaLabel: "取消",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  if (!config) return null;

  return (
    <span
      role="status"
      aria-label={config.ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.bgClass,
        config.textClass,
        className
      )}
    >
      <span aria-hidden="true" className="text-[10px] leading-none">
        {config.icon}
      </span>
      {config.label}
    </span>
  );
}
