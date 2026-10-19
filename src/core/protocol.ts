/**
 * Messages between the React Native shell and the game running inside the WebView.
 * Both sides validate what they receive; anything malformed is ignored.
 */

import { isLevelId, type LevelId, type TutorialId } from './level-format';
import type { DeathReason } from './run-flow';

export type AudioSettings = { music: boolean; sound: boolean };

/** Safe-area insets in CSS pixels, so the controls clear cutouts and the navigation bar. */
export type Insets = { left: number; right: number; top: number; bottom: number };

export type HostToGame =
  | { type: 'start'; level: LevelId; audio: AudioSettings; tips: TutorialId[]; insets: Insets }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  /** Another chance accepted (stored heart or rewarded ad): respawn with one heart. */
  | { type: 'grantHeart' }
  | { type: 'audio'; audio: AudioSettings }
  | { type: 'tipClosed'; skipAll: boolean };

export type HudState = {
  hearts: number;
  coins: number;
  score: number;
  /** Whole seconds left. */
  time: number;
  hurry: boolean;
  /** 0..1 along the level. */
  progress: number;
  form: 'small' | 'tool';
  star: boolean;
  boss: { hp: number; max: number } | null;
};

export type LevelSummary = {
  level: LevelId;
  coins: number;
  score: number;
  timeSeconds: number;
  enemiesDefeated: number;
  enemiesTotal: number;
};

export type GameToHost =
  | { type: 'ready' }
  | { type: 'levelStarted'; level: LevelId }
  | { type: 'hud'; hud: HudState }
  | { type: 'tip'; id: TutorialId }
  | { type: 'extraLife' }
  | { type: 'timeUp' }
  | { type: 'died'; reason: DeathReason }
  | { type: 'levelComplete'; summary: LevelSummary }
  | { type: 'error'; message: string };

const TIPS: readonly string[] = ['move', 'jump', 'run', 'spin', 'grab', 'walljump'];
const REASONS: readonly string[] = ['hearts', 'pit', 'time'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const bool = (v: unknown): v is boolean => typeof v === 'boolean';

function isTip(v: unknown): v is TutorialId {
  return typeof v === 'string' && TIPS.includes(v);
}

function isAudio(v: unknown): v is AudioSettings {
  return isRecord(v) && bool(v.music) && bool(v.sound);
}

function isInsets(v: unknown): v is Insets {
  return isRecord(v) && num(v.left) && num(v.right) && num(v.top) && num(v.bottom);
}

function isHud(v: unknown): v is HudState {
  if (!isRecord(v)) return false;
  const bossOk = v.boss === null || (isRecord(v.boss) && num(v.boss.hp) && num(v.boss.max));
  return (
    num(v.hearts) && num(v.coins) && num(v.score) && num(v.time) && bool(v.hurry) && num(v.progress) &&
    (v.form === 'small' || v.form === 'tool') && bool(v.star) && bossOk
  );
}

function isSummary(v: unknown): v is LevelSummary {
  return (
    isRecord(v) && isLevelId(v.level) && num(v.coins) && num(v.score) && num(v.timeSeconds) &&
    num(v.enemiesDefeated) && num(v.enemiesTotal)
  );
}

function parse(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string') return isRecord(raw) ? raw : null;
  try {
    const v = JSON.parse(raw) as unknown;
    return isRecord(v) ? v : null;
  } catch {
    return null;
  }
}

export function parseGameMessage(raw: unknown): GameToHost | null {
  const m = parse(raw);
  if (!m) return null;
  switch (m.type) {
    case 'ready':
    case 'extraLife':
    case 'timeUp':
      return { type: m.type };
    case 'levelStarted':
      return isLevelId(m.level) ? { type: 'levelStarted', level: m.level } : null;
    case 'hud':
      return isHud(m.hud) ? { type: 'hud', hud: m.hud } : null;
    case 'tip':
      return isTip(m.id) ? { type: 'tip', id: m.id } : null;
    case 'died':
      return typeof m.reason === 'string' && REASONS.includes(m.reason) ? { type: 'died', reason: m.reason as DeathReason } : null;
    case 'levelComplete':
      return isSummary(m.summary) ? { type: 'levelComplete', summary: m.summary } : null;
    case 'error':
      return typeof m.message === 'string' ? { type: 'error', message: m.message } : null;
    default:
      return null;
  }
}

export function parseHostMessage(raw: unknown): HostToGame | null {
  const m = parse(raw);
  if (!m) return null;
  switch (m.type) {
    case 'start':
      if (!isLevelId(m.level) || !isAudio(m.audio) || !Array.isArray(m.tips) || !isInsets(m.insets)) return null;
      return { type: 'start', level: m.level, audio: m.audio, tips: m.tips.filter(isTip), insets: m.insets };
    case 'pause':
    case 'resume':
    case 'restart':
    case 'grantHeart':
      return { type: m.type };
    case 'audio':
      return isAudio(m.audio) ? { type: 'audio', audio: m.audio } : null;
    case 'tipClosed':
      return bool(m.skipAll) ? { type: 'tipClosed', skipAll: m.skipAll } : null;
    default:
      return null;
  }
}

export const TIP_TEXT: Record<TutorialId, { title: string; body: string }> = {
  move: { title: 'Move', body: 'Slide your thumb on the left pad to walk. Hold down to duck.' },
  jump: { title: 'Jump', body: 'Tap Jump for a hop, hold it to jump higher. Land on monsters to stomp them.' },
  run: { title: 'Run', body: 'Hold Run while moving to sprint. You need speed to clear wide gaps.' },
  spin: { title: 'Spin jump', body: 'Spin jumps a little higher and floats near the top. Great for high ledges.' },
  grab: { title: 'Grab a shell', body: 'Stomp a turtle, then tap Grab next to the shell to pick it up. Tap again to kick it.' },
  walljump: { title: 'Wall jump', body: 'Jump at a wall and hold toward it to slide. Tap Jump to kick off the wall.' },
};
