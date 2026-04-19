import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync } from 'node:fs';
import * as schema from '../src/server/db/schema';
import { CredentialVault } from '../src/server/vault/vault';
import { credentialsRouter } from '../src/server/routes/credentials';

const TEST_KEY = Buffer.alloc(32, 7);

function createTestDb() {
  const sqlite = new Database(':memory:');
  const sql = readFileSync('./drizzle/0001_init.sql', 'utf-8');
  const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) sqlite.exec(stmt);
  return drizzle(sqlite, { schema });
}

function buildApp(vault: CredentialVault) {
  const app = express();
  app.use(express.json());
  app.use('/api/credentials', credentialsRouter(vault));
  return app;
}

describe('POST /api/credentials', () => {
  it('returns 204 and vault.load returns the saved credentials', async () => {
    const db = createTestDb();
    const vault = new CredentialVault(db, TEST_KEY);
    const app = buildApp(vault);

    const res = await request(app)
      .post('/api/credentials')
      .send({ userId: 'u1', loginId: 'alice', password: 's3cr3t' });

    expect(res.status).toBe(204);

    const loaded = await vault.load('u1');
    expect(loaded).toEqual({ loginId: 'alice', password: 's3cr3t' });
  });

  it('returns 400 for missing required fields', async () => {
    const db = createTestDb();
    const vault = new CredentialVault(db, TEST_KEY);
    const app = buildApp(vault);

    const res = await request(app)
      .post('/api/credentials')
      .send({ userId: 'u1' }); // missing loginId and password

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for empty body', async () => {
    const db = createTestDb();
    const vault = new CredentialVault(db, TEST_KEY);
    const app = buildApp(vault);

    const res = await request(app)
      .post('/api/credentials')
      .send({});

    expect(res.status).toBe(400);
  });
});
