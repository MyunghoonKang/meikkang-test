import { Router } from 'express';
import type { CredentialVault } from '../vault/vault';
import { credentialInputSchema } from '../../shared/protocol';

export function credentialsRouter(vault: CredentialVault): Router {
  const r = Router();
  r.post('/', async (req, res) => {
    const parsed = credentialInputSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: parsed.error.flatten() });
    const { userId, loginId, password } = parsed.data;
    await vault.save(userId, { loginId, password });
    res.status(204).end();
  });
  return r;
}
