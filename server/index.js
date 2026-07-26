const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const themes = require('./themes');
const socketHandlers = require('./socketHandlers');

const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true },
});

socketHandlers.attach(io);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, themes: themes.list().length });
});
app.get('/api/themes', (_req, res) => {
  res.json({ themes: themes.list() });
});

app.use(express.static(PUBLIC_DIR, { maxAge: '1h' }));

// SPA fallback — use a middleware (avoids path-to-regexp choking on Express 5-style patterns).
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'), (err) => {
    if (err) next();
  });
});

server.listen(PORT, () => {
  console.log(`[server] listening on ${PORT}`);
});
