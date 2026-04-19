import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';

// 3A 소유 — sessions 테이블
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  roomCode: text('room_code').notNull().unique(),
  // RoomStatus 9 values.
  status: text('status', {
    enum: ['PREPARING','PLAYING','FINISHED','CREDENTIAL_INPUT','QUEUED','RUNNING','COMPLETED','FAILED','ABORTED'],
  }).notNull().default('PREPARING'),
  hostId: text('host_id').notNull(),
  selectedGameId: text('selected_game_id'),
  startedAt: integer('started_at'),
  createdAt: integer('created_at').notNull(),
  // FINISHED 이후 채움
  loserId: text('loser_id'),
  // QUEUED 이후 채움 — submissions.id FK
  submissionId: text('submission_id'),
});

// 4A 소유 — submissions 테이블
export const submissions = sqliteTable('submissions', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  loserUserId: text('loser_user_id').notNull(),
  status: text('status', {
    enum: ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED_AUTH', 'FAILED_NO_TXN', 'FAILED_UNEXPECTED_UI', 'FAILED_OTHER', 'ABORTED'],
  }).notNull(),
  mode: text('mode', { enum: ['live', 'mock', 'dryrun'] }).notNull().default('mock'),
  scheduledAt: integer('scheduled_at', { mode: 'timestamp_ms' }).notNull(),
  claimedAt: integer('claimed_at', { mode: 'timestamp_ms' }),
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  sunginNb: text('sungin_nb'),
  erpRefNo: text('erp_ref_no'),
  errorLog: text('error_log'),
  screenshotDir: text('screenshot_dir'),
  attendeeNames: text('attendee_names').notNull(), // JSON array
  titleOverride: text('title_override'),
  purposeKind: text('purpose_kind', { enum: ['coffee', 'lunch'] }).notNull().default('lunch'),
});

// 4A 소유 — credentials 테이블 (AES-256-GCM 암호화 저장)
export const credentials = sqliteTable('credentials', {
  userId: text('user_id').primaryKey(),
  ciphertext: blob('ciphertext', { mode: 'buffer' }).notNull(),
  iv: blob('iv', { mode: 'buffer' }).notNull(),
  authTag: blob('auth_tag', { mode: 'buffer' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
