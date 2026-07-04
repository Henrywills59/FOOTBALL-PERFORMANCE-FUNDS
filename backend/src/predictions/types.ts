import type { FootballFixtureDetail, PredictionApprovalStatus, PredictionResult } from "@fpf/shared";

export type PredictionInput = FootballFixtureDetail;

export type PredictionRepository = {
  getFixtureForPrediction(fixtureId: string): Promise<PredictionInput | null>;
  createPrediction(input: PredictionResult & { oddId: string }): Promise<PredictionResult>;
  listPredictions(input: { approvalStatus?: PredictionApprovalStatus }): Promise<PredictionResult[]>;
  updateApprovalStatus(id: string, approvalStatus: Exclude<PredictionApprovalStatus, "PENDING">): Promise<PredictionResult | null>;
};

export type PredictionEngineResult = PredictionResult & {
  oddId?: string;
};
