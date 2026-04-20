import { describe, it, expect } from 'vitest';
import { SessionManager } from '../src/server/session/manager';
import { SubmissionQueue } from '../src/server/submissions/queue';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../src/server/db/schema';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import express from 'express';
import { submissionsRouter } from '../src/server/routes/submissions';
import { EventEmitter } from 'node:events';
import type { Server as IOServer } from 'socket.io';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const sql = readFileSync('./drizzle/0001_init.sql', 'utf-8');
  const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) sqlite.exec(stmt);
  return drizzle(sqlite, { schema });
}

// Mock IO server (just needs to emit, which we ignore in tests)
function mockIo(): IOServer {
  const emitter = new EventEmitter() as any;
  emitter.to = () => emitter;
  emitter.emit = () => emitter;
  return emitter;
}

describe('game outcome → submission flow', () => {
  it('finishGame transitions to FINISHED but does NOT enqueue submission', async () => {
    const mgr = new SessionManager({ persist: false });
    const db = createTestDb();
    const queue = new SubmissionQueue(db);

    // Create session and game
    const session = mgr.createSession({ name: 'Alice' });
    mgr.join({ roomCode: session.roomCode, name: 'Bob' });

    // Force state through to PLAYING
    mgr.selectGame({ sessionId: session.id, actorId: session.hostId, gameId: 'test-game' });
    mgr.startGame({ sessionId: session.id, actorId: session.hostId });

    // Now finish the game
    const bobId = mgr.getById(session.id)!.players[1].id;
    const finished = mgr.finishGame({
      sessionId: session.id,
      loserId: bobId,
      results: [{ playerId: session.hostId, value: 10 }, { playerId: bobId, value: 5 }],
    });

    expect(finished.status).toBe('FINISHED');
    expect(finished.loserId).toBe(bobId);

    // Verify NO submission was enqueued (the hook is a no-op)
    const submissions = await queue.list({ sessionId: session.id });
    expect(submissions).toHaveLength(0);
  });

  it('POST /api/sessions/:id/submissions enqueues + transitions to QUEUED', async () => {
    const mgr = new SessionManager({ persist: false });
    const db = createTestDb();
    const queue = new SubmissionQueue(db);
    const io = mockIo();

    const app = express();
    app.use(express.json());
    app.use('/api', submissionsRouter(mgr, queue, io));

    // Setup: session in CREDENTIAL_INPUT state
    const session = mgr.createSession({ name: 'Alice' });
    const joinedSnap = mgr.join({ roomCode: session.roomCode, name: 'Bob' });
    const loserId = joinedSnap.players[1].id;
    mgr.selectGame({ sessionId: session.id, actorId: session.hostId, gameId: 'test-game' });
    mgr.startGame({ sessionId: session.id, actorId: session.hostId });
    mgr.finishGame({ sessionId: session.id, loserId, results: [] });
    mgr.transitionStatus({ sessionId: session.id, to: 'CREDENTIAL_INPUT' });

    // Need to insert sessions row for FK
    await db.insert(schema.sessions).values({
      id: session.id, roomCode: session.roomCode, status: 'CREDENTIAL_INPUT',
      hostId: session.hostId, createdAt: Date.now(),
    });

    const r = await request(app)
      .post(`/api/sessions/${session.id}/submissions`);
    expect(r.status).toBe(200);
    expect(r.body.submissionId).toBeTruthy();

    const snapped = mgr.getById(session.id)!;
    expect(snapped.status).toBe('QUEUED');

    const subs = await queue.list({ sessionId: session.id });
    expect(subs).toHaveLength(1);
  });
});
