import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '../src/server/db/schema';

const { submissions, credentials } = schema;

function createTestDb() {
  const sqlite = new Database(':memory:');

  // Run the migration SQL (stripped of drizzle-kit markers)
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

describe('submissions/credentials schema', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('submissions insert+select round-trip', async () => {
    // Insert a parent session row (required by FK)
    await db.insert(schema.sessions).values({
      id: 'sess1',
      roomCode: 'ROOM1',
      status: 'PREPARING',
      hostId: 'u1',
      createdAt: Date.now(),
    });

    const scheduledAt = new Date('2026-04-20T00:00:00Z');

    await db.insert(submissions).values({
      id: 's1',
      sessionId: 'sess1',
      loserUserId: 'u1',
      status: 'QUEUED',
      scheduledAt,
      attendeeNames: '[]',
      purposeKind: 'lunch',
      mode: 'mock',
      sunginNb: null,
      erpRefNo: null,
      errorLog: null,
    });

    const rows = await db.select().from(submissions).where(eq(submissions.id, 's1'));
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.status).toBe('QUEUED');
    expect(row.sessionId).toBe('sess1');
    expect(row.scheduledAt).toBeInstanceOf(Date);
    expect(row.scheduledAt.getTime()).toBe(scheduledAt.getTime());
  });

  it('credentials upsert replaces existing blob', async () => {
    const now = new Date();
    const iv = Buffer.alloc(12, 0);
    const authTag = Buffer.alloc(16, 0);

    // Initial insert
    await db.insert(credentials).values({
      userId: 'u1',
      ciphertext: Buffer.from('aa', 'hex'),
      iv,
      authTag,
      updatedAt: now,
    });

    // Conflict update (upsert)
    await db
      .insert(credentials)
      .values({
        userId: 'u1',
        ciphertext: Buffer.from('bb', 'hex'),
        iv,
        authTag,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: credentials.userId,
        set: {
          ciphertext: Buffer.from('bb', 'hex'),
          updatedAt: now,
        },
      });

    const rows = await db.select().from(credentials).where(eq(credentials.userId, 'u1'));
    expect(rows).toHaveLength(1);
    expect(rows[0].ciphertext.toString('hex')).toBe('bb');
  });
});
