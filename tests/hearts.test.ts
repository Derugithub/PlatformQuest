import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyHit,
  bankExtraLife,
  canUseStoredHeart,
  collectHeart,
  collectToolBox,
  continueHearts,
  MAX_HEARTS,
  MAX_STORED_HEARTS,
  spendStoredHeart,
  START_HEARTS,
  startHearts,
} from '../src/core/hearts.ts';

test('a level starts with 2 hearts, small form', () => {
  assert.equal(START_HEARTS, 2);
  assert.deepEqual(startHearts(), { hearts: 2, form: 'small' });
});

test('hits cost a heart and the tool suit; zero hearts is a death', () => {
  const tool = collectToolBox(startHearts());
  assert.equal(tool.form, 'tool');
  const hit = applyHit(tool);
  assert.deepEqual(hit, { state: { hearts: 1, form: 'small' }, dead: false });
  assert.equal(applyHit(hit.state).dead, true);
});

test('red hearts add up to 5, then score instead', () => {
  let s = startHearts();
  for (let i = 0; i < 10; i++) s = collectHeart(s).state;
  assert.equal(s.hearts, MAX_HEARTS);
  assert.equal(collectHeart(s).added, false);
});

test('golden extra-life hearts are banked up to the cap and spent on Use', () => {
  let stored = 0;
  assert.equal(canUseStoredHeart(stored), false);
  assert.throws(() => spendStoredHeart(0));
  for (let i = 0; i < 20; i++) stored = bankExtraLife(stored);
  assert.equal(stored, MAX_STORED_HEARTS);
  assert.equal(spendStoredHeart(stored), MAX_STORED_HEARTS - 1);
  assert.deepEqual(continueHearts(), { hearts: 1, form: 'small' });
});
