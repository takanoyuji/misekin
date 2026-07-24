"""
シフト自動生成ソルバー（戦略レポート §5 設計A→C）

生成AIには割当てを作らせず、CP-SAT（Google OR-Tools）で組合せ最適化を解く。
- ハード制約: 勤務不可日には入れない / 連続勤務13日以内 / 必要人数の上限
- ソフト制約: 必要人数の充足 / 希望(PREFERRED)の優先 / 出勤間隔(SPACING) / 週上限・下限
解が見つからない場合(設計C)は、緩和して「満たせなかった必要人数」を返す。

割当ては「スタッフ×営業日」の2値。時刻は Next 側が既定値で埋める（希望・必要人数に時刻情報が無いため）。
"""

from datetime import date, timedelta
from typing import Literal

from fastapi import FastAPI
from ortools.sat.python import cp_model
from pydantic import BaseModel, Field

app = FastAPI(title="misekin shift solver")

# 法令由来（ハード）。シフト管理側の警告と同じ値。
MAX_CONSECUTIVE_DAYS = 13


class AvailabilityIn(BaseModel):
    staffId: str
    businessDate: str  # YYYY-MM-DD
    type: Literal["AVAILABLE", "UNAVAILABLE", "PREFERRED"]


class RequirementIn(BaseModel):
    businessDate: str
    requiredCount: int


class RuleIn(BaseModel):
    ruleType: str  # SPACING / MAX_SHIFTS_PER_WEEK / MIN_SHIFTS_PER_WEEK / ...
    weight: Literal["HARD", "SOFT"]
    # 該当パラメータのみ入る
    minGapDays: int | None = None
    maxPerWeek: int | None = None
    minPerWeek: int | None = None


class SolveRequest(BaseModel):
    days: list[str]  # 対象営業日（YYYY-MM-DD, 昇順想定）
    staffIds: list[str]
    availabilities: list[AvailabilityIn] = Field(default_factory=list)
    requirements: list[RequirementIn] = Field(default_factory=list)
    rules: list[RuleIn] = Field(default_factory=list)
    # ソルバーの最大計算時間（秒）
    maxSeconds: float = 10.0


class Assignment(BaseModel):
    staffId: str
    businessDate: str


class UnmetDay(BaseModel):
    businessDate: str
    required: int
    assigned: int


class SolveResponse(BaseModel):
    status: str  # OPTIMAL / FEASIBLE / INFEASIBLE / NO_REQUIREMENT
    assignments: list[Assignment]
    unmet: list[UnmetDay]  # 必要人数を満たせなかった日（設計C）
    message: str


def _consecutive_runs(day_indices: list[int]) -> list[list[int]]:
    """連続する日インデックスの区間を返す（[0,1,2,5,6] → [[0,1,2],[5,6]]）"""
    runs: list[list[int]] = []
    cur: list[int] = []
    for i in day_indices:
        if cur and i == cur[-1] + 1:
            cur.append(i)
        else:
            if cur:
                runs.append(cur)
            cur = [i]
    if cur:
        runs.append(cur)
    return runs


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/solve", response_model=SolveResponse)
def solve(req: SolveRequest) -> SolveResponse:
    days = req.days
    staff = req.staffIds
    if not days or not staff:
        return SolveResponse(
            status="NO_REQUIREMENT",
            assignments=[],
            unmet=[],
            message="対象の日またはスタッフがありません",
        )

    day_index = {d: i for i, d in enumerate(days)}
    n_days = len(days)

    # 必要人数（未設定日は0）
    required = {day_index[r.businessDate]: r.requiredCount for r in req.requirements if r.businessDate in day_index}

    # 勤務不可・希望のマップ
    unavailable: set[tuple[str, int]] = set()
    preferred: set[tuple[str, int]] = set()
    for a in req.availabilities:
        if a.businessDate not in day_index:
            continue
        di = day_index[a.businessDate]
        if a.type == "UNAVAILABLE":
            unavailable.add((a.staffId, di))
        elif a.type == "PREFERRED":
            preferred.add((a.staffId, di))

    if sum(required.values()) == 0:
        return SolveResponse(
            status="NO_REQUIREMENT",
            assignments=[],
            unmet=[],
            message="必要人数が設定されていません。先に必要人数を入力してください。",
        )

    model = cp_model.CpModel()

    # x[s, d] = そのスタッフをその日に割り当てるか
    x: dict[tuple[str, int], cp_model.IntVar] = {}
    for s in staff:
        for d in range(n_days):
            x[(s, d)] = model.NewBoolVar(f"x_{s}_{d}")

    # ハード: 勤務不可日には入れない
    for (s, d) in unavailable:
        model.Add(x[(s, d)] == 0)

    # ハード: 連続勤務13日以内（対象期間の連続営業日ウィンドウで制約）
    consecutive_runs = _consecutive_runs(list(range(n_days)))
    for s in staff:
        for run in consecutive_runs:
            if len(run) > MAX_CONSECUTIVE_DAYS:
                for start in range(len(run) - MAX_CONSECUTIVE_DAYS):
                    window = run[start : start + MAX_CONSECUTIVE_DAYS + 1]
                    model.Add(sum(x[(s, d)] for d in window) <= MAX_CONSECUTIVE_DAYS)

    # ルール適用
    hard_spacing: list[int] = []
    soft_spacing: list[int] = []
    max_per_week: dict[str, int] = {}
    min_per_week: dict[str, int] = {}
    for rule in req.rules:
        if rule.ruleType == "SPACING" and rule.minGapDays and rule.minGapDays >= 1:
            (hard_spacing if rule.weight == "HARD" else soft_spacing).append(rule.minGapDays)
        elif rule.ruleType == "MAX_SHIFTS_PER_WEEK" and rule.maxPerWeek is not None:
            max_per_week[rule.weight] = rule.maxPerWeek
        elif rule.ruleType == "MIN_SHIFTS_PER_WEEK" and rule.minPerWeek is not None:
            min_per_week[rule.weight] = rule.minPerWeek

    # ハードSPACING: 間隔未満の2日を同時に割り当てない
    for gap in set(hard_spacing):
        for s in staff:
            for d in range(n_days):
                for d2 in range(d + 1, min(n_days, d + gap)):
                    model.Add(x[(s, d)] + x[(s, d2)] <= 1)

    # ハード週上限（対象期間全体を7日窓で評価）
    if "HARD" in max_per_week:
        cap = max_per_week["HARD"]
        for s in staff:
            for start in range(max(1, n_days - 6)):
                window = range(start, min(n_days, start + 7))
                model.Add(sum(x[(s, d)] for d in window) <= cap)

    # 各日の割当は必要人数を上限とする（過剰配置しない）
    for d in range(n_days):
        req_d = required.get(d, 0)
        model.Add(sum(x[(s, d)] for s in staff) <= max(req_d, 0))

    # 目的関数の項
    objective_terms = []

    # 充足（最重要）: 各日の割当数が必要人数に届くほど加点
    W_FILL = 100
    for d in range(n_days):
        req_d = required.get(d, 0)
        if req_d > 0:
            for s in staff:
                objective_terms.append(W_FILL * x[(s, d)])

    # 希望(PREFERRED)の優先
    W_PREF = 10
    for (s, d) in preferred:
        objective_terms.append(W_PREF * x[(s, d)])

    # ソフトSPACING: 近接割当にペナルティ
    W_SPACING = 5
    for gap in set(soft_spacing):
        for s in staff:
            for d in range(n_days):
                for d2 in range(d + 1, min(n_days, d + gap)):
                    pair = model.NewBoolVar(f"sp_{s}_{d}_{d2}")
                    model.Add(pair >= x[(s, d)] + x[(s, d2)] - 1)
                    objective_terms.append(-W_SPACING * pair)

    # ソフト週上限超過ペナルティ
    W_MAXWEEK = 8
    if "SOFT" in max_per_week:
        cap = max_per_week["SOFT"]
        for s in staff:
            total = sum(x[(s, d)] for d in range(n_days))
            over = model.NewIntVar(0, n_days, f"over_{s}")
            model.Add(over >= total - cap)
            objective_terms.append(-W_MAXWEEK * over)

    # ソフト週下限未達ペナルティ
    W_MINWEEK = 6
    for weight in ("HARD", "SOFT"):
        if weight in min_per_week:
            floor = min_per_week[weight]
            for s in staff:
                total = sum(x[(s, d)] for d in range(n_days))
                under = model.NewIntVar(0, n_days, f"under_{weight}_{s}")
                model.Add(under >= floor - total)
                if weight == "HARD":
                    model.Add(under == 0)
                else:
                    objective_terms.append(-W_MINWEEK * under)

    # 負荷分散（弱め）: 最も多く入る人の日数を抑えて、同じ人への偏りを避ける
    W_BALANCE = 2
    max_load = model.NewIntVar(0, n_days, "max_load")
    for s in staff:
        model.Add(max_load >= sum(x[(s, d)] for d in range(n_days)))
    objective_terms.append(-W_BALANCE * max_load)

    model.Maximize(sum(objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max(1.0, min(30.0, req.maxSeconds))
    result = solver.Solve(model)

    if result not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        # 設計C: ハード制約だけでも解けない場合。緩和は行わず状況を返す。
        return SolveResponse(
            status="INFEASIBLE",
            assignments=[],
            unmet=[
                UnmetDay(businessDate=days[d], required=required.get(d, 0), assigned=0)
                for d in range(n_days)
                if required.get(d, 0) > 0
            ],
            message="制約を満たす割当てが見つかりませんでした。必要人数や勤務不可の希望を見直してください。",
        )

    assignments: list[Assignment] = []
    assigned_count: dict[int, int] = {d: 0 for d in range(n_days)}
    for s in staff:
        for d in range(n_days):
            if solver.Value(x[(s, d)]) == 1:
                assignments.append(Assignment(staffId=s, businessDate=days[d]))
                assigned_count[d] += 1

    unmet = [
        UnmetDay(businessDate=days[d], required=required.get(d, 0), assigned=assigned_count[d])
        for d in range(n_days)
        if required.get(d, 0) > assigned_count[d]
    ]

    status = "OPTIMAL" if result == cp_model.OPTIMAL else "FEASIBLE"
    if unmet:
        message = f"{len(assignments)}件を割り当てました。人手不足で{len(unmet)}日が必要人数に届いていません。"
    else:
        message = f"{len(assignments)}件を割り当て、必要人数を満たしました。"

    return SolveResponse(status=status, assignments=assignments, unmet=unmet, message=message)
