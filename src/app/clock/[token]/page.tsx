import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ja } from "date-fns/locale";
import { Clock, User } from "lucide-react";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ClockPage({ params }: PageProps) {
  const { token } = await params;

  const clockUrl = await db.storeClockUrl.findFirst({
    where: { token, isActive: true },
    include: {
      store: {
        include: {
          organization: { select: { id: true, name: true, timezone: true } },
          staffStores: {
            where: {
              isActive: true,
              canClock: true,
              staff: { status: "ACTIVE" },
            },
            include: { staff: { select: { id: true, displayName: true } } },
            orderBy: { staff: { displayName: "asc" } },
          },
        },
      },
    },
  });

  if (!clockUrl || (clockUrl.expiresAt && clockUrl.expiresAt < new Date())) {
    redirect("/clock/invalid");
  }

  const store = clockUrl.store;
  const timezone = store.organization.timezone ?? "Asia/Tokyo";
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  const displayDate = format(zonedNow, "yyyy年M月d日（E）", { locale: ja });
  const displayTime = format(zonedNow, "HH:mm");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{store.name}</h1>
            <p className="text-sm text-gray-500">{displayDate}</p>
          </div>
          <div className="flex items-center gap-2 text-3xl font-bold text-blue-600 tabular-nums">
            <Clock className="size-7 text-blue-400" aria-hidden="true" />
            <span aria-label={`現在時刻 ${displayTime}`}>{displayTime}</span>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        <p className="text-center text-gray-600 mb-6 text-lg">
          スタッフを選択してください
        </p>

        {store.staffStores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <User className="size-16 text-gray-300 mb-4" aria-hidden="true" />
            <p className="text-gray-500 text-lg">打刻可能なスタッフがいません</p>
            <p className="text-gray-400 text-sm mt-2">
              管理者にお問い合わせください
            </p>
          </div>
        ) : (
          <ul
            className="grid grid-cols-2 gap-4 sm:grid-cols-3"
            role="list"
            aria-label="スタッフ一覧"
          >
            {store.staffStores.map(({ staff }) => (
              <li key={staff.id}>
                <Link
                  href={`/clock/${token}/pin?staffId=${staff.id}`}
                  className="flex flex-col items-center justify-center min-h-[120px] rounded-2xl bg-white shadow-md border-2 border-transparent hover:border-blue-400 hover:shadow-lg active:scale-95 transition-all duration-150 p-4 text-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                  aria-label={`${staff.displayName}を選択`}
                >
                  <span
                    className="flex items-center justify-center size-12 rounded-full bg-blue-100 text-blue-600 text-xl font-bold mb-3"
                    aria-hidden="true"
                  >
                    {staff.displayName.charAt(0)}
                  </span>
                  <span className="text-base font-semibold text-gray-800 leading-tight">
                    {staff.displayName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="py-4 text-center text-xs text-gray-400">
        {store.organization.name}
      </footer>
    </div>
  );
}
