// src/web/socket.ts
// A9 머지 후 이 파일 전체를 아래 두 줄로 교체:
// import { io } from 'socket.io-client';
// export const socket = io({ autoConnect: false });

import type { RoomStatePayload } from '../shared/protocol';

type RoomSnap = RoomStatePayload;

// Module-level state store keyed by roomCode
const sessions = new Map<string, RoomSnap>();
// Track submissions per session: sessionId -> list of {playerId, value}
const submissions = new Map<string, Array<{ playerId: string; value: number }>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;
const listeners = new Map<string, Set<Listener>>();

// Current player identity within this mock session
let _myPlayerId: string | null = null;
let _myRoomCode: string | null = null;

function emit(event: string, ...args: unknown[]) {
  const fns = listeners.get(event);
  if (!fns) return;
  for (const fn of fns) {
    fn(...args);
  }
}

export const socket = {
  connected: false,

  connect() {
    this.connected = true;
  },

  disconnect() {
    this.connected = false;
  },

  on(event: string, fn: Listener) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(fn);
  },

  off(event: string, fn: Listener) {
    listeners.get(event)?.delete(fn);
  },

  emit(event: string, data: unknown, cb?: (res: unknown) => void) {
    if (event === 'session:create') {
      const { name } = data as { name: string };
      const roomCode = Math.random().toString(36).slice(2, 6).toUpperCase();
      const hostId = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const snap: RoomSnap = {
        sessionId,
        roomCode,
        status: 'PREPARING',
        hostId,
        players: [{ id: hostId, name }],
        selectedGameId: null,
      };
      sessions.set(roomCode, snap);
      _myPlayerId = hostId;
      _myRoomCode = roomCode;
      cb?.({ session: snap });
      setTimeout(() => emit('room:state', snap), 50);
      return;
    }

    if (event === 'session:join') {
      const { roomCode, name } = data as { roomCode: string; name: string };
      const snap = sessions.get(roomCode);
      if (!snap) {
        cb?.({ error: 'Room not found' });
        return;
      }
      const playerId = crypto.randomUUID();
      const updatedSnap: RoomSnap = {
        ...snap,
        players: [...snap.players, { id: playerId, name }],
      };
      sessions.set(roomCode, updatedSnap);
      _myPlayerId = playerId;
      _myRoomCode = roomCode;
      cb?.({ session: updatedSnap, playerId });
      setTimeout(() => emit('room:state', updatedSnap), 50);
      return;
    }

    if (event === 'game:select') {
      const { gameId } = data as { gameId: string };
      if (_myRoomCode) {
        const snap = sessions.get(_myRoomCode);
        if (snap) {
          const updatedSnap: RoomSnap = { ...snap, selectedGameId: gameId };
          sessions.set(_myRoomCode, updatedSnap);
          setTimeout(() => emit('room:state', updatedSnap), 50);
        }
      }
      cb?.({});
      return;
    }

    if (event === 'game:start') {
      if (_myRoomCode) {
        const snap = sessions.get(_myRoomCode);
        if (snap) {
          const updatedSnap: RoomSnap = { ...snap, status: 'PLAYING' };
          sessions.set(_myRoomCode, updatedSnap);
          setTimeout(() => {
            emit('room:state', updatedSnap);
            emit('game:begin', {
              game: {
                id: snap.selectedGameId ?? 'number-guess',
                filename: 'number-guess.html',
                title: '숫자 맞추기',
                minPlayers: 2,
                maxPlayers: 8,
                description: '',
                compare: 'max',
              },
              seed: 'demo-seed-1234',
            });
          }, 100);
        }
      }
      cb?.({});
      return;
    }

    if (event === 'player:submit') {
      const { value } = data as { value: number };
      if (_myRoomCode && _myPlayerId) {
        const snap = sessions.get(_myRoomCode);
        if (snap) {
          const sessionId = snap.sessionId;
          if (!submissions.has(sessionId)) submissions.set(sessionId, []);
          submissions.get(sessionId)!.push({ playerId: _myPlayerId, value });

          const playerCount = snap.players.length;
          const submitted = submissions.get(sessionId)!;

          // Resolve after all players submitted or after 1 submission in solo demo mode
          if (submitted.length >= playerCount || playerCount <= 1) {
            emit('game:progress', { submitted: submitted.length, total: playerCount });
            setTimeout(() => {
              // Determine loser based on compare rule (for demo, the submitter loses)
              const loserId = submitted[0].playerId;
              const finishedSnap: RoomSnap = {
                ...snap,
                status: 'FINISHED',
                loserId,
                results: submitted,
              };
              sessions.set(_myRoomCode!, finishedSnap);
              emit('room:state', finishedSnap);
            }, 500);
          }
        }
      }
      return;
    }
  },
};
