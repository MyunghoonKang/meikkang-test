import { useEffect, useState, useCallback } from 'react';
import { socket } from '../socket';
import type { RoomStatePayload } from '../../shared/protocol';

type RoomSnap = RoomStatePayload;

let _session: RoomSnap | null = null;
let _me: string | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach(fn => fn());

function toPayload(s: any): RoomSnap {
  return {
    sessionId: s.sessionId ?? s.id,
    roomCode: s.roomCode,
    status: s.status,
    hostId: s.hostId,
    players: s.players,
    selectedGameId: s.selectedGameId ?? null,
    loserId: s.loserId,
    results: s.results,
    submissionId: s.submissionId,
    scheduledAt: s.scheduledAt,
    workerStep: s.workerStep,
    erpRefNo: s.erpRefNo,
    errorLog: s.errorLog,
  };
}

export function useSession() {
  const [, force] = useState(0);

  useEffect(() => {
    const fn = () => force(n => n + 1);
    subs.add(fn);
    return () => { subs.delete(fn); };
  }, []);

  useEffect(() => {
    if (!socket.connected) socket.connect();
    const onState = (snap: any) => { _session = toPayload(snap); emit(); };
    socket.on('room:state', onState);
    return () => { socket.off('room:state', onState); };
  }, []);

  const create = useCallback(async (name: string) => {
    return new Promise<RoomSnap>((resolve, reject) => {
      socket.emit('session:create', { name }, (res: any) => {
        if (res?.error) return reject(new Error(res.error));
        _session = toPayload(res.session);
        _me = res.session.hostId;
        emit();
        resolve(_session);
      });
    });
  }, []);

  const join = useCallback(async (roomCode: string, name: string) => {
    return new Promise<RoomSnap>((resolve, reject) => {
      socket.emit('session:join', { roomCode, name }, (res: any) => {
        if (res?.error) return reject(new Error(res.error));
        _session = toPayload(res.session);
        _me = res.playerId;
        emit();
        resolve(_session);
      });
    });
  }, []);

  return { session: _session, me: _me, create, join };
}
