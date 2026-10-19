/**
 * Level checks used by the tests: structure, and that the goal and every checkpoint can be reached
 * from the start using the real jump physics. The reachability search simulates jumps tile by tile,
 * so it is a conservative stand-in for a player, not a proof that every route is fun.
 */

import { charAt, parseLevel, SOLID_CHARS, type Cell, type LevelDef, type ParsedLevel } from './level-format';
import { jumpLaunch, PHYS, ROWS, TILE, type JumpKind } from './physics';

type Mode = 'ground' | 'vine' | 'tire';
type Node = { col: number; row: number; mode: Mode };

const BODY_WIDTH = TILE * 0.66;
const STEP = 1 / 60;

function key(n: Node): string {
  return `${n.col},${n.row},${n.mode}`;
}

class Grid {
  constructor(
    readonly level: ParsedLevel,
    readonly tall: number,
  ) {}

  ch(col: number, row: number): string {
    return charAt(this.level.rows, col, row);
  }

  /** Solid for walking into and landing on. Dotted blocks count when the level has a switch. */
  solid(col: number, row: number): boolean {
    if (row < 0) return false;
    const c = this.ch(col, row);
    if (c === 'W') return false; // assumed open: the boss is beaten before the gate matters
    if (c === 'D') return this.level.hasSwitch;
    return SOLID_CHARS.has(c);
  }

  /** One-way moving platform track (land from above only). */
  track(col: number, row: number): boolean {
    const c = this.ch(col, row);
    return c === 'M' || c === '-';
  }

  vine(col: number, row: number): boolean {
    return this.ch(col, row) === 'V';
  }

  /** The player's body fits with its feet in cell `row` at column `col`. */
  fits(col: number, row: number): boolean {
    for (let r = row - this.tall + 1; r <= row; r += 1) if (this.solid(col, r)) return false;
    return true;
  }

  standable(col: number, row: number): boolean {
    return this.fits(col, row) && (this.solid(col, row + 1) || this.track(col, row + 1));
  }

  boxHitsSolid(x: number, bottom: number): boolean {
    const height = this.tall * TILE - 6;
    const c0 = Math.floor((x - BODY_WIDTH / 2) / TILE);
    const c1 = Math.floor((x + BODY_WIDTH / 2 - 0.01) / TILE);
    const r0 = Math.floor((bottom - height) / TILE);
    const r1 = Math.floor((bottom - 0.01) / TILE);
    for (let c = c0; c <= c1; c += 1) for (let r = r0; r <= r1; r += 1) if (this.solid(c, r)) return true;
    return false;
  }
}

type Sim = { x: number; bottom: number; vx: number; vy: number; stopAtApex: boolean };

/** Simulates one jump or fall and returns every node it can end on (landing or grabbing a vine). */
function simulate(grid: Grid, start: Sim): Node[] {
  const out: Node[] = [];
  let { x, bottom, vx, vy } = start;
  const limit = grid.level.rows.length * TILE + TILE;
  for (let t = 0; t < 3.5; t += STEP) {
    const nextVy = Math.min(vy + PHYS.gravity * STEP, PHYS.maxFall);
    if (start.stopAtApex && vy < 0 && nextVy >= 0) vx = 0;
    vy = nextVy;
    const nx = x + vx * STEP;
    // Blocked by a wall: the player keeps pushing, so the speed stays for when the wall ends.
    if (!grid.boxHitsSolid(nx, bottom)) x = nx;
    const nb = bottom + vy * STEP;
    if (vy < 0) {
      if (grid.boxHitsSolid(x, nb)) vy = 0;
      else bottom = nb;
    } else {
      const rowFrom = Math.floor((bottom - 0.01) / TILE) + 1;
      const rowTo = Math.floor(nb / TILE);
      let landed = false;
      for (let r = rowFrom; r <= rowTo && !landed; r += 1) {
        const top = r * TILE;
        if (bottom > top + 0.01 || nb < top) continue;
        const c0 = Math.floor((x - BODY_WIDTH / 2) / TILE);
        const c1 = Math.floor((x + BODY_WIDTH / 2 - 0.01) / TILE);
        const center = Math.floor(x / TILE);
        const under = [center, c0, c1].filter((c) => grid.solid(c, r) || grid.track(c, r));
        if (under.length > 0) {
          const col = under[0];
          if (grid.fits(col, r - 1)) out.push({ col, row: r - 1, mode: grid.ch(col, r) === 'T' ? 'tire' : 'ground' });
          landed = true;
        }
      }
      if (landed) return out;
      bottom = nb;
    }
    const vc = Math.floor(x / TILE);
    const vr = Math.floor((bottom - TILE / 2) / TILE);
    if (grid.vine(vc, vr) && grid.fits(vc, vr)) out.push({ col: vc, row: vr, mode: 'vine' });
    if (bottom > limit) return out;
  }
  return out;
}

function neighbours(grid: Grid, n: Node): Node[] {
  const out: Node[] = [];
  const cx = n.col * TILE + TILE / 2;
  const bottom = (n.row + 1) * TILE;
  // The player steers in the air, so try a spread of horizontal speeds up to walking pace.
  const speeds = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map((share) => share * PHYS.walkSpeed);
  if (n.mode === 'vine') {
    for (const dr of [-1, 1]) if (grid.vine(n.col, n.row + dr) && grid.fits(n.col, n.row + dr)) out.push({ col: n.col, row: n.row + dr, mode: 'vine' });
    if (grid.standable(n.col, n.row)) out.push({ col: n.col, row: n.row, mode: 'ground' });
    for (const vx of speeds) {
      for (const stopAtApex of [false, true]) out.push(...simulate(grid, { x: cx, bottom, vx, vy: -jumpLaunch('normal', 0), stopAtApex }));
      out.push(...simulate(grid, { x: cx, bottom, vx, vy: 0, stopAtApex: false }));
    }
    return out;
  }
  // Walk to a neighbouring standable tile, or walk off the edge and fall.
  for (const dir of [-1, 1]) {
    const col = n.col + dir;
    if (grid.standable(col, n.row)) out.push({ col, row: n.row, mode: grid.ch(col, n.row + 1) === 'T' ? 'tire' : 'ground' });
    else if (grid.fits(col, n.row)) out.push(...simulate(grid, { x: cx + dir * TILE * 0.6, bottom, vx: dir * PHYS.walkSpeed, vy: 0, stopAtApex: false }));
  }
  if (grid.vine(n.col, n.row)) out.push({ ...n, mode: 'vine' });
  const kind: JumpKind = n.mode === 'tire' ? 'tire' : 'normal';
  const all = [...speeds];
  // Full run speed needs a two-tile runway behind the jump.
  for (const dir of [-1, 1]) {
    if (grid.standable(n.col - dir, n.row) && grid.standable(n.col - 2 * dir, n.row)) all.push(dir * PHYS.runSpeed);
  }
  for (const vx of all) {
    for (const stopAtApex of [false, true]) {
      out.push(...simulate(grid, { x: cx, bottom, vx, vy: -jumpLaunch(kind, vx), stopAtApex }));
    }
  }
  return out;
}

/** Every node reachable from the start for a player `tall` tiles high (1 small, 2 tool suit). */
export function reachableNodes(level: ParsedLevel, tall: number): Map<string, Node> {
  const grid = new Grid(level, tall);
  const seen = new Map<string, Node>();
  let startRow = level.start.row;
  while (startRow < ROWS && !grid.standable(level.start.col, startRow)) startRow += 1;
  const first: Node = { col: level.start.col, row: startRow, mode: 'ground' };
  const queue: Node[] = [first];
  seen.set(key(first), first);
  while (queue.length > 0) {
    const n = queue.shift() as Node;
    for (const next of neighbours(grid, n)) {
      const k = key(next);
      if (!seen.has(k)) {
        seen.set(k, next);
        queue.push(next);
      }
    }
  }
  return seen;
}

function reached(nodes: Map<string, Node>, cell: Cell): boolean {
  for (const n of nodes.values()) {
    if (n.mode !== 'vine' && n.row === cell.row && Math.abs(n.col - cell.col) <= 1) return true;
  }
  return false;
}

export type LevelReport = { errors: string[]; level: ParsedLevel | null };

/** Structure and reachability problems for one level. An empty list means the level is valid. */
export function validateLevel(def: LevelDef): LevelReport {
  const errors: string[] = [];
  let level: ParsedLevel;
  try {
    level = parseLevel(def);
  } catch (error) {
    return { errors: [String(error)], level: null };
  }
  const grid = new Grid(level, 1);
  const onGround = (cell: Cell) => grid.solid(cell.col, cell.row + 1);
  if (!onGround(level.start)) errors.push(`${def.id}: start is not on solid ground`);
  if (!onGround(level.goal)) errors.push(`${def.id}: goal is not on solid ground`);
  level.checkpoints.forEach((cp) => {
    if (!onGround(cp)) errors.push(`${def.id}: checkpoint at ${cp.col} is not on solid ground`);
    if (cp.col <= level.start.col || cp.col >= level.goal.col) errors.push(`${def.id}: checkpoint at ${cp.col} is not between start and goal`);
  });
  if (level.goal.col <= level.start.col) errors.push(`${def.id}: goal is left of the start`);
  if (def.timeLimit <= 0 || def.targetSeconds <= 0 || def.targetSeconds >= def.timeLimit) {
    errors.push(`${def.id}: target time must be positive and under the time limit`);
  }
  def.tutorials.forEach((tip) => {
    if (tip.col < 0 || tip.col >= level.cols) errors.push(`${def.id}: tutorial ${tip.id} is outside the level`);
  });
  if (level.hasSwitch) {
    const firstSwitch = Math.min(...level.rows.map((line) => (line.includes('!') ? line.indexOf('!') : Infinity)));
    const firstDotted = Math.min(...level.rows.map((line) => (line.includes('D') ? line.indexOf('D') : Infinity)));
    if (firstDotted < firstSwitch) errors.push(`${def.id}: dotted blocks come before their switch`);
  } else if (level.rows.some((line) => line.includes('D'))) {
    errors.push(`${def.id}: dotted blocks without a switch`);
  }
  for (const tall of [1, 2]) {
    const nodes = reachableNodes(level, tall);
    const label = tall === 1 ? 'small' : 'tool suit';
    if (!reached(nodes, level.goal)) errors.push(`${def.id}: goal is not reachable (${label})`);
    level.checkpoints.forEach((cp) => {
      if (!reached(nodes, cp)) errors.push(`${def.id}: checkpoint at ${cp.col} is not reachable (${label})`);
    });
  }
  return { errors, level };
}
