import type { FootballFixtureDetail, PredictionApprovalStatus, PredictionResult } from "@fpf/shared";
import type { PredictionRepository } from "./types.js";

export class InMemoryPredictionRepository implements PredictionRepository {
  private predictions: PredictionResult[] = [];

  constructor(private readonly fixtures: FootballFixtureDetail[]) {}

  async getFixtureForPrediction(fixtureId: string) {
    return this.fixtures.find((fixture) => fixture.id === fixtureId) ?? null;
  }

  async createPrediction(input: PredictionResult & { oddId: string }): Promise<PredictionResult> {
    const prediction: PredictionResult = {
      ...input,
      id: String(this.predictions.length + 1),
      createdAt: new Date().toISOString(),
    };
    this.predictions.push(prediction);
    return prediction;
  }

  async listPredictions(input: { approvalStatus?: PredictionApprovalStatus }) {
    return this.predictions.filter((prediction) =>
      input.approvalStatus ? prediction.approvalStatus === input.approvalStatus : true,
    );
  }

  async updateApprovalStatus(id: string, approvalStatus: "APPROVED" | "REJECTED") {
    const prediction = this.predictions.find((item) => item.id === id);
    if (!prediction) return null;
    prediction.approvalStatus = approvalStatus;
    return prediction;
  }

  async updateNotes(id: string, adminNotes: string) {
    const prediction = this.predictions.find((item) => item.id === id);
    if (!prediction) return null;
    prediction.adminNotes = adminNotes;
    return prediction;
  }
}
