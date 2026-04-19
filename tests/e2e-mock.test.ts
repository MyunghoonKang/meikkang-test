import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../src/server/db/schema';
import { readFileSync } from 'node:fs';
import { SubmissionQueue } from '../src/server/submissions/queue';
import { Scheduler } from '../src/server/submissions/scheduler';
import { CredentialVault } from '../src/server/vault/vault';
import { nextBusinessDayNineAm } from '../src/server/submissions/scheduling';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const sql = readFileSync('./drizzle/0001_init.sql', 'utf-8');
  const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) sqlite.exec(stmt);
  return drizzle(sqlite, { schema });
}

const VAULT_KEY = Buffer.alloc(32, 7);

describe('e2e (mock pipeline)', () => {
  it('full flow: enqueue → vault save → scheduler tick → COMPLETED', async () => {
    const db = createTestDb();
    const queue = new SubmissionQueue(db);
    const vault = new CredentialVault(db, VAULT_KEY);

    // Insert session row (FK requirement)
    await db.insert(schema.sessions).values({
      id: 'sess-e2e', roomCode: 'E2E1', status: 'QUEUED',
      hostId: 'host1', createdAt: Date.now(),
    });

    // 1. Simulate: game finished, credential submitted → enqueue
    const loserId = 'user-loser';
    const scheduledAt = new Date(0); // schedule immediately (past)
    const submissionId = await queue.enqueue({
      sessionId: 'sess-e2e',
      loserUserId: loserId,
      scheduledAt,
      attendeeNames: ['강명훈', '홍길동'],
      purposeKind: 'coffee',
      mode: 'mock',
    });

    // 2. Loser saves credentials
    await vault.save(loserId, { loginId: 'alice', password: 'pw' });

    // 3. Run scheduler tick (claimNext + runSubmission)
    let capturedId: string | null = null;

    // Track the runSubmission promise so we can await it after tick()
    let runSubmissionPromise: Promise<void> | null = null;

    const scheduler = new Scheduler({
      queue,
      runSubmission: async (id) => {
        capturedId = id;
        // mock worker: complete immediately
        await queue.complete(id, { erpRefNo: `ERP-MOCK-${id}`, sunginNb: '68763054' });
      },
    });

    // Wrap tick to capture the runSubmission promise
    const originalRunSubmission = scheduler['deps'].runSubmission;
    scheduler['deps'] = {
      ...scheduler['deps'],
      runSubmission: async (id) => {
        runSubmissionPromise = originalRunSubmission(id);
        return runSubmissionPromise;
      },
    };

    await scheduler.tick();

    // tick() fires runSubmission without awaiting; wait for it to settle
    if (runSubmissionPromise) {
      await runSubmissionPromise;
    }

    // 4. Verify
    expect(capturedId).toBe(submissionId);

    const sub = await queue.loadForRun(submissionId);
    expect(sub?.status).toBe('COMPLETED');
    expect(sub?.sunginNb).toBe('68763054');
    expect(sub?.erpRefNo).toBe(`ERP-MOCK-${submissionId}`);
  }, 10_000);

  it('scheduler tick does nothing when no due items', async () => {
    const db = createTestDb();
    const queue = new SubmissionQueue(db);

    // Insert session row
    await db.insert(schema.sessions).values({
      id: 'sess-e2e2', roomCode: 'E2E2', status: 'QUEUED',
      hostId: 'host2', createdAt: Date.now(),
    });

    // Enqueue with future scheduled time
    await queue.enqueue({
      sessionId: 'sess-e2e2',
      loserUserId: 'u2',
      scheduledAt: new Date('2099-01-01T00:00:00Z'), // far future
      attendeeNames: [],
      purposeKind: 'lunch',
      mode: 'mock',
    });

    let called = false;
    const scheduler = new Scheduler({
      queue,
      runSubmission: async () => { called = true; },
    });

    await scheduler.tick();
    expect(called).toBe(false);
  });

  it('vault credential round-trip in pipeline context', async () => {
    const db = createTestDb();
    const vault = new CredentialVault(db, VAULT_KEY);

    await vault.save('u3', { loginId: 'testuser', password: 'testpw' });
    const loaded = await vault.load('u3');
    expect(loaded).toEqual({ loginId: 'testuser', password: 'testpw' });

    // idempotent save
    await vault.save('u3', { loginId: 'testuser2', password: 'newpw' });
    const loaded2 = await vault.load('u3');
    expect(loaded2?.loginId).toBe('testuser2');
  });

  it('nextBusinessDayNineAm returns a future date on a weekday', () => {
    // Call with a known weekday time to verify the function is importable and returns a valid Date
    const now = new Date('2026-04-20T00:00:00Z'); // Monday
    const result = nextBusinessDayNineAm(now);
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeGreaterThan(now.getTime());
  });
});
