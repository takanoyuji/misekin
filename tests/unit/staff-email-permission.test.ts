import { describe, it, expect, vi, beforeEach } from "vitest";

// permissions.ts は @/lib/db に依存するためモックする
const mockDb = {
  staff: { findFirst: vi.fn() },
  organizationMember: { findFirst: vi.fn(), count: vi.fn() },
  storeAdmin: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: mockDb }));

const { requireStaffEmailEditPermission } = await import(
  "@/lib/auth/permissions"
);

const ORG = "org_1";
const STAFF = "staff_1";

/** 対象スタッフの状態を設定する */
function givenStaff(opts: { userId?: string | null; storeIds?: string[] }) {
  mockDb.staff.findFirst.mockResolvedValue({
    userId: opts.userId ?? null,
    staffStores: (opts.storeIds ?? []).map((storeId) => ({ storeId })),
  });
}

/** 操作者の組織メンバーシップと店舗スコープを設定する */
function givenActor(opts: {
  role?: "OWNER" | "ADMIN";
  isMember?: boolean;
  scopedStoreIds?: string[] | null;
}) {
  if (opts.isMember === false) {
    mockDb.organizationMember.findFirst.mockResolvedValue(null);
    return;
  }
  mockDb.organizationMember.findFirst.mockResolvedValue({
    id: "member_1",
    userId: "user_admin",
    organizationId: ORG,
    role: opts.role ?? "ADMIN",
    isActive: true,
  });
  // null = スコープ未設定 (全店舗管理者)
  const scopes = opts.scopedStoreIds ?? null;
  mockDb.storeAdmin.findMany.mockResolvedValue(
    scopes === null ? [] : scopes.map((storeId) => ({ storeId }))
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireStaffEmailEditPermission", () => {
  it("本人は自分のスタッフ情報を変更できる", async () => {
    givenStaff({ userId: "user_self", storeIds: ["store_a"] });

    const scope = await requireStaffEmailEditPermission(
      "user_self",
      ORG,
      STAFF
    );

    expect(scope).toBe("SELF");
    // 本人判定で完結するため管理者チェックは行われない
    expect(mockDb.organizationMember.findFirst).not.toHaveBeenCalled();
  });

  it("オーナーは組織内のどのスタッフでも変更できる", async () => {
    givenStaff({ userId: null, storeIds: ["store_a"] });
    givenActor({ role: "OWNER" });

    const scope = await requireStaffEmailEditPermission(
      "user_owner",
      ORG,
      STAFF
    );

    expect(scope).toBe("OWNER");
  });

  it("店舗管理者は担当店舗に所属するスタッフを変更できる", async () => {
    givenStaff({ userId: null, storeIds: ["store_a"] });
    givenActor({ role: "ADMIN", scopedStoreIds: ["store_a"] });

    const scope = await requireStaffEmailEditPermission(
      "user_admin",
      ORG,
      STAFF
    );

    expect(scope).toBe("STORE_ADMIN");
  });

  it("複数店舗に所属するスタッフは、いずれか1店舗の管理者であれば変更できる", async () => {
    givenStaff({ userId: null, storeIds: ["store_a", "store_b"] });
    givenActor({ role: "ADMIN", scopedStoreIds: ["store_b"] });

    const scope = await requireStaffEmailEditPermission(
      "user_admin",
      ORG,
      STAFF
    );

    expect(scope).toBe("STORE_ADMIN");
  });

  it("担当外の店舗のスタッフは変更できない", async () => {
    givenStaff({ userId: null, storeIds: ["store_a"] });
    givenActor({ role: "ADMIN", scopedStoreIds: ["store_b"] });

    await expect(
      requireStaffEmailEditPermission("user_admin", ORG, STAFF)
    ).rejects.toThrow(/FORBIDDEN/);
  });

  it("スコープ未設定の管理者は店舗未所属のスタッフも変更できる", async () => {
    givenStaff({ userId: null, storeIds: [] });
    givenActor({ role: "ADMIN", scopedStoreIds: null });

    const scope = await requireStaffEmailEditPermission(
      "user_admin",
      ORG,
      STAFF
    );

    expect(scope).toBe("STORE_ADMIN");
  });

  it("スコープ付き管理者は店舗未所属のスタッフを変更できない", async () => {
    givenStaff({ userId: null, storeIds: [] });
    givenActor({ role: "ADMIN", scopedStoreIds: ["store_a"] });

    await expect(
      requireStaffEmailEditPermission("user_admin", ORG, STAFF)
    ).rejects.toThrow(/FORBIDDEN/);
  });

  it("他人のスタッフ情報は、組織メンバーでなければ変更できない", async () => {
    givenStaff({ userId: "user_other", storeIds: ["store_a"] });
    givenActor({ isMember: false });

    await expect(
      requireStaffEmailEditPermission("user_stranger", ORG, STAFF)
    ).rejects.toThrow(/FORBIDDEN/);
  });

  it("別組織のスタッフIDを指定しても変更できない", async () => {
    // organizationId スコープ付きで検索するため見つからない
    mockDb.staff.findFirst.mockResolvedValue(null);

    await expect(
      requireStaffEmailEditPermission("user_owner", ORG, "staff_other_org")
    ).rejects.toThrow(/NOT_FOUND/);
  });
});
