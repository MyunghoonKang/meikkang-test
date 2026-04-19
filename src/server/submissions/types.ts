export type SubmissionStatus =
  | 'QUEUED' | 'RUNNING' | 'COMPLETED'
  | 'FAILED_AUTH' | 'FAILED_NO_TXN' | 'FAILED_UNEXPECTED_UI' | 'FAILED_OTHER' | 'ABORTED';

export type WorkerMode = 'live' | 'mock' | 'dryrun';

export interface EnqueueInput {
  sessionId: string;
  loserUserId: string;
  scheduledAt: Date;
  attendeeNames: string[];
  purposeKind: 'coffee' | 'lunch';
  mode: WorkerMode;
  titleOverride?: string | null;
}

export interface CompleteInput {
  erpRefNo?: string | null;
  sunginNb?: string | null;
  screenshotDir?: string | null;
}

export interface FailInput {
  status: Exclude<SubmissionStatus, 'QUEUED' | 'RUNNING' | 'COMPLETED'>;
  errorLog: string;
  screenshotDir?: string | null;
}
