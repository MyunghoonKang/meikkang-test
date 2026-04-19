import 'dotenv/config';
export const config = {
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? './data/app.db',
  gamesDir: process.env.GAMES_DIR ?? './games',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-secret',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  vaultKey: process.env.VAULT_MASTER_KEY
    ? Buffer.from(process.env.VAULT_MASTER_KEY, 'hex')
    : Buffer.alloc(32, 0),
};
