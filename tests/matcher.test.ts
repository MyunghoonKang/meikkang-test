import { describe, it, expect } from 'vitest';
import { matchCardRow, type CardRow, type MatchCriteria } from '../src/server/worker/matcher';
import rows from './fixtures/cardRows.json' with { type: 'json' };

describe('matchCardRow', () => {
  it('returns the closest matching row from cardRows.json fixture', () => {
    // sessionStartedAt = 2026-04-06T04:29:00Z = 13:29:00 KST
    // '68763054' is at 13:29:26 KST → |delta| = 26s  (within 60min)
    // '68763055' is at 12:00:00 KST → |delta| = 89min (outside 60min tolerance)
    // → only '68763054' passes; it should be returned
    const criteria: MatchCriteria = {
      cardCd: '5105545000378130',
      sessionDate: '20260406',
      sessionStartedAt: new Date('2026-04-06T04:29:00Z'),
      toleranceMinutes: 60,
    };
    const result = matchCardRow(rows as CardRow[], criteria);
    expect(result).not.toBeNull();
    expect(result!.sunginNb).toBe('68763054');
  });

  it('returns null when cardCd does not match any row', () => {
    const criteria: MatchCriteria = {
      cardCd: '0000000000000000',
      sessionDate: '20260406',
      sessionStartedAt: new Date('2026-04-06T04:29:00Z'),
      toleranceMinutes: 60,
    };
    const result = matchCardRow(rows as CardRow[], criteria);
    expect(result).toBeNull();
  });

  it('selects the closest-time row from multiple candidates', () => {
    // sessionStartedAt = 2026-04-06T01:05:30Z = 10:05:30 KST
    // 'A' is at 10:00:00 KST → delta = -5.5min  (|delta|=5.5min)
    // 'B' is at 10:05:00 KST → delta = -0.5min  (|delta|=0.5min) ← closest
    // 'C' is at 09:00:00 KST → delta = -65.5min (|delta|=65.5min)
    // All within 120min tolerance → 'B' has smallest |delta|
    const customRows: CardRow[] = [
      {
        cardCd: 'TEST0001',
        issDt: '20260406',
        issTime: '10:00:00',
        formatedIssDtTime: '2026-04-06 10:00:00',
        sunginNb: 'A',
        supAm: 1000, vatAm: 100, sunginAm: 1100,
      },
      {
        cardCd: 'TEST0001',
        issDt: '20260406',
        issTime: '10:05:00',
        formatedIssDtTime: '2026-04-06 10:05:00',
        sunginNb: 'B',
        supAm: 2000, vatAm: 200, sunginAm: 2200,
      },
      {
        cardCd: 'TEST0001',
        issDt: '20260406',
        issTime: '09:00:00',
        formatedIssDtTime: '2026-04-06 09:00:00',
        sunginNb: 'C',
        supAm: 3000, vatAm: 300, sunginAm: 3300,
      },
    ];
    const criteria: MatchCriteria = {
      cardCd: 'TEST0001',
      sessionDate: '20260406',
      sessionStartedAt: new Date('2026-04-06T01:05:30Z'), // 10:05:30 KST
      toleranceMinutes: 120,
    };
    const result = matchCardRow(customRows, criteria);
    expect(result).not.toBeNull();
    expect(result!.sunginNb).toBe('B');
  });

  it('returns null when matching sunginNb is excluded (idempotency)', () => {
    // '68763054' was the only match; excluding it → null
    const criteria: MatchCriteria = {
      cardCd: '5105545000378130',
      sessionDate: '20260406',
      sessionStartedAt: new Date('2026-04-06T04:29:00Z'),
      toleranceMinutes: 60,
      excludeSunginNbs: ['68763054'],
    };
    const result = matchCardRow(rows as CardRow[], criteria);
    expect(result).toBeNull();
  });
});
