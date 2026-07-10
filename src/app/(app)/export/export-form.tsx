"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Download } from "lucide-react";

interface ExportFormProps {
  stores: { id: string; name: string }[];
  organizationId: string;
}

export function ExportForm({ stores, organizationId }: ExportFormProps) {
  const now = new Date();
  const firstDay = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
  const today = format(now, "yyyy-MM-dd");

  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo, setDateTo] = useState(today);
  const [storeId, setStoreId] = useState("");

  function buildDownloadUrl() {
    const params = new URLSearchParams({
      dateFrom,
      dateTo,
      ...(storeId ? { storeId } : {}),
    });
    return `/api/export/attendance?${params.toString()}`;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="export-from" className="block text-sm font-medium">
            開始日
          </label>
          <input
            id="export-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="export-to" className="block text-sm font-medium">
            終了日
          </label>
          <input
            id="export-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="export-store" className="block text-sm font-medium">
          店舗
        </label>
        <select
          id="export-store"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">すべての店舗</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <a
        href={buildDownloadUrl()}
        download={`勤怠_${dateFrom}_${dateTo}.csv`}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
      >
        <Download className="size-4" aria-hidden="true" />
        CSVをダウンロード
      </a>
    </div>
  );
}
