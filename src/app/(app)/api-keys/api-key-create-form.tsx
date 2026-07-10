"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createApiKey } from "@/actions/api-key";

interface Store {
  id: string;
  name: string;
}

interface ApiKeyCreateFormProps {
  organizationId: string;
  stores: Store[];
}

export function ApiKeyCreateForm({
  organizationId,
  stores,
}: ApiKeyCreateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isReadOnly, setIsReadOnly] = useState(true);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createApiKey(organizationId, {
        name,
        description: description || undefined,
        isReadOnly,
        storeScope: selectedStores.length > 0 ? selectedStores : undefined,
        expiresAt: expiresAt || undefined,
      });
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        const data = result.data as { rawKey: string };
        setCreatedRawKey(data.rawKey);
        router.refresh();
      }
    });
  };

  const handleCopy = async () => {
    if (!createdRawKey) return;
    await navigator.clipboard.writeText(createdRawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setIsOpen(false);
    setCreatedRawKey(null);
    setCopied(false);
    setName("");
    setDescription("");
    setIsReadOnly(true);
    setSelectedStores([]);
    setExpiresAt("");
    setError(null);
  };

  const toggleStore = (storeId: string) => {
    setSelectedStores((prev) =>
      prev.includes(storeId)
        ? prev.filter((id) => id !== storeId)
        : [...prev, storeId]
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50 transition-colors"
      >
        <span aria-hidden="true">+</span>
        APIキーを発行
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-api-key-title"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            {createdRawKey ? (
              /* 発行完了: キー表示画面 */
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-green-100 text-green-600 text-lg">
                    ✓
                  </span>
                  <h2
                    id="create-api-key-title"
                    className="text-lg font-bold text-gray-900"
                  >
                    APIキーを発行しました
                  </h2>
                </div>
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
                  このキーは今後表示されません。今すぐコピーして安全な場所に保存してください。
                </p>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 mb-6">
                  <code className="flex-1 text-xs text-gray-800 break-all font-mono">
                    {createdRawKey}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {copied ? "コピー済み" : "コピー"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
                >
                  閉じる
                </button>
              </div>
            ) : (
              /* 発行フォーム */
              <form onSubmit={handleSubmit}>
                <h2
                  id="create-api-key-title"
                  className="text-lg font-bold text-gray-900 mb-5"
                >
                  APIキーを発行
                </h2>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="api-key-name"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      キー名
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      id="api-key-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="例: 外部連携システム"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="api-key-description"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      説明
                    </label>
                    <textarea
                      id="api-key-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="このキーの用途を記載してください"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      アクセス権限
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isReadOnly}
                        onChange={(e) => setIsReadOnly(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">読み取り専用</span>
                    </label>
                  </div>

                  {stores.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        店舗スコープ
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        選択しない場合はすべての店舗にアクセス可能です
                      </p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg border border-gray-200 p-3">
                        {stores.map((store) => (
                          <label
                            key={store.id}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedStores.includes(store.id)}
                              onChange={() => toggleStore(store.id)}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700">
                              {store.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="api-key-expires"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      有効期限
                    </label>
                    <input
                      id="api-key-expires"
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      空欄の場合は無期限です
                    </p>
                  </div>
                </div>

                {error && (
                  <p className="mt-4 text-sm text-red-600" role="alert">
                    {error}
                  </p>
                )}

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isPending}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || !name}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    {isPending ? "発行中..." : "発行する"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
