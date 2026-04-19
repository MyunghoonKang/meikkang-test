import type { Page } from 'playwright';

export interface FillInput {
  title: string;          // ex. '04월 06일 음료 지출'
  purposeKind: 'coffee' | 'lunch';
  projectCode: string;    // ex. '3009'
  budgetCode: string;     // ex. '4001'
}

const CASH_CODE = '3001';
const CONTENT = { coffee: '음료/커피', lunch: '중식' } as const;

type GridEl = Element & {
  gridView?: {
    getDataSource(): {
      setValue(row: number, field: string, value: unknown): void;
      getValue(row: number, field: string): unknown;
    };
  };
};

export async function fillForm(page: Page, input: FillInput): Promise<void> {
  // 1. 제목 입력
  const titleInput = page
    .locator('th[scope="row"]:has-text("제목")')
    .locator('xpath=ancestor::tr[1]')
    .locator('input[type="text"]')
    .first();
  await titleInput.fill(input.title);

  // 2+3. cashCd(용도) + rmkDc(내용) 한 번의 evaluate로 세팅
  await page.evaluate(
    ([code, content]) => {
      const el = document.querySelector('[data-orbit-id="APB1020WriteGridGrid"]') as GridEl | null;
      const ds = el?.gridView?.getDataSource();
      ds?.setValue(0, 'cashCd', code);
      ds?.setValue(0, 'rmkDc', content);
    },
    [CASH_CODE, CONTENT[input.purposeKind]] as [string, string],
  );

  // 4. 예산 lookup 모달 열기
  await page.locator('#budgetLookupBtn').click();
  await page.waitForSelector('.obt-modal.active', { timeout: 15_000 });

  await page.locator('.obt-modal [data-field="projectCode"]').fill(input.projectCode);
  await page.locator('.obt-modal [data-field="budgetAcctCd"]').fill(input.budgetCode);
  await page.locator('.obt-modal button:visible').filter({ hasText: /^확인$/ }).click();

  // 모달 닫힘 확인
  await page.waitForSelector('.obt-modal.active', { state: 'hidden', timeout: 10_000 });

  // 5. validateResult 대기 — '부적합' 등 최종 오류값이 세팅되면 즉시 throw
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-orbit-id="APB1020WriteGridGrid"]') as GridEl | null;
      const v = el?.gridView?.getDataSource().getValue(0, 'validateResult');
      if (v && v !== '적합') throw new Error(`validateResult='${v}' — 예산 검증 실패`);
      return v === '적합';
    },
    { timeout: 15_000 },
  );
}

/**
 * Returns the document title for the given purpose and date (KST, zero-padded).
 * Format: "04월 06일 음료 지출" or "04월 06일 중식 지출"
 */
export function defaultTitle(purposeKind: 'coffee' | 'lunch', when: Date): string {
  const kst = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
  }).format(when);
  // kst → "04. 06." → extract two groups of digits
  const [mm, dd] = kst.match(/\d{2}/g) as [string, string];
  return `${mm}월 ${dd}일 ${purposeKind === 'coffee' ? '음료' : '중식'} 지출`;
}
