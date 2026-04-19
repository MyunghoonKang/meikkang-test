import type { Page } from 'playwright';

export interface FillInput {
  title: string;          // ex. '04월 06일 음료 지출'
  purposeKind: 'coffee' | 'lunch';
  projectCode: string;    // ex. '3009'
  budgetCode: string;     // ex. '4001'
}

const CASH_CODE = '3001';
const CONTENT = { coffee: '음료/커피', lunch: '중식' } as const;

/**
 * Fills the ERP write-form with the given input:
 * 1. Sets the document title input.
 * 2. Sets cashCd (용도) via gridView API.
 * 3. Sets rmkDc (내용) via gridView API.
 * 4. Opens the budget lookup modal, fills project/budget codes, and confirms.
 * 5. Waits until validateResult === '적합' in the gridView.
 */
export async function fillForm(page: Page, input: FillInput): Promise<void> {
  // 1. 제목 입력
  const titleInput = page
    .locator('th[scope="row"]:has-text("제목")')
    .locator('xpath=ancestor::tr[1]')
    .locator('input[type="text"]')
    .first();
  await titleInput.fill(input.title);

  // 2. cashCd (용도) 세팅
  await page.evaluate((code) => {
    const el = document.querySelector('[data-orbit-id="APB1020WriteGridGrid"]') as (Element & {
      gridView?: { getDataSource(): { setValue(row: number, field: string, value: unknown): void } };
    }) | null;
    el?.gridView?.getDataSource().setValue(0, 'cashCd', code);
  }, CASH_CODE);

  // 3. rmkDc (내용) 세팅
  await page.evaluate((content) => {
    const el = document.querySelector('[data-orbit-id="APB1020WriteGridGrid"]') as (Element & {
      gridView?: { getDataSource(): { setValue(row: number, field: string, value: unknown): void } };
    }) | null;
    el?.gridView?.getDataSource().setValue(0, 'rmkDc', content);
  }, CONTENT[input.purposeKind]);

  // 4. 예산 lookup 모달 열기
  await page.locator('#budgetLookupBtn').click();
  await page.waitForSelector('.obt-modal.active', { timeout: 15_000 });

  // 4a. 프로젝트 코드 입력
  await page.locator('.obt-modal [data-field="projectCode"]').fill(input.projectCode);

  // 4b. 예산 계정 코드 입력
  await page.locator('.obt-modal [data-field="budgetAcctCd"]').fill(input.budgetCode);

  // 4c. 확인 클릭
  await page
    .locator('.obt-modal button:visible')
    .filter({ hasText: /^확인$/ })
    .click();

  // 5. validateResult === '적합' 대기
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-orbit-id="APB1020WriteGridGrid"]') as (Element & {
        gridView?: { getDataSource(): { getValue(row: number, field: string): unknown } };
      }) | null;
      return el?.gridView?.getDataSource().getValue(0, 'validateResult') === '적합';
    },
    { timeout: 15_000 },
  );
}

/**
 * Returns the default document title in KST.
 * Format: "MM월 DD일 음료 지출" or "MM월 DD일 중식 지출"
 */
export function defaultTitle(purposeKind: 'coffee' | 'lunch', when: Date): string {
  const kstDate = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
  }).format(when);
  return `${kstDate} ${purposeKind === 'coffee' ? '음료' : '중식'} 지출`;
}
