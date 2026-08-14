import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../server/rooms/RoomManager.js';
import { registerSocketHandlers } from '../server/socket/socketHandlers.js';

class FakeSocket {
  constructor(id, io) {
    this.id = id;
    this.io = io;
    this.handlers = new Map();
    this.rooms = new Set();
    this.serverEvents = [];
  }
  on(event, handler) { this.handlers.set(event, handler); }
  join(roomId) { this.rooms.add(roomId); }
  emit(event, payload) { this.serverEvents.push({ event, payload }); }
  request(event, payload = {}) {
    return new Promise(resolve => {
      const handler = this.handlers.get(event);
      if (!handler) throw new Error(`No handler for ${event}`);
      handler(payload, result => resolve(result));
    });
  }
}

class FakeIO {
  constructor() {
    this.connectionHandler = null;
    this.sockets = { sockets: new Map() };
  }
  on(event, handler) {
    if (event === 'connection') this.connectionHandler = handler;
  }
  connect(id) {
    const socket = new FakeSocket(id, this);
    this.sockets.sockets.set(id, socket);
    this.connectionHandler(socket);
    return socket;
  }
  to(roomId) {
    return {
      emit: (event, payload) => {
        for (const socket of this.sockets.sockets.values()) {
          if (socket.rooms.has(roomId)) socket.emit(event, payload);
        }
      }
    };
  }
}

async function makePlayingRoom() {
  const io = new FakeIO();
  const manager = new RoomManager();
  registerSocketHandlers(io, manager);
  const sockets = ['s1','s2','s3','s4'].map(id => io.connect(id));

  const create = await sockets[0].request('createRoom', { name: 'One' });
  await sockets[1].request('joinRoom', { roomId: create.roomId, name: 'Two' });
  await sockets[2].request('joinRoom', { roomId: create.roomId, name: 'Three' });
  await sockets[3].request('joinRoom', { roomId: create.roomId, name: 'Four' });
  return { io, manager, sockets, room: manager.get(create.roomId) };
}

test('duplicate roll actionId executes once and returns the cached acknowledgement', async () => {
  const { sockets, room } = await makePlayingRoom();
  const beforeVersion = room.stateVersion;
  const payload = {
    actionId: 'roll_duplicate_12345678',
    expectedVersion: beforeVersion,
    expectedTurnId: room.engine.state.turnId
  };

  const firstPromise = sockets[0].request('rollDice', payload);
  const duplicatePromise = sockets[0].request('rollDice', payload);
  const [first, duplicate] = await Promise.all([firstPromise, duplicatePromise]);

  assert.equal(first.ok, true);
  assert.equal(duplicate.ok, true);
  assert.equal(first.stateVersion, duplicate.stateVersion);
  assert.equal(duplicate.duplicate, true);
  assert.equal(room.stateVersion, beforeVersion + 1, 'one authoritative dice mutation only');
});

test('stale action is rejected with a full current snapshot', async () => {
  const { sockets, room } = await makePlayingRoom();
  const oldVersion = room.stateVersion;
  const turnId = room.engine.state.turnId;

  const first = await sockets[0].request('rollDice', {
    actionId: 'roll_current_12345678',
    expectedVersion: oldVersion,
    expectedTurnId: turnId
  });
  assert.equal(first.ok, true);

  const stale = await sockets[0].request('rollDice', {
    actionId: 'roll_stale_123456789',
    expectedVersion: oldVersion,
    expectedTurnId: turnId
  });

  assert.equal(stale.ok, false);
  assert.equal(stale.error.code, 'STALE_ACTION');
  assert.equal(stale.snapshot.stateVersion, room.stateVersion);
  assert.equal(stale.snapshot.game.turnId, room.engine.state.turnId);
});
