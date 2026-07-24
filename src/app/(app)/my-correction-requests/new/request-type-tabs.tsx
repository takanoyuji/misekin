"use client";

import { useState } from "react";

interface Props {
  /** 既存の勤怠を修正する申請フォーム */
  correctionForm: React.ReactNode;
  /** 打刻の付け忘れを申請するフォーム */
  missingForm: React.ReactNode;
}

const TABS = [
  { key: "correction", label: "打刻内容の修正" },
  { key: "missing", label: "打刻の付け忘れ" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function RequestTypeTabs({ correctionForm, missingForm }: Props) {
  const [active, setActive] = useState<TabKey>("correction");

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="申請の種類" className="flex gap-1 border-b border-border">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.key}`}
              onClick={() => setActive(tab.key)}
              className={`-mb-px min-h-11 border-b-2 px-4 text-sm font-medium transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
      >
        {active === "correction" ? correctionForm : missingForm}
      </div>
    </div>
  );
}
