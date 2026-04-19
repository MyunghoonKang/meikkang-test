import { Router } from 'express';
import type { Server as IOServer } from 'socket.io';
import type { SessionManager } from '../session/manager';
import type { SubmissionQueue } from '../submissions/queue';
import { broadcastRoomState } from '../io';
import { nextBusinessDayNineAm } from '../submissions/scheduling';
import { db } from '../db/client';
import { sessions } from '../db/schema';

export function submissionsRouter(mgr: SessionManager, queue: SubmissionQueue, io: IOServer): Router {
  const r = Router();

  // POST /api/sessions/:id/credential-input — FINISHED → CREDENTIAL_INPUT
  r.post('/sessions/:id/credential-input', async (req, res) => {
    try {
      const snap = mgr.transitionStatus({ sessionId: req.params.id, to: 'CREDENTIAL_INPUT' });
      broadcastRoomState(io, snap);
      res.status(204).end();
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/sessions/:id/submissions — enqueue + CREDENTIAL_INPUT → QUEUED
  r.post('/sessions/:id/submissions', async (req, res) => {
    try {
      const session = mgr.getById(req.params.id);
      if (!session) return void res.status(404).json({ error: 'session not found' });
      if (!session.loserId) return void res.status(400).json({ error: 'no loser determined yet' });

      const scheduledAt = nextBusinessDayNineAm();
      const mode = (process.env.WORKER_MODE ?? 'mock') as 'live' | 'mock' | 'dryrun';
      const attendeeNames = session.players.map(p => p.name);

      // in-memory SessionManager → sessions 테이블에 사전 upsert (FK 보장)
      db
        .insert(sessions)
        .values({
          id: session.id,
          roomCode: session.roomCode,
          status: session.status,
          hostId: session.hostId,
          selectedGameId: session.selectedGameId,
          loserId: session.loserId,
          createdAt: session.createdAt ?? Date.now(),
        })
        .onConflictDoNothing()
        .run();

      const submissionId = await queue.enqueue({
        sessionId: session.id,
        loserUserId: session.loserId,
        scheduledAt,
        attendeeNames,
        purposeKind: 'lunch',
        mode,
      });

      const snap = mgr.transitionStatus({
        sessionId: req.params.id,
        to: 'QUEUED',
        patch: { submissionId, scheduledAt: scheduledAt.getTime() },
      });
      broadcastRoomState(io, snap);

      res.json({ submissionId, scheduledAt: scheduledAt.getTime() });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/submissions/:id/run-now — demo trigger (mock/dryrun only)
  r.post('/submissions/:id/run-now', async (req, res) => {
    const mode = process.env.WORKER_MODE ?? 'mock';
    const demoConfirm = req.headers['x-demo-confirm'] === 'yes';
    if (mode === 'live' && !demoConfirm) {
      return void res.status(422).json({ error: 'run-now not allowed in live mode' });
    }
    // runSubmission will be wired in index.ts; for now just acknowledge
    res.json({ ok: true, submissionId: req.params.id });
  });

  return r;
}
