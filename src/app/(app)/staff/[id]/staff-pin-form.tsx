"use client";

import { useState, useTransition } from "react";
import {
  setStaffPin,
  updateStaffStoreRequirePin,
  updateStaffStoreSkipLocationCheck,
} from "@/actions/staff";
import { KeyRound, Check, X, Loader2 } from "lucide-react";

interface StaffPinFormProps {
  staffId: string;
  organizationId: string;
  storeId: string;
  storeName: string;
  hasPinSet: boolean;
  requirePin: boolean;
  /** 店舗で位置の記録が有効なときだけ、除外トグルを出す */
  locationTrackingEnabled: boolean;
  skipLocationCheck: boolean;
}

export function StaffPinForm({
  staffId,
  organizationId,
  storeId,
  storeName,
  hasPinSet,
  requirePin,
  locationTrackingEnabled,
  skipLocationCheck,
}: StaffPinFormProps) {
  const [showPinInput, setShowPinInput] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [currentHasPinSet, setCurrentHasPinSet] = useState(hasPinSet);
  const [currentRequirePin, setCurrentRequirePin] = useState(requirePin);
  const [currentSkipLocation, setCurrentSkipLocation] =
    useState(skipLocationCheck);

  function clearMessage() {
    setMessage(null);
  }

  function handleSetPin() {
    if (!pinValue) {
      setMessage({ type: "error", text: "PINを入力してください" });
      return;
    }
    clearMessage();
    startTransition(async () => {
      const result = await setStaffPin(organizationId, staffId, storeId, pinValue);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "PINを設定しました" });
        setCurrentHasPinSet(true);
        setPinValue("");
        setShowPinInput(false);
      }
    });
  }

  function handleDeletePin() {
    clearMessage();
    startTransition(async () => {
      const result = await setStaffPin(organizationId, staffId, storeId, null);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "PINを削除しました" });
        setCurrentHasPinSet(false);
        setShowPinInput(false);
      }
    });
  }

  function handleToggleRequirePin() {
    const newValue = !currentRequirePin;
    clearMessage();
    startTransition(async () => {
      const result = await updateStaffStoreRequirePin(organizationId, staffId, storeId, newValue);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setCurrentRequirePin(newValue);
        setMessage({
          type: "success",
          text: newValue ? "PIN必須に設定しました" : "PIN任意に設定しました",
        });
      }
    });
  }

  function handleToggleSkipLocation() {
    const newValue = !currentSkipLocation;
    clearMessage();
    startTransition(async () => {
      const result = await updateStaffStoreSkipLocationCheck(
        organizationId,
        staffId,
        storeId,
        newValue
      );
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setCurrentSkipLocation(newValue);
        setMessage({
          type: "success",
          text: newValue
            ? "位置チェックの対象外にしました"
            : "位置チェックの対象に戻しました",
        });
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
      {/* 店舗名ヘッダー */}
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium">{storeName}</span>
      </div>

      {/* PIN状態 */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">PIN状態</span>
        <span
          className={
            currentHasPinSet
              ? "text-green-600 font-medium"
              : "text-muted-foreground"
          }
        >
          {currentHasPinSet ? "設定済み" : "未設定"}
        </span>
      </div>

      {/* PIN必須トグル */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">PIN必須</span>
        <button
          type="button"
          onClick={handleToggleRequirePin}
          disabled={isPending}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            currentRequirePin ? "bg-primary" : "bg-muted-foreground/30"
          }`}
          role="switch"
          aria-checked={currentRequirePin}
          aria-label="PIN必須を切り替える"
        >
          <span
            className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform ${
              currentRequirePin ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* 位置チェックの対象外（リモート出勤など、店舗にいないことが正常なスタッフ） */}
      {locationTrackingEnabled && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            位置チェックの対象外
            <span className="block text-xs">リモート出勤など</span>
          </span>
          <button
            type="button"
            onClick={handleToggleSkipLocation}
            disabled={isPending}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              currentSkipLocation ? "bg-primary" : "bg-muted-foreground/30"
            }`}
            role="switch"
            aria-checked={currentSkipLocation}
            aria-label="位置チェックの対象外を切り替える"
          >
            <span
              className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform ${
                currentSkipLocation ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            clearMessage();
            setShowPinInput((v) => !v);
            setPinValue("");
          }}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
        >
          {showPinInput ? "キャンセル" : currentHasPinSet ? "PINを変更" : "PINを設定"}
        </button>

        {currentHasPinSet && (
          <button
            type="button"
            onClick={handleDeletePin}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : (
              <X className="size-3" aria-hidden="true" />
            )}
            PINを削除
          </button>
        )}
      </div>

      {/* PIN入力フィールド */}
      {showPinInput && (
        <div className="flex gap-2 items-center pt-1">
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{4,8}"
            maxLength={8}
            placeholder="4〜8桁の数字"
            value={pinValue}
            onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
            disabled={isPending}
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 font-mono tracking-widest"
            aria-label="新しいPIN"
          />
          <button
            type="button"
            onClick={handleSetPin}
            disabled={isPending || pinValue.length < 4}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-3" aria-hidden="true" />
            )}
            設定
          </button>
        </div>
      )}

      {/* メッセージ */}
      {message && (
        <p
          className={`text-xs ${
            message.type === "success" ? "text-green-600" : "text-destructive"
          }`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
