import { SAFE_CELL_KEYS, MAIN_TRACK_LAST_PROGRESS, cellKey } from './constants.js';

export function chooseBotMove(engine, playerId) {
  const player = engine.getPlayer(playerId);
  if (!player) return null;
  const legal = engine.legalPieces(player);
  if (!legal.length) return null;

  const scored = legal.map(piece => {
    const info = engine.inspectMove(piece.id);
    let score = Math.random() * 2;
    if (info?.reachesHome) score += 100;
    if (info?.captures) score += 80;
    if (info?.formsBlockade) score += 35;
    if (info?.leavesBase) score += 24;
    if (info?.landsSafe) score += 18;
    if (info?.toProgress > MAIN_TRACK_LAST_PROGRESS) score += 15;
    score += Math.max(0, info?.toProgress ?? 0) * 0.12;
    return { pieceId: piece.id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].pieceId;
}
