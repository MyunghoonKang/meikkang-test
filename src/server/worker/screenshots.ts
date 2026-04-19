import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';

const DATA_DIR = join(process.cwd(), 'data', 'screenshots');

/**
 * Creates the screenshot directory for a submission and returns its path.
 * data/screenshots/{submissionId}
 */
export function makeScreenshotDir(submissionId: string): string {
  const dir = join(DATA_DIR, submissionId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Takes a screenshot of the given page, saves it as {name}.png under dir,
 * and returns the full path to the saved file.
 */
export async function snap(page: Page, dir: string, name: string): Promise<string> {
  const filePath = join(dir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}
