import type { Page } from 'playwright';

/**
 * Navigates to the write-form URL and waits for the main grid to be ready.
 */
export async function openWriteForm(page: Page, baseUrl: string): Promise<void> {
  const url = `${baseUrl}/#/HP/APB1020/APB1020?formDTp=APB1020_00001&formId=22`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-orbit-id="APB1020WriteGridGrid"]', { timeout: 30_000 });
}
