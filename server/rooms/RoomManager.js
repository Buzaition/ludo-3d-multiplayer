import { COLORS } from '../game/constants.js';
import { GameEngine } from '../game/GameEngine.js';
import { randomId, randomToken, roomCode } from '../utils/id.js';

const WAIT_MS = 60_000;
const FINISHED_TTL_MS = 30 * 60_000;
const WAITING_TTL_MS = 30 * 60_000;

function cleanName(name, fallback = 'Player') {
  const value = String(name ?? '').trim().replace(/\s+/g, ' ');
  return (value || fallback).slice(0, 24);
}

export class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.socketIndex = new Map();
  }

  createRoom({ socketId, name }) {
    let code;
    do code = roomCode(); while (this.rooms.has(code));

    const player = this.#makeHumanPlayer({ socketId, name, color: COLORS[0] });
    const now = Date.now();
    const room = {
      id: code,
      ownerPlayerId: player.id,
      status: 'WAITING',
      stateVersion: 1,
      createdAt: now,
      updatedAt: now,
      waitingEndsAt: now + WAIT_MS,
      players: [player],
      engine: null,
      runtime: this.#freshRuntime()
    };
    this.rooms.set(code, room);
    this.socketIndex.set(socketId, { roomId: code, playerId: player.id });
    return { room, player, token: player.token };
  }

  joinRoom({ roomId, socketId, name }) {
    const room = this.get(roomId);
    if (!room) throw this.error('ROOM_NOT_FOUND');
    if (room.status !== 'WAITING') throw this.error('GAME_ALREADY_STARTED');
    if (room.players.length >= 4) throw this.error('ROOM_FULL');

    const usedColors = new Set(room.players.map(player => player.color));
    const color = COLORS.find(item => !usedColors.has(item));
    const player = this.#makeHumanPlayer({ socketId, name, color });
    room.players.push(player);
    this.bumpVersion(room, 'PLAYER_JOINED');
    this.socketIndex.set(socketId, { roomId: room.id, playerId: player.id });

    if (room.players.length === 4) this.startGame(room);
    return { room, player, token: player.token };
  }

  resume({ roomId, token, socketId }) {
    const room = this.get(roomId);
    if (!room) throw this.error('ROOM_NOT_FOUND');
    const player = room.players.find(item => item.token && item.token === token);
    if (!player) throw this.error('SESSION_NOT_FOUND');

    if (player.socketId && player.socketId !== socketId) {
      this.socketIndex.delete(player.socketId);
    }
    player.socketId = socketId;
    player.connected = true;
    if (player.originalType === 'HUMAN') player.type = 'HUMAN';
    this.socketIndex.set(socketId, { roomId: room.id, playerId: player.id });
    room.engine?.setPlayerConnection(player.id, { connected: true, type: player.type });
    this.bumpVersion(room, 'SESSION_RESUMED');
    return { room, player, token: player.token };
  }

  fillWithBots({ roomId, playerId }) {
    const room = this.get(roomId);
    if (!room) throw this.error('ROOM_NOT_FOUND');
    if (room.status !== 'WAITING') throw this.error('GAME_ALREADY_STARTED');
    if (room.ownerPlayerId !== playerId) throw this.error('NOT_ROOM_OWNER');
    if (Date.now() < room.waitingEndsAt) throw this.error('WAITING_TIME_NOT_FINISHED');

    const usedColors = new Set(room.players.map(player => player.color));
    while (room.players.length < 4) {
      const color = COLORS.find(item => !usedColors.has(item));
      usedColors.add(color);
      room.players.push(this.#makeBotPlayer(color, room.players.length + 1));
    }
    this.startGame(room);
    return room;
  }

  startGame(room) {
    if (room.status === 'PLAYING') return room;
    if (room.players.length !== 4) throw this.error('ROOM_NOT_READY');
    room.status = 'PLAYING';
    room.startedAt = Date.now();
    room.engine = new GameEngine(room.players);
    room.runtime = this.#freshRuntime();
    this.bumpVersion(room, 'GAME_STARTED');
    return room;
  }

  restartGame(roomId, playerId) {
    const room = this.get(roomId);
    if (!room) throw this.error('ROOM_NOT_FOUND');
    if (room.ownerPlayerId !== playerId) throw this.error('NOT_ROOM_OWNER');
    if (room.status !== 'FINISHED') throw this.error('GAME_NOT_FINISHED');
    room.status = 'PLAYING';
    room.startedAt = Date.now();
    room.engine = new GameEngine(room.players);
    room.runtime = this.#freshRuntime();
    this.bumpVersion(room, 'GAME_RESTARTED');
    return room;
  }

  markFinished(room) {
    if (room.status === 'FINISHED') return room;
    room.status = 'FINISHED';
    this.bumpVersion(room, 'GAME_FINISHED');
    return room;
  }

  disconnect(socketId) {
    const ref = this.socketIndex.get(socketId);
    if (!ref) return null;
    this.socketIndex.delete(socketId);
    const room = this.get(ref.roomId);
    if (!room) return null;
    const player = room.players.find(item => item.id === ref.playerId);
    if (!player) return null;

    player.socketId = null;
    player.connected = false;

    if (room.status === 'WAITING') {
      room.players = room.players.filter(item => item.id !== player.id);
      if (room.ownerPlayerId === player.id) {
        room.ownerPlayerId = room.players.find(item => item.originalType === 'HUMAN')?.id ?? null;
      }
      this.bumpVersion(room, 'PLAYER_LEFT_LOBBY');
      if (!room.players.some(item => item.originalType === 'HUMAN')) {
        this.deleteRoom(room.id);
        return { room: null, player, deleted: true };
      }
      return { room, player, removed: true };
    }

    if (room.status === 'PLAYING') {
      player.type = 'BOT';
      room.engine?.setPlayerConnection(player.id, { connected: false, type: 'BOT' });
      this.bumpVersion(room, 'PLAYER_DISCONNECTED_TO_BOT');
      return { room, player, convertedToBot: true };
    }

    this.bumpVersion(room, 'PLAYER_DISCONNECTED');
    return { room, player };
  }

  deleteRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    for (const player of room.players) {
      if (player.socketId) this.socketIndex.delete(player.socketId);
      clearTimeout(room.runtime?.botTimer);
      clearTimeout(room.runtime?.autoMoveTimer);
      clearTimeout(room.runtime?.rollTimer);
    }
    this.rooms.delete(roomId);
    return true;
  }

  cleanup(now = Date.now()) {
    for (const room of this.rooms.values()) {
      const age = now - room.updatedAt;
      if (room.status === 'FINISHED' && age > FINISHED_TTL_MS) this.deleteRoom(room.id);
      else if (room.status === 'WAITING' && age > WAITING_TTL_MS) this.deleteRoom(room.id);
    }
  }

  get(roomId) {
    return this.rooms.get(String(roomId ?? '').trim().toUpperCase()) || null;
  }

  bySocket(socketId) {
    const ref = this.socketIndex.get(socketId);
    if (!ref) return null;
    const room = this.get(ref.roomId);
    if (!room) return null;
    const player = room.players.find(item => item.id === ref.playerId) || null;
    return { room, player };
  }

  publicRoom(room, viewerPlayerId = null) {
    const gameState = room.engine?.publicState() ?? null;
    const playerById = new Map((gameState?.players ?? []).map(player => [player.id, player]));
    return {
      serverNow: Date.now(),
      stateVersion: room.stateVersion,
      id: room.id,
      status: room.status,
      ownerPlayerId: room.ownerPlayerId,
      waitingEndsAt: room.waitingEndsAt,
      createdAt: room.createdAt,
      startedAt: room.startedAt ?? null,
      canFillBots: room.status === 'WAITING' && Date.now() >= room.waitingEndsAt && room.players.length < 4,
      players: room.players.map(player => {
        const gamePlayer = playerById.get(player.id);
        return {
          id: player.id,
          name: player.name,
          color: player.color,
          type: player.type,
          connected: player.connected,
          isOwner: room.ownerPlayerId === player.id,
          finishedRank: gamePlayer?.finishedRank ?? null,
          pieces: gamePlayer?.pieces ?? []
        };
      }),
      game: gameState,
      sync: {
        stateVersion: room.stateVersion,
        turnId: gameState?.turnId ?? null,
        actionLocked: !!room.runtime?.actionLocked
      },
      you: viewerPlayerId
        ? (() => {
            const player = room.players.find(item => item.id === viewerPlayerId);
            return player ? {
              playerId: player.id,
              color: player.color,
              isOwner: room.ownerPlayerId === player.id,
              type: player.type
            } : null;
          })()
        : null
    };
  }

  bumpVersion(room, reason = 'STATE_CHANGED') {
    if (!room) return 0;
    room.stateVersion = Number.isInteger(room.stateVersion) ? room.stateVersion + 1 : 1;
    room.updatedAt = Date.now();
    room.runtime.lastMutation = { reason, at: room.updatedAt, stateVersion: room.stateVersion };
    return room.stateVersion;
  }

  enqueueAction(room, task) {
    if (!room?.runtime) return Promise.reject(this.error('ROOM_NOT_FOUND'));
    const run = room.runtime.actionQueue.then(task, task);
    // Keep the queue alive even when one action fails.
    room.runtime.actionQueue = run.catch(() => undefined);
    return run;
  }

  validateActionContext(room, payload = {}) {
    const expectedVersion = Number(payload.expectedVersion);
    const expectedTurnId = Number(payload.expectedTurnId);
    const currentTurnId = room.engine?.state?.turnId ?? null;

    if (!Number.isInteger(expectedVersion) || expectedVersion !== room.stateVersion) {
      const err = this.error('STALE_ACTION');
      err.expectedVersion = expectedVersion;
      err.currentVersion = room.stateVersion;
      err.currentTurnId = currentTurnId;
      throw err;
    }
    if (currentTurnId != null && (!Number.isInteger(expectedTurnId) || expectedTurnId !== currentTurnId)) {
      const err = this.error('STALE_ACTION');
      err.expectedTurnId = expectedTurnId;
      err.currentTurnId = currentTurnId;
      err.currentVersion = room.stateVersion;
      throw err;
    }
    return true;
  }

  getProcessedAction(room, playerId, actionId) {
    if (!actionId) return null;
    return room?.runtime?.processedActions?.get(`${playerId}:${actionId}`) ?? null;
  }

  rememberProcessedAction(room, playerId, actionId, result) {
    if (!room?.runtime?.processedActions || !actionId) return result;
    const key = `${playerId}:${actionId}`;
    const cached = { ...result, duplicate: false };
    // Full snapshots are intentionally not retained in the idempotency cache.
    // A duplicate stale action can request a fresh snapshot again.
    if ('snapshot' in cached) cached.snapshot = null;
    room.runtime.processedActions.set(key, cached);
    // Bound memory while keeping a useful idempotency window.
    while (room.runtime.processedActions.size > 256) {
      const oldest = room.runtime.processedActions.keys().next().value;
      room.runtime.processedActions.delete(oldest);
    }
    return result;
  }

  error(code) {
    const messages = {
      ROOM_NOT_FOUND: 'Room not found.',
      ROOM_FULL: 'Room is full.',
      GAME_ALREADY_STARTED: 'The game has already started.',
      NOT_ROOM_OWNER: 'Only the room owner can do that.',
      WAITING_TIME_NOT_FINISHED: 'The 60 second waiting time has not finished yet.',
      ROOM_NOT_READY: 'Room needs 4 players before starting.',
      SESSION_NOT_FOUND: 'Saved player session was not found.',
      GAME_NOT_FINISHED: 'The current game has not finished yet.',
      STALE_ACTION: 'This action was created from an older game state. Resync and try again.',
      ACTION_ID_REQUIRED: 'A unique actionId is required for game actions.'
    };
    const err = new Error(messages[code] ?? code);
    err.code = code;
    return err;
  }

  #makeHumanPlayer({ socketId, name, color }) {
    return {
      id: randomId('player_'),
      token: randomToken(),
      socketId,
      name: cleanName(name),
      color,
      type: 'HUMAN',
      originalType: 'HUMAN',
      connected: true
    };
  }

  #makeBotPlayer(color, number) {
    return {
      id: randomId('bot_'),
      token: null,
      socketId: null,
      name: `Bot ${number}`,
      color,
      type: 'BOT',
      originalType: 'BOT',
      connected: true
    };
  }

  #freshRuntime() {
    return {
      actionLocked: false,
      actionQueue: Promise.resolve(),
      processedActions: new Map(),
      lastMutation: null,
      botTimer: null,
      autoMoveTimer: null,
      rollTimer: null
    };
  }
}

export const ROOM_WAIT_MS = WAIT_MS;
