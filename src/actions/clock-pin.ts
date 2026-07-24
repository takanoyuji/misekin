"use server";

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { addMinutes } from "date-fns";
import { db } from "@/lib/db";
import {
  clockCookieName,
  createClockSession,
  CLOCK_SESSION_TTL_MS,
} from "@/lib/clock-session";

interface VerifyResult {
  success?: boolean;
  error?: string;
}

/**
 * 打刻用PINを検証し、成功したら短命の打刻セッションCookieを発行する
 *
 * PINはこのアクション内でのみ扱い、URLやクライアントには残さない。
 * 成功後の画面遷移・打刻操作はCookieのセッションで認可する。
 */
export async function verifyClockPin(params: {
  token: string;
  staffId: string;
  pin: string;
}): Promise<VerifyResult> {
  const { token, staffId, pin } = params;

  const clockUrl = await db.storeClockUrl.findFirst({
    where: { token, isActive: true },
    include: { store: { select: { id: true, organizationId: true } } },
  });

  if (!clockUrl || (clockUrl.expiresAt && clockUrl.expiresAt < new Date())) {
    return { error: "打刻URLが無効です" };
  }

  const staffStore = await db.staffStore.findFirst({
    where: {
      staffId,
      storeId: clockUrl.store.id,
      isActive: true,
      canClock: true,
      staff: { status: "ACTIVE", organizationId: clockUrl.store.organizationId },
    },
    select: {
      id: true,
      pinHash: true,
      requirePin: true,
      pinFailCount: true,
      pinLockedUntil: true,
    },
  });

  if (!staffStore) {
    return { error: "スタッフが見つかりません" };
  }

  if (staffStore.pinLockedUntil && staffStore.pinLockedUntil > new Date()) {
    return {
      error: "PINが一時的にロックされています。しばらく待ってからお試しください",
    };
  }

  // PIN不要のスタッフはPINなしでセッションを発行
  if (!staffStore.requirePin) {
    await issueSession(token, staffStore.id);
    return { success: true };
  }

  if (!staffStore.pinHash) {
    return { error: "PINが設定されていません。管理者にお問い合わせください" };
  }

  const isValid = await bcrypt.compare(pin, staffStore.pinHash);

  if (!isValid) {
    const newFailCount = staffStore.pinFailCount + 1;
    const lockUntil = newFailCount >= 5 ? addMinutes(new Date(), 15) : null;

    await db.staffStore.update({
      where: { id: staffStore.id },
      data: { pinFailCount: newFailCount, pinLockedUntil: lockUntil },
    });

    if (lockUntil) {
      return { error: "PINを5回間違えました。15分間ロックされます" };
    }
    return { error: `PINが正しくありません（残り${5 - newFailCount}回）` };
  }

  // 成功: 失敗カウントをリセットしてセッション発行
  await db.staffStore.update({
    where: { id: staffStore.id },
    data: { pinFailCount: 0, pinLockedUntil: null },
  });
  await issueSession(token, staffStore.id);
  return { success: true };
}

async function issueSession(token: string, staffStoreId: string) {
  const cookieStore = await cookies();
  cookieStore.set(
    clockCookieName(token),
    createClockSession(staffStoreId, Date.now()),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(CLOCK_SESSION_TTL_MS / 1000),
    }
  );
}
