import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { RoomManager } from './rooms/RoomManager.js';
import { registerSocketHandlers } from './socket/socketHandlers.js';
import { GithubAnalyticsStore } from './analytics/GithubAnalyticsStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'client');
const port = Number(process.env.PORT || 3000);

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  serveClient: true,
  cors: { origin: false }
});

const roomManager = new RoomManager();
const analytics = new GithubAnalyticsStore(process.env);
analytics.init().catch(error => console.warn('[ANALYTICS] init error:', error.message));

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use('/three', express.static(path.join(rootDir, 'node_modules', 'three'), {
  maxAge: '7d',
  immutable: true
}));

app.post('/api/analytics/event', (req, res) => {
  const accepted = analytics.record(req.body || {});
  if (!accepted) return res.status(400).json({ ok: false, error: 'INVALID_ANALYTICS_EVENT' });
  res.status(202).json({ ok: true });
});

app.get('/api/analytics/summary', (req, res) => {
  const adminKey = String(process.env.ADMIN_KEY || '').trim();
  const provided = String(req.get('x-admin-key') || req.query.key || '').trim();
  if (adminKey && provided !== adminKey) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  res.json({ ok: true, ...analytics.summary() });
});

app.get('/health', (_req, res) => {
  const rooms = [...roomManager.rooms.values()];
  res.json({
    ok: true,
    uptimeSeconds: Math.round(process.uptime()),
    rooms: rooms.length,
    players: rooms.reduce((total, room) => total + room.players.length, 0),
    playingRooms: rooms.filter(room => room.status === 'PLAYING').length,
    publicRooms: roomManager.listPublicRooms().length,
    matchmaking: {
      classic: roomManager.queueStatus('CLASSIC').waiting,
      team2v2: roomManager.queueStatus('TEAM_2V2').waiting
    },
    analyticsPersistence: analytics.persistenceMode
  });
});

app.use(express.static(clientDir));
registerSocketHandlers(io, roomManager);

setInterval(() => roomManager.cleanup(), 5 * 60_000).unref();

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Ludo 3D platform running on http://localhost:${port}`);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[SERVER] ${signal} received, shutting down gracefully...`);
  await analytics.close();
  io.close(() => {
    httpServer.close(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 8_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
