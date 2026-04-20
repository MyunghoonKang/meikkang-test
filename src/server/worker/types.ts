export type { WorkerMode, SubmissionStatus } from '../submissions/types';
import type { WorkerMode, SubmissionStatus } from '../submissions/types';

export interface WorkerResult {
  status: SubmissionStatus;
  erpRefNo: string | null;
  sunginNb: string | null;
  screenshotDir: string | null;
  errorLog: string | null;
}

// 4A 가 initWorker() 로 주입하는 의존성 인터페이스.
// 실제 구현체는 4A 의 vault/submissions/session 에서 옴.
export interface WorkerDeps {
  loadCredential(loserUserId: string): Promise<{ loginId: string; password: string } | null>;
  loadSubmission(submissionId: string): Promise<{
    sessionId: string;
    loserUserId: string;
    purposeKind: 'coffee' | 'lunch';
    scheduledAt: Date;
    attendeeNames: string[];
    titleOverride?: string | null;
    mode: WorkerMode;
  } | null>;
  allSuccessfulSunginNbs(): Promise<string[]>;
  // 각 워커 단계 시작 시 호출 → 4A 가 SessionManager.transitionStatus + broadcastRoomState 실행
  reportStep(sessionId: string, workerStep: 'login' | 'cardModal' | 'formFill' | 'approval'): Promise<void>;
  complete(submissionId: string, result: { erpRefNo: string | null; sunginNb: string | null; screenshotDir: string | null }): Promise<void>;
  fail(submissionId: string, result: { status: Exclude<SubmissionStatus, 'QUEUED' | 'RUNNING' | 'COMPLETED'>; errorLog: string; screenshotDir?: string | null }): Promise<void>;
}
