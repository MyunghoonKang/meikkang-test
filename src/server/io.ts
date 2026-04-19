import type { Server as IOServer, Socket } from 'socket.io';
import type { SessionManager } from './session/manager';
import type { SessionSnapshot } from './session/types';
import type { GameRegistry } from './games/registry';
import { GameRunner } from './games/runner';
import { onGameFinished } from './hooks/submissionHook';
import {
  SocketCreateSession, SocketJoin, SocketSelectGame,
  SocketSubmitResult,
} from '../shared/protocol';
import { randomUUID } from 'node:crypto';

interface Ctx { mgr: SessionManager; registry: GameRegistry; }

const runners = new Map<string, GameRunner>();

interface SocketMeta { sessionId: string; playerId: string; }
const socketMeta = new WeakMap<Socket, SocketMeta>();

export function broadcastRoomState(io: IOServer, snap: SessionSnapshot): void {
  io.to(snap.id).emit('room:state', {
    sessionId: snap.id,
    roomCode: snap.roomCode,
    status: snap.status,
    hostId: snap.hostId,
    players: snap.players,
    selectedGameId: snap.selectedGameId,
    loserId: snap.loserId,
    results: snap.results ?? undefined,
    submissionId: snap.submissionId,
    scheduledAt: snap.scheduledAt,
    workerStep: snap.workerStep,
    erpRefNo: snap.erpRefNo,
    errorLog: snap.errorLog,
  });
}

export function attachIo(io: IOServer, ctx: Ctx): void {
  io.on('connection', socket => {
    socket.on('session:create', (raw, ack) => {
      const parsed = SocketCreateSession.safeParse(raw);
      if (!parsed.success) return ack?.({ error: 'invalid' });
      const snap = ctx.mgr.createSession(parsed.data);
      socketMeta.set(socket, { sessionId: snap.id, playerId: snap.hostId });
      socket.join(snap.id);
      broadcastRoomState(io, snap);
      ack?.({ ok: true, session: snap });
    });

    socket.on('session:join', (raw, ack) => {
      const parsed = SocketJoin.safeParse(raw);
      if (!parsed.success) return ack?.({ error: 'invalid' });
      try {
        const snap = ctx.mgr.join(parsed.data);
        const me = snap.players[snap.players.length - 1];
        socketMeta.set(socket, { sessionId: snap.id, playerId: me.id });
        socket.join(snap.id);
        broadcastRoomState(io, snap);
        ack?.({ ok: true, session: snap, playerId: me.id });
      } catch (e: any) {
        ack?.({ error: e.message });
      }
    });

    socket.on('game:select', (raw, ack) => {
      const parsed = SocketSelectGame.safeParse(raw);
      if (!parsed.success) return ack?.({ error: 'invalid' });
      const m = socketMeta.get(socket);
      if (!m) return ack?.({ error: 'no session' });
      try {
        const snap = ctx.mgr.selectGame({ sessionId: m.sessionId, actorId: m.playerId, gameId: parsed.data.gameId });
        broadcastRoomState(io, snap);
        ack?.({ ok: true });
      } catch (e: any) { ack?.({ error: e.message }); }
    });

    socket.on('game:start', (_raw, ack) => {
      const m = socketMeta.get(socket);
      if (!m) return ack?.({ error: 'no session' });
      try {
        const snap = ctx.mgr.startGame({ sessionId: m.sessionId, actorId: m.playerId });
        const game = snap.selectedGameId ? ctx.registry.get(snap.selectedGameId) : undefined;
        if (!game) throw new Error('game not found');
        if (snap.players.length < game.minPlayers) throw new Error(`need at least ${game.minPlayers} players`);
        const runner = new GameRunner(snap.id, snap.players.map(p => p.id), game.compare);
        runners.set(snap.id, runner);
        const seed = randomUUID();
        broadcastRoomState(io, snap);
        io.to(snap.id).emit('game:begin', { session: snap, game, seed });
        ack?.({ ok: true });
      } catch (e: any) { ack?.({ error: e.message }); }
    });

    socket.on('player:submit', (raw, ack) => {
      const parsed = SocketSubmitResult.safeParse(raw);
      if (!parsed.success) return ack?.({ error: 'invalid' });
      const m = socketMeta.get(socket);
      if (!m) return ack?.({ error: 'no session' });
      const runner = runners.get(m.sessionId);
      if (!runner) return ack?.({ error: 'no active game' });
      try {
        runner.submit(m.playerId, parsed.data.value);
        if (runner.isComplete()) {
          const outcome = runner.resolve();
          const snap = ctx.mgr.finishGame({
            sessionId: m.sessionId,
            loserId: outcome.loserId,
            results: outcome.results,
          });
          runners.delete(m.sessionId);
          broadcastRoomState(io, snap);
          // Plan B 훅 호출 (현재 no-op, 4A가 B12에서 교체)
          onGameFinished(snap.id, outcome.loserId).catch(console.error);
        } else {
          io.to(m.sessionId).emit('game:progress', {
            remaining: runner.missingPlayers().length,
          });
        }
        ack?.({ ok: true });
      } catch (e: any) { ack?.({ error: e.message }); }
    });

    socket.on('disconnect', () => {
      const m = socketMeta.get(socket);
      if (m) socket.leave(m.sessionId);
    });
  });
}
