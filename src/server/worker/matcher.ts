export interface CardRow {
  cardCd: string;
  issDt: string;             // YYYYMMDD
  issTime: string;           // HH:MM:SS
  formatedIssDtTime: string; // 'YYYY-MM-DD HH:MM:SS' (KST)
  sunginNb: string;
  supAm: number;
  vatAm: number;
  sunginAm: number;
  chainName?: string;
  payDt?: string;
}

export interface MatchCriteria {
  cardCd: string;
  sessionDate: string;           // YYYYMMDD
  sessionStartedAt: Date;        // UTC
  toleranceMinutes: number;
  excludeSunginNbs?: string[];
}

/**
 * Finds the best matching CardRow from `rows` given `criteria`.
 *
 * Matching logic:
 * 1. Filter rows where cardCd === c.cardCd, issDt === c.sessionDate,
 *    and sunginNb not in excludeSunginNbs
 * 2. Compute delta = KST timestamp of row − sessionStartedAt (ms)
 * 3. Keep rows where |delta| <= toleranceMinutes * 60_000
 * 4. Sort by delta ascending (closest-in-time first, preferring rows after session start)
 * 5. Return first, or null if none
 */
export function matchCardRow(rows: CardRow[], c: MatchCriteria): CardRow | null {
  const exclude = new Set(c.excludeSunginNbs ?? []);

  // Step 1: Filter by cardCd, issDt, and excludeSunginNbs
  const candidates = rows.filter(
    (r) => r.cardCd === c.cardCd && r.issDt === c.sessionDate && !exclude.has(r.sunginNb),
  );

  const toleranceMs = c.toleranceMinutes * 60_000;

  // Step 2 & 3: Compute delta and filter by tolerance
  const withinTolerance = candidates
    .map((r) => {
      const kstMs = Date.parse(r.formatedIssDtTime.replace(' ', 'T') + '+09:00');
      const delta = kstMs - c.sessionStartedAt.getTime();
      return { row: r, delta };
    })
    .filter(({ delta }) => Math.abs(delta) <= toleranceMs);

  if (withinTolerance.length === 0) return null;

  // Step 4: Sort by |delta| ascending (closest in time first)
  withinTolerance.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));

  // Step 5: Return first
  return withinTolerance[0].row;
}
