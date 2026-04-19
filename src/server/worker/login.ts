import type { Page } from 'playwright';
import type { ErpCredential } from '../vault/types';

export type { ErpCredential };

export interface LoginOptions {
  loginUrl: string;      // file:// or https://
  companyCode?: string;  // default: 'meissa'
  timeoutMs?: number;    // default: 30_000
}

export class LoginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoginError';
  }
}

export async function login(page: Page, cred: ErpCredential, opts: LoginOptions): Promise<void> {
  const timeout = opts.timeoutMs ?? 30_000;
  const expectedCompanyCode = opts.companyCode ?? 'meissa';

  // 1. Navigate to login page
  await page.goto(opts.loginUrl, { waitUntil: 'domcontentloaded', timeout });

  // 2. Check #companyCode (disabled field — use inputValue to verify)
  const actualCompanyCode = await page.inputValue('#companyCode');
  if (actualCompanyCode !== expectedCompanyCode) {
    throw new LoginError(
      `Company code mismatch: expected "${expectedCompanyCode}", got "${actualCompanyCode}"`,
    );
  }

  // 3. Fill userId
  await page.locator('input[name="userId"], #userId').first().fill(cred.loginId);

  // 4. Click 다음 button
  await page.getByRole('button', { name: '다음' }).click();

  // 5. Fill password
  await page.locator('input[name="password"], #password').first().fill(cred.password);

  // 6. Click 로그인 button
  await page.getByRole('button', { name: '로그인' }).click();

  // 7. Wait for navigation to settle
  await page.waitForLoadState('networkidle', { timeout });

  // Verify navigation succeeded
  const finalUrl = page.url();
  const isMock = opts.loginUrl.startsWith('file://');

  if (isMock) {
    // Mock: must have navigated away from erp-login.html to erp-writeform.html
    if (!finalUrl.includes('erp-writeform.html')) {
      throw new LoginError(
        `Login failed (mock): expected navigation to erp-writeform.html, but stayed at ${finalUrl}`,
      );
    }
  } else {
    // Live: if we're still on /login path, credentials were rejected
    if (new URL(finalUrl).pathname.includes('/login')) {
      throw new LoginError(`Login failed: still on login page after submit (url=${finalUrl})`);
    }
  }
}
