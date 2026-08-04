/**
 * 「スタッフを管理者として招待」が実際に通るかを確認する（ローカル検証用）
 *
 * 招待の送信側は auth() を必要とするのでスクリプトからは呼べない。
 * ここでは送信側がDBに書く内容を再現したうえで、**受諾処理を本物のまま呼び**、
 *   - OrganizationMember が ADMIN で作られるか
 *   - 指定した担当店舗が StoreAdmin に展開されるか
 *   - invitedRole / invitedStoreIds がクリアされるか
 * を確かめる。確認後はテストデータを消す。
 *
 *   npx tsx scripts/verify-admin-invite.ts
 */
import { db } from "../src/lib/db";
import { acceptStaffInvitation } from "../src/actions/invitation";

const ORG_NAME = "合同会社データロー";
const TEST_EMAIL = "invite-check@example.invalid";
const TEST_NAME = "招待テスト";

function ok(label: string, cond: boolean, detail = "") {
  console.log(`${cond ? "  OK  " : "  NG  "} ${label}${detail ? ` … ${detail}` : ""}`);
  return cond;
}

async function cleanup(orgId: string) {
  const user = await db.user.findUnique({ where: { email: TEST_EMAIL }, select: { id: true } });
  if (user) {
    const members = await db.organizationMember.findMany({
      where: { userId: user.id },
      select: { id: true },
    });
    await db.storeAdmin.deleteMany({
      where: { organizationMemberId: { in: members.map((m) => m.id) } },
    });
    await db.organizationMember.deleteMany({ where: { userId: user.id } });
  }
  const staff = await db.staff.findFirst({
    where: { organizationId: orgId, email: TEST_EMAIL },
    select: { id: true },
  });
  if (staff) {
    await db.staffStore.deleteMany({ where: { staffId: staff.id } });
    await db.staff.delete({ where: { id: staff.id } });
  }
  if (user) await db.user.delete({ where: { id: user.id } });
  await db.verificationToken.deleteMany({ where: { identifier: TEST_EMAIL } });
}

async function main() {
  const org = await db.organization.findFirst({
    where: { name: ORG_NAME },
    select: { id: true, stores: { select: { id: true, code: true, name: true } } },
  });
  if (!org) throw new Error(`組織「${ORG_NAME}」がありません`);
  const exhale = org.stores.find((s) => s.code === "EXHALE");
  const other = org.stores.find((s) => s.code !== "EXHALE");
  if (!exhale || !other) throw new Error("店舗が足りません");

  await cleanup(org.id);
  console.log(`対象組織: ${ORG_NAME} / 担当店舗に指定: ${exhale.name}\n`);

  // --- 送信側がDBに書く内容を再現（オーナーが「管理者として招待」を押した状態） ---
  const staff = await db.staff.create({
    data: {
      organizationId: org.id,
      displayName: TEST_NAME,
      email: TEST_EMAIL,
      status: "INVITED",
      invitedRole: "ADMIN",
      invitedStoreIds: [exhale.id],
    },
    select: { id: true },
  });
  const token = `verify-${Date.now()}`;
  await db.verificationToken.create({
    data: {
      identifier: TEST_EMAIL,
      token,
      type: "EMAIL_VERIFICATION",
      expires: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  // --- 受諾（本物の処理を呼ぶ） ---
  const result = await acceptStaffInvitation(token, "TestPass1234");
  let pass = ok("受諾が成功する", !!result.success, result.error ?? "");

  const after = await db.staff.findUnique({
    where: { id: staff.id },
    select: { userId: true, status: true, invitedRole: true, invitedStoreIds: true },
  });
  pass = ok("スタッフにアカウントが紐づく", !!after?.userId) && pass;
  pass = ok("在籍が ACTIVE になる", after?.status === "ACTIVE", String(after?.status)) && pass;

  const member = after?.userId
    ? await db.organizationMember.findFirst({
        where: { organizationId: org.id, userId: after.userId },
        select: { id: true, role: true, storeScopes: { select: { storeId: true } } },
      })
    : null;
  pass = ok("ADMIN として組織に参加する", member?.role === "ADMIN", String(member?.role)) && pass;

  const scopes = member?.storeScopes.map((s) => s.storeId) ?? [];
  pass = ok("担当店舗が1件だけ設定される", scopes.length === 1, `${scopes.length}件`) && pass;
  pass = ok("担当店舗が指定した店舗である", scopes[0] === exhale.id) && pass;
  pass = ok("担当外の店舗は含まれない", !scopes.includes(other.id)) && pass;

  pass = ok("invitedRole がクリアされる", after?.invitedRole === null, String(after?.invitedRole)) && pass;
  pass =
    ok("invitedStoreIds がクリアされる", (after?.invitedStoreIds ?? []).length === 0) && pass;

  await cleanup(org.id);
  console.log(`\n${pass ? "すべて通りました" : "失敗があります"}（テストデータは削除済み）`);
  if (!pass) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
