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

test('quick matchmaking creates one room for every four waiting players', () => {
  const manager = new RoomManager();
  let result;
  for (let i = 1; i <= 8; i++) {
    result = manager.enqueueMatchmaking({ socketId:`q${i}`, name:`Q${i}`, mode:'CLASSIC' });
    if (i % 4 === 0) assert.ok(result.match, `player ${i} should complete a match`);
  }
  assert.equal(manager.rooms.size, 2);
  assert.equal(manager.queueStatus('CLASSIC').waiting, 0);
  assert.ok([...manager.rooms.values()].every(room => room.status === 'PLAYING' && room.players.length === 4));
});

test('2v2 rooms assign opposite colors to the same team', () => {
  const manager = new RoomManager();
  let result;
  for (let i = 1; i <= 4; i++) result = manager.enqueueMatchmaking({ socketId:`t${i}`, name:`T${i}`, mode:'TEAM_2V2' });
  const room = result.match.room;
  const teams = Object.fromEntries(room.players.map(player => [player.color, player.teamId]));
  assert.equal(teams.RED, teams.YELLOW);
  assert.equal(teams.GREEN, teams.BLUE);
  assert.notEqual(teams.RED, teams.GREEN);
  assert.equal(room.engine.state.mode, 'TEAM_2V2');
});

test('play with computer starts immediately with one human and three bots', () => {
  const manager = new RoomManager();
  const result = manager.createComputerGame({ socketId:'cpu1', name:'Human' });
  assert.equal(result.room.status, 'PLAYING');
  assert.equal(result.room.players.filter(player => player.type === 'BOT').length, 3);
});

test('public room list only exposes waiting public rooms', () => {
  const manager = new RoomManager();
  const publicRoom = manager.createRoom({ socketId:'pub1', name:'Public', visibility:'PUBLIC' });
  manager.createRoom({ socketId:'priv1', name:'Private', visibility:'PRIVATE' });
  const listed = manager.listPublicRooms();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, publicRoom.room.id);
});

test('explicit leave during a running game releases the socket and leaves a bot in the seat', () => {
  const manager = new RoomManager();
  const first = manager.createRoom({ socketId:'leave1', name:'One' });
  manager.joinRoom({ roomId:first.room.id, socketId:'leave2', name:'Two' });
  manager.joinRoom({ roomId:first.room.id, socketId:'leave3', name:'Three' });
  manager.joinRoom({ roomId:first.room.id, socketId:'leave4', name:'Four' });
  const oldToken = first.player.token;
  const result = manager.leaveRoom('leave1');
  assert.equal(result.convertedToBot, true);
  assert.equal(first.player.type, 'BOT');
  assert.equal(first.player.connected, false);
  assert.notEqual(first.player.token, oldToken);
  assert.equal(manager.bySocket('leave1'), null);
});
