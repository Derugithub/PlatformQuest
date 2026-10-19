/** Per-level countdown. Pure: the game feeds elapsed time and reacts to the returned events. */

export const HURRY_SECONDS = 100;
/** Music tempo while the timer is under HURRY_SECONDS. */
export const HURRY_TEMPO = 1.35;

export type TimerState = { limit: number; remaining: number };
export type TimerEvent = 'hurry' | 'timeout';

export function startTimer(limit: number): TimerState {
  return { limit, remaining: limit };
}

export function tickTimer(state: TimerState, dtSeconds: number): { state: TimerState; events: TimerEvent[] } {
  if (state.remaining <= 0 || dtSeconds <= 0) return { state, events: [] };
  const remaining = Math.max(0, state.remaining - dtSeconds);
  const events: TimerEvent[] = [];
  if (state.remaining > HURRY_SECONDS && remaining <= HURRY_SECONDS) events.push('hurry');
  if (remaining === 0) events.push('timeout');
  return { state: { ...state, remaining }, events };
}

/** Whole seconds shown on the HUD (rounded up, so 0 means time is really up). */
export function displaySeconds(state: TimerState): number {
  return Math.max(0, Math.ceil(state.remaining - 1e-9));
}

export function isHurry(state: TimerState): boolean {
  return state.remaining <= HURRY_SECONDS;
}

/** Red flash on the HUD: on for the first half of every second while hurrying. */
export function hurryFlashOn(state: TimerState): boolean {
  if (!isHurry(state) || state.remaining <= 0) return false;
  return state.remaining % 1 >= 0.5;
}

export function musicTempo(state: TimerState): number {
  return isHurry(state) ? HURRY_TEMPO : 1;
}

export function elapsedSeconds(state: TimerState): number {
  return state.limit - state.remaining;
}

/** After "Another chance" the countdown keeps going, with at least a short grace period. */
export const CONTINUE_MIN_SECONDS = 60;

export function timerAfterContinue(state: TimerState): TimerState {
  return { ...state, remaining: Math.min(state.limit, Math.max(state.remaining, CONTINUE_MIN_SECONDS)) };
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
