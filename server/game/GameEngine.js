import {
  SAFE_CELL_KEYS,
  MAIN_TRACK_LAST_PROGRESS,
  FINISH_LANE_START_PROGRESS,
  FINAL_PROGRESS,
  START_CELL,
  cellForProgress,
  cellKey
} from './constants.js';

export class GameRuleError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'GameRuleError';
    this.code = code;
  }
}

export class GameEngine {
  constructor(players, { rng = Math.random, mode = 'CLASSIC' } = {}) {
    if (!Array.isArray(players) || players.length !== 4) {
      throw new Error('GameEngine requires exactly 4 players.');
    }
    this.rng = rng;
    this.state = {
      mode,
      winningTeam: null,
      phase: 'ROLL',
      turnId: 1,
      currentPlayerId: players[0].id,
      rolled: null,
      consecutiveSixes: 0,
      rankings: [],
      gameOver: false,
      startedAt: Date.now(),
      finishedAt: null,
      players: players.map(player => ({
        id: player.id,
        name: player.name,
        color: player.color,
        teamId: player.teamId ?? null,
        type: player.type,
        connected: player.connected !== false,
        finishedRank: null,
        pieces: Array.from({ length: 4 }, (_, index) => ({
          id: `${player.id}:piece:${index}`,
          index,
          color: player.color,
          progress: -1,
          finished: false
        }))
      }))
    };
  }

  publicState() {
    const legalPieceIds = this.state.phase === 'MOVE' && !this.state.gameOver
      ? this.legalPieces().map(piece => piece.id)
      : [];
    return structuredClone({ ...this.state, legalPieceIds });
  }

  getPlayer(playerId) {
    return this.state.players.find(player => player.id === playerId) || null;
  }

  currentPlayer() {
    return this.getPlayer(this.state.currentPlayerId);
  }

  setPlayerConnection(playerId, { connected, type } = {}) {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    if (typeof connected === 'boolean') player.connected = connected;
    if (type) player.type = type;
    return true;
  }

  getPiece(pieceId) {
    for (const player of this.state.players) {
      const piece = player.pieces.find(item => item.id === pieceId);
      if (piece) return piece;
    }
    return null;
  }

  ownerOfPiece(pieceId) {
    return this.state.players.find(player => player.pieces.some(piece => piece.id === pieceId)) || null;
  }

  areOpponents(pieceA, pieceB) {
    if (!pieceA || !pieceB) return false;
    const ownerA = this.ownerOfPiece(pieceA.id);
    const ownerB = this.ownerOfPiece(pieceB.id);
    if (!ownerA || !ownerB || ownerA.id === ownerB.id) return false;
    if (this.state.mode === 'TEAM_2V2' && ownerA.teamId && ownerA.teamId === ownerB.teamId) return false;
    return true;
  }

  isOpponentColor(movingColor, otherPiece) {
    const movingPlayer = this.state.players.find(player => player.color === movingColor);
    const otherPlayer = this.ownerOfPiece(otherPiece.id);
    if (!movingPlayer || !otherPlayer || movingPlayer.id === otherPlayer.id) return false;
    if (this.state.mode === 'TEAM_2V2' && movingPlayer.teamId && movingPlayer.teamId === otherPlayer.teamId) return false;
    return true;
  }

  occupantsAtCell(cell, excludePieceId = null) {
    const key = cellKey(cell);
    if (!key) return [];
    const occupants = [];
    for (const player of this.state.players) {
      for (const piece of player.pieces) {
        if (piece.id === excludePieceId || piece.progress < 0 || piece.finished) continue;
        const pieceCell = cellForProgress(piece.color, piece.progress);
        if (cellKey(pieceCell) === key) occupants.push(piece);
      }
    }
    return occupants;
  }

  hasEnemyBlockade(cell, movingColor, excludePieceId = null) {
    const counts = new Map();
    for (const piece of this.occupantsAtCell(cell, excludePieceId)) {
      if (!this.isOpponentColor(movingColor, piece) || piece.progress >= FINISH_LANE_START_PROGRESS) continue;
      counts.set(piece.color, (counts.get(piece.color) || 0) + 1);
      if (counts.get(piece.color) >= 2) return true;
    }
    return false;
  }

  moveSteps(piece, roll) {
    if (piece.progress < 0) {
      return roll === 6 ? [{ progress: 0, cell: START_CELL[piece.color] }] : [];
    }
    const targetProgress = piece.progress + roll;
    if (targetProgress > FINAL_PROGRESS) return [];
    const steps = [];
    for (let progress = piece.progress + 1; progress <= targetProgress; progress++) {
      steps.push({ progress, cell: cellForProgress(piece.color, progress) });
    }
    return steps;
  }

  isLegalMove(piece, roll = this.state.rolled) {
    if (!roll || !piece || piece.finished) return false;
    if (piece.progress < 0 && roll !== 6) return false;
    if (piece.progress >= 0 && piece.progress + roll > FINAL_PROGRESS) return false;

    const steps = this.moveSteps(piece, roll);
    if (!steps.length) return false;

    // Revised blockade rule: opponents can pass through, but cannot land on it.
    const target = steps.at(-1);
    if (
      target.progress <= MAIN_TRACK_LAST_PROGRESS &&
      this.hasEnemyBlockade(target.cell, piece.color, piece.id)
    ) {
      return false;
    }

    // Do not create an impossible multi-capture on a non-safe cell.
    if (target.progress <= MAIN_TRACK_LAST_PROGRESS && !SAFE_CELL_KEYS.has(cellKey(target.cell))) {
      const enemies = this.occupantsAtCell(target.cell, piece.id)
        .filter(other => this.areOpponents(piece, other));
      if (enemies.length > 1) return false;
    }

    return true;
  }

  legalPieces(player = this.currentPlayer(), roll = this.state.rolled) {
    if (!player) return [];
    return player.pieces.filter(piece => this.isLegalMove(piece, roll));
  }

  hasExactFinishWait(player, roll) {
    return player.pieces.some(piece =>
      !piece.finished &&
      piece.progress >= FINISH_LANE_START_PROGRESS &&
      piece.progress + roll > FINAL_PROGRESS
    );
  }

  hasBlockedLanding(player, roll) {
    return player.pieces.some(piece => {
      if (piece.finished) return false;
      const steps = this.moveSteps(piece, roll);
      if (!steps.length) return false;
      const target = steps.at(-1);
      return target.progress <= MAIN_TRACK_LAST_PROGRESS &&
        this.hasEnemyBlockade(target.cell, piece.color, piece.id);
    });
  }

  rollDice(playerId, { forcedValue } = {}) {
    this.#assertAction(playerId, 'ROLL');
    const value = forcedValue ?? (Math.floor(this.rng() * 6) + 1);
    if (!Number.isInteger(value) || value < 1 || value > 6) {
      throw new Error('Dice value must be 1..6.');
    }

    this.state.rolled = value;
    if (value === 6) this.state.consecutiveSixes += 1;
    else this.state.consecutiveSixes = 0;

    const events = [{
      type: 'DICE_ROLLED',
      playerId,
      value,
      consecutiveSixes: this.state.consecutiveSixes,
      penalized: value === 6 && this.state.consecutiveSixes >= 3
    }];

    if (value === 6 && this.state.consecutiveSixes >= 3) {
      events.push({ type: 'TRIPLE_SIX_PENALTY', playerId });
      this.#advanceTurn(events, 'TRIPLE_SIX');
      return { events, autoMovePieceId: null };
    }

    const legal = this.legalPieces(this.currentPlayer(), value);
    if (!legal.length) {
      if (this.hasExactFinishWait(this.currentPlayer(), value)) {
        events.push({ type: 'EXACT_FINISH_WAIT', playerId, value });
      } else if (this.hasBlockedLanding(this.currentPlayer(), value)) {
        events.push({ type: 'MOVE_REJECTED_BLOCKADE', playerId, value });
      }

      events.push({ type: 'NO_LEGAL_MOVE', playerId, value });
      if (value === 6) {
        this.state.phase = 'ROLL';
        this.state.rolled = null;
        this.state.turnId += 1;
        events.push({ type: 'EXTRA_ROLL_GRANTED', playerId, reason: 'SIX', turnId: this.state.turnId });
      } else {
        this.#advanceTurn(events, 'NO_MOVE');
      }
      return { events, autoMovePieceId: null };
    }

    this.state.phase = 'MOVE';
    return {
      events,
      autoMovePieceId: legal.length === 1 ? legal[0].id : null
    };
  }

  inspectMove(pieceId, roll = this.state.rolled) {
    const piece = this.getPiece(pieceId);
    if (!piece || !this.isLegalMove(piece, roll)) return null;
    const steps = this.moveSteps(piece, roll);
    const target = steps.at(-1);
    const targetCell = target.cell;
    const enemies = target.progress <= MAIN_TRACK_LAST_PROGRESS
      ? this.occupantsAtCell(targetCell, piece.id).filter(other => this.areOpponents(piece, other))
      : [];
    const sameBefore = target.progress <= MAIN_TRACK_LAST_PROGRESS
      ? this.occupantsAtCell(targetCell, piece.id).filter(other => other.color === piece.color).length
      : 0;
    return {
      pieceId,
      leavesBase: piece.progress < 0,
      fromProgress: piece.progress,
      toProgress: target.progress,
      reachesHome: target.progress === FINAL_PROGRESS,
      captures: enemies.length === 1 && !SAFE_CELL_KEYS.has(cellKey(targetCell)),
      landsSafe: target.progress <= MAIN_TRACK_LAST_PROGRESS && SAFE_CELL_KEYS.has(cellKey(targetCell)),
      formsBlockade: target.progress <= MAIN_TRACK_LAST_PROGRESS && sameBefore === 1,
      targetCell
    };
  }

  movePiece(playerId, pieceId) {
    this.#assertAction(playerId, 'MOVE');
    const player = this.currentPlayer();
    const piece = this.getPiece(pieceId);
    if (!piece || this.ownerOfPiece(pieceId)?.id !== playerId) {
      throw new GameRuleError('PIECE_NOT_OWNED', 'This piece does not belong to the current player.');
    }
    if (!this.isLegalMove(piece)) {
      const steps = this.moveSteps(piece, this.state.rolled);
      const target = steps.at(-1);
      if (
        target &&
        target.progress <= MAIN_TRACK_LAST_PROGRESS &&
        this.hasEnemyBlockade(target.cell, piece.color, piece.id)
      ) {
        throw new GameRuleError('BLOCKADE_LANDING_FORBIDDEN', 'Cannot land on an opponent blockade.');
      }
      throw new GameRuleError('INVALID_MOVE', 'Illegal piece move.');
    }

    const roll = this.state.rolled;
    const inspection = this.inspectMove(pieceId, roll);
    const fromProgress = piece.progress;
    const wasBase = piece.progress < 0;
    const targetProgress = wasBase ? 0 : piece.progress + roll;
    const targetCell = cellForProgress(piece.color, targetProgress);
    const sameColorBefore = targetProgress <= MAIN_TRACK_LAST_PROGRESS
      ? this.occupantsAtCell(targetCell, piece.id).filter(other => other.color === piece.color).length
      : 0;

    piece.progress = targetProgress;
    const events = [];
    if (wasBase) {
      events.push({ type: 'PIECE_LEFT_BASE', playerId, pieceId, toProgress: 0 });
    }

    events.push({
      type: 'PIECE_MOVED',
      playerId,
      pieceId,
      fromProgress,
      toProgress: targetProgress,
      roll,
      steps: wasBase ? [0] : Array.from({ length: roll }, (_, index) => fromProgress + index + 1)
    });

    let reachedHome = false;
    if (piece.progress === FINAL_PROGRESS) {
      piece.finished = true;
      reachedHome = true;
      events.push({ type: 'PIECE_REACHED_HOME', playerId, pieceId });
    } else if (
      piece.progress <= MAIN_TRACK_LAST_PROGRESS &&
      SAFE_CELL_KEYS.has(cellKey(targetCell))
    ) {
      events.push({ type: 'PIECE_ENTERED_SAFE_CELL', playerId, pieceId, cell: targetCell });
    }

    let captured = false;
    if (
      piece.progress <= MAIN_TRACK_LAST_PROGRESS &&
      !SAFE_CELL_KEYS.has(cellKey(targetCell))
    ) {
      const enemies = this.occupantsAtCell(targetCell, piece.id)
        .filter(other => this.areOpponents(piece, other));
      if (enemies.length === 1) {
        const enemy = enemies[0];
        enemy.progress = -1;
        enemy.finished = false;
        captured = true;
        events.push({
          type: 'PIECE_CAPTURED',
          playerId,
          pieceId,
          capturedPieceId: enemy.id,
          capturedPlayerId: this.ownerOfPiece(enemy.id)?.id ?? null
        });
      }
    }

    if (
      !reachedHome &&
      piece.progress <= MAIN_TRACK_LAST_PROGRESS &&
      sameColorBefore === 1
    ) {
      events.push({ type: 'BLOCKADE_FORMED', playerId, pieceId, cell: targetCell });
    }

    if (!captured && this.#isChasingEnemy(piece)) {
      events.push({ type: 'CHASE_THREAT', playerId, pieceId });
    }

    const playerFinished = player.pieces.every(item => item.finished);
    if (playerFinished && !this.state.rankings.includes(playerId)) {
      this.state.rankings.push(playerId);
      player.finishedRank = this.state.rankings.length;
      events.push({
        type: 'PLAYER_FINISHED',
        playerId,
        rank: player.finishedRank
      });

      if (this.state.mode === 'TEAM_2V2') {
        const teamId = player.teamId;
        const teamMembers = this.state.players.filter(candidate => candidate.teamId === teamId);
        const teamFinished = teamMembers.length === 2 && teamMembers.every(member => member.pieces.every(pieceItem => pieceItem.finished));
        if (teamFinished) {
          this.state.winningTeam = teamId;
          this.state.gameOver = true;
          this.state.phase = 'DONE';
          this.state.rolled = null;
          this.state.finishedAt = Date.now();
          events.push({ type: 'GAME_FINISHED', mode: this.state.mode, winningTeam: teamId, rankings: [...this.state.rankings] });
          return { events, extraRoll: false };
        }
      } else if (this.state.rankings.length === 3) {
        const remaining = this.state.players.find(
          candidate => !this.state.rankings.includes(candidate.id)
        );
        if (remaining) {
          this.state.rankings.push(remaining.id);
          remaining.finishedRank = 4;
          events.push({ type: 'PLAYER_FINISHED', playerId: remaining.id, rank: 4, automatic: true });
        }
        this.state.gameOver = true;
        this.state.phase = 'DONE';
        this.state.rolled = null;
        this.state.finishedAt = Date.now();
        events.push({ type: 'GAME_FINISHED', mode: this.state.mode, rankings: [...this.state.rankings] });
        return { events, extraRoll: false };
      }
    }

    // Bonuses do not stack. A finished player never takes another turn.
    const extraRoll = !playerFinished && (roll === 6 || captured || reachedHome);
    if (extraRoll) {
      this.state.phase = 'ROLL';
      this.state.rolled = null;
      const reason = reachedHome
        ? 'HOME'
        : roll === 6 && captured
          ? 'SIX_CAPTURE'
          : captured
            ? 'CAPTURE'
            : 'SIX';
      this.state.turnId += 1;
      events.push({ type: 'EXTRA_ROLL_GRANTED', playerId, reason, turnId: this.state.turnId });
    } else {
      this.#advanceTurn(events, playerFinished ? 'PLAYER_FINISHED' : 'NORMAL');
    }

    return { events, extraRoll, inspection };
  }

  #isChasingEnemy(piece) {
    if (
      !piece ||
      piece.progress < 0 ||
      piece.progress >= MAIN_TRACK_LAST_PROGRESS
    ) return false;
    const next = cellForProgress(piece.color, piece.progress + 1);
    if (!next || SAFE_CELL_KEYS.has(cellKey(next))) return false;
    const enemies = this.occupantsAtCell(next).filter(other => this.areOpponents(piece, other));
    return enemies.length === 1;
  }

  #advanceTurn(events, reason) {
    const previousPlayerId = this.state.currentPlayerId;
    const players = this.state.players;
    const startIndex = players.findIndex(player => player.id === previousPlayerId);
    let next = null;
    for (let offset = 1; offset <= players.length; offset++) {
      const candidate = players[(startIndex + offset + players.length) % players.length];
      if (!this.state.rankings.includes(candidate.id)) {
        next = candidate;
        break;
      }
    }
    if (!next) return;

    this.state.currentPlayerId = next.id;
    this.state.phase = 'ROLL';
    this.state.rolled = null;
    this.state.consecutiveSixes = 0;
    this.state.turnId += 1;
    events.push({
      type: 'TURN_CHANGED',
      fromPlayerId: previousPlayerId,
      playerId: next.id,
      reason,
      turnId: this.state.turnId
    });
  }

  #assertAction(playerId, expectedPhase) {
    if (this.state.gameOver) throw new GameRuleError('GAME_FINISHED', 'Game has finished.');
    if (this.state.currentPlayerId !== playerId) {
      throw new GameRuleError('NOT_YOUR_TURN', 'It is not this player\'s turn.');
    }
    if (this.state.phase !== expectedPhase) {
      throw new GameRuleError(
        expectedPhase === 'ROLL' ? 'ROLL_NOT_ALLOWED' : 'MOVE_NOT_ALLOWED',
        `Expected phase ${expectedPhase}, found ${this.state.phase}.`
      );
    }
  }
}
