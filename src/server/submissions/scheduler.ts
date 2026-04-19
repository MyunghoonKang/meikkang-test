import cron from 'node-cron';
import type { SubmissionQueue } from './queue';

export interface SchedulerDeps {
  queue: SubmissionQueue;
  runSubmission: (id: string) => Promise<void>;
  logger?: { info: (m: string, meta?: any) => void; error: (m: string, meta?: any) => void };
}

export class Scheduler {
  private task?: cron.ScheduledTask;
  constructor(private deps: SchedulerDeps) {}

  start(): void {
    this.task = cron.schedule('* * * * *', () => this.tick().catch((e) =>
      this.deps.logger?.error('scheduler tick failed', { err: String(e) }),
    ));
  }

  async tick(): Promise<void> {
    await this.deps.queue.recoverStuck({ thresholdMs: 30 * 60 * 1000 });
    const claimed = await this.deps.queue.claimNext(new Date());
    if (!claimed) return;
    this.deps.logger?.info('dispatching submission', { id: claimed.id });
    this.deps.runSubmission(claimed.id).catch((e) =>
      this.deps.logger?.error('runSubmission threw', { id: claimed.id, err: String(e) }),
    );
  }

  stop(): void { this.task?.stop(); }
}
