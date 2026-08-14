# Ludo audio event contract — V9

The local prototype synthesizes these sounds in the browser with Web Audio. The multiplayer backend should NOT stream audio; it should emit authoritative gameplay events and each client plays the matching SFX.

## Dice / turn
- `DICE_ROLL_STARTED` → quick dice-rattle sound.
- `DICE_ROLLED` with value `6` → gold sparkle/chime, except when this is the penalized third consecutive six.
- `TRIPLE_SIX_PENALTY` → sad descending failure/trombone-style sound.

## Piece movement
- `PIECE_LEFT_BASE` → boing/unlock sound.
- `PIECE_STEP` → short step/click for each traveled cell.
- `PIECE_ENTERED_SAFE_CELL` → shield/metal protection sound.
- `BLOCKADE_FORMED` → metallic lock/door-close sound.
- `MOVE_REJECTED_BLOCKADE` → same blockade/denied sound.

## Interaction
- `PIECE_CAPTURED` → strong hit/whoosh sound.
- `CHASE_THREAT` → heartbeat when a moved piece finishes exactly one outer-track cell behind a capturable enemy piece.

## Finish
- `PIECE_REACHED_HOME` → coins/light-fireworks chime and grants one extra roll.
- `EXACT_FINISH_WAIT` → ticking sound when a near-finish piece cannot move because the roll is too large and no legal move is available.
- `PLAYER_FINISHED` with rank `1` → full victory fanfare/applause.
- `PLAYER_LOST` / `PLAYER_WITHDREW` → sad/empty wind sound (reserved for multiplayer/disconnect handling).

## Important
- Audio is presentation only. It must never decide legal moves, turn order, rewards, or results.
- The server owns dice values, captures, home rewards, triple-six penalties, rankings and all other authoritative state.
