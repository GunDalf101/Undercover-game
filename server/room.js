const crypto = require('crypto');
const themes = require('./themes');

function newId() {
  return crypto.randomBytes(6).toString('hex');
}
function newToken() {
  return crypto.randomBytes(16).toString('hex');
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PHASES = {
  LOBBY: 'lobby',
  REVEAL: 'reveal',
  DESCRIBE: 'describe',
  VOTE: 'vote',
  RESOLUTION: 'resolution',
  ENDED: 'ended',
};

class Room {
  constructor(code) {
    this.code = code;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.phase = PHASES.LOBBY;
    this.players = new Map(); // playerId -> Player
    this.hostId = null;
    this.config = {
      themeId: null,
      undercoverCount: 1,
    };
    this.round = 0;
    this.currentPair = null; // {index, civilian, undercover}
    this.usedPairIndices = new Set();
    this.speakingOrder = []; // playerIds
    this.votes = new Map(); // voterId -> targetId
    this.voteRound = 'main'; // 'main' or 'runoff'
    this.runoffCandidates = null; // Set of playerIds during runoff
    this.tieCount = 0;
    this.lastElimination = null; // {playerId, role}
    this.winner = null; // 'civilians' | 'undercovers'
    this.reveal = null; // [{playerId, role, word}]
  }

  touch() {
    this.lastActivity = Date.now();
  }

  // ---------- player management ----------
  addPlayer(nickname, socketId) {
    const id = newId();
    const token = newToken();
    const player = {
      id,
      token,
      nickname: (nickname || 'Player').slice(0, 20),
      socketId,
      connected: true,
      alive: true,
      role: null,
      word: null,
    };
    this.players.set(id, player);
    if (!this.hostId) this.hostId = id;
    this.touch();
    return player;
  }

  rebind(playerId, token, socketId) {
    const p = this.players.get(playerId);
    if (!p || p.token !== token) return null;
    p.socketId = socketId;
    p.connected = true;
    this.touch();
    return p;
  }

  markDisconnected(socketId) {
    for (const p of this.players.values()) {
      if (p.socketId === socketId) {
        p.connected = false;
        this.touch();
        return p;
      }
    }
    return null;
  }

  removePlayer(playerId) {
    const p = this.players.get(playerId);
    if (!p) return null;
    this.players.delete(playerId);
    this.votes.delete(playerId);
    for (const [voterId, targetId] of this.votes.entries()) {
      if (targetId === playerId) this.votes.delete(voterId);
    }
    if (this.hostId === playerId) {
      const next = [...this.players.values()].find((x) => x.connected) || [...this.players.values()][0];
      this.hostId = next ? next.id : null;
    }
    if (this.speakingOrder.includes(playerId)) {
      this.speakingOrder = this.speakingOrder.filter((x) => x !== playerId);
    }
    if (this.runoffCandidates) this.runoffCandidates.delete(playerId);
    this.touch();
    return p;
  }

  isHost(playerId) {
    return this.hostId === playerId;
  }

  // ---------- game flow ----------
  configure({ themeId, undercoverCount }) {
    if (themeId) this.config.themeId = themeId;
    if (typeof undercoverCount === 'number') {
      this.config.undercoverCount = Math.max(1, Math.min(3, Math.floor(undercoverCount)));
    }
    this.touch();
  }

  canStart() {
    if (this.phase !== PHASES.LOBBY && this.phase !== PHASES.ENDED) {
      return { ok: false, reason: 'Game already in progress' };
    }
    if (this.players.size < 3) return { ok: false, reason: 'Need at least 3 players' };
    if (!this.config.themeId) return { ok: false, reason: 'Pick a theme first' };
    if (!themes.getById(this.config.themeId)) return { ok: false, reason: 'Unknown theme' };
    const alive = this.players.size;
    if (this.config.undercoverCount >= alive) return { ok: false, reason: 'Too many undercovers for player count' };
    return { ok: true };
  }

  startGame() {
    const check = this.canStart();
    if (!check.ok) return check;

    this.round = 0;
    this.usedPairIndices = new Set();
    this.winner = null;
    this.reveal = null;
    this.lastElimination = null;
    for (const p of this.players.values()) {
      p.alive = true;
      p.role = null;
      p.word = null;
    }
    this._startRound();
    return { ok: true };
  }

  _startRound() {
    this.round += 1;
    this.votes = new Map();
    this.voteRound = 'main';
    this.runoffCandidates = null;
    this.tieCount = 0;
    this.lastElimination = null;

    const pair = themes.pickPair(this.config.themeId, this.usedPairIndices);
    if (!pair) return { ok: false, reason: 'Theme has no pairs' };
    this.usedPairIndices.add(pair.index);
    this.currentPair = pair;

    const alivePlayers = [...this.players.values()].filter((p) => p.alive);
    const shuffled = shuffle(alivePlayers);
    const undercoverCount = Math.min(this.config.undercoverCount, alivePlayers.length - 1);
    for (let i = 0; i < shuffled.length; i++) {
      const isUndercover = i < undercoverCount;
      shuffled[i].role = isUndercover ? 'undercover' : 'civilian';
      shuffled[i].word = isUndercover ? pair.undercover : pair.civilian;
    }
    this.speakingOrder = shuffle(alivePlayers.map((p) => p.id));
    this.phase = PHASES.REVEAL;
    this.touch();
    return { ok: true };
  }

  moveToDescribe() {
    if (this.phase !== PHASES.REVEAL) return { ok: false, reason: 'Not in reveal phase' };
    this.phase = PHASES.DESCRIBE;
    this.touch();
    return { ok: true };
  }

  startVoting() {
    if (this.phase !== PHASES.DESCRIBE && this.phase !== PHASES.REVEAL) {
      return { ok: false, reason: 'Cannot start voting now' };
    }
    this.phase = PHASES.VOTE;
    this.votes = new Map();
    this.voteRound = 'main';
    this.runoffCandidates = null;
    this.tieCount = 0;
    this.touch();
    return { ok: true };
  }

  castVote(voterId, targetId) {
    if (this.phase !== PHASES.VOTE) return { ok: false, reason: 'Not voting phase' };
    const voter = this.players.get(voterId);
    const target = this.players.get(targetId);
    if (!voter || !voter.alive) return { ok: false, reason: 'You cannot vote' };
    if (!target || !target.alive) return { ok: false, reason: 'Invalid target' };
    if (voterId === targetId) return { ok: false, reason: 'Cannot vote yourself' };
    if (this.runoffCandidates && !this.runoffCandidates.has(targetId)) {
      return { ok: false, reason: 'Target not in runoff' };
    }
    this.votes.set(voterId, targetId);
    this.touch();
    const eligibleVoters = this._eligibleVoters();
    const allVoted = eligibleVoters.every((id) => this.votes.has(id));
    if (allVoted) return { ok: true, tally: true };
    return { ok: true, tally: false };
  }

  _eligibleVoters() {
    if (this.runoffCandidates) {
      return [...this.players.values()]
        .filter((p) => p.alive && !this.runoffCandidates.has(p.id))
        .map((p) => p.id);
    }
    return [...this.players.values()].filter((p) => p.alive).map((p) => p.id);
  }

  tallyVotes() {
    if (this.phase !== PHASES.VOTE) return { ok: false, reason: 'Not voting phase' };
    const counts = new Map();
    for (const target of this.votes.values()) {
      counts.set(target, (counts.get(target) || 0) + 1);
    }
    if (counts.size === 0) {
      // no votes → skip elimination
      this.lastElimination = null;
      return this._afterElimination(null);
    }
    let max = 0;
    for (const c of counts.values()) if (c > max) max = c;
    const top = [...counts.entries()].filter(([, c]) => c === max).map(([id]) => id);

    if (top.length > 1) {
      this.tieCount += 1;
      if (this.tieCount >= 2) {
        // second tie: skip elimination, move on
        this.lastElimination = null;
        return this._afterElimination(null);
      }
      this.voteRound = 'runoff';
      this.runoffCandidates = new Set(top);
      this.votes = new Map();
      return { ok: true, tally: 'runoff', tied: top };
    }

    const eliminatedId = top[0];
    const p = this.players.get(eliminatedId);
    p.alive = false;
    this.lastElimination = { playerId: eliminatedId, role: p.role, nickname: p.nickname };
    return this._afterElimination(this.lastElimination);
  }

  _afterElimination(elim) {
    const aliveList = [...this.players.values()].filter((p) => p.alive);
    const aliveCivilians = aliveList.filter((p) => p.role === 'civilian').length;
    const aliveUndercovers = aliveList.filter((p) => p.role === 'undercover').length;

    if (aliveUndercovers === 0) {
      return this._endGame('civilians', elim);
    }
    if (aliveUndercovers >= aliveCivilians) {
      return this._endGame('undercovers', elim);
    }
    this.phase = PHASES.RESOLUTION;
    this.touch();
    return { ok: true, tally: 'eliminated', elimination: elim };
  }

  _endGame(winner, elim) {
    this.phase = PHASES.ENDED;
    this.winner = winner;
    this.reveal = [...this.players.values()].map((p) => ({
      playerId: p.id,
      nickname: p.nickname,
      role: p.role,
      word: p.word,
    }));
    this.touch();
    return { ok: true, tally: 'ended', elimination: elim, winner };
  }

  nextRound() {
    if (this.phase !== PHASES.RESOLUTION) return { ok: false, reason: 'Not in resolution' };
    // keep same pair? no — plan says "new round: same words, same roles, back to describe"
    // Wait: re-read plan. "Otherwise → new round: same words, same roles, back to `describe`."
    // So we do NOT re-pick words or reassign roles between rounds within one game.
    this.phase = PHASES.DESCRIBE;
    this.votes = new Map();
    this.voteRound = 'main';
    this.runoffCandidates = null;
    this.tieCount = 0;
    this.lastElimination = null;
    // update speaking order to alive players only
    this.speakingOrder = shuffle([...this.players.values()].filter((p) => p.alive).map((p) => p.id));
    this.touch();
    return { ok: true };
  }

  playAgain() {
    this.phase = PHASES.LOBBY;
    this.round = 0;
    this.currentPair = null;
    this.speakingOrder = [];
    this.votes = new Map();
    this.voteRound = 'main';
    this.runoffCandidates = null;
    this.tieCount = 0;
    this.lastElimination = null;
    this.winner = null;
    this.reveal = null;
    for (const p of this.players.values()) {
      p.alive = true;
      p.role = null;
      p.word = null;
    }
    this.touch();
    return { ok: true };
  }

  // ---------- serialization ----------
  publicState() {
    return {
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      round: this.round,
      config: {
        themeId: this.config.themeId,
        themeName: this.config.themeId ? (themes.getById(this.config.themeId)?.name || null) : null,
        undercoverCount: this.config.undercoverCount,
      },
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        nickname: p.nickname,
        connected: p.connected,
        alive: p.alive,
        isHost: p.id === this.hostId,
      })),
      speakingOrder: this.speakingOrder.slice(),
      voteRound: this.voteRound,
      runoffCandidates: this.runoffCandidates ? [...this.runoffCandidates] : null,
      votesReceived: this._voteProgress(),
      lastElimination: this.lastElimination,
      winner: this.winner,
      reveal: this.reveal,
    };
  }

  _voteProgress() {
    // only show how many have voted, not who voted for whom
    if (this.phase !== PHASES.VOTE) return { count: 0, needed: 0, voterIds: [] };
    const eligible = this._eligibleVoters();
    return {
      count: [...this.votes.keys()].filter((id) => this.players.get(id)?.alive).length,
      needed: eligible.length,
      voterIds: [...this.votes.keys()],
    };
  }
}

module.exports = { Room, PHASES };
