# Dev 4 — 백엔드·핵심 엔진 Brief (Claude Code)

## 범위 요약

- **Plan A Task 1~9 + 16** — 스캐폴딩부터 SessionManager·GameRegistry·Upload API·GameRunner·Socket.io 까지 **게임 플랫폼 엔진 전체**.
- **Plan B 전체 (Task 1~14 중 UI 2건만 Dev 3 에 양도)** — DB 확장·CredentialVault·SubmissionQueue·Scheduler·Playwright 워커·ERP 라이브 리허설.

**단일 최대 병목이다.** 24시간 중 ~20시간을 담당하므로 선행 토대를 최우선 처리하고, 후반부 Playwright 구간에 여유를 남긴다.

## 필독 문서

1. `docs/superpowers/plans/2026-04-19-game-platform.md` — Plan A 전체
2. `docs/superpowers/plans/2026-04-19-erp-automation.md` — Plan B 전체
3. `docs/superpowers/specs/2026-04-19-q6-erp-field-findings.md` — 실 ERP 탐색 결과 (Plan B 입력)
4. `docs/superpowers/specs/2026-04-19-erp-proposal-game-automation-design.md` — 통합 설계
5. `docs/handoff/README.md` — 팀 DAG·타임라인·ERP 안전 규칙
6. `docs/design/project/Wireframes.html` — UI 와이어프레임 (Dev 3 가 따라 만드는 시각 스펙). 백엔드 입장에서는 ResultView가 9 RoomStatus를 어떻게 표시하는지 확인용

## 실행 방식 (권장)

Plan A/B 모두 `> REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans` 로 시작한다. 둘 다 체크박스 Task 로 구조화되어 있어 자동 실행 가능. 첫 세션에서 Claude 에게:

```
Plan A 부터 시작. 먼저 Task 1 스캐폴딩까지 수행하고, 각 커밋 후 멈춰서 결과를 보고해라.
파일은 docs/superpowers/plans/2026-04-19-game-platform.md 를 그대로 따른다.
```

## 우선순위 · 선행 토대 (다른 팀 언블록)

| 순서 | Task | 언블록 대상 |
|------|------|------------|
| 1 | A1 스캐폴딩 (Vite·tsconfig·package.json) | Dev 3 의 `npm run dev` |
| 2 | A2 shared/protocol (`RoomStatus` 9 enum + `RoomStatePayload` 포함) | Dev 3 타입 import, Dev 1/2 는 meta 태그만 지키면 됨 |
| 3 | A3 DB 스키마 + 마이그레이션 (sessions.status + loserId/submissionId 필드) | Plan B Task 1 이 extension 만 하면 됨 |
| 4 | A4 roomCode | — |
| 5 | A5 SessionManager (ALLOWED_TRANSITIONS 표 + transitionStatus 메서드) | Dev 3 HomePage/RoomPage 실 연동 |
| 6 | A6 GameRegistry · A7 Upload API (admin 도구로만 사용; 사용자 UI 없음) | **Dev 1, 2 언블록** — 이 시점 이후 운영자가 사전 등록 가능 |
| 7 | A8 GameRunner (서버 컴퍼레이터) | — |
| 8 | A9 Socket.io 통합 (`broadcastRoomState` + 단일 `room:state` 채널) | Dev 3 실 소켓 연동 |
| 9 | A16 이전에 Plan B 시작 (병렬 가능) | — |

**목표:** H+8 안에 A1~A9 완료 → 나머지 팀 완전 언블록 + Plan B 착수 가능.

## Plan B 착수 지점

Plan A Task 9 이후 Plan B 로 전환. Plan B 는 자체 스캐폴딩 없음 — Plan A 의 `src/server/` 에 하위 모듈로 추가:
- `src/server/vault/`
- `src/server/submissions/`
- `src/server/worker/`
- `src/server/routes/credentials.ts`, `submissions.ts`

Plan B §파일 구조 와 §Task 1 ~ 14 순서를 지킨다.

## 환경변수 초기 세팅

프로젝트 스캐폴딩 직후 `.env.example` 에 아래 추가 후 본인 `.env` 도 생성:

```
PORT=3000
DB_PATH=data/sqlite.db
GAMES_DIR=games
VAULT_MASTER_KEY=<openssl rand -hex 32 로 생성한 64자 hex>
WORKER_MODE=mock
ERP_BASE_URL=https://erp.meissa.ai
ERP_COMPANY_CODE=meissa
# ERP_CONFIRM_SUBMIT=1   # 실 상신 허용. H+22 라이브 리허설 시에만, 사용자 동석 후 set
```

## ERP 자동화 안전 규칙 (Plan B Task 6 이후 필독)

이는 단순 권장이 아니다. 사용자 선호 규칙이다:

1. **ID/PW 는 본인이 브라우저에 직접 타이핑.** 코드·채팅에 절대 하드코딩/로그 금지.
2. **쓰기 동작(상신/저장/이체/삭제) 은 사용자 명시적 확인 없이 실행 금지.** `WORKER_MODE=live` 에서도 `ERP_CONFIRM_SUBMIT` 미세팅 시 최종 [상신] 버튼 스킵.
3. Playwright 는 `headless=false` 유지 — 관측 가능해야 한다.
4. 관측만 하는 세션에서는 마지막에 탭을 수동 close 로 롤백. Q6 세션에서 쓴 방식과 동일.

## Dev 3 와의 계약 (준비물)

Plan A Task 2 (`shared/protocol.ts`)에 이미 `RoomStatus`(9 enum) + `RoomStatePayload`(submissionId/scheduledAt/workerStep/erpRefNo/errorLog 포함)가 정의돼 있다. Plan B Task 3 시작 시 추가로 다음을 푸시:

```typescript
export const credentialInputSchema = z.object({ userId: z.string().min(1), loginId: z.string().min(1), password: z.string().min(1) });
// (submissionSchema는 더 이상 UI에서 사용하지 않음 — RoomStatePayload가 단일 source of truth)
```

API 엔드포인트:
- `POST /api/credentials` → 204
- `POST /api/sessions/:id/credential-input` → 204 (`FINISHED → CREDENTIAL_INPUT` 전이 + broadcast)
- `POST /api/sessions/:id/submissions` → `{ submissionId, scheduledAt }` (`CREDENTIAL_INPUT → QUEUED` 전이 + broadcast)
- `POST /api/submissions/:id/run-now` (demo only · mock 모드 or `X-Demo-Confirm: yes` header 필요) → 202 (`QUEUED → RUNNING` 전이 + broadcast)
- `GET /api/submissions/:id` (디버그 전용 — UI는 폴링하지 않음. UI 갱신은 `room:state` socket으로만)

**상태 전이 책임:** 모든 RoomStatus 전이는 `mgr.transitionStatus()` 한 메서드로만 일어나고, 전이 직후 `broadcastRoomState(io, snap)`을 호출해 모든 클라이언트에 동기화. 직접 `snap.status = ...`로 쓰지 말 것 (illegal transition 가드 우회됨).

## Dev 1, 2 와의 계약

- 게임 업로드는 **운영자 admin 도구로만** 사용 (사용자 UI 없음). meta 5개(title, min-players, max-players, description, compare) 필수. 누락 시 422 응답에 필드 명시.
- `compare` 값은 `"max"` | `"min"` 만 허용.
- 업로드 파일 용량 상한 256KB (multer 설정).
- 업로드된 게임은 `GET /api/games` 응답으로 노출. 로비는 게임 목록을 마운트 시점 1회 페치하므로, 데모 직전 등록한 게임은 호스트가 방을 새로 만들 때 반영.

## 유닛 테스트 커버리지 목표

시간 제약상 **핵심 로직만 TDD** — 나머지는 통합/수동 검증.

| 대상 | 테스트 우선순위 |
|------|-----------------|
| roomCode 중복률 · GameRegistry meta 파싱 · GameRunner compare · `SessionManager.transitionStatus`(9 RoomStatus의 ALLOWED_TRANSITIONS) · SubmissionQueue 상태전이 · nextBusinessDayNineAm · matchCardRow · CredentialVault roundtrip | **필수** |
| Socket.io 핸들러·REST 라우트 (특히 `POST /api/sessions/:id/credential-input`·`/submissions`·`/run-now` 가 status 전이 + broadcast 까지 한 번에 수행하는지) | 중요 엔드포인트 2~3개 만 supertest |
| Playwright 워커 (login/cardModal/formFill/approval) | 목업 HTML 기반 integration 1개씩 + 각 단계 시작 시 `transitionStatus(RUNNING, { workerStep })` + broadcast 호출 검증 |

## 체크리스트 (H+22 DoD)

- [ ] A1~A9 머지 · 4대 노트북에서 방 생성·참여·게임·패자 결정 E2E 성공 (모두 `/room/XXXX` 한 URL, `room:state` 단일 채널)
- [ ] 운영자 admin 으로 사전 등록한 게임이 LobbyView `GameSelector` 에 노출 · 실 플레이 OK
- [ ] `SessionManager.transitionStatus` 가 9 RoomStatus 의 ALLOWED_TRANSITIONS 만 허용하고 illegal jump 차단
- [ ] B1~B5 머지 · `POST /api/credentials` 로 저장된 자격증명이 vault 에서 복호화 가능
- [ ] B6~B10 목업 HTML 기반 Playwright 파이프라인 통과 (`tests/e2e-mock.test.ts` 녹색) · 각 단계 시작 시 `RUNNING` workerStep 갱신 + broadcast
- [ ] B11~B12 REST 라우트가 큐 삽입 + status 전이 + broadcast 한 번에 수행. 게임 결과는 `FINISHED` 까지만 자동, **enqueue 는 패자 자격증명 제출 시점**
- [ ] B13 `WORKER_MODE=mock` 으로 데모 시나리오 1회 성공 (패자 발표 → 자격 입력 → 상신 연출까지)
- [ ] B14 실 ERP 라이브 리허설: 사용자 동석, 폼 채움까지 OK, [상신] 은 데모 당일 `ERP_CONFIRM_SUBMIT=1` + 수동 확인 후

## 긴급 차선책

- Playwright 가 실 ERP 에서 새 CAPTCHA·2FA 마주침 → Plan B §6.4 `FAILED_UNEXPECTED_UI` 로 분기 + **모킹 모드 데모**. 심사 슬라이드에서 "실서비스 구조·목업 재현"을 강조.
- 카드내역이 데모 당일 아직 반영 안됨 → 사전 저장된 `tests/fixtures/cardRows.json` 으로 목업 흐름 재생.
- 스케줄러가 못 돌 지경 → `POST /api/submissions/:id/run-now` 로 수동 트리거해 데모.
