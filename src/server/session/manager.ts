import { randomUUID } from 'node:crypto';
import { generateRoomCode } from './roomCode';
import { ALLOWED_TRANSITIONS } from '../../shared/protocol';
import type { RoomStatus } from '../../shared/protocol';
import type { CreateSessionInput, JoinSessionInput, SessionSnapshot } from './types';

interface Options { persist?: boolean; }

export class SessionManager {
  private byId = new Map<string, SessionSnapshot>();
  private byRoom = new Map<string, string>(); // roomCode → id
  private persist: boolean;
  constructor(opts: Options = {}) { this.persist = opts.persist ?? true; }

  createSession(input: CreateSessionInput): SessionSnapshot {
    const excluded = new Set(this.byRoom.keys());
    const roomCode = generateRoomCode(excluded);
    const id = randomUUID();
    const hostId = randomUUID();
    const snapshot: SessionSnapshot = {
      id, roomCode, status: 'PREPARING', hostId,
      players: [{ id: hostId, name: input.name }],
      selectedGameId: null, startedAt: null, createdAt: Date.now(),
      loserId: null, results: null,
      submissionId: null, scheduledAt: null,
      workerStep: null, erpRefNo: null, errorLog: null,
    };
    this.byId.set(id, snapshot);
    this.byRoom.set(roomCode, id);
    return { ...snapshot, players: [...snapshot.players] };
  }

  join(input: JoinSessionInput): SessionSnapshot {
    const id = this.byRoom.get(input.roomCode.toUpperCase());
    if (!id) throw new Error(`session not found for code ${input.roomCode}`);
    const snap = this.byId.get(id)!;
    if (snap.status !== 'PREPARING') throw new Error('session already started');
    const playerId = randomUUID();
    snap.players.push({ id: playerId, name: input.name });
    return { ...snap, players: [...snap.players] };
  }

  getById(id: string): SessionSnapshot | undefined {
    const s = this.byId.get(id);
    return s ? { ...s, players: [...s.players] } : undefined;
  }

  getByRoomCode(code: string): SessionSnapshot | undefined {
    const id = this.byRoom.get(code.toUpperCase());
    return id ? this.getById(id) : undefined;
  }

  selectGame({ sessionId, actorId, gameId }: { sessionId: string; actorId: string; gameId: string; }): SessionSnapshot {
    const snap = this.requireSession(sessionId);
    if (snap.hostId !== actorId) throw new Error('host only');
    snap.selectedGameId = gameId;
    return { ...snap, players: [...snap.players] };
  }

  startGame({ sessionId, actorId }: { sessionId: string; actorId: string; }): SessionSnapshot {
    const snap = this.requireSession(sessionId);
    if (snap.hostId !== actorId) throw new Error('host only');
    if (!snap.selectedGameId) throw new Error('no game selected');
    this.assertTransition(snap.status, 'PLAYING');
    snap.status = 'PLAYING';
    snap.startedAt = Date.now();
    return { ...snap, players: [...snap.players] };
  }

  finishGame(input: {
    sessionId: string;
    loserId: string;
    results: { playerId: string; value: number }[];
  }): SessionSnapshot {
    const snap = this.requireSession(input.sessionId);
    this.assertTransition(snap.status, 'FINISHED');
    snap.status = 'FINISHED';
    snap.loserId = input.loserId;
    snap.results = input.results;
    return { ...snap, players: [...snap.players] };
  }

  transitionStatus(input: {
    sessionId: string;
    to: RoomStatus;
    patch?: Partial<Pick<SessionSnapshot, 'submissionId' | 'scheduledAt' | 'workerStep' | 'erpRefNo' | 'errorLog'>>;
  }): SessionSnapshot {
    const snap = this.requireSession(input.sessionId);
    this.assertTransition(snap.status, input.to);
    snap.status = input.to;
    if (input.patch) Object.assign(snap, input.patch);
    return { ...snap, players: [...snap.players] };
  }

  abort({ sessionId }: { sessionId: string; }): SessionSnapshot {
    const snap = this.requireSession(sessionId);
    snap.status = 'ABORTED';
    return { ...snap, players: [...snap.players] };
  }

  private assertTransition(from: RoomStatus, to: RoomStatus): void {
    const allowed = ALLOWED_TRANSITIONS[from] as readonly RoomStatus[];
    if (!allowed.includes(to)) {
      throw new Error(`illegal transition ${from} → ${to}`);
    }
  }

  private requireSession(id: string): SessionSnapshot {
    const snap = this.byId.get(id);
    if (!snap) throw new Error('session not found');
    return snap;
  }
}
