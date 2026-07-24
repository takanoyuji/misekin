/**
 * シフトの計測指標（戦略レポート §4-2）
 *
 * レポートが「機能を作る前にスプレッドシートで測れ」と指摘する3指標を、
 * アプリ内で自動算出する。この数字が、次に最適化を作るか代打マッチングを
 * 作るかの投資判断の根拠になる。
 * - 希望提出率: 提出人日 / (対象スタッフ数 × 対象日数)
 * - 充足率: 割当済み人日 / 必要人数の合計
 * - 確定後変更回数: 公開済みシフトの revisionCount 合計
 */

export interface ShiftMetricsInput {
  activeStaffCount: number;
  dayCount: number;
  submittedAvailabilities: number; // UNAVAILABLE も「提出」として数える
  requiredTotal: number; // 必要人数の合計
  assignedTotal: number; // 割当済みシフト件数
  postPublishRevisions: number;
}

export interface ShiftMetrics {
  submissionRate: number | null; // 0..1
  fulfillmentRate: number | null; // 0..1
  postPublishRevisions: number;
}

export function computeShiftMetrics(input: ShiftMetricsInput): ShiftMetrics {
  const denomSubmission = input.activeStaffCount * input.dayCount;
  const submissionRate =
    denomSubmission > 0 ? input.submittedAvailabilities / denomSubmission : null;

  const fulfillmentRate =
    input.requiredTotal > 0
      ? Math.min(1, input.assignedTotal / input.requiredTotal)
      : null;

  return {
    submissionRate,
    fulfillmentRate,
    postPublishRevisions: input.postPublishRevisions,
  };
}

export function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}
