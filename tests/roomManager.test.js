import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../server/rooms/RoomManager.js';

test('room supports four humans and starts immediately at four', () => {
  const manager = new RoomManager();
  const first = manager.createRoom({ socketId:'s1', name:'One' });
  manager.joinRoom({ roomId:first.room.id, socketId:'s2', name:'Two' });
  manager.joinRoom({ roomId:first.room.id, socketId:'s3', name:'Three' });
  assert.equal(first.room.status, 'WAITING');
  manager.joinRoom({ roomId:first.room.id, socketId:'s4', name:'Four' });
  assert.equal(first.room.status, 'PLAYING');
  assert.equal(first.room.players.length, 4);
  assert.ok(first.room.engine);
});

test('owner can fill missing places with bots after wait time', () => {
  const manager = new RoomManager();
  const first = manager.createRoom({ socketId:'s1', name:'One' });
  first.room.waitingEndsAt = Date.now() - 1;
  manager.fillWithBots({ roomId:first.room.id, playerId:first.player.id });
  assert.equal(first.room.status, 'PLAYING');
  assert.equal(first.room.players.length, 4);
  assert.equal(first.room.players.filter(player => player.type === 'BOT').length, 3);
});

test('disconnect in a running game converts human to bot and resume restores human', () => {
  const manager = new RoomManager();
  const first = manager.createRoom({ socketId:'s1', name:'One' });
  manager.joinRoom({ roomId:first.room.id, socketId:'s2', name:'Two' });
  manager.joinRoom({ roomId:first.room.id, socketId:'s3', name:'Three' });
  manager.joinRoom({ roomId:first.room.id, socketId:'s4', name:'Four' });
  const token = first.player.token;

  const result = manager.disconnect('s1');
  assert.equal(result.convertedToBot, true);
  assert.equal(first.player.type, 'BOT');

  manager.resume({ roomId:first.room.id, token, socketId:'s1-new' });
  assert.equal(first.player.type, 'HUMAN');
  assert.equal(first.player.connected, true);
});
