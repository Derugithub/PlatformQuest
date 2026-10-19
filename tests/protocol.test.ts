import assert from 'node:assert/strict';
import test from 'node:test';

import { parseGameMessage, parseHostMessage, TIP_TEXT } from '../src/core/protocol.ts';

const hud = { hearts: 2, coins: 3, score: 100, time: 250, hurry: false, progress: 0.4, form: 'small', star: false, boss: null };

test('game messages are validated', () => {
  assert.deepEqual(parseGameMessage('{"type":"ready"}'), { type: 'ready' });
  assert.deepEqual(parseGameMessage(JSON.stringify({ type: 'hud', hud })), { type: 'hud', hud });
  assert.deepEqual(parseGameMessage({ type: 'died', reason: 'time' }), { type: 'died', reason: 'time' });
  assert.equal(parseGameMessage(JSON.stringify({ type: 'died', reason: 'boredom' })), null);
  assert.equal(parseGameMessage(JSON.stringify({ type: 'hud', hud: { ...hud, hearts: 'two' } })), null);
  assert.equal(parseGameMessage('garbage'), null);
  assert.equal(parseGameMessage(JSON.stringify({ type: 'levelComplete', summary: { level: '7-7' } })), null);
  const summary = { level: '1-2', coins: 5, score: 900, timeSeconds: 70, enemiesDefeated: 3, enemiesTotal: 4 };
  assert.deepEqual(parseGameMessage(JSON.stringify({ type: 'levelComplete', summary })), { type: 'levelComplete', summary });
});

test('host messages are validated', () => {
  const start = { type: 'start', level: '1-1', audio: { music: true, sound: false }, tips: ['move'], insets: { left: 0, right: 0, top: 0, bottom: 0 } };
  assert.deepEqual(parseHostMessage(JSON.stringify(start)), start);
  assert.equal(parseHostMessage(JSON.stringify({ ...start, level: 'x' })), null);
  assert.deepEqual(parseHostMessage('{"type":"grantHeart"}'), { type: 'grantHeart' });
  assert.equal(parseHostMessage('{"type":"hack"}'), null);
});

test('every tutorial has text', () => {
  for (const id of ['move', 'jump', 'run', 'spin', 'grab', 'walljump'] as const) {
    assert.ok(TIP_TEXT[id].title.length > 0 && TIP_TEXT[id].body.length > 0);
  }
});
