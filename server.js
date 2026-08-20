import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import QRCode from 'qrcode';
import { Server } from 'socket.io';
import {
  buzz,
  createRoom,
  isHost,
  joinPlayer,
  randomCode,
  removePlayer,
  resetRound,
  setStatus,
  snapshot,
} from './lib/game.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const ROOM_TTL_MS = 1000 * 60 * 60 * 4;

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const rooms = new Map();

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function existingCodes() {
  return new Set(rooms.keys());
}

function getRoom(code) {
  if (typeof code !== 'string') return null;
  return rooms.get(code.trim().toUpperCase()) || null;
}

function emitState(room) {
  io.to(room.code).emit('state', snapshot(room));
}

function publicOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/rooms', (_req, res) => {
  const code = randomCode(existingCodes());
  const hostToken = crypto.randomUUID();
  const room = createRoom(code, hostToken);
  rooms.set(code, room);
  res.json({ code, hostToken });
});

app.get('/api/rooms/:code', (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json(snapshot(room));
});

app.get('/api/qr/:code', async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(code)) {
    res.status(400).type('text').send('Invalid room code');
    return;
  }
  const joinUrl = `${publicOrigin(req)}/?room=${encodeURIComponent(code)}`;
  try {
    const png = await QRCode.toBuffer(joinUrl, {
      width: 360,
      margin: 1,
      color: { dark: '#0b1020', light: '#ffffff' },
    });
    res.setHeader('Cache-Control', 'no-store');
    res.type('png').send(png);
  } catch (error) {
    res.status(500).type('text').send(error.message);
  }
});

io.on('connection', (socket) => {
  socket.data.role = null;
  socket.data.roomCode = null;

  socket.on('host:join', ({ code, token } = {}, ack) => {
    const room = getRoom(code);
    if (!room) return ack?.({ ok: false, reason: 'not-found' });
    if (!isHost(room, token)) return ack?.({ ok: false, reason: 'unauthorized' });

    socket.data.role = 'host';
    socket.data.roomCode = room.code;
    socket.join(room.code);
    ack?.({ ok: true, state: snapshot(room) });
  });

  socket.on('player:join', ({ code, name, team } = {}, ack) => {
    const room = getRoom(code);
    if (!room) return ack?.({ ok: false, reason: 'not-found' });

    const result = joinPlayer(room, socket.id, name, team);
    if (!result.ok) return ack?.(result);

    socket.data.role = 'player';
    socket.data.roomCode = room.code;
    socket.join(room.code);
    emitState(room);
    ack?.({ ok: true, player: result.player, state: snapshot(room) });
  });

  socket.on('player:buzz', (ack) => {
    const room = getRoom(socket.data.roomCode);
    if (!room || socket.data.role !== 'player') {
      return ack?.({ ok: false, reason: 'not-in-room' });
    }
    const result = buzz(room, socket.id);
    if (result.ok) emitState(room);
    ack?.(result);
  });

  socket.on('host:open', ({ token } = {}, ack) => {
    const room = getRoom(socket.data.roomCode);
    if (!room || !isHost(room, token)) return ack?.({ ok: false, reason: 'unauthorized' });
    const result = setStatus(room, 'open');
    emitState(room);
    ack?.(result);
  });

  socket.on('host:standby', ({ token } = {}, ack) => {
    const room = getRoom(socket.data.roomCode);
    if (!room || !isHost(room, token)) return ack?.({ ok: false, reason: 'unauthorized' });
    const result = setStatus(room, 'standby');
    emitState(room);
    ack?.(result);
  });

  socket.on('host:reset', ({ token, open } = {}, ack) => {
    const room = getRoom(socket.data.roomCode);
    if (!room || !isHost(room, token)) return ack?.({ ok: false, reason: 'unauthorized' });
    const result = resetRound(room, { open: Boolean(open) });
    emitState(room);
    ack?.(result);
  });

  socket.on('disconnect', () => {
    const room = getRoom(socket.data.roomCode);
    if (!room || socket.data.role !== 'player') return;
    removePlayer(room, socket.id);
    emitState(room);
  });
});

setInterval(() => {
  const cutoff = Date.now() - ROOM_TTL_MS;
  for (const [code, room] of rooms) {
    if (room.lastActivityAt < cutoff) rooms.delete(code);
  }
}, 60_000).unref();

export { app, server, io };

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  server.listen(PORT, () => {
    console.log(`Classroom buzzer ready on http://localhost:${PORT}`);
  });
}
