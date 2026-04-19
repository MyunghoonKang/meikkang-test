import type { RoomStatus } from '../../shared/protocol';

export type WorkerMode = 'live' | 'mock' | 'dryrun';

export type SubmissionStatus =
  | 'QUEUED' | 'RUNNING' | 'COMPLETED'
  | 'FAILED_AUTH' | 'FAILED_NO_TXN' | 'FAILED_UNEXPECTED_UI' | 'FAILED_OTHER' | 'ABORTED';

export interface WorkerResult {
  status: SubmissionStatus;
  erpRefNo: string | null;
  sunginNb: string | null;
  screenshotDir: string | null;
  errorLog: string | null;
}

// 4A 가 initWorker() 로 주입하는 의존성 인터페이스
// 실제 구현체는 4A 의 vault/submissions 에서 옴
export interface WorkerDeps {
  loadCredential(loserUserId: string): Promise<{ loginId: string; password: string } | null>;
  loadSubmission(submissionId: string): Promise<{
    loserUserId: string;
    purposeKind: 'coffee' | 'lunch';
    scheduledAt: Date;
    attendeeNames: string[];
    titleOverride?: string | null;
    mode: WorkerMode;
  } | null>;
  allSuccessfulSunginNbs(): Promise<string[]>;
  markRunning(submissionId: string): Promise<void>;
  complete(submissionId: string, result: { erpRefNo: string | null; sunginNb: string | null; screenshotDir: string | null }): Promise<void>;
  fail(submissionId: string, result: { status: SubmissionStatus; errorLog: string; screenshotDir: string | null }): Promise<void>;
}

// suppress unused import warning — RoomStatus is referenced by shared consumers
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _RoomStatusRef = RoomStatus;
