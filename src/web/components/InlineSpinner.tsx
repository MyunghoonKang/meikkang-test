type WorkerStep = 'login' | 'cardModal' | 'formFill' | 'approval';

const STEP_LABEL: Record<WorkerStep, string> = {
  login: '로그인 중',
  cardModal: '카드내역 확인 중',
  formFill: '품의서 작성 중',
  approval: '결재 상신 중',
};

export function InlineSpinner({ step, label }: { step?: WorkerStep | null; label?: string }) {
  const text = label ?? (step ? STEP_LABEL[step] : '진행 중');
  return (
    <span className="inline-spinner" role="status" aria-live="polite">
      <span className="inline-spinner__dot" aria-hidden="true" />
      <span className="inline-spinner__label">{text}</span>
    </span>
  );
}
