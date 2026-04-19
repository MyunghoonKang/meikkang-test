import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../src/server/db/schema';
import { CredentialVault } from '../src/server/vault/vault';
import { readFileSync } from 'node:fs';

const KEY = Buffer.alloc(32, 7);

function createTestDb() {
  const sqlite = new Database(':memory:');
  const sql = readFileSync('./drizzle/0001_init.sql', 'utf-8');
  const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) sqlite.exec(stmt);
  return drizzle(sqlite, { schema });
}

describe('CredentialVault', () => {
  it('encrypts, stores, and decrypts credentials', async () => {
    const db = createTestDb();
    const vault = new CredentialVault(db, KEY);
    await vault.save('u1', { loginId: 'alice', password: 'p@ss!' });
    const out = await vault.load('u1');
    expect(out).toEqual({ loginId: 'alice', password: 'p@ss!' });
  });

  it('different calls produce different ciphertexts (random IV)', async () => {
    const db = createTestDb();
    const vault = new CredentialVault(db, KEY);
    await vault.save('u1', { loginId: 'a', password: 'b' });
    const first = await db.query.credentials.findFirst();
    await vault.save('u1', { loginId: 'a', password: 'b' });
    const second = await db.query.credentials.findFirst();
    expect(first!.ciphertext.equals(second!.ciphertext)).toBe(false);
  });

  it('returns null when record missing', async () => {
    const db = createTestDb();
    const vault = new CredentialVault(db, KEY);
    expect(await vault.load('missing')).toBeNull();
  });

  it('throws on wrong key (auth tag mismatch)', async () => {
    const db = createTestDb();
    const vaultA = new CredentialVault(db, KEY);
    await vaultA.save('u1', { loginId: 'a', password: 'b' });
    const vaultB = new CredentialVault(db, Buffer.alloc(32, 9));
    await expect(vaultB.load('u1')).rejects.toThrow();
  });
});
