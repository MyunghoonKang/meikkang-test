import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { Server as IOServer } from 'socket.io';

const app = express();
app.get('/api/health', (_req, res) => res.json({ ok: true }));
const httpServer = createServer(app);
const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
new IOServer(httpServer, { cors: { origin: corsOrigin } });
const port = Number(process.env.PORT ?? 3000);
httpServer.listen(port, () => console.log(`[server] listening on :${port}`));
