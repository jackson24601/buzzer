export const TEAMS = ['red', 'blue', 'green', 'yellow'];

export const TEAM_META = {
  red: { id: 'red', label: 'Red', hex: '#ef4444' },
  blue: { id: 'blue', label: 'Blue', hex: '#3b82f6' },
  green: { id: 'green', label: 'Green', hex: '#22c55e' },
  yellow: { id: 'yellow', label: 'Yellow', hex: '#eab308' },
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_NAME_LENGTH = 24;
const MAX_PLAYERS = 80;

export function createRoom(code, hostToken) {
  return {
    code,
    hostToken,
    players: {},
    status: 'standby',
    winner: null,
    buzzes: [],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };
}

export function randomCode(existing = new Set()) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    let code = '';
    for (let i = 0; i < 4; i += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!existing.has(code)) return code;
  }
  throw new Error('Could not allocate a room code');
}

export function normalizeName(name) {
  if (typeof name !== 'string') return '';
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

export function isValidTeam(team) {
  return TEAMS.includes(team);
}

export function joinPlayer(room, playerId, name, team) {
  if (!playerId) {
    return { ok: false, reason: 'missing-player' };
  }
  const cleanName = normalizeName(name);
  if (!cleanName) {
    return { ok: false, reason: 'name-required' };
  }
  if (!isValidTeam(team)) {
    return { ok: false, reason: 'invalid-team' };
  }
  const alreadyInRoom = Boolean(room.players[playerId]);
  if (!alreadyInRoom && Object.keys(room.players).length >= MAX_PLAYERS) {
    return { ok: false, reason: 'room-full' };
  }

  room.players[playerId] = { id: playerId, name: cleanName, team };
  touch(room);
  return { ok: true, player: room.players[playerId] };
}

export function removePlayer(room, playerId) {
  if (!room.players[playerId]) return false;
  delete room.players[playerId];
  touch(room);
  return true;
}

export function setStatus(room, status) {
  if (!['standby', 'open'].includes(status)) {
    return { ok: false, reason: 'invalid-status' };
  }
  if (status === 'open') {
    room.status = 'open';
    room.winner = null;
    room.buzzes = [];
  } else {
    room.status = 'standby';
    room.winner = null;
    room.buzzes = [];
  }
  touch(room);
  return { ok: true };
}

export function resetRound(room, { open = false } = {}) {
  room.winner = null;
  room.buzzes = [];
  room.status = open ? 'open' : 'standby';
  touch(room);
  return { ok: true };
}

export function buzz(room, playerId, at = Date.now()) {
  const player = room.players[playerId];
  if (!player) {
    return { ok: false, reason: 'not-in-room' };
  }
  if (room.status === 'standby') {
    return { ok: false, reason: 'standby' };
  }
  if (room.buzzes.some((entry) => entry.playerId === playerId)) {
    return { ok: false, reason: 'already-buzzed' };
  }

  const entry = {
    playerId,
    name: player.name,
    team: player.team,
    at,
  };

  if (room.status === 'open') {
    room.status = 'locked';
    room.winner = entry;
    room.buzzes.push(entry);
    touch(room);
    return { ok: true, first: true, winner: entry };
  }

  room.buzzes.push(entry);
  touch(room);
  return {
    ok: true,
    first: false,
    winner: room.winner,
  };
}

export function teamOrder(room) {
  const seen = new Set();
  const order = [];
  for (const entry of room.buzzes) {
    if (seen.has(entry.team)) continue;
    seen.add(entry.team);
    order.push({
      team: entry.team,
      name: entry.name,
      at: entry.at,
    });
  }
  return order;
}

export function snapshot(room) {
  const players = Object.values(room.players).map((player) => ({
    id: player.id,
    name: player.name,
    team: player.team,
  }));

  return {
    code: room.code,
    status: room.status,
    winner: room.winner,
    buzzes: room.buzzes,
    teamOrder: teamOrder(room),
    players,
    teams: TEAMS.map((team) => ({
      id: team,
      label: TEAM_META[team].label,
      members: players.filter((player) => player.team === team),
    })),
  };
}

export function isHost(room, token) {
  return Boolean(token) && token === room.hostToken;
}

function touch(room) {
  room.lastActivityAt = Date.now();
}
