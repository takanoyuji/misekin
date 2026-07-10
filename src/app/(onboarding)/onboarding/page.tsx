"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { onboardingSchema, type OnboardingInput } from "@/lib/validations/organization";
import { createOrganizationWithStore } from "@/actions/organization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, Store, Clock, CheckCircle } from "lucide-react";

const STEPS = [
  {
    id: 1,
    title: "組織を作成",
    description: "会社・グループの名前を入力してください",
    icon: Building2,
  },
  {
    id: 2,
    title: "最初の店舗を作成",
    description: "最初の店舗名を入力してください",
    icon: Store,
  },
  {
    id: 3,
    title: "営業時間の設定",
    description: "深夜営業に対応した営業日の切替時刻を設定してください",
    icon: Clock,
  },
];

const TIMEZONES = [
  { value: "Asia/Tokyo", label: "日本標準時 (JST)" },
  { value: "Asia/Seoul", label: "韓国標準時 (KST)" },
  { value: "Asia/Shanghai", label: "中国標準時 (CST)" },
  { value: "UTC", label: "UTC" },
];

const DAY_CHANGE_HOURS = Array.from({ length: 13 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, "0")}:00`,
}));

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      organizationName: "",
      storeName: "",
      timezone: "Asia/Tokyo",
      dayChangeHour: 6,
      dayChangeMinute: 0,
    },
  });

  const watchedValues = watch();

  async function onSubmit(data: OnboardingInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await createOrganizationWithStore(data);
      if (result.error) {
        setServerError(result.error);
      } else {
        router.push("/dashboard");
      }
    });
  }

  const CurrentIcon = STEPS[step - 1]?.icon ?? Building2;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary">みせ勤</h1>
          <p className="text-sm text-muted-foreground mt-1">初期設定</p>
        </div>

        {/* ステップインジケーター */}
        <div className="flex items-center justify-center mb-8 gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`flex size-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  step > s.id
                    ? "bg-primary text-primary-foreground"
                    : step === s.id
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                }`}
                aria-current={step === s.id ? "step" : undefined}
              >
                {step > s.id ? (
                  <CheckCircle className="size-4" aria-hidden="true" />
                ) : (
                  s.id
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-12 transition-colors ${step > s.id ? "bg-primary" : "bg-muted"}`}
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* ステップ1: 組織名 */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="size-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>組織を作成</CardTitle>
                    <CardDescription>
                      会社・グループの名前を入力してください
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {serverError && (
                  <div
                    role="alert"
                    className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
                  >
                    {serverError}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="organizationName">
                    組織名 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="organizationName"
                    placeholder="例: 株式会社みせ勤、コンカフェ〇〇"
                    aria-describedby={
                      errors.organizationName ? "org-name-error" : "org-name-hint"
                    }
                    aria-invalid={!!errors.organizationName}
                    {...register("organizationName")}
                  />
                  {errors.organizationName ? (
                    <p id="org-name-error" role="alert" className="text-xs text-destructive">
                      {errors.organizationName.message}
                    </p>
                  ) : (
                    <p id="org-name-hint" className="text-xs text-muted-foreground">
                      複数店舗を管理する組織・グループの名前です
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  className="w-full"
                  disabled={!watchedValues.organizationName?.trim()}
                  onClick={() => setStep(2)}
                >
                  次へ
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ステップ2: 店舗名 */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                    <Store className="size-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>最初の店舗を作成</CardTitle>
                    <CardDescription>
                      後から店舗を追加することができます
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="storeName">
                    店舗名 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="storeName"
                    placeholder="例: 新宿店、本店"
                    aria-describedby={errors.storeName ? "store-name-error" : undefined}
                    aria-invalid={!!errors.storeName}
                    {...register("storeName")}
                  />
                  {errors.storeName && (
                    <p id="store-name-error" role="alert" className="text-xs text-destructive">
                      {errors.storeName.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="timezone">タイムゾーン</Label>
                  <select
                    id="timezone"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    {...register("timezone")}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep(1)}
                  >
                    戻る
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={!watchedValues.storeName?.trim()}
                    onClick={() => setStep(3)}
                  >
                    次へ
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ステップ3: 営業時間設定 */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                    <Clock className="size-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>営業日の切替時刻</CardTitle>
                    <CardDescription>
                      深夜勤務の営業日判定に使用します
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">例：切替時刻 = 06:00</p>
                  <p>• 7/10 23:00 出勤 → 勤務日は 7/10</p>
                  <p>• 7/11 05:00 退勤 → 同じく 7/10 の勤務</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dayChangeHour">
                    切替時刻
                  </Label>
                  <select
                    id="dayChangeHour"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    {...register("dayChangeHour", { valueAsNumber: true })}
                  >
                    {DAY_CHANGE_HOURS.map((h) => (
                      <option key={h.value} value={h.value}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    初期値は 06:00 です。深夜営業がない場合は 00:00 でも構いません
                  </p>
                </div>

                {/* 確認まとめ */}
                <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
                  <p className="font-medium text-foreground">設定内容の確認</p>
                  <div className="grid grid-cols-2 gap-y-1 text-muted-foreground">
                    <span>組織名</span>
                    <span className="text-foreground font-medium">{watchedValues.organizationName}</span>
                    <span>店舗名</span>
                    <span className="text-foreground font-medium">{watchedValues.storeName}</span>
                    <span>タイムゾーン</span>
                    <span className="text-foreground font-medium">
                      {TIMEZONES.find((t) => t.value === watchedValues.timezone)?.label}
                    </span>
                    <span>切替時刻</span>
                    <span className="text-foreground font-medium">
                      {String(watchedValues.dayChangeHour ?? 6).padStart(2, "0")}:00
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep(2)}
                    disabled={isPending}
                  >
                    戻る
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isPending}
                    aria-busy={isPending}
                  >
                    {isPending ? "作成中..." : "みせ勤を開始する"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </form>
      </div>
    </div>
  );
}
