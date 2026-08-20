import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../lib/session.js';

describe('host session', () => {
  it('lets four teams join and locks the first buzz', () => {
    const session = createSession('ABCD', 'secret');
    assert.equal(session.getState().status, 'standby');

    for (const [id, name, team] of [
      ['p1', 'Ava', 'red'],
      ['p2', 'Ben', 'blue'],
      ['p3', 'Cara', 'green'],
      ['p4', 'Drew', 'yellow'],
    ]) {
      assert.equal(session.join(id, name, team).ok, true);
    }

    assert.equal(session.buzz('p1').reason, 'standby');
    assert.equal(session.open('nope').reason, 'unauthorized');
    assert.equal(session.open('secret').ok, true);

    const first = session.buzz('p3');
    const late = session.buzz('p1');
    assert.equal(first.first, true);
    assert.equal(first.winner.team, 'green');
    assert.equal(late.first, false);
    assert.equal(session.getState().winner.team, 'green');

    assert.equal(session.reset('secret').ok, true);
    assert.equal(session.getState().status, 'standby');
    assert.equal(session.getState().winner, null);

    session.open('secret');
    const next = session.buzz('p4');
    assert.equal(next.winner.team, 'yellow');
  });

  it('removes a student who leaves', () => {
    const session = createSession('ABCD', 'secret');
    session.join('p1', 'Ava', 'red');
    session.leave('p1');
    assert.equal(session.getState().players.length, 0);
  });
});
