import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { credentials } from '../db/schema';
import { encrypt, decrypt } from './crypto';
import type { ErpCredential } from './types';

export class CredentialVault {
  constructor(private db: BetterSQLite3Database<any>, private key: Buffer) {
    if (key.length !== 32) throw new Error('VAULT_MASTER_KEY must be 32 bytes');
  }

  async save(userId: string, cred: ErpCredential): Promise<void> {
    const { ciphertext, iv, authTag } = encrypt(this.key, JSON.stringify(cred));
    await this.db
      .insert(credentials)
      .values({ userId, ciphertext, iv, authTag, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: credentials.userId,
        set: { ciphertext, iv, authTag, updatedAt: new Date() },
      });
  }

  async load(userId: string): Promise<ErpCredential | null> {
    const row = await this.db.query.credentials.findFirst({ where: eq(credentials.userId, userId) });
    if (!row) return null;
    const json = decrypt(this.key, row.ciphertext, row.iv, row.authTag);
    return JSON.parse(json) as ErpCredential;
  }
}
