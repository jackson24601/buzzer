import {
  buzz,
  createRoom,
  isHost,
  joinPlayer,
  removePlayer,
  resetRound,
  setStatus,
  snapshot,
} from './game.js';

export function createSession(code, hostToken) {
  const room = createRoom(code, hostToken);

  return {
    getState() {
      return snapshot(room);
    },
    join(playerId, name, team) {
      const result = joinPlayer(room, playerId, name, team);
      return { ...result, state: snapshot(room) };
    },
    leave(playerId) {
      removePlayer(room, playerId);
      return snapshot(room);
    },
    buzz(playerId) {
      const result = buzz(room, playerId);
      return { ...result, state: snapshot(room) };
    },
    open(token) {
      if (!isHost(room, token)) return { ok: false, reason: 'unauthorized', state: snapshot(room) };
      return { ...setStatus(room, 'open'), state: snapshot(room) };
    },
    standby(token) {
      if (!isHost(room, token)) return { ok: false, reason: 'unauthorized', state: snapshot(room) };
      return { ...setStatus(room, 'standby'), state: snapshot(room) };
    },
    reset(token, open = false) {
      if (!isHost(room, token)) return { ok: false, reason: 'unauthorized', state: snapshot(room) };
      return { ...resetRound(room, { open }), state: snapshot(room) };
    },
  };
}
