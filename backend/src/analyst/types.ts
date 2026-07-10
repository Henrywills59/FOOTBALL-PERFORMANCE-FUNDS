import type {
  AnalystAssignment,
  AcademyPrediction,
  AdminAnalystControlCenter,
  AnalystAcademy,
  AnalystApplication,
  AnalystApplicationStatus,
  AnalystDashboard,
  AnalystPerformanceDashboard,
  AnalystProfile,
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

export type CreateAnalystApplicationInput = {
  fullName: string;
  email: string;
  country: string;
  footballExperience: string;
  preferredLeagues: string[];
  yearsOfExperience: number;
  countriesCovered: string[];
  predictionStyle: string;
  motivationStatement: string;
};

export type CreateAcademyPredictionInput = {
  analystId: string;
  matchName: string;
  leagueName: string;
  market: AcademyPrediction["market"];
  prediction: string;
  confidence: number;
  riskLevel: AcademyPrediction["riskLevel"];
  explanation: string;
  supportingNotes: string;
  stakeCents?: number;
  odds?: number;
};

export type AnalystRepository = {
  dashboard(analystId: string): Promise<AnalystDashboard>;
  performanceDashboard(analystId: string): Promise<AnalystPerformanceDashboard>;
  createApplication(input: CreateAnalystApplicationInput): Promise<AnalystApplication>;
  listApplications(): Promise<AnalystApplication[]>;
  updateApplicationStatus(id: string, status: AnalystApplicationStatus, adminNotes?: string | null): Promise<AnalystApplication | null>;
  listAnalysts(): Promise<AnalystProfile[]>;
  promoteAnalyst(analystId: string, adminNotes?: string | null): Promise<AnalystProfile>;
  suspendAnalyst(analystId: string, adminNotes?: string | null): Promise<AnalystProfile>;
  createAcademyPrediction(input: CreateAcademyPredictionInput): Promise<AcademyPrediction>;
  calculateRewards(adminUserId: string): Promise<AdminAnalystControlCenter>;
  adminControlCenter(): Promise<AdminAnalystControlCenter>;
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
