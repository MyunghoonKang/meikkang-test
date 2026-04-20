import type { WorkerMode } from './types';

/**
 * Reads WORKER_MODE from the given env object and resolves it to a WorkerMode.
 * Defaults to 'mock' if WORKER_MODE is not set.
 * Throws if the value is not one of: live | mock | dryrun.
 */
export function resolveMode(env: NodeJS.ProcessEnv): WorkerMode {
  const raw = env['WORKER_MODE'];
  if (raw === undefined || raw === '') {
    return 'mock';
  }
  if (raw === 'live' || raw === 'mock' || raw === 'dryrun') {
    return raw;
  }
  throw new Error(
    `Invalid WORKER_MODE: "${raw}". Expected one of: live | mock | dryrun`,
  );
}
