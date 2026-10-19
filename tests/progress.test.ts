import assert from 'node:assert/strict';
import test from 'node:test';

import {
  defaultProgress,
  defaultSettings,
  isUnlocked,
  markTutorialSeen,
  migrateProgress,
  parseProgress,
  parseSettings,
  recordLevelResult,
  setStoredHearts,
  STORAGE_KEYS,
} from '../src/core/progress.ts';

test('storage keys are versioned under platformquest.*.v1', () => {
  for (const key of Object.values(STORAGE_KEYS)) assert.match(key, /^platformquest\.[a-z]+\.v1$/);
});

test('missing or corrupt saves fall back to defaults', () => {
  assert.deepEqual(parseProgress(null), defaultProgress());
  assert.deepEqual(parseProgress('{not json'), defaultProgress());
  assert.deepEqual(parseProgress('[1,2]'), defaultProgress());
  assert.deepEqual(parseSettings('null'), defaultSettings());
  assert.deepEqual(defaultProgress().unlocked, ['1-1']);
});

test('migration keeps valid fields, repairs bad ones and drops unknown ones', () => {
  const p = migrateProgress({
    schema: 0,
    levels: { '1-1': { completed: true, stars: [false, true, 'x'], bestScore: 1234.7, bestTimeSeconds: 88 }, '9-9': {} },
    unlocked: ['1-1', 'nope'],
    totalCoins: -5,
    storedHearts: 99,
    tutorialsSeen: ['move', 'fly'],
    extra: true,
  });
  assert.deepEqual(p.levels['1-1'], { completed: true, stars: [true, true, false], bestScore: 1234, bestTimeSeconds: 88 });
  assert.deepEqual(p.unlocked, ['1-1', '1-2'], 'completing 1-1 unlocks 1-2');
  assert.equal(p.totalCoins, 0);
  assert.equal(p.storedHearts, 9, 'stored hearts are capped');
  assert.deepEqual(p.tutorialsSeen, ['move']);
  assert.equal('extra' in p, false);
  assert.equal(p.schema, 1);
});

test('settings migrate with defaults for missing toggles', () => {
  assert.deepEqual(parseSettings('{"music":false}'), { schema: 1, music: false, sound: true, tips: true });
});

test('a finished level keeps best results and unlocks the next one', () => {
  let p = defaultProgress();
  p = recordLevelResult(p, { level: '1-1', stars: [true, false, true], score: 5000, coins: 40, timeSeconds: 100 });
  p = recordLevelResult(p, { level: '1-1', stars: [true, true, false], score: 3000, coins: 10, timeSeconds: 130 });
  assert.deepEqual(p.levels['1-1'], { completed: true, stars: [true, true, true], bestScore: 5000, bestTimeSeconds: 100 });
  assert.equal(p.totalCoins, 50);
  assert.ok(isUnlocked(p, '1-2'));
  assert.ok(!isUnlocked(p, '1-3'));
  const round = parseProgress(JSON.stringify(p));
  assert.deepEqual(round, p, 'save round-trips');
});

test('tutorials and stored hearts', () => {
  let p = markTutorialSeen(defaultProgress(), 'jump');
  assert.equal(markTutorialSeen(p, 'jump'), p);
  p = setStoredHearts(p, -3);
  assert.equal(p.storedHearts, 0);
  assert.equal(setStoredHearts(p, 4.6).storedHearts, 4);
});
