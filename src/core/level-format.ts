/**
 * Levels are plain data: 15 rows of characters, one character per 48 px tile, read left to right.
 * Segments of equal height are joined side by side, so a level is a list of reusable chunks.
 */

import { ROWS } from './physics';

export const LEVEL_IDS = ['1-1', '1-2', '1-3', '1-4', '1-5'] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

export function isLevelId(value: unknown): value is LevelId {
  return typeof value === 'string' && (LEVEL_IDS as readonly string[]).includes(value);
}

export function nextLevelId(id: LevelId): LevelId | null {
  const i = LEVEL_IDS.indexOf(id);
  return i >= 0 && i < LEVEL_IDS.length - 1 ? LEVEL_IDS[i + 1] : null;
}

export function levelIndex(id: LevelId): number {
  return LEVEL_IDS.indexOf(id);
}

/** Tile legend. Anything not listed here is invalid level data. */
export const LEGEND = {
  '.': 'empty',
  '#': 'ground',
  X: 'hard block',
  B: 'breakable brick',
  '?': 'item block: coin',
  P: 'item block: tool box',
  S: 'item block: invincible star',
  H: 'item block: heart',
  h: 'hidden block: extra-life heart',
  T: 'bouncy tire',
  V: 'climbable vine',
  '!': 'blue switch block',
  D: 'dotted switch outline (solid while the switch is on)',
  M: 'moving platform track start',
  '-': 'moving platform track',
  W: 'boss gate (opens when the boss is defeated)',
  o: 'coin',
  F: 'checkpoint flag',
  G: 'goal house',
  '@': 'player start',
  s: 'slime',
  t: 'turtle',
  p: 'poison mushroom',
  k: 'spine turtle',
  w: 'flying turtle',
  m: 'banana monkey',
  b: 'boss',
} as const;

export type TileChar = keyof typeof LEGEND;

export function isTileChar(ch: string): ch is TileChar {
  return Object.prototype.hasOwnProperty.call(LEGEND, ch);
}

/** Characters that collide as solid ground for walking and landing. */
export const SOLID_CHARS: ReadonlySet<string> = new Set(['#', 'X', 'B', '?', 'P', 'S', 'H', 'T', '!', 'W']);
export const ITEM_BLOCK_CHARS: ReadonlySet<string> = new Set(['?', 'P', 'S', 'H']);
export const ENEMY_CHARS: ReadonlySet<string> = new Set(['s', 't', 'p', 'k', 'w', 'm', 'b']);

export type EnemyKind = 'slime' | 'turtle' | 'poison' | 'spine' | 'flyer' | 'monkey' | 'boss';

export const ENEMY_KIND: Record<string, EnemyKind> = {
  s: 'slime',
  t: 'turtle',
  p: 'poison',
  k: 'spine',
  w: 'flyer',
  m: 'monkey',
  b: 'boss',
};

export type TutorialId = 'move' | 'jump' | 'run' | 'spin' | 'grab' | 'walljump';

export type Tutorial = { id: TutorialId; col: number };

export type LevelDef = {
  id: LevelId;
  name: string;
  /** Countdown in seconds. */
  timeLimit: number;
  /** Finish faster than this for the time star. */
  targetSeconds: number;
  music: 'hill' | 'boss';
  segments: readonly (readonly string[])[];
  tutorials: readonly Tutorial[];
};

export type Cell = { col: number; row: number };

export type MovingPlatform = { row: number; fromCol: number; toCol: number; width: number };

export type ParsedLevel = {
  id: LevelId;
  cols: number;
  rows: string[];
  start: Cell;
  goal: Cell;
  checkpoints: Cell[];
  enemies: (Cell & { kind: EnemyKind })[];
  coins: Cell[];
  platforms: MovingPlatform[];
  hasSwitch: boolean;
};

/** Width in tiles of each moving platform. */
export const PLATFORM_WIDTH = 3;

export function joinSegments(segments: readonly (readonly string[])[]): string[] {
  const rows: string[] = Array.from({ length: ROWS }, () => '');
  segments.forEach((segment, index) => {
    if (segment.length !== ROWS) throw new Error(`segment ${index} has ${segment.length} rows, expected ${ROWS}`);
    const width = segment[0].length;
    segment.forEach((line, r) => {
      if (line.length !== width) throw new Error(`segment ${index} row ${r} is ${line.length} wide, expected ${width}`);
      rows[r] += line;
    });
  });
  return rows;
}

export function charAt(rows: readonly string[], col: number, row: number): string {
  if (row < 0 || row >= rows.length) return '.';
  const line = rows[row];
  // The level edges are walls.
  if (col < 0 || col >= line.length) return 'X';
  return line[col];
}

/** Turns level data into positions. Throws on malformed data. */
export function parseLevel(def: LevelDef): ParsedLevel {
  const rows = joinSegments(def.segments);
  const cols = rows[0].length;
  let start: Cell | null = null;
  let goal: Cell | null = null;
  const checkpoints: Cell[] = [];
  const enemies: (Cell & { kind: EnemyKind })[] = [];
  const coins: Cell[] = [];
  const platforms: MovingPlatform[] = [];
  let hasSwitch = false;
  for (let row = 0; row < ROWS; row += 1) {
    const line = rows[row];
    for (let col = 0; col < cols; col += 1) {
      const ch = line[col];
      if (!isTileChar(ch)) throw new Error(`${def.id}: unknown tile "${ch}" at ${col},${row}`);
      if (ch === '@') {
        if (start) throw new Error(`${def.id}: more than one start`);
        start = { col, row };
      } else if (ch === 'G') {
        if (goal) throw new Error(`${def.id}: more than one goal`);
        goal = { col, row };
      } else if (ch === 'F') checkpoints.push({ col, row });
      else if (ch === 'o') coins.push({ col, row });
      else if (ch === '!') hasSwitch = true;
      else if (ENEMY_CHARS.has(ch)) enemies.push({ col, row, kind: ENEMY_KIND[ch] });
      else if (ch === 'M') {
        let end = col;
        while (end + 1 < cols && line[end + 1] === '-') end += 1;
        if (end - col + 1 < PLATFORM_WIDTH) throw new Error(`${def.id}: platform track at ${col},${row} is shorter than a platform`);
        platforms.push({ row, fromCol: col, toCol: end - PLATFORM_WIDTH + 1, width: PLATFORM_WIDTH });
      } else if (ch === '-') {
        const prev = line[col - 1];
        if (prev !== 'M' && prev !== '-') throw new Error(`${def.id}: platform track at ${col},${row} has no start`);
      }
    }
  }
  if (!start) throw new Error(`${def.id}: no start`);
  if (!goal) throw new Error(`${def.id}: no goal`);
  checkpoints.sort((a, b) => a.col - b.col);
  return { id: def.id, cols, rows, start, goal, checkpoints, enemies, coins, platforms, hasSwitch };
}

/** The enemies that count toward the "Defeat all monsters" star. */
export function countableEnemies(level: ParsedLevel): number {
  return level.enemies.length;
}
