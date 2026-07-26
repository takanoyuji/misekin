"use client";

export interface StoreOption {
  id: string;
  name: string;
}

/**
 * 担当店舗の選択UI。
 * value === null … 全店舗（スコープなし）
 * value === string[] … 指定店舗のみ
 */
export function StoreScopePicker({
  stores,
  value,
  onChange,
  idPrefix,
}: {
  stores: StoreOption[];
  value: string[] | null;
  onChange: (v: string[] | null) => void;
  idPrefix: string;
}) {
  const isAll = value === null;

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isAll}
          onChange={(e) => onChange(e.target.checked ? null : [])}
          className="size-4 rounded border-input"
        />
        全店舗を管理する
      </label>

      {!isAll && (
        <fieldset className="space-y-1.5 rounded-md border border-border p-3">
          <legend className="px-1 text-xs text-muted-foreground">
            担当する店舗を選択
          </legend>
          {stores.length === 0 ? (
            <p className="text-xs text-muted-foreground">店舗がありません</p>
          ) : (
            stores.map((s) => {
              const checked = value!.includes(s.id);
              return (
                <label
                  key={s.id}
                  htmlFor={`${idPrefix}-${s.id}`}
                  className="flex min-h-9 items-center gap-2 text-sm"
                >
                  <input
                    id={`${idPrefix}-${s.id}`}
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) onChange([...value!, s.id]);
                      else onChange(value!.filter((x) => x !== s.id));
                    }}
                    className="size-4 rounded border-input"
                  />
                  {s.name}
                </label>
              );
            })
          )}
        </fieldset>
      )}
    </div>
  );
}
