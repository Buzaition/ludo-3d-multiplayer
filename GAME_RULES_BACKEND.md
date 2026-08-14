# Ludo rules locked for backend — V9

This file is the gameplay contract to keep frontend, server and bots identical.

## Turn / dice
- A piece leaves base only on a 6.
- A normal piece moves exactly the rolled number of cells.
- A 6 grants one extra roll, even when no legal piece can move.
- Three consecutive 6 rolls in the same turn: the third 6 is cancelled (no move), then the turn ends.
- A non-6 resets the consecutive-six counter.
- Capture grants one extra roll.
- Finishing a piece by reaching its final home destination grants one extra roll.
- Extra-roll bonuses do not stack: if one move qualifies through 6 + capture + home reward, it still grants only ONE next roll.

## Safe cells / capture
- All four colored START cells are safe.
- The four visible gold-star cells are safe.
- A piece on a safe cell cannot be captured.
- Landing on exactly one opponent on a non-safe outer-track cell captures it and sends it to base.
- Finish lanes are never capturable by opponents.

## Blockade — revised rule
- Exactly two or more pieces of the same color on the same outer-track cell form a blockade.
- An opponent CANNOT LAND on that occupied blockade cell.
- An opponent IS ALLOWED TO PASS THROUGH the blockade if its dice movement continues beyond that cell.
- The owner can land on/pass through its own pieces normally.
- A blockade can also exist on a safe cell.

## Home / finish
- After the last outer-track arrow cell, the next step enters that color's home lane directly (no extra outer cell).
- A move may not overshoot the final destination. Exact roll is required.
- Reaching the final home destination with one piece gives an extra roll unless that player has already completed all four pieces.
- A player finishes when all 4 pieces reach final destination.

## Ranking
- First player to finish all 4 pieces = 1st.
- Continue for 2nd and 3rd.
- As soon as three players finish, game ends and the remaining player becomes 4th automatically.

## UX-only rule
- If a roll has exactly one legal piece, execute it automatically. This is UI automation, not a different game rule.

## Audio-event contract
Gameplay rules should emit semantic events; sound playback remains client-side. See `AUDIO_EVENTS_BACKEND.md`.
