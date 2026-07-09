export type PredictionNotificationChannel = "EMAIL" | "SMS" | "PUSH" | "IN_APP";

export type PredictionNotificationService = {
  notify(input: {
    channel: PredictionNotificationChannel;
    queueItemId: string;
    event: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
};

export class PlaceholderPredictionNotificationService implements PredictionNotificationService {
  async notify(input: {
    channel: PredictionNotificationChannel;
    queueItemId: string;
    event: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    console.info("PREDICTION_WORKFLOW_NOTIFICATION_PLACEHOLDER", {
      channel: input.channel,
      queueItemId: input.queueItemId,
      event: input.event,
    });
  }
}

