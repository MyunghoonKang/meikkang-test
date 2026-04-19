import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { resolveMode } from './mode';
import { launchBrowser } from './browser';
import { makeScreenshotDir, snap } from './screenshots';
import { login, LoginError } from './login';
import { openWriteForm } from './navigate';
import { openCardModal, selectCardRow, NoMatchError } from './cardModal';
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
 * Returns the write-form base URL for the given mode.
 * - mock:    local file:// URL pointing to mock/erp-writeform.html (without hash/query)
 * - live/dryrun: process.env.ERP_BASE_URL (must be set)
 */
function writeFormBaseUrl(mode: WorkerMode): string {
  if (mode === 'mock') {
    return pathToFileURL(
      join(dirname(fileURLToPath(import.meta.url)), 'mock', 'erp-writeform.html'),
    ).toString();
  }
  return process.env['ERP_BASE_URL'] ?? (() => { throw new Error('ERP_BASE_URL not set'); })();
}

/**
 * Converts a Date to a YYYYMMDD string in Asia/Seoul (KST) timezone.
 */
function toKstDateString(date: Date): string {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  // parts is like "2026. 04. 06." → extract digits only
  return parts.replace(/\D/g, '');
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
 *  - mock:   launches headed Chromium, performs login + cardModal steps
 *  - live:   same behaviour as mock against real ERP
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

    // Step: cardModal
    await deps.reportStep(sub.sessionId, 'cardModal');

    try {
      await openWriteForm(page, writeFormBaseUrl(mode));
    } catch (e) {
      await snap(page, screenshotDir, 'writeform-fail');
      const errorLog = String(e);
      await deps.fail(submissionId, { status: 'FAILED_UNEXPECTED_UI', errorLog, screenshotDir });
      return { status: 'FAILED_UNEXPECTED_UI', erpRefNo: null, sunginNb: null, screenshotDir, errorLog };
    }

    try {
      await openCardModal(page);
    } catch (e) {
      await snap(page, screenshotDir, 'cardmodal-open-fail');
      const errorLog = String(e);
      await deps.fail(submissionId, { status: 'FAILED_UNEXPECTED_UI', errorLog, screenshotDir });
      return { status: 'FAILED_UNEXPECTED_UI', erpRefNo: null, sunginNb: null, screenshotDir, errorLog };
    }

    // TODO: cardCd should come from submission data once the field is added
    const cardCd = '5105545000378130';
    const sessionDate = toKstDateString(sub.scheduledAt);
    const sessionStartedAt = sub.scheduledAt;
    const excludeSunginNbs = await deps.allSuccessfulSunginNbs();

    let sunginNb: string;
    try {
      sunginNb = await selectCardRow(page, {
        cardCd,
        sessionDate,
        sessionStartedAt,
        toleranceMinutes: 180,
        excludeSunginNbs,
      });
    } catch (e) {
      await snap(page, screenshotDir, 'cardrow-select-fail');
      if (e instanceof NoMatchError) {
        const errorLog = e.message;
        await deps.fail(submissionId, { status: 'FAILED_NO_TXN', errorLog, screenshotDir });
        return { status: 'FAILED_NO_TXN', erpRefNo: null, sunginNb: null, screenshotDir, errorLog };
      }
      const errorLog = String(e);
      await deps.fail(submissionId, { status: 'FAILED_UNEXPECTED_UI', errorLog, screenshotDir });
      return { status: 'FAILED_UNEXPECTED_UI', erpRefNo: null, sunginNb: null, screenshotDir, errorLog };
    }

    // Subsequent steps (B9+) — not implemented yet
    console.log(`[worker] runSubmission(${submissionId}) mode=${mode} — cardModal OK (sunginNb=${sunginNb}), remaining steps not implemented yet`);
    const result = {
      status: 'FAILED_OTHER' as const,
      erpRefNo: null,
      sunginNb,
      screenshotDir,
      errorLog: 'runSubmission: steps after cardModal not implemented yet',
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
