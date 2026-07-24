"""
シフト自動生成ソルバー（戦略レポート §5 設計A→C）

生成AIには割当てを作らせず、CP-SAT（Google OR-Tools）で組合せ最適化を解く。
割当ては「スタッフ×営業日×時間帯」の2値。
- ハード制約: 勤務不可には入れない / 1日1時間帯まで / 連続勤務13日以内 / 各時間帯の必要人数上限
- ソフト制約: 必要人数の充足 / 希望(PREFERRED)の優先 / 出勤間隔(SPACING) / 週上限・下限 / 負荷分散
解が見つからない場合(設計C)は、緩和して「満たせなかった必要人数」を返す。
時刻は Next 側が時間帯定義から埋める。
"""

from typing import Literal

from fastapi import FastAPI
from ortools.sat.python import cp_model
from pydantic import BaseModel, Field

app = FastAPI(title="misekin shift solver")

MAX_CONSECUTIVE_DAYS = 13


class AvailabilityIn(BaseModel):
    staffId: str
    businessDate: str
    slotId: str
    type: Literal["AVAILABLE", "UNAVAILABLE", "PREFERRED"]


class RequirementIn(BaseModel):
    businessDate: str
    slotId: str
    requiredCount: int


class RuleIn(BaseModel):
    ruleType: str
    weight: Literal["HARD", "SOFT"]
    minGapDays: int | None = None
    maxPerWeek: int | None = None
    minPerWeek: int | None = None


class SolveRequest(BaseModel):
    days: list[str]
    staffIds: list[str]
    slotIds: list[str]
    availabilities: list[AvailabilityIn] = Field(default_factory=list)
    requirements: list[RequirementIn] = Field(default_factory=list)
    rules: list[RuleIn] = Field(default_factory=list)
    maxSeconds: float = 10.0


class Assignment(BaseModel):
    staffId: str
    businessDate: str
    slotId: str


class UnmetDay(BaseModel):
    businessDate: str
    slotId: str
    required: int
    assigned: int


class SolveResponse(BaseModel):
    status: str
    assignments: list[Assignment]
    unmet: list[UnmetDay]
    message: str


def _consecutive_runs(day_indices: list[int]) -> list[list[int]]:
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
    slots = req.slotIds
    if not days or not staff or not slots:
        return SolveResponse(
            status="NO_REQUIREMENT",
            assignments=[],
            unmet=[],
            message="対象の日・スタッフ・時間帯がありません",
        )

    day_index = {d: i for i, d in enumerate(days)}
    n_days = len(days)

    # 必要人数 (day_index, slotId) -> count
    required: dict[tuple[int, str], int] = {}
    for r in req.requirements:
        if r.businessDate in day_index and r.slotId in slots:
            required[(day_index[r.businessDate], r.slotId)] = r.requiredCount

    unavailable: set[tuple[str, int, str]] = set()
    preferred: set[tuple[str, int, str]] = set()
    for a in req.availabilities:
        if a.businessDate not in day_index or a.slotId not in slots:
            continue
        key = (a.staffId, day_index[a.businessDate], a.slotId)
        if a.type == "UNAVAILABLE":
            unavailable.add(key)
        elif a.type == "PREFERRED":
            preferred.add(key)

    if sum(required.values()) == 0:
        return SolveResponse(
            status="NO_REQUIREMENT",
            assignments=[],
            unmet=[],
            message="必要人数が設定されていません。先に必要人数を入力してください。",
        )

    model = cp_model.CpModel()

    # x[s, d, slot]
    x: dict[tuple[str, int, str], cp_model.IntVar] = {}
    for s in staff:
        for d in range(n_days):
            for slot in slots:
                x[(s, d, slot)] = model.NewBoolVar(f"x_{s}_{d}_{slot}")

    # ハード: 勤務不可に入れない
    for (s, d, slot) in unavailable:
        model.Add(x[(s, d, slot)] == 0)

    # ハード: 1日1時間帯まで（同日の掛け持ち禁止）
    for s in staff:
        for d in range(n_days):
            model.Add(sum(x[(s, d, slot)] for slot in slots) <= 1)

    # worked[s, d] = その日どこかの時間帯に入るか
    worked: dict[tuple[str, int], cp_model.IntVar] = {}
    for s in staff:
        for d in range(n_days):
            w = model.NewBoolVar(f"w_{s}_{d}")
            model.Add(w == sum(x[(s, d, slot)] for slot in slots))
            worked[(s, d)] = w

    # ハード: 連続勤務13日以内
    for s in staff:
        for run in _consecutive_runs(list(range(n_days))):
            if len(run) > MAX_CONSECUTIVE_DAYS:
                for start in range(len(run) - MAX_CONSECUTIVE_DAYS):
                    window = run[start : start + MAX_CONSECUTIVE_DAYS + 1]
                    model.Add(sum(worked[(s, d)] for d in window) <= MAX_CONSECUTIVE_DAYS)

    # ルール
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

    for gap in set(hard_spacing):
        for s in staff:
            for d in range(n_days):
                for d2 in range(d + 1, min(n_days, d + gap)):
                    model.Add(worked[(s, d)] + worked[(s, d2)] <= 1)

    if "HARD" in max_per_week:
        cap = max_per_week["HARD"]
        for s in staff:
            for start in range(max(1, n_days - 6)):
                window = range(start, min(n_days, start + 7))
                model.Add(sum(worked[(s, d)] for d in window) <= cap)

    # 各(日,時間帯)の割当は必要人数を上限とする
    for d in range(n_days):
        for slot in slots:
            req_d = required.get((d, slot), 0)
            model.Add(sum(x[(s, d, slot)] for s in staff) <= max(req_d, 0))

    objective_terms = []

    # 充足（最重要）
    W_FILL = 100
    for d in range(n_days):
        for slot in slots:
            if required.get((d, slot), 0) > 0:
                for s in staff:
                    objective_terms.append(W_FILL * x[(s, d, slot)])

    # 希望の優先
    W_PREF = 10
    for (s, d, slot) in preferred:
        objective_terms.append(W_PREF * x[(s, d, slot)])

    # ソフトSPACING
    W_SPACING = 5
    for gap in set(soft_spacing):
        for s in staff:
            for d in range(n_days):
                for d2 in range(d + 1, min(n_days, d + gap)):
                    pair = model.NewBoolVar(f"sp_{s}_{d}_{d2}")
                    model.Add(pair >= worked[(s, d)] + worked[(s, d2)] - 1)
                    objective_terms.append(-W_SPACING * pair)

    # ソフト週上限
    W_MAXWEEK = 8
    if "SOFT" in max_per_week:
        cap = max_per_week["SOFT"]
        for s in staff:
            total = sum(worked[(s, d)] for d in range(n_days))
            over = model.NewIntVar(0, n_days, f"over_{s}")
            model.Add(over >= total - cap)
            objective_terms.append(-W_MAXWEEK * over)

    # 週下限
    W_MINWEEK = 6
    for weight in ("HARD", "SOFT"):
        if weight in min_per_week:
            floor = min_per_week[weight]
            for s in staff:
                total = sum(worked[(s, d)] for d in range(n_days))
                under = model.NewIntVar(0, n_days, f"under_{weight}_{s}")
                model.Add(under >= floor - total)
                if weight == "HARD":
                    model.Add(under == 0)
                else:
                    objective_terms.append(-W_MINWEEK * under)

    # 負荷分散
    W_BALANCE = 2
    max_load = model.NewIntVar(0, n_days, "max_load")
    for s in staff:
        model.Add(max_load >= sum(worked[(s, d)] for d in range(n_days)))
    objective_terms.append(-W_BALANCE * max_load)

    model.Maximize(sum(objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max(1.0, min(30.0, req.maxSeconds))
    result = solver.Solve(model)

    if result not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolveResponse(
            status="INFEASIBLE",
            assignments=[],
            unmet=[
                UnmetDay(businessDate=days[d], slotId=slot, required=cnt, assigned=0)
                for (d, slot), cnt in required.items()
                if cnt > 0
            ],
            message="制約を満たす割当てが見つかりませんでした。必要人数や勤務不可の希望を見直してください。",
        )

    assignments: list[Assignment] = []
    assigned_count: dict[tuple[int, str], int] = {}
    for s in staff:
        for d in range(n_days):
            for slot in slots:
                if solver.Value(x[(s, d, slot)]) == 1:
                    assignments.append(Assignment(staffId=s, businessDate=days[d], slotId=slot))
                    assigned_count[(d, slot)] = assigned_count.get((d, slot), 0) + 1

    unmet = [
        UnmetDay(
            businessDate=days[d],
            slotId=slot,
            required=cnt,
            assigned=assigned_count.get((d, slot), 0),
        )
        for (d, slot), cnt in required.items()
        if cnt > assigned_count.get((d, slot), 0)
    ]

    status = "OPTIMAL" if result == cp_model.OPTIMAL else "FEASIBLE"
    if unmet:
        message = f"{len(assignments)}件を割り当てました。人手不足で{len(unmet)}枠が必要人数に届いていません。"
    else:
        message = f"{len(assignments)}件を割り当て、必要人数を満たしました。"

    return SolveResponse(status=status, assignments=assignments, unmet=unmet, message=message)
