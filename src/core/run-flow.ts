/**
 * What happens after the player dies, as a small pure state machine.
 *
 * - Zero hearts or a pit: the "Another chance?" popup. "Use" spends a banked heart, the green
 *   "+1 heart" button plays a rewarded ad and continues only when the reward was earned,
 *   "No, thanks" goes to Mission Failed.
 * - Time out: "Time's up!" then Mission Failed directly (no Another chance).
 * - Mission Failed offers Replay (restart the level from the start), Map and Home.
 */

import { canUseStoredHeart, spendStoredHeart } from './hearts';

export type DeathReason = 'hearts' | 'pit' | 'time';

export type FlowState =
  | { screen: 'playing' }
  | { screen: 'another_chance'; reason: 'hearts' | 'pit' }
  | { screen: 'mission_failed'; reason: DeathReason };

export function afterDeath(reason: DeathReason): FlowState {
  if (reason === 'time') return { screen: 'mission_failed', reason };
  return { screen: 'another_chance', reason };
}

export type AnotherChanceOptions = { useEnabled: boolean; rewardedEnabled: boolean };

export function anotherChanceOptions(storedHearts: number, rewardedReady: boolean): AnotherChanceOptions {
  return { useEnabled: canUseStoredHeart(storedHearts), rewardedEnabled: rewardedReady };
}

export type ChanceChoice = { kind: 'no_thanks' } | { kind: 'use' } | { kind: 'rewarded'; earned: boolean };

export type ChanceResult = {
  flow: FlowState;
  storedHearts: number;
  /** True when the game should respawn the player at the last checkpoint with one heart. */
  respawn: boolean;
};

export function resolveAnotherChance(state: FlowState, choice: ChanceChoice, storedHearts: number): ChanceResult {
  if (state.screen !== 'another_chance') return { flow: state, storedHearts, respawn: false };
  switch (choice.kind) {
    case 'no_thanks':
      return { flow: { screen: 'mission_failed', reason: state.reason }, storedHearts, respawn: false };
    case 'use':
      if (!canUseStoredHeart(storedHearts)) return { flow: state, storedHearts, respawn: false };
      return { flow: { screen: 'playing' }, storedHearts: spendStoredHeart(storedHearts), respawn: true };
    case 'rewarded':
      // The reward is granted only on the earned-reward callback; closing early keeps the popup.
      if (!choice.earned) return { flow: state, storedHearts, respawn: false };
      return { flow: { screen: 'playing' }, storedHearts, respawn: true };
  }
}

export type MissionFailedAction = 'replay' | 'map' | 'home';

/** Mission Failed buttons, in order. A Shop button slots in here in a later version. */
export const MISSION_FAILED_ACTIONS: readonly MissionFailedAction[] = ['replay', 'map', 'home'];

export type Navigation = { kind: 'restart_level' } | { kind: 'route'; to: '/map' | '/' };

export function missionFailedNavigation(action: MissionFailedAction): Navigation {
  switch (action) {
    case 'replay':
      return { kind: 'restart_level' };
    case 'map':
      return { kind: 'route', to: '/map' };
    case 'home':
      return { kind: 'route', to: '/' };
  }
}
