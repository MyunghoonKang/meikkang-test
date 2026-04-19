import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { resolveMode } from './mode';
import { launchBrowser } from './browser';
import { makeScreenshotDir, snap } from './screenshots';
import { login, LoginError } from './login';
import type { WorkerResult, WorkerDeps, WorkerMode } from './types';

export type { WorkerResult, WorkerDeps, WorkerMode };

// Module-level deps reference, injected by 4A via initWorker()
let _deps: WorkerDeps | null = null;

/**
 * Returns the ERP login URL for the given mode.
 * - mock:    local file:// URL pointing to mock/erp-login.html
 * - live/dryrun: process.env.ERP_BASE_URL + '/#/login'
 */
function loginUrlFor(mode: WorkerMode): string {
  if (mode === 'mock') {
    return pathToFileURL(
      join(dirname(fileURLToPath(import.meta.url)), 'mock', 'erp-login.html'),
    ).toString();
  }
  const base = process.env['ERP_BASE_URL'];
  if (!base) {
    throw new Error('ERP_BASE_URL environment variable is required for live/dryrun mode');
  }
  return `${base}/#/login`;
}

/**
 * Called by 4A (server) to inject vault/submission dependencies.
 * Must be called before any runSubmission() invocation.
 */
export function initWorker(deps: WorkerDeps): void {
  _deps = deps;
}

/**
 * Executes the ERP submission flow for the given submissionId.
 *
 * Modes:
 *  - dryrun: creates screenshot dir and returns COMPLETED immediately
 *  - mock:   launches headed Chromium, logs "not implemented yet", returns FAILED_OTHER
 *  - live:   same stub behaviour as mock for now (not implemented)
 */
export async function runSubmission(submissionId: string): Promise<WorkerResult> {
  if (_deps === null) {
    throw new Error('initWorker() has not been called');
  }

  const deps = _deps;
  const mode = resolveMode(process.env);

  // 제출 정보 로드
  const sub = await deps.loadSubmission(submissionId);
  if (!sub) {
    return { status: 'FAILED_OTHER', erpRefNo: null, sunginNb: null, screenshotDir: null, errorLog: `submission ${submissionId} not found` };
  }

  if (mode === 'dryrun') {
    const screenshotDir = makeScreenshotDir(submissionId);
    const result = {
      erpRefNo: null,
      sunginNb: null,
      screenshotDir,
    };
    await deps.complete(submissionId, result);
    return {
      status: 'COMPLETED',
      errorLog: null,
      ...result,
    };
  }

  // mock | live — launch browser and perform login
  const screenshotDir = makeScreenshotDir(submissionId);
  const session = await launchBrowser({ headless: mode === 'live' });
  try {
    // Step: login
    await deps.reportStep(sub.sessionId, 'login');

    const cred = await deps.loadCredential(sub.loserUserId);
    if (!cred) {
      const errorLog = `No credential found for user ${sub.loserUserId}`;
      await deps.fail(submissionId, { status: 'FAILED_AUTH', errorLog, screenshotDir });
      return { status: 'FAILED_AUTH', erpRefNo: null, sunginNb: null, screenshotDir, errorLog };
    }

    const page = await session.context.newPage();
    try {
      await login(page, cred, { loginUrl: loginUrlFor(mode) });
    } catch (e) {
      await snap(page, screenshotDir, 'login-fail');
      const errorLog = e instanceof LoginError ? e.message : String(e);
      await deps.fail(submissionId, { status: 'FAILED_AUTH', errorLog, screenshotDir });
      return { status: 'FAILED_AUTH', erpRefNo: null, sunginNb: null, screenshotDir, errorLog };
    }

    // Subsequent steps (B8+) — not implemented yet
    console.log(`[worker] runSubmission(${submissionId}) mode=${mode} — login OK, remaining steps not implemented yet`);
    const result = {
      status: 'FAILED_OTHER' as const,
      erpRefNo: null,
      sunginNb: null,
      screenshotDir,
      errorLog: 'runSubmission: steps after login not implemented yet',
    };
    await deps.fail(submissionId, {
      status: result.status,
      errorLog: result.errorLog,
      screenshotDir,
    });
    return result;
  } finally {
    await session.close();
  }
}
