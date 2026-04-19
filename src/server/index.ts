import 'dotenv/config';
import './db/migrate';
import { createServer } from 'node:http';
import { Server as IOServer } from 'socket.io';
import { createApp } from './app';
import { GameRegistry } from './games/registry';
import { SessionManager } from './session/manager';
import { attachIo } from './io';
import { sessionsRouter } from './routes/sessions';
import { submissionsRouter } from './routes/submissions';
import { config } from './config';
import { CredentialVault } from './vault/vault';
import { db } from './db/client';
import { SubmissionQueue } from './submissions/queue';
import { Scheduler } from './submissions/scheduler';

const registry = new GameRegistry({ dir: config.gamesDir, watch: true });
await registry.scan();
registry.startWatching();

const vault = new CredentialVault(db, config.vaultKey);
const mgr = new SessionManager({ persist: false });
const app = await createApp(registry, vault);
app.use('/api/sessions', sessionsRouter(mgr));

const httpServer = createServer(app);
const io = new IOServer(httpServer, { cors: { origin: config.corsOrigin } });
attachIo(io, { mgr, registry });

const queue = new SubmissionQueue(db);
app.use('/api', submissionsRouter(mgr, queue, io));
const scheduler = new Scheduler({
  queue,
  runSubmission: async (id) => { console.log('[scheduler] runSubmission stub:', id); },
  logger: console,
});
scheduler.start();

httpServer.listen(config.port, () => console.log(`[server] listening on :${config.port}`));
