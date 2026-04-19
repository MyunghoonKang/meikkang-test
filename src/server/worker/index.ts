import { resolveMode } from './mode';
import { launchBrowser } from './browser';
import { makeScreenshotDir } from './screenshots';
import type { WorkerResult, WorkerDeps, WorkerMode } from './types';

export type { WorkerResult, WorkerDeps, WorkerMode };

// Module-level deps reference, injected by 4A via initWorker()
let _deps: WorkerDeps | null = null;

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

  // Mark as running at entry
  await deps.markRunning(submissionId);

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

  // mock | live — stub: launch browser then bail out
  const session = await launchBrowser({ headless: false });
  try {
    console.log(`[worker] runSubmission(${submissionId}) mode=${mode} — not implemented yet`);
    const result = {
      status: 'FAILED_OTHER' as const,
      erpRefNo: null,
      sunginNb: null,
      screenshotDir: null,
      errorLog: 'runSubmission stub: not implemented yet',
    };
    await deps.fail(submissionId, {
      status: result.status,
      errorLog: result.errorLog,
      screenshotDir: null,
    });
    return result;
  } finally {
    await session.close();
  }
}
