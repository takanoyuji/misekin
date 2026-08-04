import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * スタッフへのアクセス制御。
 *
 * 勤怠・締め処理・シフトは店舗スコープで絞られているのに、
 * スタッフの基本情報と時給だけ組織全体に開いていた。その回帰を防ぐ。
 */

const db = {
  staff: { findFirst: vi.fn() },
  staffStore: { findFirst: vi.fn() },
  organizationMember: { findFirst: vi.fn() },
  // canAccessStore は count + findFirst、getAccessibleStoreIds は findMany を使う
  storeAdmin: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db }));

const { requireStaffAccess, requireStaffStoreScope } = await import(
  "@/lib/auth/permissions"
);

/** 組織メンバーの状態を用意する */
function asMember(role: "OWNER" | "ADMIN", scopeStoreIds: string[]) {
  db.organizationMember.findFirst.mockResolvedValue({
    id: "member1",
    userId: "u1",
    organizationId: "org1",
    role,
    isActive: true,
  });
  db.storeAdmin.findMany.mockResolvedValue(
    scopeStoreIds.map((storeId) => ({ storeId }))
  );
  db.storeAdmin.count.mockResolvedValue(scopeStoreIds.length);
  db.storeAdmin.findFirst.mockImplementation(
    async ({ where }: { where: { storeId: string } }) =>
      scopeStoreIds.includes(where.storeId) ? { id: "scope1" } : null
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireStaffAccess", () => {
  it("オーナーは組織内のどのスタッフも操作できる", async () => {
    asMember("OWNER", []);
    db.staff.findFirst.mockResolvedValue({
      userId: null,
      staffStores: [{ storeId: "storeB" }],
    });
    await expect(
      requireStaffAccess("u1", "org1", "staff1")
    ).resolves.toBeUndefined();
  });

  it("担当店舗のスタッフは操作できる", async () => {
    asMember("ADMIN", ["storeA"]);
    db.staff.findFirst.mockResolvedValue({
      userId: null,
      staffStores: [{ storeId: "storeA" }],
    });
    await expect(
      requireStaffAccess("u1", "org1", "staff1")
    ).resolves.toBeUndefined();
  });

  it("担当外の店舗のスタッフは拒否する", async () => {
    asMember("ADMIN", ["storeA"]);
    db.staff.findFirst.mockResolvedValue({
      userId: null,
      staffStores: [{ storeId: "storeB" }],
    });
    await expect(requireStaffAccess("u1", "org1", "staff1")).rejects.toThrow(
      /FORBIDDEN/
    );
  });

  it("スコープ未設定の管理者は全店舗を操作できる", async () => {
    asMember("ADMIN", []);
    db.staff.findFirst.mockResolvedValue({
      userId: null,
      staffStores: [{ storeId: "storeB" }],
    });
    await expect(
      requireStaffAccess("u1", "org1", "staff1")
    ).resolves.toBeUndefined();
  });

  it("本人は担当店舗に関係なく自分を操作できる", async () => {
    asMember("ADMIN", ["storeA"]);
    db.staff.findFirst.mockResolvedValue({
      userId: "u1",
      staffStores: [{ storeId: "storeB" }],
    });
    await expect(
      requireStaffAccess("u1", "org1", "staff1")
    ).resolves.toBeUndefined();
  });

  it("他組織のスタッフIDは見つからない扱いにする", async () => {
    db.staff.findFirst.mockResolvedValue(null);
    await expect(requireStaffAccess("u1", "org1", "staff1")).rejects.toThrow(
      /NOT_FOUND/
    );
  });
});

describe("requireStaffStoreScope", () => {
  it("他組織の staffStoreId は弾く（時給の書き込み防止）", async () => {
    // where に store.organizationId を入れているので、他組織のIDは null で返る
    db.staffStore.findFirst.mockResolvedValue(null);
    await expect(
      requireStaffStoreScope("u1", "org1", "otherOrgStaffStore")
    ).rejects.toThrow(/NOT_FOUND/);
  });

  it("担当外の店舗の所属は弾く", async () => {
    db.staffStore.findFirst.mockResolvedValue({
      staffId: "staff1",
      storeId: "storeB",
    });
    asMember("ADMIN", ["storeA"]);
    await expect(
      requireStaffStoreScope("u1", "org1", "ss1")
    ).rejects.toThrow(/FORBIDDEN/);
  });

  it("担当店舗の所属は通す", async () => {
    db.staffStore.findFirst.mockResolvedValue({
      staffId: "staff1",
      storeId: "storeA",
    });
    asMember("ADMIN", ["storeA"]);
    await expect(requireStaffStoreScope("u1", "org1", "ss1")).resolves.toEqual({
      staffId: "staff1",
      storeId: "storeA",
    });
  });
});
