/**
 * Pure ad rules. Every function takes `now` (epoch ms) so the caps can be tested with a fake clock.
 * The game never waits on an ad: these only say whether one is allowed, and callers continue
 * either way.
 *
 * Banner: main menu and world map only. Never during gameplay, so it can never cover the controls.
 * Interstitial: only after a completed level, at most once every 3 minutes, and never after the
 * first two levels completed in the player's first session.
 * Rewarded: "+1 heart" in Another chance only. The heart is granted on the earned-reward callback.
 */

export const MINUTE = 60_000;

export const AD_RULES = {
  /** A cold start, or a resume after this long in the background, starts a new session. */
  sessionGapMs: 30 * MINUTE,
  interstitialMinGapMs: 3 * MINUTE,
  /** Level completions in the first session that never show an interstitial. */
  firstSessionFreeLevels: 2,
  /** Safety ceiling for rewarded shows a day. */
  rewardedDailyCap: 30,
} as const;

export type DayCount = { date: string; count: number };

export type AdState = {
  sessionCount: number;
  lastBackgroundAt: number | null;
  /** Levels completed in the current session. */
  levelsThisSession: number;
  lastInterstitialAt: number | null;
  rewardedToday: DayCount;
  /** Latest wall-clock time seen, to pull back timestamps if the clock is set back. */
  lastSeenAt: number;
};

export function emptyAdState(): AdState {
  return {
    sessionCount: 0,
    lastBackgroundAt: null,
    levelsThisSession: 0,
    lastInterstitialAt: null,
    rewardedToday: { date: '', count: 0 },
    lastSeenAt: 0,
  };
}

export function localDateKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function countToday(bucket: DayCount, now: number): number {
  return bucket.date === localDateKey(now) ? bucket.count : 0;
}

export function bumpToday(bucket: DayCount, now: number): DayCount {
  const date = localDateKey(now);
  return bucket.date === date ? { date, count: bucket.count + 1 } : { date, count: 1 };
}

/** Timestamps in the future (clock set back) are pulled back to now so cooldowns cannot lock forever. */
export function normalizeClock(state: AdState, now: number): AdState {
  const clamp = (t: number | null) => (t != null && t > now ? now : t);
  return {
    ...state,
    lastInterstitialAt: clamp(state.lastInterstitialAt),
    lastBackgroundAt: clamp(state.lastBackgroundAt),
    lastSeenAt: Math.max(now, 0),
  };
}

export type AdGate = { ready: boolean; canRequestAds?: boolean };

function gateReason(gate: AdGate): string | null {
  if (!gate.ready) return 'sdk not ready';
  if (gate.canRequestAds === false) return 'consent does not allow ad requests';
  return null;
}

export type AdScreen = 'menu' | 'map' | 'play' | 'settings';

export function bannerBlockReason(screen: AdScreen, gate: AdGate): string | null {
  if (screen !== 'menu' && screen !== 'map') return `no banner on ${screen}`;
  return gateReason(gate);
}

export function canShowBanner(screen: AdScreen, gate: AdGate): boolean {
  return bannerBlockReason(screen, gate) == null;
}

/** Counts a completed level for this session. Call before checking the interstitial. */
export function noteLevelComplete(state: AdState): AdState {
  return { ...state, levelsThisSession: state.levelsThisSession + 1 };
}

export type InterstitialMoment = AdGate & {
  now: number;
  /** The player is in a level (not on the result popup). Always blocks. */
  inLevel?: boolean;
  loaded?: boolean;
};

/** Null means the interstitial may show. */
export function interstitialBlockReason(state: AdState, m: InterstitialMoment): string | null {
  if (m.inLevel) return 'during gameplay';
  const g = gateReason(m);
  if (g) return g;
  if (m.loaded === false) return 'not loaded';
  if (state.sessionCount <= 1 && state.levelsThisSession <= AD_RULES.firstSessionFreeLevels) {
    return 'first two levels of the first session';
  }
  if (state.lastInterstitialAt != null && m.now - state.lastInterstitialAt < AD_RULES.interstitialMinGapMs) {
    return 'shown less than 3 minutes ago';
  }
  return null;
}

export function canShowInterstitial(state: AdState, m: InterstitialMoment): boolean {
  return interstitialBlockReason(state, m) == null;
}

export function recordInterstitial(state: AdState, now: number): AdState {
  return { ...state, lastInterstitialAt: now };
}

export function rewardedBlockReason(state: AdState, now: number, gate: AdGate): string | null {
  const g = gateReason(gate);
  if (g) return g;
  if (countToday(state.rewardedToday, now) >= AD_RULES.rewardedDailyCap) return 'rewarded daily cap';
  return null;
}

export function canOfferRewarded(state: AdState, now: number, gate: AdGate): boolean {
  return rewardedBlockReason(state, now, gate) == null;
}

/** Applies a rewarded show whose earned-reward callback fired. */
export function recordRewarded(state: AdState, now: number): AdState {
  return { ...state, rewardedToday: bumpToday(state.rewardedToday, now) };
}

export type SessionEvent = 'launch' | 'background' | 'active';

export function nextSession(state: AdState, event: SessionEvent, now: number): AdState {
  if (event === 'launch') return { ...state, sessionCount: state.sessionCount + 1, lastBackgroundAt: null, levelsThisSession: 0 };
  if (event === 'background') return state.lastBackgroundAt != null ? state : { ...state, lastBackgroundAt: now };
  if (state.lastBackgroundAt == null) return state;
  const away = now - state.lastBackgroundAt;
  if (away < AD_RULES.sessionGapMs) return { ...state, lastBackgroundAt: null };
  return { ...state, lastBackgroundAt: null, sessionCount: state.sessionCount + 1, levelsThisSession: 0 };
}

function day(v: unknown): DayCount {
  if (typeof v !== 'object' || v === null) return { date: '', count: 0 };
  const o = v as Record<string, unknown>;
  return typeof o.date === 'string' && typeof o.count === 'number' && Number.isFinite(o.count) && o.count >= 0
    ? { date: o.date, count: Math.floor(o.count) }
    : { date: '', count: 0 };
}

const time = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

export function parseAdState(raw: string | null): AdState {
  if (!raw) return emptyAdState();
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v !== 'object' || v === null) return emptyAdState();
    return {
      sessionCount: int(v.sessionCount),
      lastBackgroundAt: time(v.lastBackgroundAt),
      levelsThisSession: int(v.levelsThisSession),
      lastInterstitialAt: time(v.lastInterstitialAt),
      rewardedToday: day(v.rewardedToday),
      lastSeenAt: time(v.lastSeenAt) ?? 0,
    };
  } catch {
    return emptyAdState();
  }
}
