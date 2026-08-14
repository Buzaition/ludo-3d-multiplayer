import { chooseBotMove } from '../game/BotPlayer.js';

const DICE_ANIMATION_MS = 650;
const AUTO_MOVE_MS = 420;
const BOT_MIN_DELAY = 850;
const BOT_MAX_DELAY = 1450;
let serverActionSequence = 0;

function randomDelay(min = BOT_MIN_DELAY, max = BOT_MAX_DELAY) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function serverActionId(prefix = 'server') {
  serverActionSequence += 1;
  return `${prefix}_${Date.now().toString(36)}_${serverActionSequence.toString(36)}`;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function registerSocketHandlers(io, roomManager) {
  function ackSafe(ack, payload) {
    if (typeof ack === 'function') ack(payload);
  }

  function socketForPlayer(player) {
    return player?.socketId ? io.sockets.sockets.get(player.socketId) : null;
  }

  function snapshotFor(room, playerId = null) {
    return roomManager.publicRoom(room, playerId);
  }

  function emitRoomState(room) {
    if (!room) return;
    for (const player of room.players) {
      const socket = socketForPlayer(player);
      if (!socket) continue;
      socket.emit('roomState', snapshotFor(room, player.id));
    }
  }

  function emitRoomStateTo(socket, room, playerId) {
    if (!socket || !room) return null;
    const snapshot = snapshotFor(room, playerId);
    socket.emit('roomState', snapshot);
    return snapshot;
  }

  function emitGameEvents(room, events, { actionId = null } = {}) {
    const version = room.stateVersion;
    const turnId = room.engine?.state?.turnId ?? null;
    for (const [index, event] of (events ?? []).entries()) {
      io.to(room.id).emit('gameEvent', {
        ...event,
        roomId: room.id,
        actionId,
        eventId: actionId ? `${actionId}:${index}` : serverActionId('evt'),
        stateVersion: version,
        turnId,
        at: Date.now()
      });
    }
  }

  function errorPayload(error) {
    return {
      code: error?.code ?? 'SERVER_ERROR',
      message: error?.message ?? 'Unexpected server error.',
      currentVersion: error?.currentVersion,
      currentTurnId: error?.currentTurnId
    };
  }

  function fail(socket, error, ack, { room = null, playerId = null, actionId = null, remember = false } = {}) {
    const err = errorPayload(error);
    let snapshot = null;

    if (room && err.code === 'STALE_ACTION') {
      snapshot = snapshotFor(room, playerId);
      socket?.emit('resyncRequired', {
        reason: 'STALE_ACTION',
        stateVersion: room.stateVersion,
        turnId: room.engine?.state?.turnId ?? null
      });
      socket?.emit('roomState', snapshot);
    }

    const result = {
      ok: false,
      actionId,
      error: err,
      stateVersion: room?.stateVersion ?? null,
      turnId: room?.engine?.state?.turnId ?? null,
      snapshot
    };

    if (remember && room && playerId && actionId) {
      roomManager.rememberProcessedAction(room, playerId, actionId, result);
    }

    socket?.emit('gameError', err);
    ackSafe(ack, result);
    return result;
  }

  function clearTimer(room, key) {
    if (!room?.runtime?.[key]) return;
    clearTimeout(room.runtime[key]);
    room.runtime[key] = null;
  }

  function validateActionId(room, actionId, serverInitiated) {
    if (serverInitiated) return;
    if (typeof actionId !== 'string' || actionId.length < 8 || actionId.length > 128) {
      throw roomManager.error('ACTION_ID_REQUIRED');
    }
  }

  async function runQueuedAction({
    room,
    playerId,
    payload = {},
    socket = null,
    ack = null,
    serverInitiated = false,
    label = 'ACTION',
    task
  }) {
    const actionId = serverInitiated ? (payload.actionId || serverActionId(label.toLowerCase())) : payload.actionId;

    return roomManager.enqueueAction(room, async () => {
      const previous = roomManager.getProcessedAction(room, playerId, actionId);
      if (previous) {
        const duplicateResult = { ...previous, duplicate: true };
        ackSafe(ack, duplicateResult);
        return duplicateResult;
      }

      try {
        validateActionId(room, actionId, serverInitiated);
        if (!serverInitiated) roomManager.validateActionContext(room, payload);

        room.runtime.actionLocked = true;
        const outcome = await task({ actionId });
        room.runtime.actionLocked = false;

        if (outcome?.events?.length) {
          emitGameEvents(room, outcome.events, { actionId });
        }
        emitRoomState(room);

        const result = {
          ok: true,
          actionId,
          duplicate: false,
          stateVersion: room.stateVersion,
          turnId: room.engine?.state?.turnId ?? null,
          ...(outcome?.ack ?? {})
        };
        roomManager.rememberProcessedAction(room, playerId, actionId, result);
        ackSafe(ack, result);

        outcome?.after?.();
        return result;
      } catch (error) {
        room.runtime.actionLocked = false;
        if (socket) {
          return fail(socket, error, ack, {
            room,
            playerId,
            actionId,
            remember: !!actionId
          });
        }
        if (!serverInitiated) console.error(`[${label} ERROR]`, error);
        else if (error?.code !== 'STALE_ACTION' && error?.code !== 'NOT_YOUR_TURN' && error?.code !== 'MOVE_NOT_ALLOWED' && error?.code !== 'ROLL_NOT_ALLOWED') {
          console.error(`[${label} SERVER ERROR]`, error);
        }
        return { ok: false, error: errorPayload(error) };
      }
    });
  }

  function scheduleNextAction(room) {
    if (!room || room.status !== 'PLAYING' || !room.engine || room.engine.state.gameOver) return;
    clearTimer(room, 'botTimer');
    const current = room.players.find(player => player.id === room.engine.state.currentPlayerId);
    if (!current || current.type !== 'BOT') return;

    room.runtime.botTimer = setTimeout(() => {
      room.runtime.botTimer = null;
      if (room.status !== 'PLAYING' || room.engine.state.gameOver) return;
      const latest = room.players.find(player => player.id === room.engine.state.currentPlayerId);
      if (!latest || latest.id !== current.id || latest.type !== 'BOT') return;

      if (room.engine.state.phase === 'ROLL') {
        beginRoll(room, current.id, {
          serverInitiated: true,
          payload: {
            actionId: serverActionId('bot_roll'),
            expectedVersion: room.stateVersion,
            expectedTurnId: room.engine.state.turnId
          }
        });
      } else if (room.engine.state.phase === 'MOVE') {
        const pieceId = chooseBotMove(room.engine, current.id);
        if (pieceId) {
          performMove(room, current.id, pieceId, {
            serverInitiated: true,
            payload: {
              actionId: serverActionId('bot_move'),
              expectedVersion: room.stateVersion,
              expectedTurnId: room.engine.state.turnId
            }
          });
        }
      }
    }, randomDelay());
  }

  function scheduleAutoMove(room, playerId, pieceId) {
    clearTimer(room, 'autoMoveTimer');
    room.runtime.autoMoveTimer = setTimeout(() => {
      room.runtime.autoMoveTimer = null;
      if (
        room.status !== 'PLAYING' ||
        room.engine.state.phase !== 'MOVE' ||
        room.engine.state.currentPlayerId !== playerId ||
        !room.engine.publicState().legalPieceIds.includes(pieceId)
      ) return;

      performMove(room, playerId, pieceId, {
        automatic: true,
        serverInitiated: true,
        payload: {
          actionId: serverActionId('auto_move'),
          expectedVersion: room.stateVersion,
          expectedTurnId: room.engine.state.turnId
        }
      });
    }, AUTO_MOVE_MS);
  }

  function beginRoll(room, playerId, {
    socket = null,
    ack = null,
    payload = {},
    serverInitiated = false
  } = {}) {
    return runQueuedAction({
      room,
      playerId,
      payload,
      socket,
      ack,
      serverInitiated,
      label: 'ROLL',
      task: async ({ actionId }) => {
        if (!room?.engine || room.status !== 'PLAYING') throw roomManager.error('GAME_ALREADY_STARTED');
        if (room.engine.state.currentPlayerId !== playerId) {
          const err = new Error('It is not your turn.');
          err.code = 'NOT_YOUR_TURN';
          throw err;
        }
        if (room.engine.state.phase !== 'ROLL') {
          const err = new Error('Dice cannot be rolled right now.');
          err.code = 'ROLL_NOT_ALLOWED';
          throw err;
        }

        io.to(room.id).emit('gameEvent', {
          type: 'DICE_ROLL_STARTED',
          playerId,
          roomId: room.id,
          actionId,
          eventId: `${actionId}:start`,
          stateVersion: room.stateVersion,
          turnId: room.engine.state.turnId,
          at: Date.now()
        });

        await wait(DICE_ANIMATION_MS);

        // Recheck after the visual delay. The room queue normally guarantees this,
        // but the assertions make the invariant explicit.
        if (room.status !== 'PLAYING' || room.engine.state.currentPlayerId !== playerId || room.engine.state.phase !== 'ROLL') {
          const err = new Error('Roll became stale before it resolved.');
          err.code = 'STALE_ACTION';
          err.currentVersion = room.stateVersion;
          err.currentTurnId = room.engine.state.turnId;
          throw err;
        }

        const result = room.engine.rollDice(playerId);
        roomManager.bumpVersion(room, 'DICE_ROLLED');

        return {
          events: result.events,
          after: () => {
            if (room.engine.state.gameOver) {
              roomManager.markFinished(room);
              emitRoomState(room);
            } else if (result.autoMovePieceId) {
              scheduleAutoMove(room, playerId, result.autoMovePieceId);
            } else {
              scheduleNextAction(room);
            }
          }
        };
      }
    });
  }

  function performMove(room, playerId, pieceId, {
    automatic = false,
    socket = null,
    ack = null,
    payload = {},
    serverInitiated = false
  } = {}) {
    return runQueuedAction({
      room,
      playerId,
      payload,
      socket,
      ack,
      serverInitiated,
      label: automatic ? 'AUTO_MOVE' : 'MOVE',
      task: async () => {
        if (!room?.engine || room.status !== 'PLAYING') throw roomManager.error('GAME_ALREADY_STARTED');
        clearTimer(room, 'autoMoveTimer');
        const result = room.engine.movePiece(playerId, pieceId);

        if (room.engine.state.gameOver) roomManager.markFinished(room);
        else roomManager.bumpVersion(room, automatic ? 'AUTO_MOVE' : 'PIECE_MOVED');

        return {
          events: result.events,
          ack: { automatic },
          after: () => scheduleNextAction(room)
        };
      }
    });
  }

  io.on('connection', socket => {
    socket.on('createRoom', (payload = {}, ack) => {
      try {
        const existing = roomManager.bySocket(socket.id);
        if (existing) roomManager.disconnect(socket.id);
        const { room, player, token } = roomManager.createRoom({
          socketId: socket.id,
          name: payload.name
        });
        socket.join(room.id);
        console.log(`[ROOM CREATED] ${room.id} by ${player.name}`);
        emitRoomState(room);
        ackSafe(ack, {
          ok: true,
          roomId: room.id,
          token,
          playerId: player.id,
          stateVersion: room.stateVersion
        });
      } catch (error) {
        fail(socket, error, ack);
      }
    });

    socket.on('joinRoom', (payload = {}, ack) => {
      try {
        const existing = roomManager.bySocket(socket.id);
        if (existing) roomManager.disconnect(socket.id);
        const { room, player, token } = roomManager.joinRoom({
          roomId: payload.roomId,
          socketId: socket.id,
          name: payload.name
        });
        socket.join(room.id);
        console.log(`[PLAYER JOINED] ${player.name} -> ${room.id}`);
        emitRoomState(room);
        if (room.status === 'PLAYING') {
          io.to(room.id).emit('gameEvent', {
            type: 'GAME_STARTED',
            roomId: room.id,
            stateVersion: room.stateVersion,
            turnId: room.engine.state.turnId,
            at: Date.now()
          });
          scheduleNextAction(room);
        }
        ackSafe(ack, {
          ok: true,
          roomId: room.id,
          token,
          playerId: player.id,
          stateVersion: room.stateVersion
        });
      } catch (error) {
        fail(socket, error, ack);
      }
    });

    socket.on('resumeSession', (payload = {}, ack) => {
      try {
        const { room, player, token } = roomManager.resume({
          roomId: payload.roomId,
          token: payload.token,
          socketId: socket.id
        });
        socket.join(room.id);
        console.log(`[SESSION RESUMED] ${player.name} -> ${room.id}`);
        const snapshot = emitRoomStateTo(socket, room, player.id);
        // Everyone else also needs the connection/type change.
        emitRoomState(room);
        scheduleNextAction(room);
        ackSafe(ack, {
          ok: true,
          roomId: room.id,
          token,
          playerId: player.id,
          stateVersion: room.stateVersion,
          turnId: room.engine?.state?.turnId ?? null,
          snapshot
        });
      } catch (error) {
        fail(socket, error, ack);
      }
    });

    socket.on('requestStateSync', (_payload = {}, ack) => {
      try {
        const ref = roomManager.bySocket(socket.id);
        if (!ref) throw roomManager.error('SESSION_NOT_FOUND');
        const snapshot = emitRoomStateTo(socket, ref.room, ref.player.id);
        ackSafe(ack, {
          ok: true,
          stateVersion: ref.room.stateVersion,
          turnId: ref.room.engine?.state?.turnId ?? null,
          snapshot
        });
      } catch (error) {
        fail(socket, error, ack);
      }
    });

    socket.on('fillWithBots', (payload = {}, ack) => {
      try {
        const ref = roomManager.bySocket(socket.id);
        if (!ref) throw roomManager.error('SESSION_NOT_FOUND');
        if (Number.isInteger(Number(payload.expectedVersion)) && Number(payload.expectedVersion) !== ref.room.stateVersion) {
          roomManager.validateActionContext(ref.room, {
            expectedVersion: payload.expectedVersion,
            expectedTurnId: ref.room.engine?.state?.turnId ?? 0
          });
        }
        const room = roomManager.fillWithBots({ roomId: ref.room.id, playerId: ref.player.id });
        io.to(room.id).emit('gameEvent', {
          type: 'GAME_STARTED',
          roomId: room.id,
          stateVersion: room.stateVersion,
          turnId: room.engine.state.turnId,
          at: Date.now()
        });
        console.log(`[GAME STARTED] ${room.id} with bots`);
        emitRoomState(room);
        scheduleNextAction(room);
        ackSafe(ack, { ok: true, stateVersion: room.stateVersion, turnId: room.engine.state.turnId });
      } catch (error) {
        const ref = roomManager.bySocket(socket.id);
        fail(socket, error, ack, { room: ref?.room, playerId: ref?.player?.id });
      }
    });

    socket.on('rollDice', (payload = {}, ack) => {
      const ref = roomManager.bySocket(socket.id);
      if (!ref) return fail(socket, roomManager.error('SESSION_NOT_FOUND'), ack);
      beginRoll(ref.room, ref.player.id, { socket, ack, payload });
    });

    socket.on('movePiece', (payload = {}, ack) => {
      const ref = roomManager.bySocket(socket.id);
      if (!ref) return fail(socket, roomManager.error('SESSION_NOT_FOUND'), ack);
      performMove(ref.room, ref.player.id, payload.pieceId, { socket, ack, payload });
    });

    socket.on('playAgain', (payload = {}, ack) => {
      try {
        const ref = roomManager.bySocket(socket.id);
        if (!ref) throw roomManager.error('SESSION_NOT_FOUND');
        if (Number.isInteger(Number(payload.expectedVersion)) && Number(payload.expectedVersion) !== ref.room.stateVersion) {
          const err = roomManager.error('STALE_ACTION');
          err.currentVersion = ref.room.stateVersion;
          err.currentTurnId = ref.room.engine?.state?.turnId ?? null;
          throw err;
        }
        const room = roomManager.restartGame(ref.room.id, ref.player.id);
        io.to(room.id).emit('gameEvent', {
          type: 'GAME_STARTED',
          roomId: room.id,
          stateVersion: room.stateVersion,
          turnId: room.engine.state.turnId,
          at: Date.now(),
          rematch: true
        });
        emitRoomState(room);
        scheduleNextAction(room);
        ackSafe(ack, { ok: true, stateVersion: room.stateVersion, turnId: room.engine.state.turnId });
      } catch (error) {
        const ref = roomManager.bySocket(socket.id);
        fail(socket, error, ack, { room: ref?.room, playerId: ref?.player?.id });
      }
    });

    socket.on('disconnect', () => {
      const result = roomManager.disconnect(socket.id);
      if (!result || result.deleted) return;
      const { room, player } = result;
      if (!room) return;
      if (result.convertedToBot) {
        console.log(`[DISCONNECTED -> BOT] ${player.name} -> ${room.id}`);
        io.to(room.id).emit('gameEvent', {
          type: 'PLAYER_DISCONNECTED_TO_BOT',
          playerId: player.id,
          roomId: room.id,
          stateVersion: room.stateVersion,
          turnId: room.engine?.state?.turnId ?? null,
          at: Date.now()
        });
      }
      emitRoomState(room);
      scheduleNextAction(room);
    });
  });

  return { emitRoomState, scheduleNextAction };
}
