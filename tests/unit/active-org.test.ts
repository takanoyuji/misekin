import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = {
  organizationMember: { findFirst: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: mockDb }));

const { resolveActiveOrganizationId, getOrganizationRole } = await import(
  "@/lib/auth/active-org"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveActiveOrganizationId", () => {
  it("クッキーがあればそれを使う", async () => {
    const result = await resolveActiveOrganizationId("user_1", "org_cookie");

    expect(result).toBe("org_cookie");
    // クッキーがある場合はDBを引かない
    expect(mockDb.organizationMember.findFirst).not.toHaveBeenCalled();
  });

  it("クッキーが無ければ所属組織にフォールバックする", async () => {
    // 招待で参加したスタッフはクッキーが設定されないケース
    mockDb.organizationMember.findFirst.mockResolvedValue({
      organizationId: "org_from_db",
    });

    const result = await resolveActiveOrganizationId("user_1", null);

    expect(result).toBe("org_from_db");
  });

  it("どの組織にも所属していなければ null を返す", async () => {
    mockDb.organizationMember.findFirst.mockResolvedValue(null);

    const result = await resolveActiveOrganizationId("user_1", null);

    expect(result).toBeNull();
  });

  it("未ログイン (userIdなし) では null を返す", async () => {
    const result = await resolveActiveOrganizationId(undefined, null);

    expect(result).toBeNull();
    expect(mockDb.organizationMember.findFirst).not.toHaveBeenCalled();
  });
});

describe("getOrganizationRole", () => {
  it("MEMBER を返す", async () => {
    mockDb.organizationMember.findFirst.mockResolvedValue({ role: "MEMBER" });

    expect(await getOrganizationRole("user_1", "org_1")).toBe("MEMBER");
  });

  it("OWNER を返す", async () => {
    mockDb.organizationMember.findFirst.mockResolvedValue({ role: "OWNER" });

    expect(await getOrganizationRole("user_1", "org_1")).toBe("OWNER");
  });

  it("メンバーでなければ null を返す", async () => {
    mockDb.organizationMember.findFirst.mockResolvedValue(null);

    expect(await getOrganizationRole("user_1", "org_1")).toBeNull();
  });

  it("組織IDが無ければ null を返す", async () => {
    expect(await getOrganizationRole("user_1", null)).toBeNull();
    expect(mockDb.organizationMember.findFirst).not.toHaveBeenCalled();
  });
});
