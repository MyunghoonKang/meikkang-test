import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema';

const dbPath = process.env.DB_PATH ?? './data/app.db';
mkdirSync(dirname(dbPath), { recursive: true });
export const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
export const db = drizzle(sqlite, { schema });
