# 팀 킥오프 · Handoff Index

24시간 해커톤 PoC — **식후 벌칙게임 + 더존 아마란스 ERP 품의서 자동 상신**. 4인 팀, 심사기준: 실용성·재미.

## 각자 읽을 문서

| 담당 | 도구 | 문서 |
|------|------|------|
| Dev 1, 2 | **Claude Cowork** | [`dev1-2-game-cowork.md`](./dev1-2-game-cowork.md) · [`games-starter-template.html`](./games-starter-template.html) · [`games-test-harness.html`](./games-test-harness.html) |
| Dev 3 | Claude Code | [`dev3-ui.md`](./dev3-ui.md) |
| Dev 4 | Claude Code | [`dev4-engine.md`](./dev4-engine.md) |

## 공통 참조

- 설계 스펙: `docs/superpowers/specs/2026-04-19-erp-proposal-game-automation-design.md`
- Plan A (게임 플랫폼): `docs/superpowers/plans/2026-04-19-game-platform.md`
- Plan B (ERP 자동화): `docs/superpowers/plans/2026-04-19-erp-automation.md`
- Q6 ERP 조사 결과 (Plan B 입력): `docs/superpowers/specs/2026-04-19-q6-erp-field-findings.md`
- **UI 와이어프레임 (Claude Design):** `docs/design/project/Wireframes.html` (7 화면 × 2 변주, 손글씨 메모) · 원본 README `docs/design/README.md` · 작업 대화 `docs/design/chats/chat1.md`

## 의존성 DAG

```
┌─ Dev 4: Task A1~A4 (scaffold, protocol+RoomStatus, DB, roomCode) ─┐
│                                                                     │
│     ├─→ Dev 3: Task A10~A13, A15 + B3·B11 프론트
│     │     (초기엔 mock socket 으로 선행 가능)
│     │
│     ├─→ Dev 4: Task A5~A9 (SessionManager+상태머신, Registry, Runner, IO+broadcastRoomState)
│     │     ↓
│     └─→ Dev 1, 2: Task A14 (게임 3종~N종)
│           ↑ 게임 등록 API(admin) + SDK 계약 확정 필요
│
└─→ Dev 4: Plan B Task 1~14 (ERP 자동화) — 주로 Plan A 후반부와 병렬
```

- **Dev 4 선행 필수:** shared/protocol zod 스키마 + DB 스키마 + roomCode 는 가장 먼저 merge → 다른 팀 작업 해제.
- **Dev 1, 2 블로커 해제 기준:** Plan A Task 6 (GameRegistry) + Task 7 (Upload API — 운영자 admin 도구) + Task 8 (GameRunner) merge. 그 전까지는 `games-test-harness.html` 로 로컬 검증 가능. **사용자 UI 에는 게임 업로드 화면이 없으므로**, 게임은 운영자가 사전 등록한다.
- **Dev 3 블로커 해제 기준:** shared/protocol (`RoomStatus` 9 enum + `RoomStatePayload`) + Task 9 (Socket.io `room:state` 단일 채널) merge. 그 전에는 mock socket 으로 화면 제작.

## 타임라인 (24h)

| 시간 | Dev 4 | Dev 3 | Dev 1, 2 |
|------|-------|-------|----------|
| H+0~3 | Task A1~A4 (scaffold/protocol/DB/roomCode) | 디자인 시안 + 스타일 정립, mock socket hook (`room:state` 단일 채널 가정) | **게임 아이디어 3개 픽 + `games-test-harness.html` 로컬 시제품 시작** |
| H+3~8 | Task A5~A9 (SessionManager+상태머신·Registry·Upload·Runner·Socket+broadcastRoomState) | Task A10~A12 (Home/RoomPage 골격/LobbyView/GameView/GameFrame) + Plan B3 mock | 게임 1호 완성 (Cowork 로 작업) · 플랫폼 부팅되면 운영자 admin 등록으로 검증 |
| H+8~14 | Plan B Task 1~7 (DB/Vault/API/Queue/Scheduler/Worker+Login) | Task A13, A15 (RoomPage/ResultView/CredentialForm 스텁/StatusBadge) + Plan B11 프론트 | 게임 2, 3호 완성 · 운영자 사전 등록 리허설 |
| H+14~18 | Plan B Task 8~10 (카드매칭·폼·결재상신) | 연출·사운드·애니메이션 폴리싱 | 게임 추가 (여유 시) · Plan B 목업 HTML 세팅 지원 옵션 |
| H+18~22 | Plan B Task 11~13 (라우트·status 전이·E2E mock) + 전체 통합 | 통합 테스트 · 데모 스크립트 UI 확인 | 심사 당일용 추가 게임 구상 (운영자 사전 등록) |
| H+22~24 | Plan B Task 14 (라이브 리허설, 사용자 동석) + 폴리싱 | 데모 리허설 | 데모 대기 |

## 저장소 · 브랜치 규칙

- 기본 브랜치: `main`. 현재 코드는 없고 스펙·플랜·핸드오프·UI 와이어프레임이 커밋됨. Dev 4 가 Plan A Task 1 부터 스캐폴딩 시작.
- 각자 브랜치: `feat/dev4-scaffold`, `feat/dev3-ui-home`, `feat/dev1-game-<name>` 처럼 짧고 범위 명확하게.
- 커밋 스타일: 기존 `feat(…)` · `docs(…)` · `chore(…)` 유지.
- **머지 원칙:** 24h 해커톤이므로 승인 지연 금지 — **녹색 테스트 + 빠른 eyes-on → 바로 머지**. 충돌 우려 영역(shared/protocol, Socket.io)은 Dev 4 선점 후 열어둔다.

## 동기화 포인트 (3회 권장)

| 시각 | 체크 |
|------|------|
| H+4 | 공용 토대 OK? 각자 언블록됐는가? |
| H+12 | 플랫폼 부팅 & 게임 1개 admin 등록 성공 여부 (LobbyView GameSelector 노출 확인). Plan B 착수 가능? |
| H+20 | 통합 리허설 · 라이브 리허설 준비 · 데모 스크립트 최종 |

## 환경변수 (Dev 4 가 `.env.example` 에 반영. 각자 로컬에 `.env` 생성)

```
PORT=3000
DB_PATH=data/sqlite.db
GAMES_DIR=games
VAULT_MASTER_KEY=<openssl rand -hex 32>
WORKER_MODE=mock        # mock | dryrun | live — 데모 당일만 live
ERP_BASE_URL=https://erp.meissa.ai
ERP_COMPANY_CODE=meissa
# ERP_CONFIRM_SUBMIT=1  # 실 상신 허용 플래그. 데모 시 사용자 확인 후에만 설정
```

## ERP 안전 규칙 (필독)

1. **실 ERP 로그인 자격증명은 사용자(매니저)가 브라우저에 직접 타이핑.** 채팅이나 코드로 공유 금지.
2. **쓰기 동작(상신/저장/이체)은 사용자 확인 없이 절대 수행 금지.** `WORKER_MODE=live` + `ERP_CONFIRM_SUBMIT` 두 플래그 동시 세팅될 때만 실 상신.
3. 관측·탐색·DOM 캡처는 자유. 다만 데이터 생성이 될 수 있는 액션 직전에는 반드시 멈춰 사용자 판단을 기다린다.
4. Playwright 자동화 세션은 `headless=false` 유지 — 무슨 일이 일어나는지 눈으로 확인 가능해야 한다.
