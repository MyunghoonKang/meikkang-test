import type { Page, BrowserContext } from 'playwright';

export interface ApprovalInput {
  attendeeNames: string[];
  mode: 'live' | 'mock' | 'dryrun';
  submitFinal: boolean; // true이면 [상신] 클릭, false이면 팝업만 열고 참석자 주입 후 반환
}

export interface ApprovalResult {
  popup: Page;
  submittedAt: Date | null;
}

/**
 * originPage의 [결재상신] 버튼을 클릭해 팝업을 열고,
 * dzEditor iframe에 동석자 라인을 주입한다.
 *
 * ERP 안전 규칙: mock 모드에서 submitFinal=true는 절대 허용하지 않는다.
 */
export async function openApprovalAndInject(
  context: BrowserContext,
  originPage: Page,
  input: ApprovalInput,
): Promise<ApprovalResult> {
  const { attendeeNames, mode, submitFinal } = input;

  // 안전 방어: mock 모드에서 submitFinal=true는 에러
  if (mode === 'mock' && submitFinal === true) {
    throw new Error(
      '[approval] mock 모드에서 submitFinal=true는 허용되지 않습니다. ERP_CONFIRM_SUBMIT 없이 상신 금지.',
    );
  }

  // 1. 새 탭(팝업) 이벤트 대기 등록
  const popupPromise = context.waitForEvent('page');

  // 2. [결재상신] 버튼 클릭 (텍스트 우선, 폴백 #approvalBtn)
  const btn = originPage
    .locator('button', { hasText: /^결재상신$/ })
    .or(originPage.locator('#approvalBtn'));
  await btn.click();

  // 3. 새 탭(팝업) 취득
  const popup = await popupPromise;

  // 4. DOM 로드 대기
  await popup.waitForLoadState('domcontentloaded');

  // 5. live 모드일 때 URL 검증
  if (mode === 'live') {
    const url = popup.url();
    if (!url.includes('callComp=UBAP001')) {
      throw new Error(
        `[approval] live 모드: 결재상신 팝업 URL에 callComp=UBAP001 가 없습니다. (url=${url})`,
      );
    }
  }

  // 6. dzEditor iframe에 동석자 라인 주입
  const attendeesLine = '동석자: ' + attendeeNames.join(', ');
  const frame = popup.frameLocator('#editorView_UBAP001');
  const body = frame.locator('body');

  await body.evaluate(
    (el: HTMLElement, line: string) => {
      const p = el.ownerDocument.createElement('p');
      p.textContent = line;
      el.appendChild(p);
    },
    attendeesLine,
  );

  // 7. submitFinal=false이면 팝업만 열고 반환
  if (!submitFinal) {
    return { popup, submittedAt: null };
  }

  // 8. submitFinal=true: [상신] 버튼 클릭 (live 모드 전용)
  popup.once('dialog', (d) => d.accept());
  await popup.locator('button', { hasText: /^상신$/ }).click();
  await popup.waitForLoadState('networkidle', { timeout: 30_000 });

  return { popup, submittedAt: new Date() };
}
