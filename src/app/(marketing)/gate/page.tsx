import type { Metadata } from "next";

import { GateForm } from "./gate-form";

export const metadata: Metadata = {
  title: "みせ勤",
  robots: { index: false, follow: false },
};

/**
 * LPの合言葉入力
 *
 * 公開前のため、関係者だけに見せている。
 */
export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#FEF9FC] p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-xl font-bold text-[#3D3339]">みせ勤</h1>
        <p className="mt-2 text-center text-sm text-[#6E6269]">
          公開前のページです。合言葉を入れてください。
        </p>
        <GateForm next={next} />
      </div>
    </div>
  );
}
