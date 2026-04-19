# Session Notes

각 Claude Code 세션이 Task 완료 시 한 줄씩 덧붙인다. 다음 세션이 이 파일을 읽어 현재 진행 상황을 파악한다.

**형식:** `[세션] Task XN 완료 — <1줄 요약>` (미해결 이슈·결정 사항 있으면 같이)

**예:**
```
[3A] Task A4 완료 — roomCode 생성기 · 32^4 alphabet · 중복 테스트 포함
[4A] Task B2 완료 — AES-256-GCM CredentialVault round-trip OK
[4B] Task B6 완료 — 목업 HTML 3종 + WORKER_MODE 토글 + runSubmission 스텁 export
```

**중단·블로커가 있을 때:**
```
[4B] Task B8 진행 중 — 카드매칭 실패 (중복 승인번호). 4A 에게 row 중복 해결 정책 문의 필요.
```

---

## 로그

<!-- 새 항목은 이 아래에 append -->

[integrator] 2026-04-20 — main 통합 완료 (c401055).
  - feat/b-worker-scaffold (4A+4B: B1~B13) → b94d085 로 non-ff merge.
  - feat/ui-polish (3B: A10~A15) → c401055 로 non-ff merge.
  - 충돌 2건 (CredentialForm.tsx · ResultView.tsx): 4A 본문 버전 유지(3B 스텁 폐기).
  - RoomPage.tsx 는 3B 의 `default → ResultView` 패턴으로 9 status 전부 커버 → 4A 의 별도 5 case PR 불필요.
  - 남은 작업: B14 실 ERP 라이브 리허설 (사용자 동석, H+22 이후).

[integrator] 2026-04-20 — E2E 브라우저 시뮬레이션 결과: 6 개 버그 발견·패치.
  발견된 버그:
  - **[3B]** `src/web/socket.ts` — A9 머지 후 실 socket 으로 1줄 교체 DoD 누락. mock 상태로 push됨.
  - **[3B]** `src/web/hooks/useSession.ts` — component-local state 라 navigate 시 session 손실. HomePage→RoomPage 직후 "방 정보 로딩 중..." 고착.
  - **[3B]** `src/web/components/GameView.tsx` — `game:begin` 이벤트가 listener 등록 전 도달하는 race. "게임 로딩 중..." 고착.
  - **[3B]** `src/web/pages/RoomPage.tsx` — ResultView 호출 시 props naming 불일치 (snap/me ↔ state/myPlayerId).
  - **[3A]** `src/server/session/manager.ts` — `persist?: boolean` 옵션만 선언하고 DB insert 로직 누락. sessions 테이블 empty → FK 실패 원인.
  - **[4A]** `src/server/routes/submissions.ts` — `submissions.sessionId` FK 대비 sessions upsert 없음 (FOREIGN KEY constraint failed). 또한 `/run-now` 가 `runSubmission` 호출 없이 스텁 응답만.
  - **[A14]** `games/number-guess.html` — Dev 1·2 범위. `<h1>TBD in Task 9</h1>` 스텁만 존재. `docs/handoff/games-starter-template.html` 로 치환함.

  적용 패치 (단일 커밋 예정): socket.ts 교체 · useSession 전역 store · GameView REST fallback · RoomPage prop rename · submissions 라우트 sessions upsert · games/number-guess.html 교체.

  미해결: 4A 의 `/run-now` 실제 runSubmission 호출 연결. scheduler 가 2026-04-20 09:00 KST 에 자동 실행하므로 데모 때 해당 시각 대기 or run-now 스텁 교체 필요.

  시뮬 검증 단계 (LM66 방): HomePage → LobbyView (호스트+게스트 2인) → GameView (iframe 플레이) → ResultView FINISHED (명훈 7점, 지우 13점 패자) → CredentialForm → QUEUED "다음 영업일 09:00 KST" 까지 완주. RUNNING/COMPLETED 는 run-now 미구현으로 미검증.
