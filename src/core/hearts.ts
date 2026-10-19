/** Hearts are the player's hit points inside a level. Extra-life hearts are banked between runs. */

export const START_HEARTS = 2;
export const MAX_HEARTS = 5;
/** Banked extra-life hearts, spent on "Use" in Another chance. */
export const MAX_STORED_HEARTS = 9;
/** Hearts after continuing from Another chance. */
export const CONTINUE_HEARTS = 1;

export type Form = 'small' | 'tool';

export type HeartState = { hearts: number; form: Form };

export function startHearts(): HeartState {
  return { hearts: START_HEARTS, form: 'small' };
}

export type HitResult = { state: HeartState; dead: boolean };

/** A hit costs one heart and drops the power-up form. Zero hearts is a death. */
export function applyHit(state: HeartState): HitResult {
  const hearts = Math.max(0, state.hearts - 1);
  return { state: { hearts, form: 'small' }, dead: hearts === 0 };
}

/** A red heart from an item block. Returns whether it was used (false at the cap, which scores instead). */
export function collectHeart(state: HeartState): { state: HeartState; added: boolean } {
  if (state.hearts >= MAX_HEARTS) return { state, added: false };
  return { state: { ...state, hearts: state.hearts + 1 }, added: true };
}

export function collectToolBox(state: HeartState): HeartState {
  return { ...state, form: 'tool' };
}

/** A golden extra-life heart from a hidden block goes to the bank (capped). */
export function bankExtraLife(stored: number): number {
  return Math.min(MAX_STORED_HEARTS, Math.max(0, Math.floor(stored)) + 1);
}

export function canUseStoredHeart(stored: number): boolean {
  return stored > 0;
}

export function spendStoredHeart(stored: number): number {
  if (!canUseStoredHeart(stored)) throw new Error('No stored heart to spend');
  return stored - 1;
}

export function continueHearts(): HeartState {
  return { hearts: CONTINUE_HEARTS, form: 'small' };
}
