import 'dotenv/config';
import './db/migrate';
import { createServer } from 'node:http';
import { Server as IOServer } from 'socket.io';
import { createApp } from './app';
import { GameRegistry } from './games/registry';
import { config } from './config';

const registry = new GameRegistry({ dir: config.gamesDir, watch: true });
await registry.scan();
registry.startWatching();

const app = await createApp(registry);
const httpServer = createServer(app);
new IOServer(httpServer, { cors: { origin: config.corsOrigin } });
httpServer.listen(config.port, () => console.log(`[server] listening on :${config.port}`));
