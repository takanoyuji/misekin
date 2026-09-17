"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateLocationSettings } from "@/actions/store";
import { Check, Crosshair, Loader2, MapPin } from "lucide-react";

interface Props {
  organizationId: string;
  storeId: string;
  initialEnabled: boolean;
  initialLatitude: number | null;
  initialLongitude: number | null;
  initialRadius: number | null;
}

/** 座標は小数6桁（約10cm）まで持てば十分。それ以上は測位誤差に埋もれる */
const COORD_DIGITS = 6;

export function LocationSettingsForm({
  organizationId,
  storeId,
  initialEnabled,
  initialLatitude,
  initialLongitude,
  initialRadius,
}: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [latitude, setLatitude] = useState(
    initialLatitude?.toString() ?? ""
  );
  const [longitude, setLongitude] = useState(
    initialLongitude?.toString() ?? ""
  );
  const [radius, setRadius] = useState(initialRadius?.toString() ?? "");
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUseCurrentPosition() {
    if (!navigator.geolocation) {
      setMessage({
        type: "error",
        text: "この端末では位置を取得できません。緯度・経度を手で入れてください",
      });
      return;
    }
    setMessage(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(COORD_DIGITS));
        setLongitude(position.coords.longitude.toFixed(COORD_DIGITS));
        setLocating(false);
        setMessage({
          type: "success",
          text: `現在地を入れました（測位誤差 約${Math.round(position.coords.accuracy)}m）。保存はまだです`,
        });
      },
      () => {
        setLocating(false);
        setMessage({
          type: "error",
          text: "現在地を取得できませんでした。緯度・経度を手で入れてください",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const lat = latitude.trim() === "" ? null : Number(latitude);
    const lng = longitude.trim() === "" ? null : Number(longitude);
    const rad = radius.trim() === "" ? null : Number(radius);

    if ((lat !== null && Number.isNaN(lat)) || (lng !== null && Number.isNaN(lng))) {
      setMessage({ type: "error", text: "緯度・経度は数値で入れてください" });
      return;
    }
    if (rad !== null && !Number.isInteger(rad)) {
      setMessage({ type: "error", text: "判定距離は整数(m)で入れてください" });
      return;
    }

    startTransition(async () => {
      const result = await updateLocationSettings(organizationId, storeId, {
        locationTrackingEnabled: enabled,
        latitude: lat,
        longitude: lng,
        geofenceRadiusMeters: rad,
      });
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({ type: "success", text: "位置設定を保存しました" });
      router.refresh();
    });
  }

  const judging = enabled && latitude && longitude && radius;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2">
        <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-base font-semibold">打刻の位置</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        打刻した瞬間の位置を記録します。位置が離れていても打刻はできます。
        離れた打刻には勤怠にフラグが付くので、締めの前に確認してください。
      </p>

      {/* 記録のON/OFF */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
        <div>
          <span className="text-sm font-medium">位置情報を記録する</span>
          <p className="text-xs text-muted-foreground">
            オフの間は取得も保存もしません（既定はオフ）
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled((v) => !v)}
          disabled={isPending}
          role="switch"
          aria-checked={enabled}
          aria-label="位置情報の記録を切り替える"
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 ${
            enabled ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        >
          <span
            className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* 店舗の座標 */}
      <fieldset className="space-y-2" disabled={!enabled || isPending}>
        <legend className="text-sm font-medium">店舗の座標</legend>
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <label htmlFor="store-latitude" className="block text-xs text-muted-foreground">
              緯度
            </label>
            <input
              id="store-latitude"
              type="text"
              inputMode="decimal"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="35.729503"
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-numeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label htmlFor="store-longitude" className="block text-xs text-muted-foreground">
              経度
            </label>
            <input
              id="store-longitude"
              type="text"
              inputMode="decimal"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="139.711086"
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-numeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleUseCurrentPosition}
          disabled={!enabled || isPending || locating}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          {locating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Crosshair className="size-4" aria-hidden="true" />
          )}
          店舗で開いて現在地を入れる
        </button>
      </fieldset>

      {/* 判定距離 */}
      <fieldset className="space-y-1" disabled={!enabled || isPending}>
        <label htmlFor="geofence-radius" className="block text-sm font-medium">
          判定距離（m）
        </label>
        <input
          id="geofence-radius"
          type="number"
          min={20}
          max={5000}
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          placeholder="空欄 = 記録だけして判定しない"
          className="min-h-11 w-56 rounded-md border border-input bg-background px-3 text-sm font-numeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
        <p className="text-xs text-muted-foreground">
          まずは空欄のまま1ヶ月ほど記録し、実際の距離のばらつきを見てから決めてください。
          ビルの中では測位が数百m単位でずれます。距離から測位誤差を引いてもなお超えたときだけフラグが付きます。
        </p>
      </fieldset>

      {/* 今の状態 */}
      <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        現在:{" "}
        {!enabled
          ? "記録しない"
          : judging
            ? `記録して ${radius}m を超えたらフラグを立てる`
            : "記録のみ（フラグは立てない）"}
      </p>

      {message && (
        <p
          className={`text-sm ${
            message.type === "success" ? "text-green-600" : "text-destructive"
          }`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}

      <Link
        href={`/attendance/location?storeId=${storeId}`}
        className="block text-sm text-primary underline underline-offset-4"
      >
        記録した位置の分布を見る（判定距離を決める材料）
      </Link>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Check className="size-4" aria-hidden="true" />
        )}
        保存する
      </button>
    </form>
  );
}
