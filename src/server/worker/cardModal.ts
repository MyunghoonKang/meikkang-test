import type { Page } from 'playwright';
import { matchCardRow, type CardRow, type MatchCriteria } from './matcher';

export class NoMatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoMatchError';
  }
}

/**
 * Clicks the '[카드사용내역]' button and waits for the card modal grid to appear.
 */
export async function openCardModal(page: Page): Promise<void> {
  await page.getByText('[카드사용내역]').click();
  await page.waitForSelector('[data-orbit-id="cardDataGridTab1"]', { timeout: 30_000 });
}

/**
 * Polls the cardDataGridTab1 gridView for rows, finds the best match using
 * matchCardRow, checks the row item, clicks the confirm button, and returns
 * the matched sunginNb.
 *
 * Throws NoMatchError if no row matches the criteria.
 */
export async function selectCardRow(page: Page, criteria: MatchCriteria): Promise<string> {
  // Poll until gridView rows are available
  const jsonRows = await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-orbit-id="cardDataGridTab1"]') as (Element & {
        gridView?: { getDataSource(): { getJsonRows(): unknown[] } };
      }) | null;
      const rows = el?.gridView?.getDataSource().getJsonRows();
      if (rows && rows.length > 0) return rows;
      return null;
    },
    { polling: 500, timeout: 30_000 },
  );

  const rawRows = await jsonRows.jsonValue() as CardRow[];

  const matched = matchCardRow(rawRows, criteria);
  if (!matched) {
    throw new NoMatchError(
      `No card row matched criteria: cardCd=${criteria.cardCd}, sessionDate=${criteria.sessionDate}`,
    );
  }

  // Find the index of the matched row
  const idx = rawRows.findIndex((r) => r.sunginNb === matched.sunginNb);

  // Check (select) the matched row in the gridView
  await page.evaluate(
    ({ idx: rowIdx }) => {
      const el = document.querySelector('[data-orbit-id="cardDataGridTab1"]') as (Element & {
        gridView?: { checkItem(idx: number, checked: boolean): void };
      }) | null;
      el?.gridView?.checkItem(rowIdx, true);
    },
    { idx },
  );

  // Click the confirm button
  await page.locator('button:visible', { hasText: /^확인$/ }).first().click();

  return matched.sunginNb;
}
