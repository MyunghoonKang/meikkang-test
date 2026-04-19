import { describe, it, expect } from 'vitest';
import { nextBusinessDayNineAm } from '../src/server/submissions/scheduling';

describe('nextBusinessDayNineAm (Asia/Seoul)', () => {
  it('weekday evening → next day 09:00 KST', () => {
    // 2026-04-20 (Mon) 20:00 KST = 2026-04-20T11:00Z
    const at = nextBusinessDayNineAm(new Date('2026-04-20T11:00:00Z'));
    expect(at.toISOString()).toBe('2026-04-21T00:00:00.000Z'); // 09:00 KST = 00:00Z
  });

  it('Friday evening → next Monday 09:00 KST', () => {
    // 2026-04-24 (Fri) 20:00 KST
    const at = nextBusinessDayNineAm(new Date('2026-04-24T11:00:00Z'));
    expect(at.toISOString()).toBe('2026-04-27T00:00:00.000Z');
  });

  it('Saturday → Monday', () => {
    const at = nextBusinessDayNineAm(new Date('2026-04-25T11:00:00Z'));
    expect(at.toISOString()).toBe('2026-04-27T00:00:00.000Z');
  });

  it('weekday 08:00 KST → same day 09:00 KST', () => {
    // 2026-04-21 (Tue) 08:00 KST = 2026-04-20T23:00Z
    const at = nextBusinessDayNineAm(new Date('2026-04-20T23:00:00Z'));
    expect(at.toISOString()).toBe('2026-04-21T00:00:00.000Z');
  });
});
