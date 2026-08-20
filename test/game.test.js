import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
  teamOrder,
} from '../lib/game.js';

function roomWithPlayers() {
  const room = createRoom('ABCD', 'host-token');
  joinPlayer(room, 'p1', 'Ava', 'red');
  joinPlayer(room, 'p2', 'Ben', 'blue');
  joinPlayer(room, 'p3', 'Cara', 'green');
  joinPlayer(room, 'p4', 'Drew', 'yellow');
  return room;
}

describe('randomCode', () => {
  it('returns a 4-character code from the safe alphabet', () => {
    const code = randomCode();
    assert.match(code, /^[A-HJ-NP-Z2-9]{4}$/);
  });

  it('avoids codes that already exist', () => {
    const existing = new Set();
    for (let i = 0; i < 50; i += 1) {
      existing.add(randomCode(existing));
    }
    assert.equal(existing.size, 50);
  });
});

describe('joinPlayer', () => {
  it('adds a named student to a valid team', () => {
    const room = createRoom('ABCD', 'token');
    const result = joinPlayer(room, 'p1', '  Maya  ', 'red');
    assert.equal(result.ok, true);
    assert.equal(room.players.p1.name, 'Maya');
    assert.equal(room.players.p1.team, 'red');
  });

  it('rejects blank names and invalid colors', () => {
    const room = createRoom('ABCD', 'token');
    assert.equal(joinPlayer(room, 'p1', '   ', 'red').reason, 'name-required');
    assert.equal(joinPlayer(room, 'p1', 'Maya', 'purple').reason, 'invalid-team');
  });

  it('lets an already-joined student change team or name', () => {
    const room = createRoom('ABCD', 'token');
    joinPlayer(room, 'p1', 'Maya', 'red');
    const result = joinPlayer(room, 'p1', 'Maya M', 'blue');
    assert.equal(result.ok, true);
    assert.equal(room.players.p1.team, 'blue');
    assert.equal(room.players.p1.name, 'Maya M');
  });

  it('trims names to 24 characters', () => {
    const room = createRoom('ABCD', 'token');
    const result = joinPlayer(room, 'p1', 'A'.repeat(40), 'red');
    assert.equal(result.player.name.length, 24);
  });
});

describe('buzz', () => {
  it('ignores buzzes while the teacher has not opened the round', () => {
    const room = roomWithPlayers();
    const result = buzz(room, 'p1', 1000);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'standby');
    assert.equal(room.winner, null);
  });

  it('records the first press as the winning team', () => {
    const room = roomWithPlayers();
    setStatus(room, 'open');
    const first = buzz(room, 'p2', 1000);
    const late = buzz(room, 'p1', 1001);

    assert.equal(first.ok, true);
    assert.equal(first.first, true);
    assert.equal(room.status, 'locked');
    assert.equal(room.winner.team, 'blue');
    assert.equal(room.winner.name, 'Ben');
    assert.equal(late.first, false);
    assert.equal(room.winner.team, 'blue');
  });

  it('keeps the earliest team even when later teams also buzz', () => {
    const room = roomWithPlayers();
    setStatus(room, 'open');
    buzz(room, 'p4', 10);
    buzz(room, 'p1', 11);
    buzz(room, 'p3', 12);

    assert.equal(room.winner.team, 'yellow');
    assert.deepEqual(teamOrder(room).map((entry) => entry.team), [
      'yellow',
      'red',
      'green',
    ]);
  });

  it('only counts the first buzz from each team in the ranking', () => {
    const room = roomWithPlayers();
    joinPlayer(room, 'p5', 'Eli', 'red');
    setStatus(room, 'open');
    buzz(room, 'p1', 10);
    buzz(room, 'p5', 11);
    buzz(room, 'p2', 12);

    assert.deepEqual(teamOrder(room).map((entry) => entry.team), ['red', 'blue']);
    assert.equal(teamOrder(room)[0].name, 'Ava');
  });

  it('does not let the same student buzz twice in a round', () => {
    const room = roomWithPlayers();
    setStatus(room, 'open');
    buzz(room, 'p1', 10);
    const again = buzz(room, 'p1', 11);
    assert.equal(again.ok, false);
    assert.equal(again.reason, 'already-buzzed');
  });

  it('rejects buzzes from students who are not in the room', () => {
    const room = roomWithPlayers();
    setStatus(room, 'open');
    const result = buzz(room, 'ghost', 10);
    assert.equal(result.reason, 'not-in-room');
  });
});

describe('reset and host controls', () => {
  it('clears the winner so a new question can start', () => {
    const room = roomWithPlayers();
    setStatus(room, 'open');
    buzz(room, 'p1', 10);
    resetRound(room);
    assert.equal(room.winner, null);
    assert.equal(room.buzzes.length, 0);
    assert.equal(room.status, 'standby');
  });

  it('can reopen buzzers immediately on reset', () => {
    const room = roomWithPlayers();
    setStatus(room, 'open');
    buzz(room, 'p1', 10);
    resetRound(room, { open: true });
    const result = buzz(room, 'p2', 20);
    assert.equal(result.first, true);
    assert.equal(room.winner.team, 'blue');
  });

  it('opening a round clears any previous buzzes', () => {
    const room = roomWithPlayers();
    setStatus(room, 'open');
    buzz(room, 'p1', 10);
    setStatus(room, 'open');
    assert.equal(room.status, 'open');
    assert.equal(room.winner, null);
    assert.equal(room.buzzes.length, 0);
  });

  it('only the host token is treated as the teacher', () => {
    const room = createRoom('ABCD', 'secret');
    assert.equal(isHost(room, 'secret'), true);
    assert.equal(isHost(room, 'nope'), false);
    assert.equal(isHost(room, ''), false);
  });
});

describe('snapshot', () => {
  it('groups students by team without exposing the host token', () => {
    const room = roomWithPlayers();
    const state = snapshot(room);
    assert.equal(state.code, 'ABCD');
    assert.equal('hostToken' in state, false);
    assert.equal(state.teams.find((team) => team.id === 'red').members[0].name, 'Ava');
    assert.equal(state.players.length, 4);
  });

  it('removes a student who leaves', () => {
    const room = roomWithPlayers();
    assert.equal(removePlayer(room, 'p1'), true);
    assert.equal(snapshot(room).players.length, 3);
  });
});
