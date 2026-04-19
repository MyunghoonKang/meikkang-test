import { z } from 'zod';

// ===== 공용 타입 =====
export const Player = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(20),
});
export type Player = z.infer<typeof Player>;

// 9단계 Room 상태머신.
// - PREPARING:        호스트가 방 만든 직후 (LobbyView)
// - PLAYING:          게임 시작 ~ 패자 결정 전
// - FINISHED:         패자 결정. 패자에게 "자격증명 입력" CTA 노출
// - CREDENTIAL_INPUT: 패자가 자격증명 입력 중 (다른 사람은 대기 안내)
// - QUEUED:           submission enqueue 완료, 스케줄 대기 중
// - RUNNING:          워커가 ERP 자동화 실행 중
// - COMPLETED:        ERP 상신 성공
// - FAILED:           ERP 상신 실패 (errorLog 노출)
// - ABORTED:          데모 중단 등
export const RoomStatus = z.enum([
  'PREPARING', 'PLAYING', 'FINISHED',
  'CREDENTIAL_INPUT', 'QUEUED', 'RUNNING',
  'COMPLETED', 'FAILED', 'ABORTED',
]);
export type RoomStatus = z.infer<typeof RoomStatus>;

// SessionManager.transitionStatus 가 참조할 전이표.
// from -> 허용되는 to 집합. 이 표에 없는 전이는 illegal.
export const ALLOWED_TRANSITIONS: Record<RoomStatus, readonly RoomStatus[]> = {
  PREPARING:        ['PLAYING', 'ABORTED'],
  PLAYING:          ['FINISHED', 'ABORTED'],
  FINISHED:         ['CREDENTIAL_INPUT', 'ABORTED'],
  CREDENTIAL_INPUT: ['QUEUED', 'ABORTED'],
  QUEUED:           ['RUNNING', 'ABORTED'],
  RUNNING:          ['COMPLETED', 'FAILED', 'ABORTED'],
  COMPLETED:        [],
  FAILED:           ['ABORTED'], // terminal; 재시도 UI 필요 시 4A 가 별도 PR 로 QUEUED 추가
  ABORTED:          [],
} as const;

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

// ===== 자격증명 (Plan B) =====
export const credentialInputSchema = z.object({
  userId: z.string().min(1),
  loginId: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});
export type CredentialInput = z.infer<typeof credentialInputSchema>;

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
// `room:state` 이벤트 페이로드. 모든 상태 변화는 이 한 이벤트로 broadcast.
export const RoomStatePayload = z.object({
  sessionId: z.string(),
  roomCode: z.string(),
  status: RoomStatus,
  hostId: z.string(),
  players: z.array(Player),
  selectedGameId: z.string().nullable(),
  // FINISHED 이후에만 채워짐
  loserId: z.string().nullable().optional(),
  results: z.array(z.object({ playerId: z.string(), value: z.number() })).optional(),
  // QUEUED 이후에만 채워짐 (Plan B)
  submissionId: z.string().nullable().optional(),
  scheduledAt: z.number().nullable().optional(),
  // RUNNING 단계 indicator (Plan B 워커가 step 진행마다 갱신)
  workerStep: z.enum(['login', 'cardModal', 'formFill', 'approval']).nullable().optional(),
  // COMPLETED 시 채워짐
  erpRefNo: z.string().nullable().optional(),
  // FAILED 시 채워짐
  errorLog: z.string().nullable().optional(),
});
export type RoomStatePayload = z.infer<typeof RoomStatePayload>;

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

// ===== REST 응답 타입 =====
export const CreateSessionResponse = z.object({
  sessionId: z.string(),
  roomCode: z.string(),
  hostId: z.string(),
});
export const JoinSessionResponse = z.object({
  sessionId: z.string(),
  playerId: z.string(),
});
export const GamesListResponse = z.object({
  games: z.array(GameMeta),
});
export const GameUploadResponse = z.object({
  game: GameMeta,
});
export const GameUploadError = z.object({
  error: z.string(),
  errors: z.array(z.string()).optional(),
});
export const EnqueueSubmissionResponse = z.object({
  submissionId: z.string(),
  scheduledAt: z.number(),
});
