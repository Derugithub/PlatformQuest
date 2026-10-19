/**
 * Saved progress and settings. Each value lives under a versioned key (`platformquest.*.v1`) and
 * carries a `schema` number, so later versions can migrate old saves instead of dropping them.
 * Parsing never throws: damaged or unknown data falls back to safe defaults, field by field.
 */

import { MAX_STORED_HEARTS } from './hearts';
import { LEVEL_IDS, type LevelId, type TutorialId } from './level-format';
import type { Stars } from './scoring';

export const STORAGE_KEYS = {
  progress: 'platformquest.progress.v1',
  settings: 'platformquest.settings.v1',
  ads: 'platformquest.ads.v1',
} as const;

export const PROGRESS_SCHEMA = 1;
export const SETTINGS_SCHEMA = 1;

export type LevelRecord = {
  completed: boolean;
  stars: Stars;
  bestScore: number;
  /** Fastest finish in whole seconds, or null before the first finish. */
  bestTimeSeconds: number | null;
};

export type Progress = {
  schema: typeof PROGRESS_SCHEMA;
  levels: Record<LevelId, LevelRecord>;
  /** Levels the map lets the player start. 1-1 is always unlocked. */
  unlocked: LevelId[];
  totalCoins: number;
  storedHearts: number;
  tutorialsSeen: TutorialId[];
};

export type Settings = {
  schema: typeof SETTINGS_SCHEMA;
  music: boolean;
  sound: boolean;
  tips: boolean;
};

export function emptyLevelRecord(): LevelRecord {
  return { completed: false, stars: [false, false, false], bestScore: 0, bestTimeSeconds: null };
}

export function defaultProgress(): Progress {
  const levels = Object.fromEntries(LEVEL_IDS.map((id) => [id, emptyLevelRecord()])) as Record<LevelId, LevelRecord>;
  return { schema: PROGRESS_SCHEMA, levels, unlocked: ['1-1'], totalCoins: 0, storedHearts: 0, tutorialsSeen: [] };
}

export function defaultSettings(): Settings {
  return { schema: SETTINGS_SCHEMA, music: true, sound: true, tips: true };
}

const TUTORIAL_IDS: readonly TutorialId[] = ['move', 'jump', 'run', 'spin', 'grab', 'walljump'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function count(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(max, Math.floor(value)) : 0;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseStars(value: unknown): Stars {
  if (!Array.isArray(value)) return [false, false, false];
  return [value[0] === true, value[1] === true, value[2] === true];
}

function parseLevelRecord(value: unknown): LevelRecord {
  if (!isRecord(value)) return emptyLevelRecord();
  const stars = parseStars(value.stars);
  const completed = value.completed === true || stars[0];
  const time = count(value.bestTimeSeconds);
  return {
    completed,
    // A finished level always has its first star.
    stars: completed ? [true, stars[1], stars[2]] : [false, false, false],
    bestScore: count(value.bestScore),
    bestTimeSeconds: completed && time > 0 ? time : null,
  };
}

/** Unlocked levels are a prefix of the zone: 1-1, plus every level after a completed one. */
export function normalizeUnlocked(levels: Record<LevelId, LevelRecord>, stored: readonly LevelId[]): LevelId[] {
  let highest = 0;
  LEVEL_IDS.forEach((id, i) => {
    if (stored.includes(id)) highest = Math.max(highest, i);
    if (levels[id].completed) highest = Math.max(highest, Math.min(LEVEL_IDS.length - 1, i + 1));
  });
  return LEVEL_IDS.slice(0, highest + 1);
}

/** Brings any saved value up to the current schema. Unknown future schemas keep what still parses. */
export function migrateProgress(value: unknown): Progress {
  if (!isRecord(value)) return defaultProgress();
  const base = defaultProgress();
  const rawLevels = isRecord(value.levels) ? value.levels : {};
  const levels = Object.fromEntries(LEVEL_IDS.map((id) => [id, parseLevelRecord(rawLevels[id])])) as Record<LevelId, LevelRecord>;
  const storedUnlocked = Array.isArray(value.unlocked)
    ? value.unlocked.filter((id): id is LevelId => typeof id === 'string' && (LEVEL_IDS as readonly string[]).includes(id))
    : [];
  const tutorialsSeen = Array.isArray(value.tutorialsSeen)
    ? TUTORIAL_IDS.filter((id) => (value.tutorialsSeen as unknown[]).includes(id))
    : [];
  return {
    ...base,
    levels,
    unlocked: normalizeUnlocked(levels, storedUnlocked),
    totalCoins: count(value.totalCoins),
    storedHearts: count(value.storedHearts, MAX_STORED_HEARTS),
    tutorialsSeen,
  };
}

export function migrateSettings(value: unknown): Settings {
  const base = defaultSettings();
  if (!isRecord(value)) return base;
  return { ...base, music: flag(value.music, base.music), sound: flag(value.sound, base.sound), tips: flag(value.tips, base.tips) };
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function parseProgress(raw: string | null): Progress {
  return migrateProgress(parseJson(raw));
}

export function parseSettings(raw: string | null): Settings {
  return migrateSettings(parseJson(raw));
}

export function isUnlocked(progress: Progress, id: LevelId): boolean {
  return progress.unlocked.includes(id);
}

export type LevelResult = {
  level: LevelId;
  stars: Stars;
  score: number;
  coins: number;
  timeSeconds: number;
};

/** Records a finished level: best stars, score and time, coins banked, next level unlocked. */
export function recordLevelResult(progress: Progress, result: LevelResult): Progress {
  const prev = progress.levels[result.level];
  const record: LevelRecord = {
    completed: true,
    stars: [true, prev.stars[1] || result.stars[1], prev.stars[2] || result.stars[2]],
    bestScore: Math.max(prev.bestScore, Math.floor(result.score)),
    bestTimeSeconds: prev.bestTimeSeconds == null ? Math.floor(result.timeSeconds) : Math.min(prev.bestTimeSeconds, Math.floor(result.timeSeconds)),
  };
  const levels = { ...progress.levels, [result.level]: record };
  return {
    ...progress,
    levels,
    unlocked: normalizeUnlocked(levels, progress.unlocked),
    totalCoins: progress.totalCoins + Math.max(0, Math.floor(result.coins)),
  };
}

export function markTutorialSeen(progress: Progress, id: TutorialId): Progress {
  if (progress.tutorialsSeen.includes(id)) return progress;
  return { ...progress, tutorialsSeen: [...progress.tutorialsSeen, id] };
}

export function setStoredHearts(progress: Progress, stored: number): Progress {
  return { ...progress, storedHearts: Math.max(0, Math.min(MAX_STORED_HEARTS, Math.floor(stored))) };
}
