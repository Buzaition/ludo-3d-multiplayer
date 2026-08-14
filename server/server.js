import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { RoomManager } from './rooms/RoomManager.js';
import { registerSocketHandlers } from './socket/socketHandlers.js';

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

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use('/three', express.static(path.join(rootDir, 'node_modules', 'three'), {
  maxAge: '7d',
  immutable: true
}));
app.use(express.static(clientDir));
app.get('/health', (_req, res) => {
  const rooms = [...roomManager.rooms.values()];
  res.json({
    ok: true,
    uptimeSeconds: Math.round(process.uptime()),
    rooms: rooms.length,
    players: rooms.reduce((total, room) => total + room.players.length, 0),
    playingRooms: rooms.filter(room => room.status === 'PLAYING').length
  });
});

const roomManager = new RoomManager();
registerSocketHandlers(io, roomManager);

setInterval(() => roomManager.cleanup(), 5 * 60_000).unref();

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Ludo 3D multiplayer running on http://localhost:${port}`);
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[SERVER] ${signal} received, shutting down gracefully...`);
  io.close(() => {
    httpServer.close(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 8_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

