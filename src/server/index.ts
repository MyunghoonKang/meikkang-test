import 'dotenv/config';
import './db/migrate';
import { createServer } from 'node:http';
import { Server as IOServer } from 'socket.io';
import { createApp } from './app';
import { GameRegistry } from './games/registry';
import { SessionManager } from './session/manager';
import { attachIo } from './io';
import { sessionsRouter } from './routes/sessions';
import { config } from './config';
import { CredentialVault } from './vault/vault';
import { db } from './db/client';

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

httpServer.listen(config.port, () => console.log(`[server] listening on :${config.port}`));
