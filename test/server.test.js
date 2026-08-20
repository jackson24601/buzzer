import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { io as ioc } from 'socket.io-client';
import { server } from '../server.js';

let baseUrl;

function connect() {
  return ioc(baseUrl, { transports: ['websocket'], forceNew: true });
}

function connected(socket) {
  return new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
}

function emit(socket, event, payload) {
  return new Promise((resolve) => {
    if (arguments.length === 2) socket.emit(event, resolve);
    else socket.emit(event, payload, resolve);
  });
}

describe('classroom buzzer server', () => {
  before(async () => {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('creates a room and serves a join QR code', async () => {
    const created = await fetch(`${baseUrl}/api/rooms`, { method: 'POST' });
    assert.equal(created.ok, true);
    const room = await created.json();
    assert.match(room.code, /^[A-HJ-NP-Z2-9]{4}$/);
    assert.equal(typeof room.hostToken, 'string');

    const snapshot = await fetch(`${baseUrl}/api/rooms/${room.code}`);
    assert.equal(snapshot.ok, true);
    const body = await snapshot.json();
    assert.equal(body.status, 'standby');
    assert.equal('hostToken' in body, false);

    const qr = await fetch(`${baseUrl}/api/qr/${room.code}`);
    assert.equal(qr.ok, true);
    assert.equal(qr.headers.get('content-type'), 'image/png');
  });

  it('locks in the first of four teams and resets for the next question', async () => {
    const created = await fetch(`${baseUrl}/api/rooms`, { method: 'POST' });
    const room = await created.json();

    const host = connect();
    const red = connect();
    const blue = connect();
    const green = connect();
    const yellow = connect();
    const sockets = [host, red, blue, green, yellow];

    try {
      await Promise.all(sockets.map(connected));

      const hostJoin = await emit(host, 'host:join', { code: room.code, token: room.hostToken });
      assert.equal(hostJoin.ok, true);

      const joined = await Promise.all([
        emit(red, 'player:join', { code: room.code, name: 'Ava', team: 'red' }),
        emit(blue, 'player:join', { code: room.code, name: 'Ben', team: 'blue' }),
        emit(green, 'player:join', { code: room.code, name: 'Cara', team: 'green' }),
        emit(yellow, 'player:join', { code: room.code, name: 'Drew', team: 'yellow' }),
      ]);
      assert.ok(joined.every((result) => result.ok));

      const beforeOpen = await emit(red, 'player:buzz');
      assert.equal(beforeOpen.reason, 'standby');

      const opened = await emit(host, 'host:open', { token: room.hostToken });
      assert.equal(opened.ok, true);

      const first = await emit(green, 'player:buzz');
      const late = await emit(red, 'player:buzz');
      assert.equal(first.first, true);
      assert.equal(first.winner.team, 'green');
      assert.equal(late.first, false);
      assert.equal(late.winner.team, 'green');

      const spoofed = await emit(red, 'host:reset', { token: 'nope' });
      assert.equal(spoofed.ok, false);

      const reset = await emit(host, 'host:reset', { token: room.hostToken, open: true });
      assert.equal(reset.ok, true);
      const secondRound = await emit(yellow, 'player:buzz');
      assert.equal(secondRound.first, true);
      assert.equal(secondRound.winner.team, 'yellow');
    } finally {
      for (const sock of sockets) sock.close();
    }
  });
});
