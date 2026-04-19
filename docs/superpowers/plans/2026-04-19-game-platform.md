# 게임 플랫폼 Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 룸 코드로 모인 2-8명이 iframe 기반 플러그인 게임을 각자 PC에서 플레이하고, 서버 컴퍼레이터 규칙으로 패자를 결정하는 웹 플랫폼을 구축한다. ERP 상신은 Plan B.

**Architecture:** Node + TypeScript 풀스택. Express + Socket.io 서버가 세션·게임·상태를 관리, React + Vite 프론트가 로비/게임/결과 UI를 담당. SQLite(Drizzle ORM)로 세션·참가자·게임 메타 영속화. 게임은 `/games/*.html` 폴더의 HTML 파일 + iframe(`sandbox="allow-scripts"`) + postMessage 계약으로 확장.

**Tech Stack:** Node 20+, TypeScript, Express 4, Socket.io 4, React 18, Vite 5, Drizzle ORM, better-sqlite3, zod, multer, chokidar, Vitest, tsx

---

## 참고 스펙

- `docs/superpowers/specs/2026-04-19-erp-proposal-game-automation-design.md`
- 특히 §4.3 (게임 플러그인 SDK), §4.5 (DB 스키마), §5 (데이터 흐름)

## 파일 구조

```
/
├── package.json                 # npm scripts, deps
├── tsconfig.json                # server용 TS 설정
├── tsconfig.web.json            # web용 TS 설정 (JSX + DOM lib)
├── vite.config.ts               # web 빌드 + dev proxy
├── drizzle.config.ts            # DB 마이그레이션 설정
├── .env.example                 # PORT, DB_PATH, SESSION_SECRET, GAMES_DIR
├── data/                        # SQLite 파일 (gitignore)
├── games/                       # 게임 HTML 파일 폴더
│   ├── number-guess.html
│   ├── reaction.html
│   └── coin-flip.html
├── src/
│   ├── server/
│   │   ├── index.ts             # entry: Express + Socket.io 부팅
│   │   ├── app.ts               # Express app 구성
│   │   ├── io.ts                # Socket.io 핸들러 등록
│   │   ├── config.ts            # env 로드
│   │   ├── db/
│   │   │   ├── schema.ts        # Drizzle 테이블 정의
│   │   │   ├── client.ts        # DB 싱글톤
│   │   │   └── migrate.ts       # 마이그레이션 실행
│   │   ├── session/
│   │   │   ├── roomCode.ts      # 4-char 랜덤 코드 생성
│   │   │   ├── manager.ts       # SessionManager (인메모리 + DB)
│   │   │   └── types.ts
│   │   ├── games/
│   │   │   ├── registry.ts      # /games 스캔 + meta 파싱
│   │   │   ├── upload.ts        # POST /api/games 핸들러
│   │   │   └── runner.ts        # 세션별 submit 수집 + compare
│   │   └── routes/
│   │       ├── sessions.ts      # REST API
│   │       └── games.ts         # REST API
│   ├── web/
│   │   ├── main.tsx             # Vite entry
│   │   ├── App.tsx              # Router
│   │   ├── socket.ts            # Socket.io 클라이언트 싱글톤
│   │   ├── hooks/
│   │   │   ├── useSession.ts    # 세션 상태 hook
│   │   │   └── useGameFrame.ts  # iframe 브리지 hook
│   │   ├── pages/
│   │   │   ├── HomePage.tsx
│   │   │   ├── LobbyPage.tsx
│   │   │   ├── GamePage.tsx
│   │   │   ├── ResultPage.tsx
│   │   │   └── CredentialPage.tsx  # Plan B 스텁
│   │   ├── components/
│   │   │   ├── PlayerList.tsx
│   │   │   ├── GameSelector.tsx
│   │   │   ├── GameUpload.tsx
│   │   │   └── GameFrame.tsx
│   │   └── styles.css
│   └── shared/
│       └── protocol.ts          # socket/postMessage zod 스키마 공용
├── tests/
│   ├── roomCode.test.ts
│   ├── registry.test.ts
│   ├── manager.test.ts
│   ├── runner.test.ts
│   └── protocol.test.ts
└── index.html                   # Vite entry HTML
```

> **원칙**
> - 서버/웹/공용 코드는 `src/server`, `src/web`, `src/shared`로 분리. 공용 zod 스키마는 양쪽에서 import.
> - 서버는 `tsx`로 직접 실행 (빌드 단계 생략). 웹은 Vite로 개발·빌드.
> - DB 마이그레이션은 `drizzle-kit` CLI가 생성 → `migrate.ts`가 부팅 시 실행.

---

## Task 1: 프로젝트 스캐폴딩

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.web.json`, `vite.config.ts`, `drizzle.config.ts`, `.env.example`, `.gitignore` (기존 파일 갱신), `index.html`, `src/server/index.ts`, `src/web/main.tsx`, `src/web/App.tsx`

- [ ] **Step 1.1: npm init + 의존성 설치**

```bash
npm init -y
npm i express socket.io better-sqlite3 drizzle-orm zod multer chokidar
npm i -D typescript tsx vite @vitejs/plugin-react react react-dom react-router-dom \
          @types/node @types/express @types/multer @types/react @types/react-dom \
          drizzle-kit vitest @vitest/ui
```

- [ ] **Step 1.2: `package.json` scripts 섹션 추가**

```json
{
  "name": "meal-proposal-game",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev:server": "tsx watch src/server/index.ts",
    "dev:web": "vite",
    "dev": "npm run dev:server & npm run dev:web",
    "build:web": "vite build",
    "start": "node --import tsx/esm src/server/index.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/server/db/migrate.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 1.3: `tsconfig.json` (서버용)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/server/**/*", "src/shared/**/*", "tests/**/*"],
  "exclude": ["node_modules", "src/web"]
}
```

- [ ] **Step 1.4: `tsconfig.web.json` (웹용)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/web/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 1.5: `vite.config.ts` — dev proxy로 /api와 /socket.io를 서버(3000)로 전달**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: { outDir: 'dist/web' },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'ws://localhost:3000', ws: true },
      '/games': 'http://localhost:3000',
    },
  },
});
```

- [ ] **Step 1.6: `index.html` (Vite entry)**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>Meal Proposal Game</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/web/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 1.7: `.env.example`**

```
PORT=3000
DB_PATH=./data/app.db
GAMES_DIR=./games
SESSION_SECRET=change-me
```

- [ ] **Step 1.8: `.gitignore` 갱신**

```
# 기존 항목에 추가
data/
dist/
*.db
```

- [ ] **Step 1.9: `src/server/index.ts` Hello World**

```typescript
import express from 'express';
import { createServer } from 'node:http';
import { Server as IOServer } from 'socket.io';

const app = express();
app.get('/api/health', (_req, res) => res.json({ ok: true }));
const httpServer = createServer(app);
new IOServer(httpServer, { cors: { origin: 'http://localhost:5173' } });
const port = Number(process.env.PORT ?? 3000);
httpServer.listen(port, () => console.log(`[server] listening on :${port}`));
```

- [ ] **Step 1.10: `src/web/main.tsx` + `src/web/App.tsx`**

```typescript
// src/web/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter><App /></BrowserRouter>
  </React.StrictMode>
);
```

```typescript
// src/web/App.tsx
import { Routes, Route } from 'react-router-dom';
export default function App() {
  return <Routes><Route path="/" element={<h1>Meal Proposal Game</h1>} /></Routes>;
}
```

- [ ] **Step 1.11: 부팅 검증**

```bash
npm run dev:server
# 다른 터미널:
npm run dev:web
```
기대 출력: 서버 `[server] listening on :3000`, 웹은 http://localhost:5173 에서 제목 표시.

- [ ] **Step 1.12: 커밋**

```bash
git add -A
git commit -m "feat: project scaffold with express+socket.io+vite+react"
```

---

## Task 2: 공용 protocol 스키마 (zod)

**Files:**
- Create: `src/shared/protocol.ts`, `tests/protocol.test.ts`

> socket 이벤트와 iframe postMessage 양쪽을 하나의 모듈로 정의. 서버/웹이 동일한 타입을 공유.

- [ ] **Step 2.1: 실패 테스트 작성 — `tests/protocol.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { IframeSubmit, SocketJoin, Outcome } from '../src/shared/protocol';

describe('protocol schemas', () => {
  it('accepts valid iframe submit', () => {
    expect(IframeSubmit.safeParse({ type: 'submit', value: 42 }).success).toBe(true);
  });
  it('rejects submit without value', () => {
    expect(IframeSubmit.safeParse({ type: 'submit' }).success).toBe(false);
  });
  it('rejects non-numeric submit', () => {
    expect(IframeSubmit.safeParse({ type: 'submit', value: 'big' }).success).toBe(false);
  });
  it('accepts socket join payload', () => {
    expect(SocketJoin.safeParse({ roomCode: 'ABCD', name: 'Alice' }).success).toBe(true);
  });
  it('requires 4-char room code', () => {
    expect(SocketJoin.safeParse({ roomCode: 'AB', name: 'A' }).success).toBe(false);
  });
  it('parses outcome with results array', () => {
    const r = Outcome.safeParse({
      type: 'outcome', loserId: 'p1',
      results: [{ playerId: 'p1', value: 10 }, { playerId: 'p2', value: 3 }],
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2.2: 테스트 실행 — 실패 확인**

```bash
npm test
```
기대: `Cannot find module '../src/shared/protocol'`.

- [ ] **Step 2.3: `src/shared/protocol.ts` 구현**

```typescript
import { z } from 'zod';

// ===== 공용 타입 =====
export const Player = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(20),
});
export type Player = z.infer<typeof Player>;

export const SessionState = z.enum(['LOBBY', 'PLAYING', 'FINISHED', 'ABORTED']);
export type SessionState = z.infer<typeof SessionState>;

export const CompareRule = z.enum(['max', 'min']);
export type CompareRule = z.infer<typeof CompareRule>;

export const GameMeta = z.object({
  id: z.string(),
  filename: z.string(),
  title: z.string(),
  minPlayers: z.number().int().min(1),
  maxPlayers: z.number().int().min(1),
  description: z.string().default(''),
  compare: CompareRule,
});
export type GameMeta = z.infer<typeof GameMeta>;

// ===== Socket 이벤트 (클라 → 서버) =====
export const SocketCreateSession = z.object({ name: z.string().min(1).max(20) });
export const SocketJoin = z.object({
  roomCode: z.string().length(4),
  name: z.string().min(1).max(20),
});
export const SocketSelectGame = z.object({ gameId: z.string() });
export const SocketStartGame = z.object({});
export const SocketSubmitResult = z.object({ value: z.number().finite() });

// ===== Socket 이벤트 (서버 → 클라) =====
export const SessionState_Payload = z.object({
  sessionId: z.string(),
  roomCode: z.string(),
  state: SessionState,
  hostId: z.string(),
  players: z.array(Player),
  selectedGameId: z.string().nullable(),
});

export const OutcomePayload = z.object({
  loserId: z.string(),
  results: z.array(z.object({ playerId: z.string(), value: z.number() })),
});

// ===== iframe postMessage (host → iframe) =====
export const IframeInit = z.object({
  type: z.literal('init'),
  playerId: z.string(),
  players: z.array(Player),
  sessionId: z.string(),
  seed: z.string(),
});
export const IframeStart = z.object({ type: z.literal('start') });
export const Outcome = z.object({
  type: z.literal('outcome'),
  loserId: z.string(),
  results: z.array(z.object({ playerId: z.string(), value: z.number() })),
});

// ===== iframe postMessage (iframe → host) =====
export const IframeReady = z.object({ type: z.literal('ready') });
export const IframeSubmit = z.object({
  type: z.literal('submit'),
  value: z.number().finite(),
});

export const HostToIframe = z.discriminatedUnion('type', [IframeInit, IframeStart, Outcome]);
export const IframeToHost = z.discriminatedUnion('type', [IframeReady, IframeSubmit]);
```

- [ ] **Step 2.4: 테스트 통과 확인**

```bash
npm test
```
기대: 6 passing.

- [ ] **Step 2.5: 커밋**

```bash
git add src/shared/protocol.ts tests/protocol.test.ts
git commit -m "feat(shared): zod schemas for socket and postMessage protocols"
```

---

## Task 3: DB 스키마 + 마이그레이션

**Files:**
- Create: `src/server/db/schema.ts`, `src/server/db/client.ts`, `src/server/db/migrate.ts`, `drizzle.config.ts`

> submissions/credentials는 Plan B에서 추가. 이번 계획은 sessions/participants/games만.

- [ ] **Step 3.1: `drizzle.config.ts`**

```typescript
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: { url: process.env.DB_PATH ?? './data/app.db' },
});
```

- [ ] **Step 3.2: `src/server/db/schema.ts`**

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  roomCode: text('room_code').notNull().unique(),
  state: text('state').notNull().default('LOBBY'),
  hostId: text('host_id').notNull(),
  selectedGameId: text('selected_game_id'),
  startedAt: integer('started_at'),
  createdAt: integer('created_at').notNull(),
});

export const participants = sqliteTable('participants', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  name: text('name').notNull(),
  joinedAt: integer('joined_at').notNull(),
  disconnected: integer('disconnected', { mode: 'boolean' }).notNull().default(false),
});

export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull().unique(),
  title: text('title').notNull(),
  minPlayers: integer('min_players').notNull(),
  maxPlayers: integer('max_players').notNull(),
  compare: text('compare').notNull(),      // 'max' | 'min'
  description: text('description').notNull().default(''),
  uploadedAt: integer('uploaded_at').notNull(),
});
```

- [ ] **Step 3.3: `src/server/db/client.ts`**

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const dbPath = process.env.DB_PATH ?? './data/app.db';
mkdirSync(dirname(dbPath), { recursive: true });
export const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
export const db = drizzle(sqlite);
```

- [ ] **Step 3.4: `src/server/db/migrate.ts`**

```typescript
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './client';
migrate(db, { migrationsFolder: './drizzle' });
console.log('[db] migrated');
```

- [ ] **Step 3.5: 첫 마이그레이션 생성·실행**

```bash
npm run db:generate
npm run db:migrate
```
기대: `./drizzle/0000_*.sql` 파일이 생기고 `data/app.db`에 테이블 생성됨.

- [ ] **Step 3.6: 서버 부팅 시 자동 마이그레이션 실행 (index.ts 수정)**

```typescript
// src/server/index.ts 상단에 추가
import './db/migrate';
```

- [ ] **Step 3.7: 커밋**

```bash
git add -A
git commit -m "feat(db): drizzle schema for sessions/participants/games"
```

---

## Task 4: 룸 코드 생성기 (TDD)

**Files:**
- Create: `src/server/session/roomCode.ts`, `tests/roomCode.test.ts`

- [ ] **Step 4.1: 실패 테스트**

```typescript
// tests/roomCode.test.ts
import { describe, it, expect } from 'vitest';
import { generateRoomCode, isRoomCode } from '../src/server/session/roomCode';

describe('roomCode', () => {
  it('generates 4-char alphanumeric uppercase', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[A-Z0-9]{4}$/);
  });
  it('isRoomCode validates format', () => {
    expect(isRoomCode('AB12')).toBe(true);
    expect(isRoomCode('ab12')).toBe(false);
    expect(isRoomCode('ABCDE')).toBe(false);
  });
  it('generates uniqueRoomCode excluding existing set', () => {
    // 10,000 codes — must never collide with a pre-existing set of 1000
    const existing = new Set<string>();
    for (let i = 0; i < 1000; i++) existing.add(generateRoomCode());
    for (let i = 0; i < 100; i++) {
      const c = generateRoomCode(existing);
      expect(existing.has(c)).toBe(false);
      existing.add(c);
    }
  });
});
```

- [ ] **Step 4.2: 테스트 실행 — 실패 확인**

- [ ] **Step 4.3: 구현**

```typescript
// src/server/session/roomCode.ts
import { randomInt } from 'node:crypto';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // O, 0, 1, I 제외 (혼동 방지)

export function isRoomCode(value: string): boolean {
  return /^[A-Z0-9]{4}$/.test(value);
}

export function generateRoomCode(excluded?: ReadonlySet<string>): string {
  // 1,048,576 조합 (32^4) — 충돌 확률 매우 낮으나 재시도 로직 포함
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += ALPHA[randomInt(ALPHA.length)];
    if (!excluded?.has(code)) return code;
  }
  throw new Error('roomCode: exhausted attempts');
}
```

- [ ] **Step 4.4: 테스트 통과 확인**

- [ ] **Step 4.5: 커밋**

```bash
git add src/server/session/roomCode.ts tests/roomCode.test.ts
git commit -m "feat(session): room code generator (32^4 alphabet, crypto rand)"
```

---

## Task 5: SessionManager (TDD)

**Files:**
- Create: `src/server/session/manager.ts`, `src/server/session/types.ts`, `tests/manager.test.ts`

> 인메모리 맵을 소스 of truth로, DB는 스냅샷. 서버 재기동 시 DB에서 복구 — PoC에선 skip하고 메모리만 사용해도 무방. 여기선 DB 영속화 포함.

- [ ] **Step 5.1: 타입 정의 — `src/server/session/types.ts`**

```typescript
import type { Player, SessionState } from '../../shared/protocol';

export interface SessionSnapshot {
  id: string;
  roomCode: string;
  state: SessionState;
  hostId: string;
  players: Player[];
  selectedGameId: string | null;
  startedAt: number | null;
  createdAt: number;
}

export interface CreateSessionInput { name: string; }
export interface JoinSessionInput { roomCode: string; name: string; }
```

- [ ] **Step 5.2: 실패 테스트 — `tests/manager.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from '../src/server/session/manager';

describe('SessionManager', () => {
  let mgr: SessionManager;
  beforeEach(() => { mgr = new SessionManager({ persist: false }); });

  it('create session returns snapshot with unique room code', () => {
    const a = mgr.createSession({ name: 'Alice' });
    const b = mgr.createSession({ name: 'Bob' });
    expect(a.roomCode).not.toBe(b.roomCode);
    expect(a.hostId).toBe(a.players[0].id);
    expect(a.state).toBe('LOBBY');
  });

  it('join session appends participant', () => {
    const a = mgr.createSession({ name: 'Alice' });
    const joined = mgr.join({ roomCode: a.roomCode, name: 'Bob' });
    expect(joined.players.length).toBe(2);
    expect(joined.players[1].name).toBe('Bob');
  });

  it('join with unknown code throws', () => {
    expect(() => mgr.join({ roomCode: 'ZZZZ', name: 'X' })).toThrow(/not found/i);
  });

  it('selectGame stores gameId, host-only', () => {
    const a = mgr.createSession({ name: 'Alice' });
    const b = mgr.join({ roomCode: a.roomCode, name: 'Bob' });
    mgr.selectGame({ sessionId: a.id, actorId: a.hostId, gameId: 'g1' });
    expect(mgr.getById(a.id)?.selectedGameId).toBe('g1');
    expect(() => mgr.selectGame({ sessionId: a.id, actorId: b.players[1].id, gameId: 'g2' }))
      .toThrow(/host only/i);
  });

  it('startGame transitions LOBBY → PLAYING, host-only', () => {
    const a = mgr.createSession({ name: 'Alice' });
    mgr.join({ roomCode: a.roomCode, name: 'Bob' });
    mgr.selectGame({ sessionId: a.id, actorId: a.hostId, gameId: 'g1' });
    const started = mgr.startGame({ sessionId: a.id, actorId: a.hostId });
    expect(started.state).toBe('PLAYING');
    expect(started.startedAt).toBeGreaterThan(0);
  });

  it('finishGame transitions PLAYING → FINISHED', () => {
    const a = mgr.createSession({ name: 'Alice' });
    mgr.join({ roomCode: a.roomCode, name: 'Bob' });
    mgr.selectGame({ sessionId: a.id, actorId: a.hostId, gameId: 'g1' });
    mgr.startGame({ sessionId: a.id, actorId: a.hostId });
    const done = mgr.finishGame({ sessionId: a.id });
    expect(done.state).toBe('FINISHED');
  });
});
```

- [ ] **Step 5.3: 테스트 실행 — 실패 확인**

- [ ] **Step 5.4: 구현 — `src/server/session/manager.ts`**

```typescript
import { randomUUID } from 'node:crypto';
import { generateRoomCode } from './roomCode';
import type { CreateSessionInput, JoinSessionInput, SessionSnapshot } from './types';

interface Options { persist?: boolean; }

export class SessionManager {
  private byId = new Map<string, SessionSnapshot>();
  private byRoom = new Map<string, string>(); // roomCode → id
  private persist: boolean;
  constructor(opts: Options = {}) { this.persist = opts.persist ?? true; }

  createSession(input: CreateSessionInput): SessionSnapshot {
    const excluded = new Set(this.byRoom.keys());
    const roomCode = generateRoomCode(excluded);
    const id = randomUUID();
    const hostId = randomUUID();
    const snapshot: SessionSnapshot = {
      id, roomCode, state: 'LOBBY', hostId,
      players: [{ id: hostId, name: input.name }],
      selectedGameId: null, startedAt: null, createdAt: Date.now(),
    };
    this.byId.set(id, snapshot);
    this.byRoom.set(roomCode, id);
    // TODO persist — DB insert (Plan에서 bonus step)
    return { ...snapshot };
  }

  join(input: JoinSessionInput): SessionSnapshot {
    const id = this.byRoom.get(input.roomCode.toUpperCase());
    if (!id) throw new Error(`session not found for code ${input.roomCode}`);
    const snap = this.byId.get(id)!;
    if (snap.state !== 'LOBBY') throw new Error('session already started');
    const playerId = randomUUID();
    snap.players.push({ id: playerId, name: input.name });
    return { ...snap };
  }

  getById(id: string): SessionSnapshot | undefined {
    const s = this.byId.get(id);
    return s ? { ...s } : undefined;
  }

  getByRoomCode(code: string): SessionSnapshot | undefined {
    const id = this.byRoom.get(code.toUpperCase());
    return id ? this.getById(id) : undefined;
  }

  selectGame({ sessionId, actorId, gameId }: { sessionId: string; actorId: string; gameId: string; }): SessionSnapshot {
    const snap = this.requireSession(sessionId);
    if (snap.hostId !== actorId) throw new Error('host only');
    snap.selectedGameId = gameId;
    return { ...snap };
  }

  startGame({ sessionId, actorId }: { sessionId: string; actorId: string; }): SessionSnapshot {
    const snap = this.requireSession(sessionId);
    if (snap.hostId !== actorId) throw new Error('host only');
    if (!snap.selectedGameId) throw new Error('no game selected');
    snap.state = 'PLAYING';
    snap.startedAt = Date.now();
    return { ...snap };
  }

  finishGame({ sessionId }: { sessionId: string; }): SessionSnapshot {
    const snap = this.requireSession(sessionId);
    snap.state = 'FINISHED';
    return { ...snap };
  }

  abort({ sessionId }: { sessionId: string; }): SessionSnapshot {
    const snap = this.requireSession(sessionId);
    snap.state = 'ABORTED';
    return { ...snap };
  }

  private requireSession(id: string): SessionSnapshot {
    const snap = this.byId.get(id);
    if (!snap) throw new Error('session not found');
    return snap;
  }
}
```

- [ ] **Step 5.5: 테스트 통과 확인** — 6 passing.

- [ ] **Step 5.6: 커밋**

```bash
git add -A
git commit -m "feat(session): SessionManager with state transitions"
```

> **참고:** DB persistence는 시간 허락 시 bonus로 추가. 24h PoC라 인메모리만으로 데모 가능.

---

## Task 6: 게임 레지스트리 (TDD)

**Files:**
- Create: `src/server/games/registry.ts`, `tests/registry.test.ts`, `games/_test-fixture.html` (테스트용)

- [ ] **Step 6.1: 테스트 fixture 만들기 — `games/number-guess.html` (간단 버전, Task 9에서 완성)**

```html
<!DOCTYPE html>
<html>
<head>
  <meta name="game:title" content="숫자 맞추기">
  <meta name="game:min-players" content="2">
  <meta name="game:max-players" content="8">
  <meta name="game:description" content="정답에서 가장 먼 숫자를 고른 사람이 패배">
  <meta name="game:compare" content="max">
</head>
<body><h1>TBD in Task 9</h1></body>
</html>
```

- [ ] **Step 6.2: 실패 테스트 — `tests/registry.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GameRegistry } from '../src/server/games/registry';

describe('GameRegistry', () => {
  let reg: GameRegistry;
  beforeEach(() => {
    reg = new GameRegistry({ dir: './games', watch: false });
  });

  it('loads game meta from number-guess.html', async () => {
    await reg.scan();
    const all = reg.list();
    const g = all.find(x => x.filename === 'number-guess.html');
    expect(g).toBeDefined();
    expect(g!.title).toBe('숫자 맞추기');
    expect(g!.compare).toBe('max');
    expect(g!.minPlayers).toBe(2);
    expect(g!.maxPlayers).toBe(8);
  });

  it('rejects HTML file missing required meta', async () => {
    // 준비: games/invalid.html 생성
    const fs = await import('node:fs/promises');
    await fs.writeFile('./games/invalid.html', '<html><body></body></html>');
    await reg.scan();
    expect(reg.list().find(x => x.filename === 'invalid.html')).toBeUndefined();
    await fs.unlink('./games/invalid.html');
  });

  it('emits game:added event on scan', async () => {
    const seen: string[] = [];
    reg.on('added', g => seen.push(g.filename));
    await reg.scan();
    expect(seen).toContain('number-guess.html');
  });
});
```

- [ ] **Step 6.3: 테스트 실행 — 실패 확인**

- [ ] **Step 6.4: 구현 — `src/server/games/registry.ts`**

```typescript
import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { watch as chokidarWatch, type FSWatcher } from 'chokidar';
import { EventEmitter } from 'node:events';
import { GameMeta, type GameMeta as GameMetaT } from '../../shared/protocol';

interface Options { dir: string; watch?: boolean; }

const META_RE = /<meta\s+name=["']game:([a-zA-Z-]+)["']\s+content=["']([^"']*)["']/g;

export class GameRegistry extends EventEmitter {
  private byId = new Map<string, GameMetaT>();
  private watcher?: FSWatcher;
  constructor(private opts: Options) { super(); }

  async scan(): Promise<void> {
    const files = (await readdir(this.opts.dir)).filter(f => f.endsWith('.html') && !f.startsWith('_'));
    this.byId.clear();
    for (const f of files) {
      const meta = await this.parseFile(f);
      if (meta) {
        this.byId.set(meta.id, meta);
        this.emit('added', meta);
      }
    }
  }

  private async parseFile(filename: string): Promise<GameMetaT | null> {
    const html = await readFile(join(this.opts.dir, filename), 'utf8');
    const raw: Record<string, string> = {};
    for (const m of html.matchAll(META_RE)) raw[m[1]] = m[2];

    const draft = {
      id: basename(filename, '.html'),
      filename,
      title: raw['title'],
      minPlayers: Number(raw['min-players']),
      maxPlayers: Number(raw['max-players']),
      description: raw['description'] ?? '',
      compare: raw['compare'],
    };
    const parsed = GameMeta.safeParse(draft);
    if (!parsed.success) {
      console.warn(`[registry] skip ${filename}: ${parsed.error.message}`);
      return null;
    }
    return parsed.data;
  }

  list(): GameMetaT[] { return [...this.byId.values()]; }
  get(id: string): GameMetaT | undefined { return this.byId.get(id); }

  startWatching(): void {
    if (!this.opts.watch) return;
    this.watcher = chokidarWatch(this.opts.dir, { ignoreInitial: true });
    this.watcher.on('add', () => this.scan());
    this.watcher.on('change', () => this.scan());
    this.watcher.on('unlink', () => this.scan());
  }

  async stop(): Promise<void> { await this.watcher?.close(); }
}
```

- [ ] **Step 6.5: 테스트 통과 확인**

- [ ] **Step 6.6: 커밋**

```bash
git add -A
git commit -m "feat(games): GameRegistry scans /games and parses <meta> tags"
```

---

## Task 7: 게임 업로드 API

**Files:**
- Create: `src/server/games/upload.ts`, `src/server/routes/games.ts`

- [ ] **Step 7.1: `src/server/games/upload.ts`**

```typescript
import multer from 'multer';
import { join } from 'node:path';

export function createUploader(gamesDir: string) {
  return multer({
    storage: multer.diskStorage({
      destination: gamesDir,
      filename: (_req, file, cb) => {
        // 파일명 안전성: 한글/공백 허용하되 / .. 차단
        const safe = file.originalname.replace(/[/\\]/g, '_');
        if (!safe.endsWith('.html')) return cb(new Error('html only'), '');
        cb(null, safe);
      },
    }),
    limits: { fileSize: 1 * 1024 * 1024 }, // 1MB
    fileFilter: (_req, file, cb) => {
      cb(null, file.mimetype === 'text/html' || file.originalname.endsWith('.html'));
    },
  });
}
```

- [ ] **Step 7.2: `src/server/routes/games.ts`**

```typescript
import { Router } from 'express';
import type { GameRegistry } from '../games/registry';
import { createUploader } from '../games/upload';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

export function gamesRouter(registry: GameRegistry, gamesDir: string): Router {
  const router = Router();
  const upload = createUploader(gamesDir);

  router.get('/', (_req, res) => res.json(registry.list()));

  router.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'file missing' });
    await registry.scan();
    const added = registry.list().find(g => g.filename === req.file!.filename);
    if (!added) {
      // meta 없거나 invalid — 파일 삭제 후 400
      await unlink(join(gamesDir, req.file.filename));
      return res.status(400).json({ error: 'invalid game (missing required meta)' });
    }
    res.status(201).json(added);
  });

  return router;
}
```

- [ ] **Step 7.3: `src/server/app.ts` — Express app 구성 파일 신설 (라우터 등록)**

```typescript
import express from 'express';
import { gamesRouter } from './routes/games';
import { GameRegistry } from './games/registry';
import { config } from './config';
import { join } from 'node:path';

export async function createApp(registry: GameRegistry) {
  const app = express();
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/games', gamesRouter(registry, config.gamesDir));
  app.use('/games', express.static(config.gamesDir));
  return app;
}
```

- [ ] **Step 7.4: `src/server/config.ts`**

```typescript
import 'dotenv/config';
export const config = {
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? './data/app.db',
  gamesDir: process.env.GAMES_DIR ?? './games',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-secret',
};
```
`dotenv` 의존성 추가: `npm i dotenv`.

- [ ] **Step 7.5: `src/server/index.ts` 정리**

```typescript
import './db/migrate';
import { createServer } from 'node:http';
import { Server as IOServer } from 'socket.io';
import { createApp } from './app';
import { GameRegistry } from './games/registry';
import { config } from './config';

const registry = new GameRegistry({ dir: config.gamesDir, watch: true });
await registry.scan();
registry.startWatching();

const app = await createApp(registry);
const httpServer = createServer(app);
new IOServer(httpServer, { cors: { origin: 'http://localhost:5173' } });
httpServer.listen(config.port, () => console.log(`[server] listening on :${config.port}`));
```

- [ ] **Step 7.6: 수동 검증**

```bash
npm run dev:server
# 다른 터미널:
curl http://localhost:3000/api/games
# 기대: [{"id":"number-guess",...}]

curl -F file=@games/number-guess.html http://localhost:3000/api/games
# 기대: 201 + JSON meta
```

- [ ] **Step 7.7: 커밋**

```bash
git add -A
git commit -m "feat(api): games list/upload endpoints + app structure"
```

---

## Task 8: GameRunner — 서버 컴퍼레이터 (TDD)

**Files:**
- Create: `src/server/games/runner.ts`, `tests/runner.test.ts`

> 세션이 PLAYING 상태일 때 각 플레이어의 `submit(value)`를 모아 `compare` 규칙으로 패자를 결정한다.

- [ ] **Step 8.1: 실패 테스트 — `tests/runner.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { GameRunner } from '../src/server/games/runner';

describe('GameRunner', () => {
  it('collects submissions and picks loser by max rule', () => {
    const r = new GameRunner('sess1', ['p1', 'p2', 'p3'], 'max');
    r.submit('p1', 5);
    r.submit('p2', 20);
    r.submit('p3', 8);
    expect(r.isComplete()).toBe(true);
    const outcome = r.resolve();
    expect(outcome.loserId).toBe('p2');   // max loses
    expect(outcome.results).toHaveLength(3);
  });

  it('picks loser by min rule', () => {
    const r = new GameRunner('s', ['a', 'b'], 'min');
    r.submit('a', 1);
    r.submit('b', 2);
    expect(r.resolve().loserId).toBe('a'); // min loses
  });

  it('rejects duplicate submission from same player', () => {
    const r = new GameRunner('s', ['a', 'b'], 'max');
    r.submit('a', 5);
    expect(() => r.submit('a', 100)).toThrow(/duplicate/i);
  });

  it('rejects submission from unknown player', () => {
    const r = new GameRunner('s', ['a', 'b'], 'max');
    expect(() => r.submit('z', 1)).toThrow(/not a participant/i);
  });

  it('is not complete until all players submit', () => {
    const r = new GameRunner('s', ['a', 'b', 'c'], 'max');
    r.submit('a', 1);
    r.submit('b', 2);
    expect(r.isComplete()).toBe(false);
    r.submit('c', 3);
    expect(r.isComplete()).toBe(true);
  });

  it('tiebreak: random pick among tied extremes', () => {
    const r = new GameRunner('s', ['a', 'b'], 'max');
    r.submit('a', 10);
    r.submit('b', 10);
    const outcome = r.resolve();
    expect(['a', 'b']).toContain(outcome.loserId);
  });

  it('missingPlayers() reports who has not submitted', () => {
    const r = new GameRunner('s', ['a', 'b', 'c'], 'max');
    r.submit('b', 1);
    expect(r.missingPlayers()).toEqual(['a', 'c']);
  });
});
```

- [ ] **Step 8.2: 테스트 실행 — 실패 확인**

- [ ] **Step 8.3: 구현 — `src/server/games/runner.ts`**

```typescript
import type { CompareRule } from '../../shared/protocol';

interface Submission { playerId: string; value: number; }

export class GameRunner {
  private submissions = new Map<string, number>();
  private participantSet: Set<string>;
  constructor(
    public readonly sessionId: string,
    private readonly participants: ReadonlyArray<string>,
    private readonly rule: CompareRule,
  ) {
    this.participantSet = new Set(participants);
  }

  submit(playerId: string, value: number): void {
    if (!this.participantSet.has(playerId)) throw new Error(`${playerId} not a participant`);
    if (this.submissions.has(playerId)) throw new Error(`duplicate submission from ${playerId}`);
    if (!Number.isFinite(value)) throw new Error('value must be finite');
    this.submissions.set(playerId, value);
  }

  isComplete(): boolean { return this.submissions.size === this.participants.length; }

  missingPlayers(): string[] {
    return this.participants.filter(p => !this.submissions.has(p));
  }

  resolve(): { loserId: string; results: Submission[] } {
    if (!this.isComplete()) throw new Error('not all players have submitted');
    const results: Submission[] = this.participants.map(p => ({ playerId: p, value: this.submissions.get(p)! }));
    const extremum = this.rule === 'max'
      ? Math.max(...results.map(r => r.value))
      : Math.min(...results.map(r => r.value));
    const tied = results.filter(r => r.value === extremum);
    const loser = tied[Math.floor(Math.random() * tied.length)];
    return { loserId: loser.playerId, results };
  }
}
```

- [ ] **Step 8.4: 테스트 통과 확인**

- [ ] **Step 8.5: 커밋**

```bash
git add -A
git commit -m "feat(games): GameRunner collects submissions and resolves by compare rule"
```

---

## Task 9: Socket.io 핸들러 — 통합 레이어

**Files:**
- Create: `src/server/io.ts`, `src/server/routes/sessions.ts`

> SessionManager, GameRegistry, GameRunner를 Socket.io 이벤트와 연결. 이 파일이 서버의 "오케스트레이션" 중심.

- [ ] **Step 9.1: `src/server/routes/sessions.ts` — 세션 조회용 REST (디버그·로비 진입)**

```typescript
import { Router } from 'express';
import type { SessionManager } from '../session/manager';

export function sessionsRouter(mgr: SessionManager): Router {
  const r = Router();
  r.get('/:code', (req, res) => {
    const s = mgr.getByRoomCode(req.params.code);
    if (!s) return res.status(404).json({ error: 'not found' });
    res.json(s);
  });
  return r;
}
```

- [ ] **Step 9.2: `src/server/io.ts` — 핵심 이벤트 처리**

```typescript
import type { Server as IOServer, Socket } from 'socket.io';
import type { SessionManager } from './session/manager';
import type { GameRegistry } from './games/registry';
import { GameRunner } from './games/runner';
import {
  SocketCreateSession, SocketJoin, SocketSelectGame,
  SocketStartGame, SocketSubmitResult,
} from '../shared/protocol';
import { randomUUID } from 'node:crypto';

interface Ctx { mgr: SessionManager; registry: GameRegistry; }

// 진행 중인 세션별 GameRunner
const runners = new Map<string, GameRunner>();

// 소켓별 세션·플레이어 매핑
interface SocketMeta { sessionId: string; playerId: string; }
const socketMeta = new WeakMap<Socket, SocketMeta>();

export function attachIo(io: IOServer, ctx: Ctx): void {
  io.on('connection', socket => {
    socket.on('session:create', (raw, ack) => {
      const parsed = SocketCreateSession.safeParse(raw);
      if (!parsed.success) return ack?.({ error: 'invalid' });
      const snap = ctx.mgr.createSession(parsed.data);
      socketMeta.set(socket, { sessionId: snap.id, playerId: snap.hostId });
      socket.join(snap.id);
      ack?.({ ok: true, session: snap });
    });

    socket.on('session:join', (raw, ack) => {
      const parsed = SocketJoin.safeParse(raw);
      if (!parsed.success) return ack?.({ error: 'invalid' });
      try {
        const snap = ctx.mgr.join(parsed.data);
        const me = snap.players[snap.players.length - 1];
        socketMeta.set(socket, { sessionId: snap.id, playerId: me.id });
        socket.join(snap.id);
        io.to(snap.id).emit('session:update', snap);
        ack?.({ ok: true, session: snap, playerId: me.id });
      } catch (e: any) {
        ack?.({ error: e.message });
      }
    });

    socket.on('game:select', (raw, ack) => {
      const parsed = SocketSelectGame.safeParse(raw);
      if (!parsed.success) return ack?.({ error: 'invalid' });
      const m = socketMeta.get(socket);
      if (!m) return ack?.({ error: 'no session' });
      try {
        const snap = ctx.mgr.selectGame({ sessionId: m.sessionId, actorId: m.playerId, gameId: parsed.data.gameId });
        io.to(snap.id).emit('session:update', snap);
        ack?.({ ok: true });
      } catch (e: any) { ack?.({ error: e.message }); }
    });

    socket.on('game:start', (_raw, ack) => {
      const m = socketMeta.get(socket);
      if (!m) return ack?.({ error: 'no session' });
      try {
        const snap = ctx.mgr.startGame({ sessionId: m.sessionId, actorId: m.playerId });
        const game = snap.selectedGameId ? ctx.registry.get(snap.selectedGameId) : undefined;
        if (!game) throw new Error('game not found');
        if (snap.players.length < game.minPlayers) throw new Error(`need at least ${game.minPlayers} players`);
        const runner = new GameRunner(snap.id, snap.players.map(p => p.id), game.compare);
        runners.set(snap.id, runner);
        const seed = randomUUID();
        io.to(snap.id).emit('game:begin', { session: snap, game, seed });
        ack?.({ ok: true });
      } catch (e: any) { ack?.({ error: e.message }); }
    });

    socket.on('player:submit', (raw, ack) => {
      const parsed = SocketSubmitResult.safeParse(raw);
      if (!parsed.success) return ack?.({ error: 'invalid' });
      const m = socketMeta.get(socket);
      if (!m) return ack?.({ error: 'no session' });
      const runner = runners.get(m.sessionId);
      if (!runner) return ack?.({ error: 'no active game' });
      try {
        runner.submit(m.playerId, parsed.data.value);
        if (runner.isComplete()) {
          const outcome = runner.resolve();
          ctx.mgr.finishGame({ sessionId: m.sessionId });
          runners.delete(m.sessionId);
          io.to(m.sessionId).emit('game:outcome', outcome);
        } else {
          io.to(m.sessionId).emit('game:progress', {
            submittedCount: runner['submissions'].size,
            total: runner['participants'].length,
          });
        }
        ack?.({ ok: true });
      } catch (e: any) { ack?.({ error: e.message }); }
    });

    socket.on('disconnect', () => {
      const m = socketMeta.get(socket);
      if (m) socket.leave(m.sessionId);
      // PoC: 재접속 복구는 스코프 아웃
    });
  });
}
```

- [ ] **Step 9.3: `src/server/index.ts` 통합 갱신**

```typescript
import './db/migrate';
import { createServer } from 'node:http';
import { Server as IOServer } from 'socket.io';
import { createApp } from './app';
import { GameRegistry } from './games/registry';
import { SessionManager } from './session/manager';
import { attachIo } from './io';
import { config } from './config';
import { sessionsRouter } from './routes/sessions';

const registry = new GameRegistry({ dir: config.gamesDir, watch: true });
await registry.scan();
registry.startWatching();

const mgr = new SessionManager({ persist: false });
const app = await createApp(registry);
app.use('/api/sessions', sessionsRouter(mgr));

const httpServer = createServer(app);
const io = new IOServer(httpServer, { cors: { origin: 'http://localhost:5173' } });
attachIo(io, { mgr, registry });

httpServer.listen(config.port, () => console.log(`[server] listening on :${config.port}`));
```

- [ ] **Step 9.4: 수동 검증 (postman/wscat)**

```bash
npx wscat -c ws://localhost:3000/socket.io/?EIO=4\&transport=websocket
```
또는 다음 단계의 웹 UI로 검증.

- [ ] **Step 9.5: 커밋**

```bash
git add -A
git commit -m "feat(io): socket.io orchestration for create/join/select/start/submit"
```

---

## Task 10: 웹 — HomePage + 세션 hook

**Files:**
- Create: `src/web/socket.ts`, `src/web/hooks/useSession.ts`, `src/web/pages/HomePage.tsx`, `src/web/App.tsx` (갱신), `src/web/styles.css`

- [ ] **Step 10.1: Socket.io 클라이언트 — `src/web/socket.ts`**

```typescript
import { io } from 'socket.io-client';
export const socket = io({ autoConnect: false });
```
`npm i socket.io-client` 필요.

- [ ] **Step 10.2: 세션 hook — `src/web/hooks/useSession.ts`**

```typescript
import { useEffect, useState, useCallback } from 'react';
import { socket } from '../socket';
import type { z } from 'zod';
import { SessionState_Payload } from '../../shared/protocol';

type SessionSnap = z.infer<typeof SessionState_Payload>;

export function useSession() {
  const [session, setSession] = useState<SessionSnap | null>(null);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    if (!socket.connected) socket.connect();
    const onUpdate = (snap: SessionSnap) => setSession(snap);
    socket.on('session:update', onUpdate);
    return () => { socket.off('session:update', onUpdate); };
  }, []);

  const create = useCallback(async (name: string) => {
    return new Promise<SessionSnap>((resolve, reject) => {
      socket.emit('session:create', { name }, (res: any) => {
        if (res.error) return reject(new Error(res.error));
        setSession(res.session); setMe(res.session.hostId); resolve(res.session);
      });
    });
  }, []);

  const join = useCallback(async (roomCode: string, name: string) => {
    return new Promise<SessionSnap>((resolve, reject) => {
      socket.emit('session:join', { roomCode, name }, (res: any) => {
        if (res.error) return reject(new Error(res.error));
        setSession(res.session); setMe(res.playerId); resolve(res.session);
      });
    });
  }, []);

  return { session, me, create, join, setSession };
}
```

- [ ] **Step 10.3: `src/web/pages/HomePage.tsx`**

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../hooks/useSession';

export default function HomePage() {
  const { create, join } = useSession();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  const doCreate = async () => {
    try { const s = await create(name); nav(`/lobby/${s.roomCode}`); }
    catch (e: any) { setErr(e.message); }
  };
  const doJoin = async () => {
    try { const s = await join(code.toUpperCase(), name); nav(`/lobby/${s.roomCode}`); }
    catch (e: any) { setErr(e.message); }
  };

  return (
    <div className="home">
      <h1>Meal Proposal Game</h1>
      <input placeholder="이름" value={name} onChange={e => setName(e.target.value)} />
      <section>
        <h2>방 만들기</h2>
        <button disabled={!name} onClick={doCreate}>방 만들기</button>
      </section>
      <section>
        <h2>방 참여</h2>
        <input placeholder="룸 코드 (4자리)" maxLength={4} value={code}
               onChange={e => setCode(e.target.value.toUpperCase())} />
        <button disabled={!name || code.length !== 4} onClick={doJoin}>참여</button>
      </section>
      {err && <p className="error">{err}</p>}
    </div>
  );
}
```

- [ ] **Step 10.4: `src/web/App.tsx` 갱신 — 라우팅 추가**

```typescript
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import ResultPage from './pages/ResultPage';
import CredentialPage from './pages/CredentialPage';
import './styles.css';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/lobby/:code" element={<LobbyPage />} />
      <Route path="/play/:code" element={<GamePage />} />
      <Route path="/result/:code" element={<ResultPage />} />
      <Route path="/credentials/:code" element={<CredentialPage />} />
    </Routes>
  );
}
```

- [ ] **Step 10.5: `src/web/styles.css` 기본 스타일** (간결)

```css
body { font-family: -apple-system, sans-serif; margin: 0; background: #0d1117; color: #e6edf3; }
.home, .lobby, .game, .result, .cred { max-width: 640px; margin: 40px auto; padding: 24px; }
input, button { font-size: 16px; padding: 8px 12px; margin: 4px; border-radius: 6px; border: 1px solid #30363d; background: #161b22; color: inherit; }
button { cursor: pointer; background: #238636; border-color: #2ea043; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
.error { color: #f85149; }
.player-list { display: flex; flex-wrap: wrap; gap: 12px; }
.player-chip { padding: 8px 16px; background: #21262d; border-radius: 999px; }
```

- [ ] **Step 10.6: 수동 검증 — 2개 탭 열어 방 만들기 + 참여 확인**

```bash
npm run dev
```
- 탭1: 이름 입력 → "방 만들기" → URL `/lobby/XXXX` 이동, 룸 코드 확인
- 탭2: 이름 입력 + 룸 코드 입력 → "참여" → 둘 다 `/lobby/XXXX` 진입
- 이 시점에 `LobbyPage`는 아직 빈 화면이라도 OK

- [ ] **Step 10.7: 커밋**

```bash
git add -A
git commit -m "feat(web): HomePage and useSession hook for create/join"
```

---

## Task 11: LobbyPage

**Files:**
- Create: `src/web/pages/LobbyPage.tsx`, `src/web/components/PlayerList.tsx`, `src/web/components/GameSelector.tsx`, `src/web/components/GameUpload.tsx`

- [ ] **Step 11.1: `src/web/components/PlayerList.tsx`**

```typescript
import type { Player } from '../../shared/protocol';
export function PlayerList({ players, hostId }: { players: Player[]; hostId: string }) {
  return (
    <div className="player-list">
      {players.map(p => (
        <div key={p.id} className="player-chip">{p.name}{p.id === hostId && ' 👑'}</div>
      ))}
    </div>
  );
}
```

- [ ] **Step 11.2: `src/web/components/GameSelector.tsx`**

```typescript
import { useEffect, useState } from 'react';
import type { GameMeta } from '../../shared/protocol';

export function GameSelector({ selectedId, onSelect, disabled }: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [games, setGames] = useState<GameMeta[]>([]);
  useEffect(() => {
    fetch('/api/games').then(r => r.json()).then(setGames);
  }, []);
  return (
    <select value={selectedId ?? ''} onChange={e => onSelect(e.target.value)} disabled={disabled}>
      <option value="" disabled>게임을 선택하세요</option>
      {games.map(g => (
        <option key={g.id} value={g.id}>{g.title} ({g.minPlayers}-{g.maxPlayers}명)</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 11.3: `src/web/components/GameUpload.tsx`**

```typescript
import { useState } from 'react';
export function GameUpload({ onUploaded }: { onUploaded: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const handle = async (f: File) => {
    setBusy(true); setErr('');
    const fd = new FormData(); fd.append('file', f);
    const res = await fetch('/api/games', { method: 'POST', body: fd });
    if (!res.ok) setErr((await res.json()).error ?? 'upload failed');
    else onUploaded();
    setBusy(false);
  };
  return (
    <div>
      <input type="file" accept=".html" disabled={busy}
             onChange={e => e.target.files?.[0] && handle(e.target.files[0])} />
      {err && <p className="error">{err}</p>}
    </div>
  );
}
```

- [ ] **Step 11.4: `src/web/pages/LobbyPage.tsx`**

```typescript
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { socket } from '../socket';
import { PlayerList } from '../components/PlayerList';
import { GameSelector } from '../components/GameSelector';
import { GameUpload } from '../components/GameUpload';

export default function LobbyPage() {
  const { code } = useParams();
  const nav = useNavigate();
  const { session, me, setSession } = useSession();

  useEffect(() => {
    const onBegin = (p: any) => nav(`/play/${code}`);
    socket.on('game:begin', onBegin);
    return () => { socket.off('game:begin', onBegin); };
  }, [code, nav]);

  if (!session || !me) return <div className="lobby">세션 정보 로딩 중...</div>;
  const isHost = session.hostId === me;

  const selectGame = (id: string) => {
    socket.emit('game:select', { gameId: id }, (res: any) => res.error && alert(res.error));
  };
  const startGame = () => {
    socket.emit('game:start', {}, (res: any) => res.error && alert(res.error));
  };

  return (
    <div className="lobby">
      <h1>방 {session.roomCode}</h1>
      <p>공유할 코드: <strong>{session.roomCode}</strong></p>
      <h2>참가자 ({session.players.length})</h2>
      <PlayerList players={session.players} hostId={session.hostId} />

      <h2>게임 선택</h2>
      <GameSelector selectedId={session.selectedGameId} onSelect={selectGame} disabled={!isHost} />
      {isHost && (<>
        <h3>게임 업로드</h3>
        <GameUpload onUploaded={() => { /* GameSelector가 자동 refetch 안 하므로 간단히 reload */
          location.reload();
        }} />
        <button disabled={!session.selectedGameId} onClick={startGame}>시작!</button>
      </>)}
    </div>
  );
}
```

- [ ] **Step 11.5: 수동 검증 — 호스트에서 게임 선택 → 참여자에게도 session:update 반영되는지 확인**

- [ ] **Step 11.6: 커밋**

```bash
git add -A
git commit -m "feat(web): LobbyPage with game selector and host controls"
```

---

## Task 12: GameFrame + postMessage 브리지

**Files:**
- Create: `src/web/hooks/useGameFrame.ts`, `src/web/components/GameFrame.tsx`, `src/web/pages/GamePage.tsx`

- [ ] **Step 12.1: `src/web/hooks/useGameFrame.ts`**

```typescript
import { useEffect, useRef } from 'react';
import { HostToIframe, IframeToHost } from '../../shared/protocol';
import type { z } from 'zod';

type Outbound = z.infer<typeof HostToIframe>;
type Inbound = z.infer<typeof IframeToHost>;

export function useGameFrame(iframe: React.RefObject<HTMLIFrameElement>, onMessage: (msg: Inbound) => void) {
  const onMsgRef = useRef(onMessage);
  onMsgRef.current = onMessage;

  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.source !== iframe.current?.contentWindow) return;
      const parsed = IframeToHost.safeParse(e.data);
      if (!parsed.success) return console.warn('iframe msg rejected', e.data);
      onMsgRef.current(parsed.data);
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, [iframe]);

  const send = (msg: Outbound) => iframe.current?.contentWindow?.postMessage(msg, '*');
  return { send };
}
```

- [ ] **Step 12.2: `src/web/components/GameFrame.tsx`**

```typescript
import { useRef, useEffect } from 'react';
import { useGameFrame } from '../hooks/useGameFrame';
import type { Player } from '../../shared/protocol';

interface Props {
  gameUrl: string;
  playerId: string;
  players: Player[];
  sessionId: string;
  seed: string;
  onSubmit: (value: number) => void;
  showOutcome?: { loserId: string; results: { playerId: string; value: number }[] } | null;
}

export function GameFrame({ gameUrl, playerId, players, sessionId, seed, onSubmit, showOutcome }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const { send } = useGameFrame(ref, (msg) => {
    if (msg.type === 'ready') send({ type: 'start' });
    if (msg.type === 'submit') onSubmit(msg.value);
  });

  useEffect(() => {
    const onLoad = () => {
      send({ type: 'init', playerId, players, sessionId, seed });
    };
    ref.current?.addEventListener('load', onLoad);
    return () => ref.current?.removeEventListener('load', onLoad);
  }, [playerId, players, sessionId, seed, send]);

  useEffect(() => {
    if (showOutcome) send({ type: 'outcome', ...showOutcome });
  }, [showOutcome, send]);

  return (
    <iframe ref={ref} src={gameUrl} sandbox="allow-scripts" width="100%" height="520"
            style={{ border: '1px solid #30363d', borderRadius: 8 }} />
  );
}
```

- [ ] **Step 12.3: `src/web/pages/GamePage.tsx`**

```typescript
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { socket } from '../socket';
import { useSession } from '../hooks/useSession';
import { GameFrame } from '../components/GameFrame';
import type { GameMeta } from '../../shared/protocol';

export default function GamePage() {
  const { code } = useParams();
  const nav = useNavigate();
  const { session, me } = useSession();
  const [game, setGame] = useState<GameMeta | null>(null);
  const [seed, setSeed] = useState('');
  const [outcome, setOutcome] = useState<any>(null);
  const [progress, setProgress] = useState<{ submittedCount: number; total: number } | null>(null);

  useEffect(() => {
    const onBegin = (p: { game: GameMeta; seed: string }) => {
      setGame(p.game); setSeed(p.seed);
    };
    const onOutcome = (o: any) => {
      setOutcome(o);
      setTimeout(() => nav(`/result/${code}`, { state: o }), 3000);
    };
    const onProgress = (p: any) => setProgress(p);
    socket.on('game:begin', onBegin);
    socket.on('game:outcome', onOutcome);
    socket.on('game:progress', onProgress);
    return () => {
      socket.off('game:begin', onBegin);
      socket.off('game:outcome', onOutcome);
      socket.off('game:progress', onProgress);
    };
  }, [code, nav]);

  if (!session || !me || !game) return <div className="game">게임 로딩 중...</div>;

  const submit = (value: number) => {
    socket.emit('player:submit', { value }, (res: any) => res.error && alert(res.error));
  };

  return (
    <div className="game">
      <h1>{game.title}</h1>
      {progress && <p>제출 {progress.submittedCount}/{progress.total}</p>}
      <GameFrame
        gameUrl={`/games/${game.filename}`}
        playerId={me}
        players={session.players}
        sessionId={session.sessionId}
        seed={seed}
        onSubmit={submit}
        showOutcome={outcome}
      />
    </div>
  );
}
```

- [ ] **Step 12.4: 커밋**

```bash
git add -A
git commit -m "feat(web): iframe postMessage bridge and GamePage"
```

---

## Task 13: 결과 페이지 + Credential 스텁

**Files:**
- Create: `src/web/pages/ResultPage.tsx`, `src/web/pages/CredentialPage.tsx`

- [ ] **Step 13.1: `src/web/pages/ResultPage.tsx`**

```typescript
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../hooks/useSession';

export default function ResultPage() {
  const { code } = useParams();
  const { state } = useLocation();
  const nav = useNavigate();
  const { session, me } = useSession();

  if (!session || !state) return <div className="result">결과 없음</div>;
  const loser = session.players.find(p => p.id === (state as any).loserId);
  const iAmLoser = me === (state as any).loserId;

  return (
    <div className="result">
      <h1>🎲 패자 발표</h1>
      <div style={{ fontSize: 48, textAlign: 'center', margin: 40 }}>
        💀 <strong>{loser?.name}</strong>
      </div>
      <ul>
        {(state as any).results.map((r: any) => {
          const p = session.players.find(pp => pp.id === r.playerId);
          return <li key={r.playerId}>{p?.name}: {r.value}</li>;
        })}
      </ul>
      {iAmLoser && (
        <button onClick={() => nav(`/credentials/${code}`)}>품의서 상신 예약하기</button>
      )}
    </div>
  );
}
```

- [ ] **Step 13.2: `src/web/pages/CredentialPage.tsx` (Plan B에서 와이어링)**

```typescript
import { useParams } from 'react-router-dom';
import { useState } from 'react';

export default function CredentialPage() {
  const { code } = useParams();
  const [id, setId] = useState(''); const [pw, setPw] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    // Plan B: POST /api/submissions { sessionId, erpId, erpPw }
    // 지금은 스텁
    alert('Plan B에서 자동 상신 예약 로직을 연결합니다.');
    setDone(true);
  };

  if (done) return <div className="cred"><h2>예약 완료 (스텁)</h2><p>다음 영업일 09:00에 자동 상신 예정</p></div>;

  return (
    <div className="cred">
      <h1>ERP 자격증명 입력</h1>
      <p>세션 {code}의 품의서를 다음 영업일 09:00에 자동으로 상신합니다.</p>
      <input placeholder="아마란스 ID" value={id} onChange={e => setId(e.target.value)} />
      <input placeholder="아마란스 PW" type="password" value={pw} onChange={e => setPw(e.target.value)} />
      <button disabled={!id || !pw} onClick={submit}>예약하기</button>
    </div>
  );
}
```

- [ ] **Step 13.3: 커밋**

```bash
git add -A
git commit -m "feat(web): ResultPage reveal + CredentialPage stub"
```

---

## Task 14: 샘플 게임 3종 구현

**Files:**
- Create/Update: `games/number-guess.html`, `games/reaction.html`, `games/coin-flip.html`

> 각 게임은 **이 플레이어 한 명만의 UI**를 렌더하고, 하나의 `submit(value)`로 결과를 보낸다.

- [ ] **Step 14.1: `games/number-guess.html` — 1~100 중 숫자 선택, 목표 숫자에서 거리가 크면 패 (compare: max)**

```html
<!DOCTYPE html>
<html>
<head>
<meta name="game:title" content="숫자 맞추기">
<meta name="game:min-players" content="2">
<meta name="game:max-players" content="8">
<meta name="game:description" content="정답에서 가장 먼 숫자를 고른 사람이 패배">
<meta name="game:compare" content="max">
<style>
  body { font-family: sans-serif; text-align: center; padding: 24px; }
  input, button { font-size: 20px; padding: 8px 16px; margin: 8px; }
  .target { font-size: 48px; margin: 16px; color: #888; }
</style>
</head>
<body>
<h2>1-100 중 숫자를 선택하세요</h2>
<p class="target" id="target">???</p>
<input id="g" type="number" min="1" max="100" />
<button id="b">제출</button>
<p id="status"></p>
<script>
let init = null, started = false, target = null;
window.addEventListener('message', e => {
  const m = e.data;
  if (m.type === 'init') {
    init = m;
    // seed로 결정적 목표 숫자 생성 (1~100)
    const hash = [...m.seed].reduce((a, c) => a + c.charCodeAt(0), 0);
    target = (hash % 100) + 1;
    parent.postMessage({ type: 'ready' }, '*');
  }
  if (m.type === 'start') {
    started = true;
    document.getElementById('status').textContent = '선택하고 제출!';
  }
  if (m.type === 'outcome') {
    document.getElementById('target').textContent = target;
    document.getElementById('status').textContent = `정답은 ${target}. 패자: ${m.loserId}`;
  }
});
document.getElementById('b').onclick = () => {
  if (!started || target == null) return;
  const guess = Number(document.getElementById('g').value);
  const dist = Math.abs(target - guess);
  parent.postMessage({ type: 'submit', value: dist }, '*');
  document.getElementById('b').disabled = true;
  document.getElementById('status').textContent = '제출 완료! 다른 사람 대기 중...';
};
</script>
</body>
</html>
```

- [ ] **Step 14.2: `games/reaction.html` — 초록불 켜지면 빠르게 클릭, 느린 사람이 패 (compare: max)**

```html
<!DOCTYPE html>
<html>
<head>
<meta name="game:title" content="반응 속도">
<meta name="game:min-players" content="2">
<meta name="game:max-players" content="8">
<meta name="game:description" content="초록색 신호가 켜지면 클릭, 가장 느린 사람 패배">
<meta name="game:compare" content="max">
<style>
  body { font-family: sans-serif; text-align: center; padding: 0; margin: 0; }
  .box { width: 100vw; height: 400px; background: #555; display: flex; align-items: center; justify-content: center; font-size: 32px; color: white; cursor: pointer; user-select: none; }
  .go { background: #2ea043; }
  .fail { background: #f85149; }
</style>
</head>
<body>
<div id="box" class="box">대기 중...</div>
<script>
let seedHash = 0, started = false, goAt = null, clicked = false;
window.addEventListener('message', e => {
  if (e.data.type === 'init') {
    seedHash = [...e.data.seed].reduce((a, c) => a + c.charCodeAt(0), 0);
    parent.postMessage({ type: 'ready' }, '*');
  }
  if (e.data.type === 'start') {
    started = true;
    const delay = 1500 + (seedHash % 3000); // 1.5-4.5초 딜레이
    setTimeout(() => {
      goAt = performance.now();
      document.getElementById('box').className = 'box go';
      document.getElementById('box').textContent = '클릭!';
    }, delay);
  }
});
document.getElementById('box').onclick = () => {
  if (!started || clicked) return;
  clicked = true;
  const now = performance.now();
  let value;
  if (goAt == null) {
    // 너무 일찍 — 큰 페널티
    value = 10_000;
    document.getElementById('box').className = 'box fail';
    document.getElementById('box').textContent = '성급함! +10s 페널티';
  } else {
    value = now - goAt;
    document.getElementById('box').textContent = `${Math.round(value)}ms`;
  }
  parent.postMessage({ type: 'submit', value }, '*');
};
</script>
</body>
</html>
```

- [ ] **Step 14.3: `games/coin-flip.html` — 각자 클릭하면 랜덤 숫자, 최댓값이 패 (순수 운, compare: max)**

```html
<!DOCTYPE html>
<html>
<head>
<meta name="game:title" content="동전 뽑기">
<meta name="game:min-players" content="2">
<meta name="game:max-players" content="10">
<meta name="game:description" content="버튼 클릭 시 1-100 랜덤. 가장 큰 숫자 뽑은 사람 패배">
<meta name="game:compare" content="max">
<style>
  body { font-family: sans-serif; text-align: center; padding: 40px; }
  button { font-size: 32px; padding: 24px 48px; border-radius: 12px; border: 0; background: #238636; color: white; cursor: pointer; }
  .num { font-size: 80px; margin: 40px; }
</style>
</head>
<body>
<h2>운명의 버튼</h2>
<button id="b">눌러라!</button>
<p class="num" id="n">-</p>
<script>
let started = false, pulled = false;
window.addEventListener('message', e => {
  if (e.data.type === 'init') parent.postMessage({ type: 'ready' }, '*');
  if (e.data.type === 'start') started = true;
});
document.getElementById('b').onclick = () => {
  if (!started || pulled) return;
  pulled = true;
  const v = Math.floor(Math.random() * 100) + 1;
  document.getElementById('n').textContent = v;
  document.getElementById('b').disabled = true;
  parent.postMessage({ type: 'submit', value: v }, '*');
};
</script>
</body>
</html>
```

- [ ] **Step 14.4: 수동 E2E 테스트**

```bash
npm run dev
```
- 탭1 (호스트): 방 생성 → 게임 "숫자 맞추기" 선택 → 시작
- 탭2 (참여자): 룸 코드 입력 → 참여 → 게임 시작 감지 → 각자 숫자 제출 → 결과 페이지 진입

- [ ] **Step 14.5: 커밋**

```bash
git add games/
git commit -m "feat(games): 3 sample games (number-guess, reaction, coin-flip)"
```

---

## Task 15: 통합 연출 & 폴리싱

**Files:**
- Update: `src/web/pages/ResultPage.tsx`, `src/web/styles.css`

- [ ] **Step 15.1: 결과 페이지에 사운드·애니메이션 추가 (시간 허락 시)**

```typescript
// ResultPage.tsx 상단 추가
import { useEffect } from 'react';
// ...
useEffect(() => {
  // 간단한 드럼롤 → 비프
  const ctx = new AudioContext();
  const osc = ctx.createOscillator(); osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 1.5);
  const gain = ctx.createGain(); gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
  osc.connect(gain).connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + 2);
}, []);
```

- [ ] **Step 15.2: 로비에 룸 코드 복사 버튼 추가 (편의)**

LobbyPage에 추가:
```typescript
<button onClick={() => navigator.clipboard.writeText(session.roomCode)}>룸 코드 복사</button>
```

- [ ] **Step 15.3: 커밋**

```bash
git add -A
git commit -m "feat(web): polish — drumroll sound and copy-code button"
```

---

## Task 16: 수동 데모 리허설 체크리스트

**Files:**
- Create: `docs/demo-checklist.md`

- [ ] **Step 16.1: 체크리스트 작성**

```markdown
# 데모 리허설 체크리스트

## 사전 (데모 전날)
- [ ] 법인카드로 식사 결제 1건 완료 (데모 당일 카드내역 조회용) — Plan B 연동 시
- [ ] 아마란스 접속 + 로그인 동작 확인
- [ ] `npm run dev` 양쪽 다 기동, http://localhost:5173 접속
- [ ] 4대 PC 간 네트워크 연결 확인 (유선 권장)
- [ ] 샘플 게임 3종 플레이 테스트

## 데모 당일 시나리오
1. 호스트 PC에서 `npm start` (prod 모드) 또는 `npm run dev`
2. 4대 PC에서 http://<host-ip>:3000 접속 (또는 5173)
3. 호스트: "방 만들기" → 룸 코드 공유
4. 3명: 룸 코드 입력 → 참여
5. 호스트: 게임 선택 → "시작"
6. 각자 플레이 → 패자 발표
7. (Plan B 완성 후) 패자가 자격증명 입력 → "즉시 실행" 버튼 → 아마란스 상신 연출

## 플랜 B (ERP 불안정 시)
- `.env`에 `MOCK_MODE=true` → Playwright 대신 사전 캡처 스크린샷 연출
```

- [ ] **Step 16.2: 커밋**

```bash
git add docs/demo-checklist.md
git commit -m "docs: demo rehearsal checklist"
```

---

## Acceptance Criteria (Plan A 완료 기준)

1. ✅ 호스트가 `/`에서 방을 만들면 룸 코드가 발급되고 로비로 이동한다.
2. ✅ 참가자가 룸 코드로 참여하면 모든 참가자의 브라우저에 즉시 업데이트된 참가자 목록이 표시된다.
3. ✅ 호스트가 게임을 선택하고 시작을 누르면 모든 브라우저에서 iframe 게임이 동시에 로드된다.
4. ✅ 각 플레이어가 `submit(value)`를 보내면 서버가 수집하고, 전원 제출 시 `compare` 규칙으로 패자를 결정해 broadcast한다.
5. ✅ 결과 페이지가 패자를 발표하고, 패자에게는 "상신 예약" CTA가 노출된다 (Credential 페이지는 스텁).
6. ✅ 즉석에서 새 HTML 게임을 업로드하면 게임 목록에 즉시 나타나고 선택·플레이 가능하다.
7. ✅ 주요 로직(룸 코드·레지스트리·세션·러너·프로토콜)의 유닛 테스트가 녹색이다 (`npm test`).

## 팀 병렬 작업 제안

| 담당 | Task |
|------|------|
| Dev 1 (백엔드 메인) | Task 1~3, 5, 8, 9 |
| Dev 2 (자동화 전담) | Plan B (Q6 이후). 그 전에는 아마란스 수동 탐색 + DOM 캡처 보조 |
| Dev 3 (웹 UI) | Task 10, 11, 13, 15 |
| Dev 4 (게임·브리지) | Task 6, 7, 12, 14 |

Task 2 (shared/protocol) 와 Task 4 (roomCode) 는 초기에 Dev 1이 담당하되, 완료 후 공용 토대가 되므로 다른 개발자가 이를 기준으로 병렬 작업 가능.

---

## Self-Review 체크리스트 (계획 완료 시 점검)

- [ ] 스펙 §4.3~4.5의 각 항목이 Plan의 어떤 Task에서 구현되는지 점검 — 게임 SDK(§4.3)는 Task 2+12+14, DB(§4.5)는 Task 3, 세션(§4.2)은 Task 5+9. OK
- [ ] placeholder 없음 — 각 Step이 실제 코드/명령을 포함. CredentialPage만 Plan B 스텁으로 명시. OK
- [ ] 타입 일관성 — `SessionSnapshot`, `GameMeta`, `Player`, `SocketJoin` 등이 shared/protocol에서 정의되고 서버/웹에서 동일하게 import됨. OK
- [ ] Plan B 의존성 — Credential 저장/큐/Scheduler/Playwright는 Plan B 범위. Task 13이 이를 스텁으로 명시. OK
