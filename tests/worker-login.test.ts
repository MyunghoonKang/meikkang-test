import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { login } from '../src/server/worker/login';

const MOCK_URL = pathToFileURL(
  join(process.cwd(), 'src/server/worker/mock/erp-login.html'),
).toString();

describe('login (mock)', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  it(
    'types userId, clicks 다음, types password, clicks 로그인, navigates to writeform',
    async () => {
      await login(page, { loginId: 'alice', password: 'pw123' }, { loginUrl: MOCK_URL });
      expect(page.url()).toContain('erp-writeform.html');
    },
    30_000,
  );
});
