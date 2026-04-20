import express from 'express';
import { gamesRouter } from './routes/games';
import { credentialsRouter } from './routes/credentials';
import type { GameRegistry } from './games/registry';
import type { CredentialVault } from './vault/vault';
import { config } from './config';

export async function createApp(registry: GameRegistry, vault: CredentialVault) {
  const app = express();
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/games', gamesRouter(registry, config.gamesDir));
  app.use('/api/credentials', credentialsRouter(vault));
  app.use('/games', express.static(config.gamesDir));
  return app;
}
