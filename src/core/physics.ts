/**
 * Pure movement math shared by the game and the level validator. Units are pixels and seconds.
 * One tile is 48 px; the view is 15 tiles tall.
 */

export const TILE = 48;
export const ROWS = 15;
export const VIEW_HEIGHT = TILE * ROWS;

export const PHYS = {
  gravity: 2300,
  maxFall: 960,
  walkSpeed: 270,
  runSpeed: 430,
  /** Multiplier on top speed while the Invincible Star is active. */
  starSpeedFactor: 1.25,
  groundAccel: 1500,
  runAccel: 1900,
  airAccel: 1150,
  friction: 1700,
  skidDecel: 2800,
  jumpTiles: 4.2,
  /** Extra height at full run speed, scaled by how fast the player is going. */
  runJumpBonusTiles: 0.8,
  spinJumpBonusTiles: 0.6,
  /** Spin jump: gravity is reduced for this long around the apex. */
  spinHangMs: 280,
  spinHangGravityFactor: 0.35,
  /** Releasing jump while rising keeps this share of the upward speed. */
  jumpCutFactor: 0.45,
  wallSlideSpeed: 150,
  wallJumpSpeedX: 380,
  wallJumpLockMs: 170,
  tireBounceTiles: 7.5,
  stompBounceTiles: 2.4,
  climbSpeed: 180,
  /** A jump pressed this long before landing still counts. */
  jumpBufferMs: 110,
  /** A jump pressed this long after walking off a ledge still counts. */
  coyoteMs: 90,
} as const;

/** Upward launch speed (positive number) that reaches `heightPx` under `gravity`. */
export function launchSpeed(heightPx: number, gravity: number = PHYS.gravity): number {
  if (heightPx <= 0) return 0;
  return Math.sqrt(2 * gravity * heightPx);
}

/** Apex height in pixels for an upward launch speed. */
export function apexHeight(speed: number, gravity: number = PHYS.gravity): number {
  if (speed <= 0) return 0;
  return (speed * speed) / (2 * gravity);
}

/** Time in seconds to rise and fall back to the launch height. */
export function airTime(speed: number, gravity: number = PHYS.gravity): number {
  if (speed <= 0) return 0;
  return (2 * speed) / gravity;
}

/** Moves `current` toward `target` by at most `delta`. */
export function approach(current: number, target: number, delta: number): number {
  if (current < target) return Math.min(current + delta, target);
  if (current > target) return Math.max(current - delta, target);
  return target;
}

export type Direction = -1 | 0 | 1;

export type HorizontalInput = {
  dir: Direction;
  run: boolean;
  onGround: boolean;
  /** Ducking on the ground stops walking input (the player slides to a halt). */
  ducking: boolean;
  star: boolean;
};

export function topSpeed(input: Pick<HorizontalInput, 'run' | 'star'>): number {
  const base = input.run ? PHYS.runSpeed : PHYS.walkSpeed;
  return input.star ? base * PHYS.starSpeedFactor : base;
}

/**
 * Horizontal speed after one step. Running builds momentum up to run speed, releasing input
 * glides to a stop with friction, and pushing against the current direction skids.
 */
export function stepHorizontal(vx: number, input: HorizontalInput, dt: number): number {
  const dir = input.ducking && input.onGround ? 0 : input.dir;
  const max = topSpeed(input);
  if (dir === 0) {
    const decel = input.onGround ? PHYS.friction : PHYS.friction * 0.35;
    return approach(vx, 0, decel * dt);
  }
  const target = dir * max;
  const reversing = vx !== 0 && Math.sign(vx) !== dir;
  let accel: number = input.onGround ? (input.run ? PHYS.runAccel : PHYS.groundAccel) : PHYS.airAccel;
  if (reversing && input.onGround) accel = PHYS.skidDecel;
  // Over top speed (for example after letting go of Run): ease down instead of snapping.
  if (Math.abs(vx) > max && Math.sign(vx) === dir) return approach(vx, target, PHYS.friction * 0.5 * dt);
  return approach(vx, target, accel * dt);
}

export type JumpKind = 'normal' | 'spin' | 'tire' | 'stomp' | 'wall';

/** Launch speed (positive, upward) for a jump. Faster horizontal speed gives a little more height. */
export function jumpLaunch(kind: JumpKind, vx: number): number {
  const speedShare = Math.min(1, Math.abs(vx) / PHYS.runSpeed);
  switch (kind) {
    case 'tire':
      return launchSpeed(PHYS.tireBounceTiles * TILE);
    case 'stomp':
      return launchSpeed(PHYS.stompBounceTiles * TILE);
    case 'spin':
      return launchSpeed((PHYS.jumpTiles + PHYS.spinJumpBonusTiles + PHYS.runJumpBonusTiles * speedShare * 0.5) * TILE);
    case 'wall':
      return launchSpeed((PHYS.jumpTiles - 0.6) * TILE);
    case 'normal':
      return launchSpeed((PHYS.jumpTiles + PHYS.runJumpBonusTiles * speedShare) * TILE);
  }
}

/** Variable jump height: letting go of Jump while rising cuts the upward speed once. */
export function cutJump(vy: number, held: boolean): number {
  if (held || vy >= 0) return vy;
  return vy * PHYS.jumpCutFactor;
}

/** Gravity for this frame. The spin jump hangs briefly near its apex. */
export function gravityFor(vy: number, spinHangLeftMs: number): number {
  if (spinHangLeftMs > 0 && Math.abs(vy) < 260) return PHYS.gravity * PHYS.spinHangGravityFactor;
  return PHYS.gravity;
}

/** Vertical speed clamp: terminal fall speed, or wall-slide speed while clinging. */
export function clampFall(vy: number, wallSliding: boolean): number {
  const limit = wallSliding ? PHYS.wallSlideSpeed : PHYS.maxFall;
  return Math.min(vy, limit);
}

/** Whether a wall cling is allowed: airborne, falling, pressing into the wall, and not in the tool suit. */
export function canWallCling(input: {
  onGround: boolean;
  vy: number;
  pressingIntoWall: boolean;
  toolSuit: boolean;
  carrying: boolean;
}): boolean {
  return !input.onGround && input.vy > -60 && input.pressingIntoWall && !input.toolSuit && !input.carrying;
}

/** A stomp counts when the player is falling and their feet were above the enemy's upper half. */
export function isStomp(input: { playerVy: number; playerBottom: number; enemyTop: number; enemyHeight: number }): boolean {
  return input.playerVy > 0 && input.playerBottom <= input.enemyTop + input.enemyHeight * 0.5;
}

/** Horizontal distance in tiles a jump covers at speed `vx` when landing at the launch height. */
export function jumpDistanceTiles(kind: JumpKind, vx: number): number {
  return (Math.abs(vx) * airTime(jumpLaunch(kind, vx))) / TILE;
}
