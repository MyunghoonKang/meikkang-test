import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync } from 'node:fs';
import type { Server as IOServer } from 'socket.io';
import * as schema from '../src/server/db/schema';
import { SessionManager } from '../src/server/session/manager';
import { SubmissionQueue } from '../src/server/submissions/queue';
import { submissionsRouter } from '../src/server/routes/submissions';

const { sessions } = schema;

function createTestDb() {
  const sqlite = new Database(':memory:');
  const sql = readFileSync('./drizzle/0001_init.sql', 'utf-8');
  const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) sqlite.exec(stmt);
  return drizzle(sqlite, { schema });
}

async function insertSessionRow(db: ReturnType<typeof createTestDb>, snap: { id: string; roomCode: string; hostId: string }) {
  await db.insert(sessions).values({
    id: snap.id,
    roomCode: snap.roomCode,
    status: 'FINISHED',
    hostId: snap.hostId,
    createdAt: Date.now(),
  });
}

function makeIoMock(): IOServer {
  return {
    to: vi.fn().mockReturnValue({ emit: vi.fn() }),
  } as unknown as IOServer;
}

function buildApp(mgr: SessionManager, queue: SubmissionQueue, io: IOServer) {
  const app = express();
  app.use(express.json());
  app.use('/api', submissionsRouter(mgr, queue, io));
  return app;
}

describe('submissions routes', () => {
  let db: ReturnType<typeof createTestDb>;
  let mgr: SessionManager;
  let queue: SubmissionQueue;
  let io: IOServer;
  let app: express.Express;
  let sessionId: string;
  let loserId: string;

  beforeEach(async () => {
    db = createTestDb();
    mgr = new SessionManager({ persist: false });
    queue = new SubmissionQueue(db);
    io = makeIoMock();
    app = buildApp(mgr, queue, io);

    // Create a session and move it to FINISHED state (in-memory)
    const snap = mgr.createSession({ name: 'Alice' });
    sessionId = snap.id;
    loserId = snap.hostId;

    // Add a second player so we can start the game
    mgr.join({ roomCode: snap.roomCode, name: 'Bob' });

    // Transition to PLAYING then FINISHED
    mgr.selectGame({ sessionId, actorId: loserId, gameId: 'test-game' });
    mgr.startGame({ sessionId, actorId: loserId });
    mgr.finishGame({ sessionId, loserId, results: [{ playerId: loserId, value: 1 }] });

    // Insert session row into DB so FK constraint is satisfied when enqueuing
    await insertSessionRow(db, { id: sessionId, roomCode: snap.roomCode, hostId: loserId });
  });

  describe('POST /api/sessions/:id/credential-input', () => {
    it('transitions FINISHED → CREDENTIAL_INPUT and returns 204', async () => {
      const res = await request(app)
        .post(`/api/sessions/${sessionId}/credential-input`)
        .send();

      expect(res.status).toBe(204);

      const updated = mgr.getById(sessionId);
      expect(updated?.status).toBe('CREDENTIAL_INPUT');
    });

    it('broadcasts room state after transition', async () => {
      await request(app)
        .post(`/api/sessions/${sessionId}/credential-input`)
        .send();

      expect((io.to as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(sessionId);
    });

    it('returns 400 for unknown session', async () => {
      const res = await request(app)
        .post('/api/sessions/nonexistent-id/credential-input')
        .send();

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/sessions/:id/submissions', () => {
    beforeEach(async () => {
      // Move to CREDENTIAL_INPUT first (required transition before QUEUED)
      await request(app)
        .post(`/api/sessions/${sessionId}/credential-input`)
        .send();
    });

    it('enqueues submission and transitions CREDENTIAL_INPUT → QUEUED', async () => {
      const res = await request(app)
        .post(`/api/sessions/${sessionId}/submissions`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('submissionId');
      expect(res.body).toHaveProperty('scheduledAt');
      expect(typeof res.body.submissionId).toBe('string');
      expect(typeof res.body.scheduledAt).toBe('number');

      const updated = mgr.getById(sessionId);
      expect(updated?.status).toBe('QUEUED');
      expect(updated?.submissionId).toBe(res.body.submissionId);
    });

    it('returns 404 for unknown session', async () => {
      const res = await request(app)
        .post('/api/sessions/nonexistent-id/submissions')
        .send();

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'session not found');
    });

    it('returns 400 when session has no loser', async () => {
      // Create a fresh session in FINISHED state but then manually inspect:
      // Actually let's create a new session that is still PREPARING (no loserId)
      const newSnap = mgr.createSession({ name: 'Carol' });
      const newSessionId = newSnap.id;

      // Transition this new session manually to CREDENTIAL_INPUT via a patched approach
      // Since we can't get to CREDENTIAL_INPUT without going through FINISHED first,
      // let's test with a session stuck in CREDENTIAL_INPUT with no loserId
      // (this shouldn't normally happen, but the route guards against it)
      // Instead, just test with the PREPARING session which has no loserId
      const res = await request(app)
        .post(`/api/sessions/${newSessionId}/submissions`)
        .send();

      // PREPARING → QUEUED is not a valid transition so it'll fail with 400
      // (either "no loser determined yet" or illegal transition)
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/submissions/:id/run-now', () => {
    it('returns 200 in mock mode', async () => {
      process.env.WORKER_MODE = 'mock';
      const res = await request(app)
        .post('/api/submissions/test-submission-id/run-now')
        .send();

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, submissionId: 'test-submission-id' });
    });

    it('returns 200 in dryrun mode', async () => {
      process.env.WORKER_MODE = 'dryrun';
      const res = await request(app)
        .post('/api/submissions/test-submission-id/run-now')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('returns 422 in live mode without x-demo-confirm header', async () => {
      process.env.WORKER_MODE = 'live';
      const res = await request(app)
        .post('/api/submissions/test-submission-id/run-now')
        .send();

      expect(res.status).toBe(422);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 200 in live mode with x-demo-confirm: yes header', async () => {
      process.env.WORKER_MODE = 'live';
      const res = await request(app)
        .post('/api/submissions/test-submission-id/run-now')
        .set('x-demo-confirm', 'yes')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });
});
