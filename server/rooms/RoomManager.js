import { COLORS } from '../game/constants.js';
import { GameEngine } from '../game/GameEngine.js';
import { randomId, randomToken, roomCode } from '../utils/id.js';

const WAIT_MS = 60_000;
const FINISHED_TTL_MS = 30 * 60_000;
const WAITING_TTL_MS = 30 * 60_000;
export const GAME_MODES = Object.freeze({ CLASSIC: 'CLASSIC', TEAM_2V2: 'TEAM_2V2' });
export const ROOM_VISIBILITY = Object.freeze({ PRIVATE: 'PRIVATE', PUBLIC: 'PUBLIC' });

function cleanName(name, fallback = 'Player') {
  const value = String(name ?? '').trim().replace(/\s+/g, ' ');
  return (value || fallback).slice(0, 24);
}

function normalizeMode(mode) {
  return mode === GAME_MODES.TEAM_2V2 ? GAME_MODES.TEAM_2V2 : GAME_MODES.CLASSIC;
}

function normalizeVisibility(value) {
  return value === ROOM_VISIBILITY.PUBLIC ? ROOM_VISIBILITY.PUBLIC : ROOM_VISIBILITY.PRIVATE;
}

function teamForColor(mode, color) {
  if (mode !== GAME_MODES.TEAM_2V2) return null;
  return color === 'RED' || color === 'YELLOW' ? 'A' : 'B';
}

export class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.socketIndex = new Map();
    this.matchQueues = new Map([
      [GAME_MODES.CLASSIC, []],
      [GAME_MODES.TEAM_2V2, []]
    ]);
  }

  createRoom({ socketId, name, mode = GAME_MODES.CLASSIC, visibility = ROOM_VISIBILITY.PRIVATE }) {
    mode = normalizeMode(mode);
    visibility = normalizeVisibility(visibility);
    const room = this.#newRoom({ mode, visibility, matchmaking: false });
    const player = this.#makeHumanPlayer({
      socketId,
      name,
      color: COLORS[0],
      teamId: teamForColor(mode, COLORS[0])
    });
    room.ownerPlayerId = player.id;
    room.players.push(player);
    this.rooms.set(room.id, room);
    this.socketIndex.set(socketId, { roomId: room.id, playerId: player.id });
    return { room, player, token: player.token };
  }

  createComputerGame({ socketId, name }) {
    const { room, player, token } = this.createRoom({
      socketId,
      name,
      mode: GAME_MODES.CLASSIC,
      visibility: ROOM_VISIBILITY.PRIVATE
    });
    const usedColors = new Set(room.players.map(item => item.color));
    while (room.players.length < 4) {
      const color = COLORS.find(item => !usedColors.has(item));
      usedColors.add(color);
      room.players.push(this.#makeBotPlayer(color, room.players.length + 1, null));
    }
    room.waitingEndsAt = Date.now();
    this.startGame(room);
    return { room, player, token };
  }

  joinRoom({ roomId, socketId, name }) {
    const room = this.get(roomId);
    if (!room) throw this.error('ROOM_NOT_FOUND');
    if (room.status !== 'WAITING') throw this.error('GAME_ALREADY_STARTED');
    if (room.players.length >= 4) throw this.error('ROOM_FULL');

    const usedColors = new Set(room.players.map(player => player.color));
    const color = COLORS.find(item => !usedColors.has(item));
    const player = this.#makeHumanPlayer({
      socketId,
      name,
      color,
      teamId: teamForColor(room.mode, color)
    });
    room.players.push(player);
    this.bumpVersion(room, 'PLAYER_JOINED');
    this.socketIndex.set(socketId, { roomId: room.id, playerId: player.id });

    if (room.players.length === 4) this.startGame(room);
    return { room, player, token: player.token };
  }

  enqueueMatchmaking({ socketId, name, mode = GAME_MODES.CLASSIC }) {
    mode = normalizeMode(mode);
    if (this.bySocket(socketId)) throw this.error('ALREADY_IN_ROOM');
    this.removeFromMatchmaking(socketId);
    const queue = this.matchQueues.get(mode);
    const entry = {
      socketId,
      name: cleanName(name),
      mode,
      enqueuedAt: Date.now()
    };
    queue.push(entry);

    let match = null;
    if (queue.length >= 4) {
      const entries = queue.splice(0, 4);
      match = this.#createMatchedRoom(entries, mode);
    }
    return {
      queued: !match,
      mode,
      position: match ? 0 : queue.findIndex(item => item.socketId === socketId) + 1,
      waiting: match ? 0 : queue.length,
      match
    };
  }

  removeFromMatchmaking(socketId) {
    let removed = false;
    for (const queue of this.matchQueues.values()) {
      const index = queue.findIndex(item => item.socketId === socketId);
      if (index >= 0) {
        queue.splice(index, 1);
        removed = true;
      }
    }
    return removed;
  }

  queueStatus(mode = GAME_MODES.CLASSIC) {
    const normalized = normalizeMode(mode);
    return { mode: normalized, waiting: this.matchQueues.get(normalized).length };
  }

  listPublicRooms() {
    return [...this.rooms.values()]
      .filter(room => room.visibility === ROOM_VISIBILITY.PUBLIC && room.status === 'WAITING' && room.players.length < 4)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30)
      .map(room => ({
        id: room.id,
        mode: room.mode,
        players: room.players.length,
        capacity: 4,
        ownerName: room.players.find(player => player.id === room.ownerPlayerId)?.name ?? 'Player',
        waitingEndsAt: room.waitingEndsAt,
        createdAt: room.createdAt
      }));
  }

  resume({ roomId, token, socketId }) {
    const room = this.get(roomId);
    if (!room) throw this.error('ROOM_NOT_FOUND');
    const player = room.players.find(item => item.token && item.token === token);
    if (!player) throw this.error('SESSION_NOT_FOUND');

    if (player.socketId && player.socketId !== socketId) this.socketIndex.delete(player.socketId);
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
      room.players.push(this.#makeBotPlayer(color, room.players.length + 1, teamForColor(room.mode, color)));
    }
    this.startGame(room);
    return room;
  }

  startGame(room) {
    if (room.status === 'PLAYING') return room;
    if (room.players.length !== 4) throw this.error('ROOM_NOT_READY');
    room.status = 'PLAYING';
    room.startedAt = Date.now();
    room.engine = new GameEngine(room.players, { mode: room.mode });
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
    room.engine = new GameEngine(room.players, { mode: room.mode });
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
    this.removeFromMatchmaking(socketId);
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
      mode: room.mode,
      visibility: room.visibility,
      matchmaking: !!room.matchmaking,
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
          teamId: player.teamId ?? gamePlayer?.teamId ?? null,
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
              teamId: player.teamId ?? null,
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
    if ('snapshot' in cached) cached.snapshot = null;
    room.runtime.processedActions.set(key, cached);
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
      ACTION_ID_REQUIRED: 'A unique actionId is required for game actions.',
      ALREADY_IN_ROOM: 'Player is already inside a room.'
    };
    const err = new Error(messages[code] ?? code);
    err.code = code;
    return err;
  }

  #newRoom({ mode, visibility, matchmaking }) {
    let code;
    do code = roomCode(); while (this.rooms.has(code));
    const now = Date.now();
    return {
      id: code,
      mode,
      visibility,
      matchmaking: !!matchmaking,
      ownerPlayerId: null,
      status: 'WAITING',
      stateVersion: 1,
      createdAt: now,
      updatedAt: now,
      waitingEndsAt: now + WAIT_MS,
      players: [],
      engine: null,
      runtime: this.#freshRuntime()
    };
  }

  #createMatchedRoom(entries, mode) {
    const room = this.#newRoom({ mode, visibility: ROOM_VISIBILITY.PRIVATE, matchmaking: true });
    const participants = entries.map((entry, index) => {
      const color = COLORS[index];
      const player = this.#makeHumanPlayer({
        socketId: entry.socketId,
        name: entry.name,
        color,
        teamId: teamForColor(mode, color)
      });
      room.players.push(player);
      this.socketIndex.set(entry.socketId, { roomId: room.id, playerId: player.id });
      return { socketId: entry.socketId, player, token: player.token };
    });
    room.ownerPlayerId = room.players[0].id;
    room.waitingEndsAt = Date.now();
    this.rooms.set(room.id, room);
    this.startGame(room);
    return { room, participants };
  }

  #makeHumanPlayer({ socketId, name, color, teamId = null }) {
    return {
      id: randomId('player_'),
      token: randomToken(),
      socketId,
      name: cleanName(name),
      color,
      teamId,
      type: 'HUMAN',
      originalType: 'HUMAN',
      connected: true
    };
  }

  #makeBotPlayer(color, number, teamId = null) {
    return {
      id: randomId('bot_'),
      token: null,
      socketId: null,
      name: `Bot ${number}`,
      color,
      teamId,
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
