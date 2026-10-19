import { createContext, useContext } from 'react';

export type AdsContextValue = {
  /** Consent gathered and the SDK initialised; ad requests are allowed. */
  ready: boolean;
  /** UMP says the app must offer a privacy options entry point. */
  privacyOptionsRequired: boolean;
  /** A rewarded ad is loaded and the daily cap allows one. */
  rewardedReady: boolean;
  /** Shows the "+1 heart" rewarded ad. Resolves true only when the reward was earned. Never throws. */
  showRewarded: () => Promise<boolean>;
  /**
   * Call once after a completed level, when the player leaves the result popup. Shows an
   * interstitial only if every cap allows it. Resolves after the ad closes (or right away).
   */
  levelCompleted: () => Promise<boolean>;
  openPrivacyOptions: () => Promise<void>;
};

export const idleAdsContext: AdsContextValue = {
  ready: false,
  privacyOptionsRequired: false,
  rewardedReady: false,
  showRewarded: async () => false,
  levelCompleted: async () => false,
  openPrivacyOptions: async () => undefined,
};

export const AdsContext = createContext<AdsContextValue>(idleAdsContext);

export function useAds(): AdsContextValue {
  return useContext(AdsContext);
}
