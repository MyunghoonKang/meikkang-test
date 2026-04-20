import type { RoomStatus } from '../../shared/protocol';

const LABEL: Record<RoomStatus, string> = {
  PREPARING: '준비',
  PLAYING: '게임 중',
  FINISHED: '게임 완료',
  CREDENTIAL_INPUT: '상신 준비',
  QUEUED: '상신 대기',
  RUNNING: '상신 중',
  COMPLETED: '상신 성공',
  FAILED: '상신 실패',
  ABORTED: '중단',
};

export function StatusBadge({ status }: { status: RoomStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{LABEL[status]}</span>;
}
