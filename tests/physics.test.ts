import assert from 'node:assert/strict';
import test from 'node:test';

import {
  airTime,
  apexHeight,
  approach,
  canWallCling,
  clampFall,
  cutJump,
  gravityFor,
  isStomp,
  jumpDistanceTiles,
  jumpLaunch,
  launchSpeed,
  PHYS,
  stepHorizontal,
  TILE,
  topSpeed,
} from '../src/core/physics.ts';

test('launch speed and apex height are inverse', () => {
  for (const tiles of [1, 2.4, 4.2, 7.5]) {
    assert.ok(Math.abs(apexHeight(launchSpeed(tiles * TILE)) - tiles * TILE) < 1e-6);
  }
  assert.ok(airTime(launchSpeed(TILE)) > 0);
});

test('a standing jump clears four tiles, a running jump goes higher and further', () => {
  const stand = apexHeight(jumpLaunch('normal', 0)) / TILE;
  const run = apexHeight(jumpLaunch('normal', PHYS.runSpeed)) / TILE;
  assert.ok(stand >= 4 && stand < 4.5, `standing apex ${stand}`);
  assert.ok(run > stand);
  assert.ok(jumpDistanceTiles('normal', PHYS.runSpeed) > jumpDistanceTiles('normal', PHYS.walkSpeed));
  assert.ok(jumpDistanceTiles('normal', PHYS.runSpeed) >= 6, 'running jump crosses a wide pit');
});

test('spin, tire, stomp and wall jumps have their own heights', () => {
  const h = (k: Parameters<typeof jumpLaunch>[0]) => apexHeight(jumpLaunch(k, 0));
  assert.ok(h('spin') > h('normal'));
  assert.ok(h('tire') > h('spin'));
  assert.ok(h('stomp') < h('normal'));
  assert.ok(h('wall') < h('normal'));
  assert.ok(gravityFor(-100, PHYS.spinHangMs) < PHYS.gravity, 'spin jump hangs near the apex');
  assert.equal(gravityFor(-800, PHYS.spinHangMs), PHYS.gravity);
  assert.equal(gravityFor(-100, 0), PHYS.gravity);
});

test('releasing jump early cuts the rise once (variable jump)', () => {
  assert.equal(cutJump(-1000, true), -1000);
  assert.equal(cutJump(-1000, false), -1000 * PHYS.jumpCutFactor);
  assert.equal(cutJump(200, false), 200, 'no effect while falling');
});

test('momentum: acceleration ramps to top speed, run is faster, star is fastest', () => {
  assert.ok(topSpeed({ run: true, star: false }) > topSpeed({ run: false, star: false }));
  assert.ok(topSpeed({ run: true, star: true }) > topSpeed({ run: true, star: false }));
  let vx = 0;
  const input = { dir: 1 as const, run: false, star: false, onGround: true, ducking: false };
  vx = stepHorizontal(vx, input, 1 / 60);
  assert.ok(vx > 0 && vx < PHYS.walkSpeed, 'one frame does not reach top speed');
  for (let i = 0; i < 120; i++) vx = stepHorizontal(vx, input, 1 / 60);
  assert.ok(Math.abs(vx - PHYS.walkSpeed) < 1);
  for (let i = 0; i < 120; i++) vx = stepHorizontal(vx, { ...input, dir: 0 }, 1 / 60);
  assert.equal(vx, 0, 'friction stops the hero');
  assert.equal(approach(5, 10, 100), 10);
  assert.equal(approach(5, 0, 2), 3);
});

test('falls are clamped, slower on a wall slide', () => {
  assert.equal(clampFall(5000, false), PHYS.maxFall);
  assert.equal(clampFall(5000, true), PHYS.wallSlideSpeed);
  assert.equal(clampFall(-300, true), -300);
});

test('wall cling is not available in the tool suit or while carrying', () => {
  const base = { onGround: false, vy: 50, pressingIntoWall: true, toolSuit: false, carrying: false };
  assert.equal(canWallCling(base), true);
  assert.equal(canWallCling({ ...base, toolSuit: true }), false);
  assert.equal(canWallCling({ ...base, carrying: true }), false);
  assert.equal(canWallCling({ ...base, onGround: true }), false);
  assert.equal(canWallCling({ ...base, pressingIntoWall: false }), false);
});

test('stomps need a falling hero above the enemy midline', () => {
  assert.equal(isStomp({ playerVy: 200, playerBottom: 100, enemyTop: 95, enemyHeight: 40 }), true);
  assert.equal(isStomp({ playerVy: 200, playerBottom: 130, enemyTop: 95, enemyHeight: 40 }), false);
  assert.equal(isStomp({ playerVy: -50, playerBottom: 100, enemyTop: 95, enemyHeight: 40 }), false);
});
