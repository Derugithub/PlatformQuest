import assert from 'node:assert/strict';
import test from 'node:test';

import { countableEnemies, LEVEL_IDS, nextLevelId, parseLevel, type LevelDef } from '../src/core/level-format.ts';
import { validateLevel } from '../src/core/level-validate.ts';
import { getLevel, ZONE_1 } from '../src/core/levels/index.ts';
import { ROWS } from '../src/core/physics.ts';

test('zone 1 has five levels in order, ending with the boss', () => {
  assert.deepEqual(ZONE_1.map((l) => l.id), [...LEVEL_IDS]);
  assert.equal(nextLevelId('1-4'), '1-5');
  assert.equal(nextLevelId('1-5'), null);
  const boss = parseLevel(getLevel('1-5'));
  assert.equal(boss.enemies.filter((e) => e.kind === 'boss').length, 1);
  assert.equal(getLevel('1-5').music, 'boss');
  assert.equal(getLevel('1-5').timeLimit, 180);
  for (const id of ['1-1', '1-2', '1-3', '1-4'] as const) assert.equal(getLevel(id).timeLimit, 300);
});

for (const def of ZONE_1) {
  test(`${def.id} "${def.name}" is valid: start, goal and every checkpoint reachable, small and tall`, () => {
    const report = validateLevel(def);
    assert.deepEqual(report.errors, []);
    assert.ok(report.level);
    assert.equal(report.level.rows.length, ROWS);
  });
}

test('every regular level has a checkpoint flag, a hidden extra-life heart and coins', () => {
  for (const id of ['1-1', '1-2', '1-3', '1-4'] as const) {
    const level = parseLevel(getLevel(id));
    assert.ok(level.checkpoints.length >= 1, `${id} checkpoint`);
    assert.ok(level.rows.some((r) => r.includes('h')), `${id} hidden heart block`);
    assert.ok(level.coins.length >= 10, `${id} coins`);
  }
});

test('difficulty grows: more monsters and new enemy kinds later in the zone', () => {
  const counts = (['1-1', '1-2', '1-3', '1-4'] as const).map((id) => countableEnemies(parseLevel(getLevel(id))));
  assert.ok(counts[3] > counts[0], `enemy counts ${counts.join(',')}`);
  const kinds = (id: '1-1' | '1-3') => new Set(parseLevel(getLevel(id)).enemies.map((e) => e.kind));
  assert.ok(kinds('1-3').has('monkey'));
  assert.ok(!kinds('1-1').has('monkey'));
});

test('tutorials live in 1-1 and 1-2 and cover every move', () => {
  const tips = [...getLevel('1-1').tutorials, ...getLevel('1-2').tutorials].map((t) => t.id).sort();
  assert.deepEqual(tips, ['grab', 'jump', 'move', 'run', 'spin', 'walljump']);
  for (const id of ['1-3', '1-4', '1-5'] as const) assert.equal(getLevel(id).tutorials.length, 0);
});

const flat = (row: string) => Array.from({ length: ROWS }, (_, r) => (r === 12 ? row : r >= 13 ? '#'.repeat(row.length) : '.'.repeat(row.length)));

function testLevel(segments: string[][]): LevelDef {
  return { id: '1-1', name: 'test', timeLimit: 100, targetSeconds: 50, music: 'hill', segments, tutorials: [] };
}

test('the validator rejects an impossible pit', () => {
  const pit = Array.from({ length: ROWS }, () => '.'.repeat(14));
  const ok = validateLevel(testLevel([flat('..@.....'), flat('......G.')]));
  assert.deepEqual(ok.errors, []);
  const bad = validateLevel(testLevel([flat('..@.....'), pit, flat('......G.')]));
  assert.ok(bad.errors.some((e) => e.includes('goal is not reachable')), bad.errors.join('; '));
});

test('the validator rejects an unreachable checkpoint and a floating goal', () => {
  const tall = Array.from({ length: ROWS }, (_, r) => (r >= 2 ? '#'.repeat(8) : '.'.repeat(8)));
  const report = validateLevel(testLevel([flat('..@..F..'), tall, flat('.....G..')]));
  assert.ok(report.errors.some((e) => e.includes('not reachable')), report.errors.join('; '));
  const floating = flat('..@.....').map((r, i) => (i === 5 ? '....G...' : r));
  assert.ok(validateLevel(testLevel([floating])).errors.some((e) => e.includes('goal is not on solid ground')));
});
