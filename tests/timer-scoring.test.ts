import assert from 'node:assert/strict';
import test from 'node:test';

import { chainPoints, mergeStars, POINTS, scoreStars, starCount, timeBonus } from '../src/core/scoring.ts';
import {
  CONTINUE_MIN_SECONDS,
  displaySeconds,
  elapsedSeconds,
  formatClock,
  HURRY_TEMPO,
  hurryFlashOn,
  isHurry,
  musicTempo,
  startTimer,
  tickTimer,
  timerAfterContinue,
} from '../src/core/timer.ts';

test('the countdown fires hurry under 100 s, then timeout at 0', () => {
  let t = startTimer(300);
  let events: string[] = [];
  for (let i = 0; i < 199; i++) {
    const step = tickTimer(t, 1);
    events = events.concat(step.events);
    t = step.state;
  }
  assert.deepEqual(events, []);
  const hurry = tickTimer(t, 1.5);
  assert.deepEqual(hurry.events, ['hurry']);
  assert.ok(isHurry(hurry.state));
  assert.equal(musicTempo(hurry.state), HURRY_TEMPO);
  const end = tickTimer(hurry.state, 1000);
  assert.deepEqual(end.events, ['timeout']);
  assert.equal(displaySeconds(end.state), 0);
  assert.deepEqual(tickTimer(end.state, 1).events, [], 'timeout fires once');
});

test('the HUD flashes while hurrying and shows whole seconds', () => {
  assert.equal(hurryFlashOn({ limit: 300, remaining: 150.7 }), false);
  assert.equal(hurryFlashOn({ limit: 300, remaining: 50.7 }), true);
  assert.equal(hurryFlashOn({ limit: 300, remaining: 50.2 }), false);
  assert.equal(displaySeconds({ limit: 300, remaining: 99.2 }), 100);
  assert.equal(formatClock(185), '3:05');
  assert.equal(elapsedSeconds({ limit: 300, remaining: 120 }), 180);
});

test('a continue keeps the clock but grants a minimum', () => {
  assert.equal(timerAfterContinue({ limit: 300, remaining: 10 }).remaining, CONTINUE_MIN_SECONDS);
  assert.equal(timerAfterContinue({ limit: 300, remaining: 200 }).remaining, 200);
  assert.equal(timerAfterContinue({ limit: 40, remaining: 10 }).remaining, 40);
});

test('three stars: finish, defeat all monsters, beat the target time', () => {
  const base = { finished: true, enemiesDefeated: 10, enemiesTotal: 10, elapsedSeconds: 90, targetSeconds: 120 };
  assert.deepEqual(scoreStars(base), [true, true, true]);
  assert.deepEqual(scoreStars({ ...base, enemiesDefeated: 9 }), [true, false, true]);
  assert.deepEqual(scoreStars({ ...base, elapsedSeconds: 121 }), [true, true, false]);
  assert.deepEqual(scoreStars({ ...base, finished: false }), [false, false, false]);
  assert.equal(starCount([true, false, true]), 2);
  assert.deepEqual(mergeStars([true, true, false], [true, false, true]), [true, true, true]);
});

test('score helpers', () => {
  assert.equal(chainPoints(POINTS.stomp, 0), POINTS.stomp);
  assert.equal(chainPoints(POINTS.stomp, 2), POINTS.stomp * 4);
  assert.equal(chainPoints(POINTS.stomp, 10), POINTS.stomp * 8);
  assert.equal(timeBonus(12.9), 12 * POINTS.timeBonusPerSecond);
});
