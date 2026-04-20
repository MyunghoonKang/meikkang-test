import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { submissions } from '../db/schema';
import type { EnqueueInput, CompleteInput, FailInput } from './types';

export class SubmissionQueue {
  constructor(private db: BetterSQLite3Database<any>) {}

  async enqueue(input: EnqueueInput): Promise<string> {
    const id = randomUUID();
    await this.db.insert(submissions).values({
      id,
      sessionId: input.sessionId,
      loserUserId: input.loserUserId,
      status: 'QUEUED',
      mode: input.mode,
      scheduledAt: input.scheduledAt,
      attendeeNames: JSON.stringify(input.attendeeNames),
      titleOverride: input.titleOverride ?? null,
      purposeKind: input.purposeKind,
    });
    return id;
  }

  async claimNext(now: Date): Promise<{ id: string; status: 'RUNNING' } | null> {
    const candidate = await this.db
      .select({ id: submissions.id })
      .from(submissions)
      .where(and(eq(submissions.status, 'QUEUED'), lt(submissions.scheduledAt, new Date(now.getTime() + 1))))
      .limit(1);
    if (candidate.length === 0) return null;
    const { id } = candidate[0];
    const updated = await this.db
      .update(submissions)
      .set({ status: 'RUNNING', claimedAt: now })
      .where(and(eq(submissions.id, id), eq(submissions.status, 'QUEUED')))
      .returning({ id: submissions.id });
    if (updated.length === 0) return null;
    return { id, status: 'RUNNING' };
  }

  async complete(id: string, out: CompleteInput): Promise<void> {
    await this.db.update(submissions)
      .set({
        status: 'COMPLETED',
        completedAt: new Date(),
        erpRefNo: out.erpRefNo ?? null,
        sunginNb: out.sunginNb ?? null,
        screenshotDir: out.screenshotDir ?? null,
      })
      .where(eq(submissions.id, id));
  }

  async fail(id: string, f: FailInput): Promise<void> {
    await this.db.update(submissions)
      .set({
        status: f.status,
        completedAt: new Date(),
        errorLog: f.errorLog,
        screenshotDir: f.screenshotDir ?? null,
      })
      .where(eq(submissions.id, id));
  }

  async recoverStuck({ thresholdMs }: { thresholdMs: number }): Promise<number> {
    const cutoff = new Date(Date.now() - thresholdMs);
    const res = await this.db.update(submissions)
      .set({ status: 'QUEUED', claimedAt: null })
      .where(
        and(
          eq(submissions.status, 'RUNNING'),
          isNotNull(submissions.claimedAt),
          lt(submissions.claimedAt, cutoff),
        ),
      )
      .returning({ id: submissions.id });
    return res.length;
  }

  async loadForRun(id: string) {
    return await this.db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  }

  async allSuccessfulSunginNbs(): Promise<string[]> {
    const rows = await this.db
      .select({ sunginNb: submissions.sunginNb })
      .from(submissions)
      .where(eq(submissions.status, 'COMPLETED'));
    return rows.flatMap(r => r.sunginNb ? [r.sunginNb] : []);
  }

  async list({ sessionId }: { sessionId: string }) {
    return await this.db
      .select()
      .from(submissions)
      .where(eq(submissions.sessionId, sessionId));
  }
}
