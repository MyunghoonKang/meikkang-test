/**
 * Plan A GameRunner 의 outcome 확정 직후 호출되는 훅.
 *
 * 계약:
 * - 3A (GameRunner) 가 패자 확정 직후 이 함수만 호출.
 * - 4A (Plan B Task 12) 가 본문을 구현하여 Submission enqueue + RoomStatus 전이를 수행.
 * - 이 훅 내부에서 `SessionManager.transitionStatus(FINISHED → CREDENTIAL_INPUT)` 를 호출하는지,
 *   혹은 GameRunner 가 먼저 FINISHED 로 전이한 뒤 이 훅이 CREDENTIAL_INPUT 전이를 수행하는지는
 *   4A B12 구현 시점의 결정 사항. 현재는 3A 가 FINISHED 전이 + broadcast 까지 책임진다고 가정.
 *
 * 시그니처 변경 금지 (양 Dev 동의 필요).
 */
export async function onGameFinished(sessionId: string, loserId: string): Promise<void> {
  // no-op: 4A Plan B Task 12 에서 교체
  void sessionId;
  void loserId;
}
