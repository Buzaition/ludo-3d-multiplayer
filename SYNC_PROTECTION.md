# Multiplayer State Sync Protection — V4

## Authoritative versioning

Each room owns a monotonic `stateVersion`. Every authoritative mutation increments it. `roomState` snapshots expose both `stateVersion` and the game `turnId`.

## Human action envelope

Gameplay actions (`rollDice`, `movePiece`) send:

```json
{
  "actionId": "unique-client-action-id",
  "expectedVersion": 12,
  "expectedTurnId": 4
}
```

The server rejects a request with `STALE_ACTION` when the client's expected version/turn no longer matches the authoritative state. The rejection includes a fresh snapshot and the client automatically resyncs.

## Idempotency

The server caches recent results by `playerId + actionId`. If the browser retries the same request, the cached acknowledgement is returned and the game mutation is not executed again. The cache is bounded to 256 recent actions per room.

## Room action queue

Every dice roll and piece move goes through one serialized Promise queue per room. A second action cannot mutate the room while a previous action is still resolving, including the dice animation delay.

## Action epochs (`turnId`)

`turnId` stays stable from a roll through the corresponding move. It advances whenever a new roll opportunity begins: next player, six bonus, capture bonus, or home bonus. This makes late actions from the previous action epoch easy to reject.

## Full snapshot recovery

Clients can request `requestStateSync` at any time. The server also emits `resyncRequired` after stale actions. Reconnect returns a complete snapshot in the acknowledgement and also emits the normal `roomState`.

## Bots

Bots and automatic single legal moves use the same queue and GameEngine as human players; they do not mutate the game through a separate rule path.

## Tests

`npm test` includes coverage for:

- Monotonic room versions.
- Stale action rejection.
- Serialized async room actions.
- `turnId` action epochs.
- Duplicate `actionId` executing exactly once.
- Stale socket action returning a current full snapshot.
