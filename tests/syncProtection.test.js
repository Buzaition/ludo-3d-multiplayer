import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../server/rooms/RoomManager.js';
import { GameEngine } from '../server/game/GameEngine.js';
import { COLORS } from '../server/game/constants.js';

function players() {
  return COLORS.map((color, index) => ({
    id: `p${index + 1}`,
    name: `P${index + 1}`,
    color,
    type: 'HUMAN',
    connected: true
  }));
}

test('room stateVersion increases and stale action context is rejected', () => {
  const manager = new RoomManager();
  const created = manager.createRoom({ socketId: 's1', name: 'One' });
  const initial = created.room.stateVersion;
  manager.joinRoom({ roomId: created.room.id, socketId: 's2', name: 'Two' });
  assert.ok(created.room.stateVersion > initial);

  assert.throws(
    () => manager.validateActionContext(created.room, {
      expectedVersion: initial,
      expectedTurnId: 0
    }),
    error => error.code === 'STALE_ACTION' && error.currentVersion === created.room.stateVersion
  );
});

test('processed action ids are idempotent and bounded lookup works', () => {
  const manager = new RoomManager();
  const created = manager.createRoom({ socketId: 's1', name: 'One' });
  const result = { ok: true, stateVersion: created.room.stateVersion };
  manager.rememberProcessedAction(created.room, created.player.id, 'action_12345678', result);
  const saved = manager.getProcessedAction(created.room, created.player.id, 'action_12345678');
  assert.equal(saved.ok, true);
  assert.equal(saved.stateVersion, created.room.stateVersion);
});

test('room action queue serializes asynchronous mutations', async () => {
  const manager = new RoomManager();
  const created = manager.createRoom({ socketId: 's1', name: 'One' });
  const order = [];

  const first = manager.enqueueAction(created.room, async () => {
    order.push('first-start');
    await new Promise(resolve => setTimeout(resolve, 25));
    order.push('first-end');
  });
  const second = manager.enqueueAction(created.room, async () => {
    order.push('second-start');
    order.push('second-end');
  });

  await Promise.all([first, second]);
  assert.deepEqual(order, ['first-start', 'first-end', 'second-start', 'second-end']);
});

test('turnId stays stable between roll and move, then advances for the next action epoch', () => {
  const game = new GameEngine(players());
  const initialTurnId = game.state.turnId;

  game.rollDice('p1', { forcedValue: 6 });
  assert.equal(game.state.turnId, initialTurnId, 'roll -> move remains the same turn epoch');

  const pieceId = game.getPlayer('p1').pieces[0].id;
  game.movePiece('p1', pieceId);
  assert.equal(game.state.currentPlayerId, 'p1');
  assert.equal(game.state.phase, 'ROLL');
  assert.equal(game.state.turnId, initialTurnId + 1, 'extra roll gets a new action epoch');

  game.rollDice('p1', { forcedValue: 1 });
  game.movePiece('p1', pieceId);
  assert.equal(game.state.currentPlayerId, 'p2');
  assert.equal(game.state.turnId, initialTurnId + 2, 'next player gets another epoch');
});

test('public snapshot exposes stateVersion and turnId for client resync', () => {
  const manager = new RoomManager();
  const first = manager.createRoom({ socketId:'s1', name:'One' });
  manager.joinRoom({ roomId:first.room.id, socketId:'s2', name:'Two' });
  manager.joinRoom({ roomId:first.room.id, socketId:'s3', name:'Three' });
  manager.joinRoom({ roomId:first.room.id, socketId:'s4', name:'Four' });

  const snapshot = manager.publicRoom(first.room, first.player.id);
  assert.equal(snapshot.stateVersion, first.room.stateVersion);
  assert.equal(snapshot.game.turnId, 1);
  assert.equal(snapshot.sync.turnId, 1);
});
