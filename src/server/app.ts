import express from 'express';
import { gamesRouter } from './routes/games';
import type { GameRegistry } from './games/registry';
import { config } from './config';

export async function createApp(registry: GameRegistry) {
  const app = express();
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/games', gamesRouter(registry, config.gamesDir));
  app.use('/games', express.static(config.gamesDir));
  return app;
}
