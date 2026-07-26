import { io } from 'socket.io-client';

// Reuse a single socket across the app.
const socket = io({
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

export default socket;
