const { createRoom, getRoom, deleteRoom } = require('./rooms');
const themes = require('./themes');

function emitRoomState(io, room) {
  io.to(roomChannel(room.code)).emit('room:state', room.publicState());
}

function roomChannel(code) {
  return `room:${code}`;
}

function sendPrivateWord(io, room, player) {
  if (!player.socketId) return;
  io.to(player.socketId).emit('you:word', {
    word: player.word,
    role: null, // role hidden until game ends
    round: room.round,
    theme: room.config.themeId,
  });
}

function broadcastReveal(io, room) {
  for (const p of room.players.values()) {
    if (p.word && p.alive) sendPrivateWord(io, room, p);
  }
}

function socketError(socket, code, message) {
  socket.emit('error:msg', { code, message });
}

function attach(io) {
  io.on('connection', (socket) => {
    let bound = null; // { roomCode, playerId }

    socket.on('theme:list', (cb) => {
      if (typeof cb === 'function') cb(themes.list());
    });

    socket.on('room:create', ({ nickname }, cb) => {
      const room = createRoom();
      const player = room.addPlayer(nickname, socket.id);
      socket.join(roomChannel(room.code));
      bound = { roomCode: room.code, playerId: player.id };
      if (typeof cb === 'function') {
        cb({
          ok: true,
          roomCode: room.code,
          playerId: player.id,
          token: player.token,
          state: room.publicState(),
          themes: themes.list(),
        });
      }
      emitRoomState(io, room);
    });

    socket.on('room:join', ({ roomCode, nickname, playerId, token }, cb) => {
      const room = getRoom(roomCode);
      if (!room) {
        if (typeof cb === 'function') cb({ ok: false, error: 'Room not found' });
        return;
      }
      let player = null;
      if (playerId && token) {
        player = room.rebind(playerId, token, socket.id);
        if (player && nickname && nickname.trim() && nickname.trim() !== player.nickname) {
          player.nickname = nickname.trim().slice(0, 20);
        }
      }
      if (!player) {
        if (room.phase !== 'lobby' && room.phase !== 'ended') {
          if (typeof cb === 'function') cb({ ok: false, error: 'Game already in progress' });
          return;
        }
        if (room.players.size >= 20) {
          if (typeof cb === 'function') cb({ ok: false, error: 'Room is full' });
          return;
        }
        player = room.addPlayer(nickname, socket.id);
      }
      socket.join(roomChannel(room.code));
      bound = { roomCode: room.code, playerId: player.id };
      if (typeof cb === 'function') {
        cb({
          ok: true,
          roomCode: room.code,
          playerId: player.id,
          token: player.token,
          state: room.publicState(),
          themes: themes.list(),
        });
      }
      // if game is mid-round, resend their private word
      if (player.word && player.alive && (room.phase === 'reveal' || room.phase === 'describe' || room.phase === 'vote' || room.phase === 'resolution')) {
        sendPrivateWord(io, room, player);
      }
      emitRoomState(io, room);
    });

    socket.on('room:leave', () => {
      if (!bound) return;
      const room = getRoom(bound.roomCode);
      if (!room) return;
      room.removePlayer(bound.playerId);
      socket.leave(roomChannel(bound.roomCode));
      if (room.players.size === 0) {
        deleteRoom(room.code);
      } else {
        emitRoomState(io, room);
      }
      bound = null;
    });

    socket.on('host:configure', ({ themeId, undercoverCount }, cb) => {
      if (!bound) return;
      const room = getRoom(bound.roomCode);
      if (!room) return;
      if (!room.isHost(bound.playerId)) {
        socketError(socket, 'not_host', 'Only the host can configure');
        return;
      }
      room.configure({ themeId, undercoverCount });
      if (typeof cb === 'function') cb({ ok: true });
      emitRoomState(io, room);
    });

    socket.on('host:startGame', (_, cb) => {
      if (!bound) return;
      const room = getRoom(bound.roomCode);
      if (!room) return;
      if (!room.isHost(bound.playerId)) {
        socketError(socket, 'not_host', 'Only the host can start');
        return;
      }
      const res = room.startGame();
      if (!res.ok) {
        if (typeof cb === 'function') cb(res);
        socketError(socket, 'cannot_start', res.reason);
        return;
      }
      // send private words
      broadcastReveal(io, room);
      // then move phase to describe after a brief moment so clients can display card
      emitRoomState(io, room);
      if (typeof cb === 'function') cb({ ok: true });
    });

    socket.on('host:startDescribing', (_, cb) => {
      if (!bound) return;
      const room = getRoom(bound.roomCode);
      if (!room) return;
      if (!room.isHost(bound.playerId)) return;
      const res = room.moveToDescribe();
      if (typeof cb === 'function') cb(res);
      emitRoomState(io, room);
    });

    socket.on('host:startVoting', (_, cb) => {
      if (!bound) return;
      const room = getRoom(bound.roomCode);
      if (!room) return;
      if (!room.isHost(bound.playerId)) return;
      const res = room.startVoting();
      if (typeof cb === 'function') cb(res);
      emitRoomState(io, room);
    });

    socket.on('vote:cast', ({ targetPlayerId }, cb) => {
      if (!bound) return;
      const room = getRoom(bound.roomCode);
      if (!room) return;
      const res = room.castVote(bound.playerId, targetPlayerId);
      if (typeof cb === 'function') cb(res);
      if (!res.ok) return;
      if (res.tally) {
        const outcome = room.tallyVotes();
        emitRoomState(io, room);
        if (outcome.tally === 'eliminated') {
          io.to(roomChannel(room.code)).emit('round:eliminated', outcome.elimination);
        } else if (outcome.tally === 'runoff') {
          io.to(roomChannel(room.code)).emit('vote:runoff', { candidates: outcome.tied });
        } else if (outcome.tally === 'ended') {
          io.to(roomChannel(room.code)).emit('game:ended', {
            winner: outcome.winner,
            reveal: room.reveal,
          });
        }
      } else {
        emitRoomState(io, room);
      }
    });

    socket.on('host:forceTally', (_, cb) => {
      if (!bound) return;
      const room = getRoom(bound.roomCode);
      if (!room) return;
      if (!room.isHost(bound.playerId)) return;
      const outcome = room.tallyVotes();
      emitRoomState(io, room);
      if (outcome.tally === 'eliminated') {
        io.to(roomChannel(room.code)).emit('round:eliminated', outcome.elimination);
      } else if (outcome.tally === 'runoff') {
        io.to(roomChannel(room.code)).emit('vote:runoff', { candidates: outcome.tied });
      } else if (outcome.tally === 'ended') {
        io.to(roomChannel(room.code)).emit('game:ended', {
          winner: outcome.winner,
          reveal: room.reveal,
        });
      }
      if (typeof cb === 'function') cb(outcome);
    });

    socket.on('host:nextRound', (_, cb) => {
      if (!bound) return;
      const room = getRoom(bound.roomCode);
      if (!room) return;
      if (!room.isHost(bound.playerId)) return;
      const res = room.nextRound();
      if (typeof cb === 'function') cb(res);
      emitRoomState(io, room);
    });

    socket.on('host:playAgain', (_, cb) => {
      if (!bound) return;
      const room = getRoom(bound.roomCode);
      if (!room) return;
      if (!room.isHost(bound.playerId)) return;
      const res = room.playAgain();
      if (typeof cb === 'function') cb(res);
      emitRoomState(io, room);
    });

    socket.on('host:kick', ({ playerId }, cb) => {
      if (!bound) return;
      const room = getRoom(bound.roomCode);
      if (!room) return;
      if (!room.isHost(bound.playerId)) return;
      if (playerId === bound.playerId) return;
      const target = room.players.get(playerId);
      if (!target) return;
      const targetSocketId = target.socketId;
      room.removePlayer(playerId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('room:kicked');
        const sock = io.sockets.sockets.get(targetSocketId);
        if (sock) sock.leave(roomChannel(room.code));
      }
      if (typeof cb === 'function') cb({ ok: true });
      emitRoomState(io, room);
    });

    socket.on('disconnect', () => {
      if (!bound) return;
      const room = getRoom(bound.roomCode);
      if (!room) return;
      const p = room.markDisconnected(socket.id);
      // If the room is in lobby and the disconnected player never played, drop them entirely.
      if (p && (room.phase === 'lobby' || room.phase === 'ended')) {
        room.removePlayer(p.id);
        if (room.players.size === 0) {
          deleteRoom(room.code);
          return;
        }
      }
      emitRoomState(io, room);
    });
  });
}

module.exports = { attach };
