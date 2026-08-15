# Ludo 3D Multiplayer — Backend V4

This version keeps the server-authoritative multiplayer engine and fixes the 3D dice vertical-drift bug. It also adds a generic production/deployment baseline.



## V4 multiplayer hardening

- Every authoritative room/game snapshot now carries a monotonic `stateVersion`.
- Every gameplay action carries a `turnId`/action epoch so late requests from an older turn are rejected.
- `rollDice` and `movePiece` require a unique `actionId`; duplicate requests are idempotent and execute only once.
- Each room has a serialized action queue, so two mutations cannot resolve concurrently.
- Stale actions return `STALE_ACTION` plus a fresh authoritative snapshot and trigger automatic client resync.
- The client ignores older snapshots and duplicated semantic events.
- Reconnect always receives a complete snapshot before normal interaction resumes.
- Bots and automatic single-move actions use the same queued authoritative action pipeline as human actions.
- Added `requestStateSync` for explicit full-state recovery.
- Test suite expanded with sync/version/idempotency/socket simulations.

## V2 changes

- Fixed cumulative 3D dice Y-position drift: every roll now animates from and settles back to one immutable rest height.
- The dice is also re-centered over the board before each roll.
- Added richer `/health` runtime stats.
- Added graceful `SIGTERM` / `SIGINT` shutdown for hosting platforms.
- Added `Dockerfile` and `.dockerignore` for generic WebSocket-capable deployment.
- Added `npm run check` syntax validation.

## Included

- 4-player realtime rooms.
- 60-second waiting lobby.
- Owner-only **Fill With Bots** after the waiting time ends.
- Immediate start when 4 humans join.
- Server-authoritative dice, turns, legal moves, captures, safe cells, blockades, exact finish, triple-six penalty, extra-roll rewards and ranking.
- Revised blockade rule: opponents may pass through a blockade but cannot land on it.
- Home reward: finishing one piece grants one extra roll unless the player has just completed all four pieces.
- First three finishers are ranked; the remaining player becomes fourth automatically.
- Server-side bots.
- If a human disconnects during a game, a bot continues their color; reconnecting with the saved session token restores the human player.
- Client-side 3D animations and procedural sound effects driven by semantic server events.
- Individual player camera perspective.
- Mobile play directly through the 3D dice and pieces.
- No database yet; rooms live in server memory.

## Run on Windows

Double-click `START_SERVER.bat`.

The first run installs npm dependencies, starts the server, and opens:

`http://localhost:3000`

To test multiplayer locally, open the URL in multiple browsers/devices on the same network. For another device, use your computer's LAN IP instead of `localhost`.

## Run manually

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Tests

```bash
npm test
```

The test suite covers the locked game-engine rules, room/bot/reconnect behavior, state versions, action queues, duplicate action IDs, stale-action recovery, and socket-level sync simulations.

## Project structure

```text
client/
  index.html
  styles.css
  app.js
  assets/ludo_board_games.glb
server/
  server.js
  game/
    constants.js
    GameEngine.js
    BotPlayer.js
  rooms/
    RoomManager.js
  socket/
    socketHandlers.js
  utils/
    id.js
tests/
GAME_RULES_BACKEND.md
AUDIO_EVENTS_BACKEND.md
```

## Realtime events

Client → server:

- `createRoom`
- `joinRoom`
- `resumeSession`
- `fillWithBots`
- `rollDice`
- `movePiece`
- `playAgain`
- `requestStateSync`

Server → client:

- `roomState` — authoritative room/game snapshot.
- `gameEvent` — semantic gameplay/audio/animation event.
- `gameError` — rejected action with an error code.
- `resyncRequired` — asks the client to fetch a fresh authoritative snapshot.

## Current architecture boundary

The server owns all gameplay decisions. The browser is allowed to request `rollDice` and `movePiece(pieceId)`, but it never supplies the dice value, destination position, winner, capture result, or ranking.

The current single-process in-memory room store is intentional for this small MVP. A later version can replace room persistence/pub-sub with Redis if multiple server instances are ever needed.


## V3 desktop/tablet HUD layout

- Player panel is stacked above the game controls on the right.
- Camera controls sit directly below the game controls.
- Player cards use a compact 2x2 grid on desktop/tablet.
- Turn, dice status, roll button, and piece choices are consolidated inside one compact dice zone.
- Desktop/tablet camera framing is slightly closer and shifted away from the HUD so the 3D board uses more of the available screen.
- Mobile keeps the direct-on-board gameplay layout and compact auto-camera control.

## V6 lobby + recorded audio update

- Added the five supplied recorded audio clips for: rolling a 6, capture, player disconnect, piece leaving base, and piece reaching home.
- Existing synthesized effects for all other game events remain unchanged.
- Redesigned lobby with dedicated Copy Code, Copy Link, and Share actions.
- Splash screen now shows a real GLB loading progress bar and percentage.
