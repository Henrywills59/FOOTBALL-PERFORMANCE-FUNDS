import type {
  AnalystAssignment,
  AnalystDashboard,
  AnalystIntelligenceSubmission,
  IntelligenceSubmissionStatus,
  PublishedIntelligence,
} from "@fpf/shared";

export type CreateAssignmentInput = {
  analystId: string;
  fixtureId: string;
  leagueName: string;
  adminNotes?: string | null;
};

export type CreateSubmissionInput = {
  analystId: string;
  fixtureId: string;
  leagueName: string;
  market: string;
  prediction: string;
  confidence: number;
  riskLevel: string;
  detailedReasoning: string;
  supportingStatistics: string;
  sourceNotes: string;
  briefExplanation: string;
  recommendedStake: string;
  status: "DRAFT" | "PENDING_REVIEW";
};

export type AnalystRepository = {
  dashboard(analystId: string): Promise<AnalystDashboard>;
  listAssignments(analystId: string): Promise<AnalystAssignment[]>;
  createAssignment(input: CreateAssignmentInput): Promise<AnalystAssignment>;
  createSubmission(input: CreateSubmissionInput): Promise<AnalystIntelligenceSubmission>;
  updateSubmission(
    id: string,
    analystId: string,
    input: Partial<Omit<CreateSubmissionInput, "analystId">>,
  ): Promise<AnalystIntelligenceSubmission | null>;
  submitForReview(id: string, analystId: string): Promise<AnalystIntelligenceSubmission | null>;
  listAnalystSubmissions(analystId: string): Promise<AnalystIntelligenceSubmission[]>;
  listAdminSubmissions(): Promise<AnalystIntelligenceSubmission[]>;
  updateStatus(
    id: string,
    status: IntelligenceSubmissionStatus,
    adminNotes?: string | null,
  ): Promise<AnalystIntelligenceSubmission | null>;
  updateAdminNotes(id: string, adminNotes: string): Promise<AnalystIntelligenceSubmission | null>;
  listPublished(): Promise<PublishedIntelligence[]>;
};
