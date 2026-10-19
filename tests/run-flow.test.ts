import assert from 'node:assert/strict';
import test from 'node:test';

import {
  afterDeath,
  anotherChanceOptions,
  MISSION_FAILED_ACTIONS,
  missionFailedNavigation,
  resolveAnotherChance,
  type FlowState,
} from '../src/core/run-flow.ts';

const chance: FlowState = { screen: 'another_chance', reason: 'hearts' };

test('time-out skips Another chance and goes straight to Mission Failed', () => {
  assert.deepEqual(afterDeath('time'), { screen: 'mission_failed', reason: 'time' });
});

test('zero hearts and pits offer Another chance', () => {
  assert.deepEqual(afterDeath('hearts'), { screen: 'another_chance', reason: 'hearts' });
  assert.deepEqual(afterDeath('pit'), { screen: 'another_chance', reason: 'pit' });
});

test('"No, thanks" leads to the same Mission Failed popup', () => {
  for (const reason of ['hearts', 'pit'] as const) {
    const r = resolveAnotherChance({ screen: 'another_chance', reason }, { kind: 'no_thanks' }, 3);
    assert.deepEqual(r.flow, { screen: 'mission_failed', reason });
    assert.equal(r.storedHearts, 3, 'no heart spent');
    assert.equal(r.respawn, false);
  }
});

test('"Use" is greyed out without a stored heart and spends one when available', () => {
  assert.equal(anotherChanceOptions(0, true).useEnabled, false);
  assert.equal(anotherChanceOptions(1, false).useEnabled, true);
  const none = resolveAnotherChance(chance, { kind: 'use' }, 0);
  assert.deepEqual(none.flow, chance);
  assert.equal(none.respawn, false);
  const used = resolveAnotherChance(chance, { kind: 'use' }, 2);
  assert.deepEqual(used.flow, { screen: 'playing' });
  assert.equal(used.storedHearts, 1);
  assert.equal(used.respawn, true);
});

test('the rewarded "+1 heart" continues only when the reward was earned', () => {
  assert.equal(anotherChanceOptions(0, false).rewardedEnabled, false);
  assert.equal(anotherChanceOptions(0, true).rewardedEnabled, true);
  const skipped = resolveAnotherChance(chance, { kind: 'rewarded', earned: false }, 0);
  assert.deepEqual(skipped.flow, chance);
  assert.equal(skipped.respawn, false);
  const earned = resolveAnotherChance(chance, { kind: 'rewarded', earned: true }, 0);
  assert.deepEqual(earned.flow, { screen: 'playing' });
  assert.equal(earned.storedHearts, 0, 'a rewarded heart does not touch the bank');
  assert.equal(earned.respawn, true);
});

test('choices outside Another chance do nothing', () => {
  const failed: FlowState = { screen: 'mission_failed', reason: 'time' };
  assert.deepEqual(resolveAnotherChance(failed, { kind: 'use' }, 5), { flow: failed, storedHearts: 5, respawn: false });
});

test('Mission Failed offers Replay, Map and Home (no Shop yet)', () => {
  assert.deepEqual([...MISSION_FAILED_ACTIONS], ['replay', 'map', 'home']);
  assert.deepEqual(missionFailedNavigation('replay'), { kind: 'restart_level' });
  assert.deepEqual(missionFailedNavigation('map'), { kind: 'route', to: '/map' });
  assert.deepEqual(missionFailedNavigation('home'), { kind: 'route', to: '/' });
});

test('full flows: time-out and no-thanks end on the same popup', () => {
  const timeout = afterDeath('time');
  const pit = resolveAnotherChance(afterDeath('pit'), { kind: 'no_thanks' }, 0).flow;
  assert.equal(timeout.screen, 'mission_failed');
  assert.equal(pit.screen, 'mission_failed');
});
