# Dev 3 — 플랫폼 UI 디자인·구현 Brief (Claude Code)

## 범위

- **Plan A:** Task 10, 11, 12, 13, 15 — React 라우팅·뷰·연출 전체. 단일 `RoomPage`가 `RoomStatus`(9개)에 따라 `LobbyView`/`GameView`/`ResultView`를 스왑.
- **Plan B:** Task 3 (`CredentialForm` 본문 와이어링), Task 11 프론트 부분 (`ResultView`의 QUEUED/RUNNING/COMPLETED/FAILED 단계 표시 디테일)
- **디자인:** 시안·색상·타이포·모션 본인 주도

핵심 문서:
- `docs/superpowers/plans/2026-04-19-game-platform.md` §Task 10~15 (특히 Task 13의 RoomPage/ResultView/CredentialForm)
- `docs/superpowers/plans/2026-04-19-erp-automation.md` §Task 3, §Task 11
- `docs/superpowers/specs/2026-04-19-erp-proposal-game-automation-design.md` §4.1 (페이지 목록)

## 시작 전 의존성 (Dev 4 가 먼저 해야 할 것)

1. **`src/shared/protocol.ts`** — `RoomStatus`(9 enum), `RoomStatePayload`(submissionId/scheduledAt/workerStep/erpRefNo/errorLog 포함), `credentialInputSchema` 등 모든 zod 스키마가 여기서 export. 본인 UI 는 이걸 **타입 단일 소스**로 쓴다. Dev 4 가 Task A2 를 끝내야 언블록.
2. **`vite.config.ts` · `index.html`** — Vite dev 서버 동작 기반. Dev 4 의 Task A1 산출물.
3. **Socket.io 이벤트명·페이로드** — Plan A Task 9 완료 시 확정. **단일 채널 `room:state`** 만 구독하면 모든 상태 변화가 broadcast 된다 (폴링 불필요).

위 3개가 먼저 merge 되기 전까지는 **mock socket** 으로 UI 만 제작:
```ts
// src/web/socket.ts (초기 mock 버전)
export const socket = {
  on(evt, cb) { /* noop. 실제로는 'room:state' 만 듣는다 */ },
  emit(evt, data) { console.log('[mock]', evt, data); },
  disconnect() {},
};
```
Dev 4 가 Task 9 를 끝내면 실제 `io('/', …)` 로 교체 (1줄 수정).

## 페이지 / 뷰 구성·우선순위

라우트는 `/` (HomePage)와 `/room/:code` (RoomPage) **단 2개**. RoomPage는 `RoomStatus`에 따라 내부 뷰를 스왑한다.

| 우선순위 | 컴포넌트 | 어느 RoomStatus에서 표시 | 핵심 기능 | 의존 |
|----------|----------|--------------------------|----------|------|
| P0 | `HomePage` | (라우트 `/`) | 방 생성·방 참여 진입 (이름 + 룸코드) | Session REST API (A8) |
| P0 | `RoomPage` | `/room/:code` 항상 마운트 | RoomStatus → 뷰 스왑 | useSession (room:state 구독) |
| P0 | `LobbyView` | `PREPARING` | 참가자 목록, 게임 선택(사전 등록 게임만), 시작 | Socket(A9) + Games REST(A7) |
| P0 | `GameView` | `PLAYING` | iframe + 상단 플레이어 아바타 | GameFrame(A12) |
| P0 | `ResultView` | `FINISHED`/`CREDENTIAL_INPUT`/`QUEUED`/`RUNNING`/`COMPLETED`/`FAILED` | 패자 발표 + 단계별 본문 (StatusBadge, CredentialForm 임베드, run-now 버튼, 워커 진행 indicator, ERP 참조번호/에러) | Plan B API (B3, B11) |
| P0 | `CredentialForm` | `ResultView` 내부 (`FINISHED`→패자만 CTA로, `CREDENTIAL_INPUT`→패자만 인라인) | ID/PW 입력 → `POST /api/credentials` + `POST /api/sessions/:id/submissions` 두 호출 → 응답 후 navigation 없음 (room:state로 자동 갱신) | Plan B API (B3) |
| P0 | `StatusBadge` | 모든 ResultView 단계 | 9 RoomStatus → 한국어 라벨 + 색상 | - |
| P2 | `AdminPage` | 별도 라우트 (선택) | 게임 목록·상신 큐 모니터링 | - |

> ⚠️ **GameUpload 컴포넌트는 만들지 않는다.** 게임은 운영자가 사전에 `games/` 폴더 또는 admin curl 로 등록. LobbyView에는 `GameSelector`만.

## 디자인 방향 제안 (본인 재량)

- **톤:** 해커톤이므로 "재미있지만 장난처럼 안 보이게". 다크 테마 + 액센트 1색(라임 · 네온 핑크 · 오렌지 중 택1).
- **타이포:** 한글은 Pretendard, 영문/숫자는 Inter 혹은 JetBrains Mono(숫자·카운트다운).
- **모션:** 결과 페이지의 패자 발표는 **0.8~1.2초 서스펜스 → 확정**. Framer Motion 같은 추가 라이브러리 허용. 단 번들 용량 >200KB 되면 회피.
- **사운드:** 결과 발표 시 "뚜둥" 효과음 권장 (`data:audio/wav;base64,…` 로 인라인해도 됨).

## 주의 · 해커톤 축약

- **디자인 시스템 과설계 금지.** Tailwind or 단일 `styles.css` + CSS 변수 수준. shadcn 같은 컴포넌트 라이브러리는 설치 시간 대비 효용이 애매하므로 생략 권장.
- **반응형 제한:** 데모는 노트북 4대 — 모바일 미지원 OK. 해상도 1280~1920 에서만 깨지지 않으면 충분.
- **접근성:** 최소한의 label·aria-live 만 유지 (심사 슬라이드에 한 줄로 언급).

## 개발 흐름 (권장)

1. **H+0~2: 디자인 시안** (Figma 혹은 바로 코드)
   - 7개 화면 러프 레이아웃, 모두 한국어 텍스트:
     1) HomePage  2) LobbyView (PREPARING)  3) GameView (PLAYING)
     4) ResultView – FINISHED  5) ResultView – CREDENTIAL_INPUT (패자/관전 분기)
     6) ResultView – QUEUED + RUNNING  7) ResultView – COMPLETED / FAILED
2. **H+2~5: 스타일 토대 + HomePage + LobbyView + RoomPage 골격** (mock socket 기반, RoomStatus 스위치문)
3. **H+5~8: GameView + ResultView FINISHED 단계** (iframe 브리지는 Task A12 참고)
4. **H+8~10: CredentialForm 본문 와이어링** (Plan B §Task 3 코드 스니펫 바로 사용 가능)
5. **H+10~12: ResultView QUEUED/RUNNING/COMPLETED/FAILED 단계 + StatusBadge + 워커 진행 indicator** (Plan B §Task 11)
6. **H+12~16: 연출·사운드·폴리싱** (Plan A Task 15: FINISHED 진입 시 드럼롤, 룸 코드 복사 버튼 등)
7. **H+16~24: 버그 수정 + 데모 리허설 대응**

## 로컬 실행 방법

```bash
# Dev 4 가 scaffold 한 뒤
npm install
npm run dev      # 서버(3000) + vite(5173) 동시 기동
# 브라우저에서 http://localhost:5173
```

## 공유 상태·네이밍 규칙

- 모든 API 요청은 `fetch('/api/...')` — Vite proxy 가 3000 으로 전달.
- 소켓 이벤트는 단일 채널 `room:state` 만 사용. 페이로드는 `RoomStatePayload`. 다른 이벤트(`session:update` 등) 사용 금지 — Plan A에서 모두 `room:state`로 통합됨.
- 컴포넌트 파일명: `PascalCase.tsx`. 페이지는 `src/web/pages/XxxPage.tsx` (단 2개: HomePage, RoomPage), 공용 뷰/컴포넌트는 `src/web/components/Xxx.tsx`.
- 스타일: 글로벌 `src/web/styles.css` + 필요 시 `XxxView.module.css` (CSS modules).

## 막혔을 때

- API 스펙 애매 → Dev 4 에게 즉시 슬랙·구두.
- 사전 등록한 게임이 `GameSelector`에 안 보임 → `GET /api/games` 응답 + 게임 HTML의 meta 태그(게임팀 문제) 확인. (UI에서 업로드하는 경로는 없음)
- 소켓 연결 끊김 연출 → Plan A §Task 15 참고 (재연결 토스트).
- ResultView가 갱신 안 됨 → `room:state` 이벤트 페이로드 확인 (브라우저 devtools Network → WS). 폴링 코드를 작성하고 있다면 즉시 제거.

## 체크리스트 (H+22 기준 DoD)

- [ ] 방 생성 → 룸코드 공유 → 4인 접속까지 UI 매끄럽게 동작 (모두 `/room/XXXX` 한 URL)
- [ ] LobbyView에서 사전 등록된 게임 목록이 보이고 호스트만 선택 가능
- [ ] 게임 종료 시 ResultView가 패자 발표 연출 (서스펜스 + 사운드, FINISHED 진입 시점)
- [ ] 패자에게만 `CredentialForm`이 인라인 노출, ID/PW 입력 폼에 보안 문구 명시 (입력값이 AES-256-GCM 으로 서버 저장됨을 1줄 고지)
- [ ] 9 RoomStatus가 단일 `room:state` socket 이벤트로 모든 클라이언트에 동기화 (폴링 없음)
- [ ] StatusBadge가 9 상태 모두 한국어 라벨 + 색상으로 렌더
- [ ] RUNNING 단계에서 워커 진행 indicator(login → cardModal → formFill → approval) 표시
- [ ] COMPLETED에서 ERP 참조번호, FAILED에서 errorLog 표시
- [ ] 데모용 "지금 상신 실행" 버튼이 mock 모드에서 동작 확인
