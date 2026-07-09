import type {
  DecisionEngineOutput,
  PredictionLifecycleStatus,
  PredictionQueueItem,
  PredictionWorkflowAction,
} from "@fpf/shared";

export type PredictionWorkflowSort =
  | "league"
  | "kickoffTime"
  | "confidence"
  | "risk"
  | "predictionType"
  | "priority";

export type PredictionWorkflowFilters = {
  status?: PredictionLifecycleStatus;
  sort?: PredictionWorkflowSort;
};

export type PredictionWorkflowActionInput = {
  actorUserId: string;
  action: PredictionWorkflowAction;
  reason?: string | null;
  notes?: string | null;
};

export type PredictionWorkflowRepository = {
  upsertCandidate(decision: DecisionEngineOutput): Promise<PredictionQueueItem>;
  listQueue(filters: PredictionWorkflowFilters): Promise<PredictionQueueItem[]>;
  getQueueItem(id: string): Promise<PredictionQueueItem | null>;
  applyAction(id: string, input: PredictionWorkflowActionInput): Promise<PredictionQueueItem | null>;
  listPublished(): Promise<PredictionQueueItem[]>;
};
