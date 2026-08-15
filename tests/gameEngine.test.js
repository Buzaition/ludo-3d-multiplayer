import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../server/game/GameEngine.js';
import { COLORS, cellForProgress, cellKey, FINAL_PROGRESS } from '../server/game/constants.js';

function makePlayers() {
  return COLORS.map((color, index) => ({
    id: `p${index + 1}`,
    name: `P${index + 1}`,
    color,
    type: 'HUMAN',
    connected: true
  }));
}

function engine() {
  return new GameEngine(makePlayers(), { rng: () => 0 });
}

function progressAtCell(color, cell) {
  const key = cellKey(cell);
  for (let progress = 0; progress <= 50; progress++) {
    if (cellKey(cellForProgress(color, progress)) === key) return progress;
  }
  return null;
}

test('piece leaves base only on 6 and six grants extra roll', () => {
  const game = engine();
  let result = game.rollDice('p1', { forcedValue: 5 });
  assert.equal(game.state.currentPlayerId, 'p2');
  assert.ok(result.events.some(event => event.type === 'NO_LEGAL_MOVE'));

  // New game for the six path.
  const game2 = engine();
  result = game2.rollDice('p1', { forcedValue: 6 });
  assert.equal(game2.state.phase, 'MOVE');
  assert.equal(game2.legalPieces().length, 4);
  const pieceId = game2.currentPlayer().pieces[0].id;
  game2.movePiece('p1', pieceId);
  assert.equal(game2.getPiece(pieceId).progress, 0);
  assert.equal(game2.state.currentPlayerId, 'p1');
  assert.equal(game2.state.phase, 'ROLL');
});

test('third consecutive six is cancelled and turn passes', () => {
  const game = engine();
  const pieceId = game.currentPlayer().pieces[0].id;

  game.rollDice('p1', { forcedValue: 6 });
  game.movePiece('p1', pieceId);
  game.rollDice('p1', { forcedValue: 6 });
  game.movePiece('p1', pieceId);
  const beforeThird = game.getPiece(pieceId).progress;
  const result = game.rollDice('p1', { forcedValue: 6 });

  assert.equal(game.getPiece(pieceId).progress, beforeThird);
  assert.equal(game.state.currentPlayerId, 'p2');
  assert.ok(result.events.some(event => event.type === 'TRIPLE_SIX_PENALTY'));
});

test('opponent blockade cannot be landed on but can be passed through', () => {
  const game = engine();
  const red = game.getPlayer('p1');
  const green = game.getPlayer('p2');
  const redPiece = red.pieces[0];
  redPiece.progress = 0;

  const blockadeCell = cellForProgress('RED', 5);
  const greenProgress = progressAtCell('GREEN', blockadeCell);
  assert.notEqual(greenProgress, null);
  green.pieces[0].progress = greenProgress;
  green.pieces[1].progress = greenProgress;

  game.state.rolled = 5;
  game.state.phase = 'MOVE';
  assert.equal(game.isLegalMove(redPiece, 5), false, 'landing on blockade should fail');
  assert.equal(game.isLegalMove(redPiece, 6), true, 'passing through blockade should be allowed');
});

test('capture sends one enemy home and grants one extra roll', () => {
  const game = engine();
  const redPiece = game.getPlayer('p1').pieces[0];
  const greenPiece = game.getPlayer('p2').pieces[0];
  redPiece.progress = 0;
  const targetCell = cellForProgress('RED', 1);
  greenPiece.progress = progressAtCell('GREEN', targetCell);

  game.state.phase = 'ROLL';
  game.rollDice('p1', { forcedValue: 1 });
  const result = game.movePiece('p1', redPiece.id);

  assert.equal(greenPiece.progress, -1);
  assert.equal(game.state.currentPlayerId, 'p1');
  assert.equal(game.state.phase, 'ROLL');
  assert.ok(result.events.some(event => event.type === 'PIECE_CAPTURED'));
  assert.ok(result.events.some(event => event.type === 'EXTRA_ROLL_GRANTED'));
});

test('safe cell prevents capture', () => {
  const game = engine();
  const redPiece = game.getPlayer('p1').pieces[0];
  const greenPiece = game.getPlayer('p2').pieces[0];
  redPiece.progress = 7;
  const safeCell = cellForProgress('RED', 8);
  greenPiece.progress = progressAtCell('GREEN', safeCell);

  game.rollDice('p1', { forcedValue: 1 });
  const result = game.movePiece('p1', redPiece.id);

  assert.notEqual(greenPiece.progress, -1);
  assert.ok(!result.events.some(event => event.type === 'PIECE_CAPTURED'));
  assert.ok(result.events.some(event => event.type === 'PIECE_ENTERED_SAFE_CELL'));
});

test('exact roll is required for final home and home arrival grants an extra roll', () => {
  const game = engine();
  const piece = game.getPlayer('p1').pieces[0];
  piece.progress = FINAL_PROGRESS - 1;

  let result = game.rollDice('p1', { forcedValue: 2 });
  assert.equal(game.state.currentPlayerId, 'p2');
  assert.ok(result.events.some(event => event.type === 'EXACT_FINISH_WAIT'));

  const game2 = engine();
  const piece2 = game2.getPlayer('p1').pieces[0];
  piece2.progress = FINAL_PROGRESS - 1;
  game2.rollDice('p1', { forcedValue: 1 });
  result = game2.movePiece('p1', piece2.id);
  assert.equal(piece2.finished, true);
  assert.equal(game2.state.currentPlayerId, 'p1');
  assert.equal(game2.state.phase, 'ROLL');
  assert.ok(result.events.some(event => event.type === 'PIECE_REACHED_HOME'));
});

test('third finisher ends game and remaining player becomes fourth', () => {
  const game = engine();

  // Mark first two players as already ranked/finished.
  for (const playerId of ['p1', 'p2']) {
    const player = game.getPlayer(playerId);
    player.pieces.forEach(piece => { piece.progress = FINAL_PROGRESS; piece.finished = true; });
  }
  game.state.rankings = ['p1', 'p2'];
  game.getPlayer('p1').finishedRank = 1;
  game.getPlayer('p2').finishedRank = 2;

  const p3 = game.getPlayer('p3');
  p3.pieces.forEach((piece, index) => {
    piece.progress = index === 0 ? FINAL_PROGRESS - 1 : FINAL_PROGRESS;
    piece.finished = index !== 0;
  });
  game.state.currentPlayerId = 'p3';
  game.state.phase = 'ROLL';

  game.rollDice('p3', { forcedValue: 1 });
  const result = game.movePiece('p3', p3.pieces[0].id);

  assert.equal(game.state.gameOver, true);
  assert.equal(game.state.rankings.length, 4);
  assert.deepEqual(game.state.rankings.slice(0, 3), ['p1', 'p2', 'p3']);
  assert.equal(game.getPlayer('p4').finishedRank, 4);
  assert.ok(result.events.some(event => event.type === 'GAME_FINISHED'));
});

test('2v2 teammates do not capture each other and game ends when both teammates finish', () => {
  const players = makePlayers().map(player => ({
    ...player,
    teamId: player.color === 'RED' || player.color === 'YELLOW' ? 'A' : 'B'
  }));
  const game = new GameEngine(players, { mode:'TEAM_2V2', rng:() => 0 });
  const red = game.getPlayer('p1');
  const yellow = game.getPlayer('p3');
  const redPiece = red.pieces[0];
  const yellowPiece = yellow.pieces[0];
  redPiece.progress = 0;
  yellowPiece.progress = progressAtCell('YELLOW', cellForProgress('RED', 1));
  game.rollDice('p1', { forcedValue:1 });
  const move = game.movePiece('p1', redPiece.id);
  assert.notEqual(yellowPiece.progress, -1, 'teammate must not be captured');
  assert.ok(!move.events.some(event => event.type === 'PIECE_CAPTURED'));

  // Finish red completely and make yellow one exact step from completing the team.
  red.pieces.forEach(piece => { piece.progress = FINAL_PROGRESS; piece.finished = true; });
  if (!game.state.rankings.includes(red.id)) game.state.rankings.push(red.id);
  yellow.pieces.forEach((piece, index) => {
    piece.progress = index === 0 ? FINAL_PROGRESS - 1 : FINAL_PROGRESS;
    piece.finished = index !== 0;
  });
  game.state.currentPlayerId = yellow.id;
  game.state.phase = 'ROLL';
  game.state.rolled = null;
  game.rollDice(yellow.id, { forcedValue:1 });
  const result = game.movePiece(yellow.id, yellow.pieces[0].id);
  assert.equal(game.state.gameOver, true);
  assert.equal(game.state.winningTeam, 'A');
  assert.ok(result.events.some(event => event.type === 'GAME_FINISHED' && event.winningTeam === 'A'));
});
