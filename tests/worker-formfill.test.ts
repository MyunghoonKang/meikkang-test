import { describe, it, expect } from 'vitest';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { fillForm, defaultTitle } from '../src/server/worker/formFill';

const URL_WRITEFORM = pathToFileURL(
  join(process.cwd(), 'src/server/worker/mock/erp-writeform.html'),
).toString();

describe('fillForm (mock)', () => {
  it(
    'populates title, cashCd=3001, rmkDc=음료/커피, 예산 3009/4001, validateResult=적합',
    async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      try {
        await page.goto(URL_WRITEFORM);
        await fillForm(page, {
          title: '04월 06일 음료 지출',
          purposeKind: 'coffee',
          projectCode: '3009',
          budgetCode: '4001',
        });

        const row = await page.evaluate(() => {
          const el = document.querySelector('[data-orbit-id="APB1020WriteGridGrid"]') as (Element & {
            gridView?: { getDataSource(): { getJsonRows(): Record<string, unknown>[] } };
          }) | null;
          return el?.gridView?.getDataSource().getJsonRows()[0];
        });

        expect(row?.cashCd).toBe('3001');
        expect(row?.rmkDc).toBe('음료/커피');
        expect(row?.budgetAcctCd).toBe('4001');
        expect(row?.validateResult).toBe('적합');

        // Also verify title was set in the DOM
        const titleVal = await page.inputValue('#docTitle');
        expect(titleVal).toBe('04월 06일 음료 지출');
      } finally {
        await browser.close();
      }
    },
    30_000,
  );
});

describe('defaultTitle', () => {
  it('returns coffee title in KST zero-padded format', () => {
    // 2026-04-06 UTC → 2026-04-06 KST (UTC+9 so still April 6)
    const d = new Date('2026-04-06T04:00:00Z');
    expect(defaultTitle('coffee', d)).toBe('04월 06일 음료 지출');
  });

  it('returns lunch title in KST zero-padded format', () => {
    const d = new Date('2026-04-06T04:00:00Z');
    expect(defaultTitle('lunch', d)).toBe('04월 06일 중식 지출');
  });
});
