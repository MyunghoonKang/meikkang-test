import { describe, it, expect } from 'vitest';
import { IframeSubmit, SocketJoin, Outcome, RoomStatus, RoomStatePayload } from '../src/shared/protocol';

describe('protocol schemas', () => {
  it('accepts valid iframe submit', () => {
    expect(IframeSubmit.safeParse({ type: 'submit', value: 42 }).success).toBe(true);
  });
  it('rejects submit without value', () => {
    expect(IframeSubmit.safeParse({ type: 'submit' }).success).toBe(false);
  });
  it('rejects non-numeric submit', () => {
    expect(IframeSubmit.safeParse({ type: 'submit', value: 'big' }).success).toBe(false);
  });
  it('accepts socket join payload', () => {
    expect(SocketJoin.safeParse({ roomCode: 'ABCD', name: 'Alice' }).success).toBe(true);
  });
  it('requires 4-char room code', () => {
    expect(SocketJoin.safeParse({ roomCode: 'AB', name: 'A' }).success).toBe(false);
  });
  it('parses outcome with results array', () => {
    const r = Outcome.safeParse({
      type: 'outcome', loserId: 'p1',
      results: [{ playerId: 'p1', value: 10 }, { playerId: 'p2', value: 3 }],
    });
    expect(r.success).toBe(true);
  });
  it('RoomStatus accepts all 9 values', () => {
    for (const s of ['PREPARING','PLAYING','FINISHED','CREDENTIAL_INPUT','QUEUED','RUNNING','COMPLETED','FAILED','ABORTED']) {
      expect(RoomStatus.safeParse(s).success).toBe(true);
    }
    expect(RoomStatus.safeParse('LOBBY').success).toBe(false);
  });
  it('RoomStatePayload accepts minimal PREPARING snapshot', () => {
    const r = RoomStatePayload.safeParse({
      sessionId: 's1', roomCode: 'ABCD', status: 'PREPARING',
      hostId: 'h1', players: [{ id: 'h1', name: 'A' }], selectedGameId: null,
    });
    expect(r.success).toBe(true);
  });
  it('RoomStatePayload accepts COMPLETED with erpRefNo', () => {
    const r = RoomStatePayload.safeParse({
      sessionId: 's1', roomCode: 'ABCD', status: 'COMPLETED',
      hostId: 'h1', players: [{ id: 'h1', name: 'A' }], selectedGameId: 'g1',
      loserId: 'h1', erpRefNo: 'EX-2026-0001',
    });
    expect(r.success).toBe(true);
  });
});
