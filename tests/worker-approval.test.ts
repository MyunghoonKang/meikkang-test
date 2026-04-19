import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { openApprovalAndInject } from '../src/server/worker/approval';

const WRITEFORM_URL = pathToFileURL(
  join(process.cwd(), 'src/server/worker/mock/erp-writeform.html'),
).toString();

describe('openApprovalAndInject (mock)', () => {
  let browser: Browser;
  let context: BrowserContext;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
  });

  afterAll(async () => {
    await browser?.close();
  });

  it(
    'opens popup from [결재상신] click and injects 동석자 line into iframe body',
    async () => {
      const originPage = await context.newPage();
      await originPage.goto(WRITEFORM_URL);

      const result = await openApprovalAndInject(context, originPage, {
        attendeeNames: ['Alice', 'Bob'],
        mode: 'mock',
        submitFinal: false,
      });

      // iframe body에 동석자 라인 포함 확인
      const frame = result.popup.frameLocator('#editorView_UBAP001');
      const bodyText = await frame.locator('body').textContent();
      expect(bodyText).toContain('동석자: Alice, Bob');

      // submittedAt은 null (submitFinal=false)
      expect(result.submittedAt).toBeNull();

      // 팝업 탭 수동 close (관측-only 세션)
      await result.popup.close();
    },
    30_000,
  );

  it(
    'throws error when mode=mock and submitFinal=true',
    async () => {
      const originPage = await context.newPage();
      await originPage.goto(WRITEFORM_URL);

      await expect(
        openApprovalAndInject(context, originPage, {
          attendeeNames: ['Alice'],
          mode: 'mock',
          submitFinal: true,
        }),
      ).rejects.toThrow('mock 모드에서 submitFinal=true');
    },
    30_000,
  );
});
