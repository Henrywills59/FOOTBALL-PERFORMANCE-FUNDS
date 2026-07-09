import type { DecisionEngineOutput, PredictionLifecycleStatus } from "@fpf/shared";

export function suggestedStatus(decision: DecisionEngineOutput): PredictionLifecycleStatus {
  if (decision.scores.confidenceScore >= 70 && decision.scores.riskScore < 60) return "PENDING_REVIEW";
  if (decision.scores.confidenceScore >= 50) return "PENDING_REVIEW";
  return "REJECTED";
}

export function priorityFromDecision(decision: DecisionEngineOutput) {
  const confidenceWeight = decision.scores.confidenceScore;
  const opportunityWeight = decision.scores.opportunityScore;
  const riskPenalty = decision.scores.riskScore * 0.5;
  return Math.max(0, Math.min(100, Math.round(confidenceWeight * 0.4 + opportunityWeight * 0.45 - riskPenalty + 25)));
}

export function statusBucket(status: PredictionLifecycleStatus) {
  if (["NEW", "ANALYZING", "PENDING_REVIEW", "UNDER_REVIEW"].includes(status)) return "pending";
  if (status === "APPROVED") return "approved";
  if (status === "REJECTED") return "rejected";
  if (status === "PUBLISHED") return "published";
  if (status === "EXPIRED") return "expired";
  if (status === "ARCHIVED") return "archived";
  return "draft";
}
