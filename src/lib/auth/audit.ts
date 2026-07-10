import { db } from "@/lib/db";

export type AuditAction =
  | "ATTENDANCE_CREATE"
  | "ATTENDANCE_MODIFY"
  | "CORRECTION_REQUEST_CREATE"
  | "CORRECTION_REQUEST_APPROVE"
  | "CORRECTION_REQUEST_REJECT"
  | "CORRECTION_REQUEST_CANCEL"
  | "STAFF_CREATE"
  | "STAFF_UPDATE"
  | "STAFF_STATUS_CHANGE"
  | "WAGE_HISTORY_CREATE"
  | "TRANSPORTATION_HISTORY_CREATE"
  | "MEMBER_INVITE"
  | "MEMBER_ROLE_CHANGE"
  | "MEMBER_DEACTIVATE"
  | "STORE_CREATE"
  | "STORE_UPDATE"
  | "STORE_DEACTIVATE"
  | "CLOCK_URL_ISSUE"
  | "CLOCK_URL_REVOKE"
  | "API_KEY_ISSUE"
  | "API_KEY_REVOKE"
  | "CSV_EXPORT"
  | "CLOSING_PERIOD_CLOSE"
  | "ATTENDANCE_LOCK"
  | "ATTENDANCE_UNLOCK"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "CLOCK_IN"
  | "BREAK_START"
  | "BREAK_END"
  | "CLOCK_OUT";

export interface AuditLogInput {
  organizationId: string;
  actorUserId?: string;
  actorType?: "USER" | "SYSTEM" | "API";
  action: AuditAction;
  targetType: string;
  targetId?: string;
  storeId?: string;
  staffId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: unknown;
}

/**
 * 監査ログを記録する
 * 監査ログは作成のみ（更新・削除不可）
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      actorType: input.actorType ?? "USER",
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      storeId: input.storeId,
      staffId: input.staffId,
      before: input.before as any,
      after: input.after as any,
      reason: input.reason,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: input.metadata as any,
    },
  });
}
