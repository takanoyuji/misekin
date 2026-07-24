/**
 * シフト自動生成ソルバー（Python OR-Tools マイクロサービス）のクライアント
 *
 * 戦略レポート §5 の設計A→C。割当ての生成はソルバーが担い、
 * Next 側は入力を渡して結果（スタッフ×営業日の割当て）を受け取るだけ。
 */

const SOLVER_URL = process.env.SHIFT_SOLVER_URL ?? "http://localhost:8000";

export interface SolverAvailability {
  staffId: string;
  businessDate: string;
  type: "AVAILABLE" | "UNAVAILABLE" | "PREFERRED";
}

export interface SolverRequirement {
  businessDate: string;
  requiredCount: number;
}

export interface SolverRule {
  ruleType: string;
  weight: "HARD" | "SOFT";
  minGapDays?: number | null;
  maxPerWeek?: number | null;
  minPerWeek?: number | null;
}

export interface SolveInput {
  days: string[];
  staffIds: string[];
  availabilities: SolverAvailability[];
  requirements: SolverRequirement[];
  rules: SolverRule[];
  maxSeconds?: number;
}

export interface SolveResult {
  status: "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "NO_REQUIREMENT";
  assignments: { staffId: string; businessDate: string }[];
  unmet: { businessDate: string; required: number; assigned: number }[];
  message: string;
}

export async function solveShifts(input: SolveInput): Promise<SolveResult> {
  let res: Response;
  try {
    res = await fetch(`${SOLVER_URL}/solve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ maxSeconds: 10, ...input }),
      // ソルバーは重い場合があるので長めに待つ
      signal: AbortSignal.timeout(40_000),
    });
  } catch {
    throw new Error(
      "自動生成サービスに接続できませんでした。ソルバーが起動しているか確認してください。"
    );
  }

  if (!res.ok) {
    throw new Error(`自動生成に失敗しました（${res.status}）`);
  }

  return (await res.json()) as SolveResult;
}
