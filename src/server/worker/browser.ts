import { chromium, type Browser, type BrowserContext } from 'playwright';

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  close(): Promise<void>;
}

/**
 * Launches a Chromium browser and returns a BrowserSession.
 * Always call with { headless: false } per project constraints.
 */
export async function launchBrowser(opts: { headless: boolean }): Promise<BrowserSession> {
  const browser = await chromium.launch({ headless: opts.headless });
  const context = await browser.newContext();

  return {
    browser,
    context,
    async close() {
      await context.close();
      await browser.close();
    },
  };
}
