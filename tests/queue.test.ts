import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../src/server/db/schema';
import { SubmissionQueue } from '../src/server/submissions/queue';

const { sessions } = schema;

function createTestDb() {
  const sqlite = new Database(':memory:');

  sqlite.exec(`
    CREATE TABLE \`sessions\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`room_code\` text NOT NULL,
      \`status\` text DEFAULT 'PREPARING' NOT NULL,
      \`host_id\` text NOT NULL,
      \`selected_game_id\` text,
      \`started_at\` integer,
      \`created_at\` integer NOT NULL,
      \`loser_id\` text,
      \`submission_id\` text
    );
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX \`sessions_room_code_unique\` ON \`sessions\` (\`room_code\`);
  `);
  sqlite.exec(`
    CREATE TABLE \`submissions\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`session_id\` text NOT NULL,
      \`loser_user_id\` text NOT NULL,
      \`status\` text NOT NULL,
      \`mode\` text DEFAULT 'mock' NOT NULL,
      \`scheduled_at\` integer NOT NULL,
      \`claimed_at\` integer,
      \`completed_at\` integer,
      \`sungin_nb\` text,
      \`erp_ref_no\` text,
      \`error_log\` text,
      \`screenshot_dir\` text,
      \`attendee_names\` text NOT NULL,
      \`title_override\` text,
      \`purpose_kind\` text DEFAULT 'lunch' NOT NULL,
      FOREIGN KEY (\`session_id\`) REFERENCES \`sessions\`(\`id\`) ON UPDATE no action ON DELETE no action
    );
  `);
  sqlite.exec(`
    CREATE TABLE \`credentials\` (
      \`user_id\` text PRIMARY KEY NOT NULL,
      \`ciphertext\` blob NOT NULL,
      \`iv\` blob NOT NULL,
      \`auth_tag\` blob NOT NULL,
      \`updated_at\` integer NOT NULL
    );
  `);

  return drizzle(sqlite, { schema });
}

async function insertSession(db: ReturnType<typeof createTestDb>, id: string) {
  await db.insert(sessions).values({
    id,
    roomCode: `ROOM-${id}`,
    status: 'FINISHED',
    hostId: 'host1',
    createdAt: Date.now(),
  });
}

describe('SubmissionQueue', () => {
  let db: ReturnType<typeof createTestDb>;
  let queue: SubmissionQueue;

  beforeEach(async () => {
    db = createTestDb();
    queue = new SubmissionQueue(db);
    await insertSession(db, 'sess1');
  });

  it('enqueue creates a QUEUED row', async () => {
    const id = await queue.enqueue({
      sessionId: 'sess1',
      loserUserId: 'user1',
      scheduledAt: new Date(),
      attendeeNames: ['Alice', 'Bob'],
      purposeKind: 'coffee',
      mode: 'mock',
    });

    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);

    const row = await queue.loadForRun(id);
    expect(row).toBeDefined();
    expect(row!.status).toBe('QUEUED');
    expect(row!.sessionId).toBe('sess1');
    expect(row!.loserUserId).toBe('user1');
    expect(JSON.parse(row!.attendeeNames)).toEqual(['Alice', 'Bob']);
    expect(row!.purposeKind).toBe('coffee');
  });

  it('claimNext returns due item and marks RUNNING atomically; second claim returns null', async () => {
    const now = new Date();
    const id = await queue.enqueue({
      sessionId: 'sess1',
      loserUserId: 'user1',
      scheduledAt: new Date(now.getTime() - 1000), // 1 second in the past
      attendeeNames: [],
      purposeKind: 'lunch',
      mode: 'mock',
    });

    const claimed = await queue.claimNext(now);
    expect(claimed).not.toBeNull();
    expect(claimed!.id).toBe(id);
    expect(claimed!.status).toBe('RUNNING');

    const row = await queue.loadForRun(id);
    expect(row!.status).toBe('RUNNING');
    expect(row!.claimedAt).toBeInstanceOf(Date);

    // Second claim should return null
    const second = await queue.claimNext(now);
    expect(second).toBeNull();
  });

  it('claimNext skips items scheduled in the future', async () => {
    const now = new Date();
    await queue.enqueue({
      sessionId: 'sess1',
      loserUserId: 'user1',
      scheduledAt: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour in the future
      attendeeNames: [],
      purposeKind: 'lunch',
      mode: 'mock',
    });

    const claimed = await queue.claimNext(now);
    expect(claimed).toBeNull();
  });

  it('complete transitions RUNNING to COMPLETED with output fields', async () => {
    const now = new Date();
    const id = await queue.enqueue({
      sessionId: 'sess1',
      loserUserId: 'user1',
      scheduledAt: new Date(now.getTime() - 1000),
      attendeeNames: [],
      purposeKind: 'lunch',
      mode: 'mock',
    });

    await queue.claimNext(now);
    await queue.complete(id, {
      erpRefNo: 'ERP-123',
      sunginNb: 'SN-456',
      screenshotDir: '/tmp/screenshots',
    });

    const row = await queue.loadForRun(id);
    expect(row!.status).toBe('COMPLETED');
    expect(row!.erpRefNo).toBe('ERP-123');
    expect(row!.sunginNb).toBe('SN-456');
    expect(row!.screenshotDir).toBe('/tmp/screenshots');
    expect(row!.completedAt).toBeInstanceOf(Date);
  });

  it('fail transitions RUNNING to failure status with errorLog', async () => {
    const now = new Date();
    const id = await queue.enqueue({
      sessionId: 'sess1',
      loserUserId: 'user1',
      scheduledAt: new Date(now.getTime() - 1000),
      attendeeNames: [],
      purposeKind: 'lunch',
      mode: 'mock',
    });

    await queue.claimNext(now);
    await queue.fail(id, {
      status: 'FAILED_AUTH',
      errorLog: 'Login failed: invalid credentials',
      screenshotDir: '/tmp/fail-screenshots',
    });

    const row = await queue.loadForRun(id);
    expect(row!.status).toBe('FAILED_AUTH');
    expect(row!.errorLog).toBe('Login failed: invalid credentials');
    expect(row!.screenshotDir).toBe('/tmp/fail-screenshots');
    expect(row!.completedAt).toBeInstanceOf(Date);
  });

  it('recoverStuck resets stuck RUNNING items older than threshold', async () => {
    const now = new Date();
    const id = await queue.enqueue({
      sessionId: 'sess1',
      loserUserId: 'user1',
      scheduledAt: new Date(now.getTime() - 1000),
      attendeeNames: [],
      purposeKind: 'lunch',
      mode: 'mock',
    });

    // Manually set status to RUNNING with an old claimedAt (1 hour ago)
    const stuckClaimedAt = new Date(Date.now() - 60 * 60 * 1000);
    const { eq } = await import('drizzle-orm');
    const { submissions } = await import('../src/server/db/schema');
    await db.update(submissions)
      .set({ status: 'RUNNING', claimedAt: stuckClaimedAt })
      .where(eq(submissions.id, id));

    // recoverStuck with 30-minute threshold: the item is 1 hour old, so it qualifies
    const recovered = await queue.recoverStuck({ thresholdMs: 30 * 60 * 1000 });
    expect(recovered).toBe(1);

    const row = await queue.loadForRun(id);
    expect(row!.status).toBe('QUEUED');
    expect(row!.claimedAt).toBeNull();
  });

  it('recoverStuck does NOT reset items claimed recently', async () => {
    const now = new Date();
    const id = await queue.enqueue({
      sessionId: 'sess1',
      loserUserId: 'user1',
      scheduledAt: new Date(now.getTime() - 1000),
      attendeeNames: [],
      purposeKind: 'lunch',
      mode: 'mock',
    });

    // Claim it (just now)
    await queue.claimNext(now);

    // recoverStuck with 30-minute threshold: freshly claimed item should NOT be reset
    const recovered = await queue.recoverStuck({ thresholdMs: 30 * 60 * 1000 });
    expect(recovered).toBe(0);

    const row = await queue.loadForRun(id);
    expect(row!.status).toBe('RUNNING');
  });

  it('allSuccessfulSunginNbs returns only COMPLETED sunginNbs', async () => {
    await insertSession(db, 'sess2');

    const id1 = await queue.enqueue({
      sessionId: 'sess1',
      loserUserId: 'user1',
      scheduledAt: new Date(Date.now() - 1000),
      attendeeNames: [],
      purposeKind: 'lunch',
      mode: 'mock',
    });
    const id2 = await queue.enqueue({
      sessionId: 'sess2',
      loserUserId: 'user2',
      scheduledAt: new Date(Date.now() - 1000),
      attendeeNames: [],
      purposeKind: 'coffee',
      mode: 'mock',
    });

    const now = new Date();
    await queue.claimNext(now);
    await queue.complete(id1, { sunginNb: 'SN-001' });

    // id2 stays QUEUED — no sunginNb
    const nbs = await queue.allSuccessfulSunginNbs();
    expect(nbs).toEqual(['SN-001']);
  });

  it('list returns submissions for given sessionId only', async () => {
    await insertSession(db, 'sess2');

    await queue.enqueue({
      sessionId: 'sess1',
      loserUserId: 'user1',
      scheduledAt: new Date(),
      attendeeNames: [],
      purposeKind: 'lunch',
      mode: 'mock',
    });
    await queue.enqueue({
      sessionId: 'sess2',
      loserUserId: 'user2',
      scheduledAt: new Date(),
      attendeeNames: [],
      purposeKind: 'coffee',
      mode: 'mock',
    });

    const rows = await queue.list({ sessionId: 'sess1' });
    expect(rows).toHaveLength(1);
    expect(rows[0].sessionId).toBe('sess1');
  });
});
