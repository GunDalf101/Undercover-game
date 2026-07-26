const { Room } = require('./room');
const { generateUniqueCode } = require('./codes');

const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;    // 5 minutes

const rooms = new Map();

function createRoom() {
  const code = generateUniqueCode((c) => rooms.has(c), 6);
  const room = new Room(code);
  rooms.set(code, room);
  return room;
}

function getRoom(code) {
  return rooms.get((code || '').toUpperCase()) || null;
}

function deleteRoom(code) {
  rooms.delete(code);
}

function sweepIdle() {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActivity > IDLE_TIMEOUT_MS) {
      rooms.delete(code);
      console.log(`[rooms] swept idle room ${code}`);
    }
  }
}

setInterval(sweepIdle, SWEEP_INTERVAL_MS).unref();

module.exports = { createRoom, getRoom, deleteRoom, rooms };
