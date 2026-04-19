import { useEffect, useState, useCallback } from 'react';
import { socket } from '../socket';
import type { RoomStatePayload } from '../../shared/protocol';

type RoomSnap = RoomStatePayload;

export function useSession() {
  const [session, setSession] = useState<RoomSnap | null>(null);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    if (!socket.connected) socket.connect();
    const onState = (snap: RoomSnap) => setSession(snap);
    socket.on('room:state', onState);
    return () => { socket.off('room:state', onState); };
  }, []);

  const create = useCallback(async (name: string) => {
    return new Promise<RoomSnap>((resolve, reject) => {
      socket.emit('session:create', { name }, (res: unknown) => {
        const r = res as { error?: string; session?: RoomSnap };
        if (r.error) return reject(new Error(r.error));
        setSession(r.session!); setMe(r.session!.hostId); resolve(r.session!);
      });
    });
  }, []);

  const join = useCallback(async (roomCode: string, name: string) => {
    return new Promise<RoomSnap>((resolve, reject) => {
      socket.emit('session:join', { roomCode, name }, (res: unknown) => {
        const r = res as { error?: string; session?: RoomSnap; playerId?: string };
        if (r.error) return reject(new Error(r.error));
        setSession(r.session!); setMe(r.playerId!); resolve(r.session!);
      });
    });
  }, []);

  return { session, me, create, join, setSession };
}
