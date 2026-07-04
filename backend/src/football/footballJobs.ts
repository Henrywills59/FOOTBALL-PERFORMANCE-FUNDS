import type { FootballConfig } from "./config.js";
import type { FootballSyncService } from "./footballSyncService.js";

export class FootballJobScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly syncService: FootballSyncService,
    private readonly config: FootballConfig,
  ) {}

  start() {
    if (!this.config.jobsEnabled || this.timer) {
      return false;
    }

    const intervalMs = Math.max(this.config.syncIntervalMinutes, 5) * 60 * 1000;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);
    this.timer.unref();
    void this.runOnce();
    return true;
  }

  isStarted() {
    return Boolean(this.timer);
  }

  async runOnce() {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      await this.syncService.syncAll();
    } finally {
      this.running = false;
    }
  }
}
