import { describe, it, expect } from "vitest";
import { correctionRequestScopeWhere } from "@/lib/business/correction-request-scope";

describe("correctionRequestScopeWhere", () => {
  it("全店舗の管理者: 勤怠の組織 または 付け忘れ申請の店舗の組織 で絞る", () => {
    expect(correctionRequestScopeWhere("org1", null)).toEqual({
      OR: [
        { attendance: { organizationId: "org1" } },
        { attendanceId: null, store: { organizationId: "org1" } },
      ],
    });
  });

  it("店舗スコープ付きの管理者: 付け忘れ申請も担当店舗に絞る", () => {
    expect(correctionRequestScopeWhere("org1", ["s1", "s2"])).toEqual({
      OR: [
        { attendance: { organizationId: "org1", storeId: { in: ["s1", "s2"] } } },
        {
          attendanceId: null,
          store: { organizationId: "org1", id: { in: ["s1", "s2"] } },
        },
      ],
    });
  });
});
