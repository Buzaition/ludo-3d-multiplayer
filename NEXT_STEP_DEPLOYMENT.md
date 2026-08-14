# Next step — deployment readiness

Backend V2 is ready to run on any single-instance Node.js host that supports WebSockets.

## Runtime contract

- Node.js 18+ (22 recommended)
- `PORT` environment variable is supported
- Socket.IO must be allowed to keep WebSocket connections open
- Keep a single app instance while rooms are stored in memory
- Health endpoint: `/health`

## Generic deployment choices

### Native Node

```bash
npm install
npm start
```

### Docker

```bash
docker build -t ludo-3d .
docker run --rm -p 3000:3000 -e PORT=3000 ludo-3d
```

## Important current limitation

Rooms and active matches are stored in process memory. Restarting the server clears them. This is intentional for the current friends/MVP version. Before running multiple server instances, add Redis-backed room state / Socket.IO coordination.
