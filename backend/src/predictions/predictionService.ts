import { PredictionEngine } from "./predictionEngine.js";
import type { PredictionRepository } from "./types.js";

export class PredictionService {
  constructor(
    private readonly repository: PredictionRepository,
    private readonly engine = new PredictionEngine(),
  ) {}

  async generateForFixture(fixtureId: string) {
    const fixture = await this.repository.getFixtureForPrediction(fixtureId);
    if (!fixture) {
      return null;
    }

    const result = this.engine.analyzeFixture(fixture);
    if (result.dataQualityStatus === "INSUFFICIENT_DATA" || result.dataQualityStatus === "STALE_ODDS" || !result.oddId) {
      return result;
    }

    return this.repository.createPrediction({ ...result, oddId: result.oddId });
  }

  async listAdminPredictions() {
    return this.repository.listPredictions({});
  }

  async listApprovedPredictions() {
    return this.repository.listPredictions({ approvalStatus: "APPROVED" });
  }

  async approve(id: string) {
    return this.repository.updateApprovalStatus(id, "APPROVED");
  }

  async reject(id: string) {
    return this.repository.updateApprovalStatus(id, "REJECTED");
  }

  async updateNotes(id: string, adminNotes: string) {
    return this.repository.updateNotes(id, adminNotes);
  }
}
