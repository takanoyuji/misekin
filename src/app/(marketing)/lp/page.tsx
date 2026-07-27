import { redirect } from "next/navigation";

import { DEFAULT_VERTICAL_SLUG } from "@/lib/verticals";

/** 旧URL。既定の版へ送る（外部から貼られたリンクを死なせないため） */
export default function LegacyLandingPage() {
  redirect(`/${DEFAULT_VERTICAL_SLUG}`);
}
