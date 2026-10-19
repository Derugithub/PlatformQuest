import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { TEST_DEVICE_IDENTIFIERS } from '@/lib/ads/ad-config';
import {
  canOfferRewarded,
  emptyAdState,
  interstitialBlockReason,
  nextSession,
  normalizeClock,
  noteLevelComplete,
  parseAdState,
  recordInterstitial,
  recordRewarded,
  type AdState,
} from '@/lib/ads/ad-policy';
import { getUnitId } from '@/lib/ads/ad-units';
import { AdsContext, type AdsContextValue } from '@/lib/ads/ads-context';
import { isTestAdsMode, logAdDecision } from '@/lib/ads/ads-mode';
import { gatherConsent, privacyOptionsRequired, showPrivacyOptions } from '@/lib/ads/consent';
import { loadGoogleMobileAds } from '@/lib/ads/native-ads';
import { KEYS, readRaw, writeRaw, writeRawSync } from '@/lib/storage';

type Ads = ReturnType<typeof loadGoogleMobileAds>;
type Interstitial = ReturnType<Ads['InterstitialAd']['createForAdRequest']>;
type Rewarded = ReturnType<Ads['RewardedAd']['createForAdRequest']>;

const RETRY_MS = 60_000;

/**
 * Gathers UMP consent first, initialises the SDK only when consent allows ad requests, keeps one
 * interstitial and one rewarded ad preloaded, and applies the caps in ad-policy.ts. Any failure
 * leaves ads off; the game never waits on an ad.
 */
export function AdsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [privacyRequired, setPrivacyRequired] = useState(false);
  const [rewardedLoaded, setRewardedLoaded] = useState(false);

  const stateRef = useRef<AdState>(emptyAdState());
  const loadedRef = useRef(false);
  const readyRef = useRef(false);
  const interstitial = useRef<{ ad: Interstitial; loaded: boolean; onClosed: (() => void) | null } | null>(null);
  const rewarded = useRef<{ ad: Rewarded; loaded: boolean } | null>(null);
  const rewardResolver = useRef<((earned: boolean) => void) | null>(null);
  const earned = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const unsubscribers = useRef<(() => void)[]>([]);

  const commit = useCallback((next: AdState) => {
    stateRef.current = next;
    if (loadedRef.current) void writeRaw(KEYS.ads, JSON.stringify(next));
  }, []);

  // Load counters and count this launch as a session.
  useEffect(() => {
    let alive = true;
    readRaw(KEYS.ads).then((raw) => {
      if (!alive) return;
      const now = Date.now();
      loadedRef.current = true;
      commit(nextSession(normalizeClock(parseAdState(raw), now), 'launch', now));
    });
    const sub = AppState.addEventListener('change', (status) => {
      if (!loadedRef.current) return;
      const now = Date.now();
      if (status === 'background') {
        const next = nextSession(normalizeClock(stateRef.current, now), 'background', now);
        stateRef.current = next;
        writeRawSync(KEYS.ads, JSON.stringify(next));
      } else if (status === 'active') {
        commit(nextSession(normalizeClock(stateRef.current, now), 'active', now));
      }
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [commit]);

  const setUp = useCallback(() => {
    const ads = loadGoogleMobileAds();
    const testMode = isTestAdsMode();
    const testIds = {
      menu_banner: ads.TestIds.ADAPTIVE_BANNER,
      level_interstitial: ads.TestIds.INTERSTITIAL,
      continue_rewarded: ads.TestIds.REWARDED,
    };

    const interstitialId = getUnitId('level_interstitial', { testMode, testIds });
    if (interstitialId) {
      const ad = ads.InterstitialAd.createForAdRequest(interstitialId);
      const holder: { ad: Interstitial; loaded: boolean; onClosed: (() => void) | null } = { ad, loaded: false, onClosed: null };
      interstitial.current = holder;
      const closed = () => {
        const done = holder.onClosed;
        holder.onClosed = null;
        done?.();
      };
      unsubscribers.current.push(
        ad.addAdEventListener(ads.AdEventType.LOADED, () => {
          holder.loaded = true;
        }),
        ad.addAdEventListener(ads.AdEventType.CLOSED, () => {
          holder.loaded = false;
          closed();
          ad.load();
        }),
        ad.addAdEventListener(ads.AdEventType.ERROR, (error) => {
          holder.loaded = false;
          closed();
          logAdDecision('interstitial failed', { error: String(error) });
          timers.current.push(setTimeout(() => ad.load(), RETRY_MS));
        }),
      );
      ad.load();
    }

    const rewardedId = getUnitId('continue_rewarded', { testMode, testIds });
    if (rewardedId) {
      const ad = ads.RewardedAd.createForAdRequest(rewardedId);
      const holder = { ad, loaded: false };
      rewarded.current = holder;
      const finish = (value: boolean) => {
        const resolve = rewardResolver.current;
        rewardResolver.current = null;
        resolve?.(value);
      };
      unsubscribers.current.push(
        ad.addAdEventListener(ads.RewardedAdEventType.LOADED, () => {
          holder.loaded = true;
          setRewardedLoaded(true);
        }),
        ad.addAdEventListener(ads.RewardedAdEventType.EARNED_REWARD, () => {
          earned.current = true;
        }),
        ad.addAdEventListener(ads.AdEventType.CLOSED, () => {
          holder.loaded = false;
          setRewardedLoaded(false);
          finish(earned.current);
          ad.load();
        }),
        ad.addAdEventListener(ads.AdEventType.ERROR, (error) => {
          holder.loaded = false;
          setRewardedLoaded(false);
          logAdDecision('rewarded failed', { error: String(error) });
          finish(false);
          timers.current.push(setTimeout(() => ad.load(), RETRY_MS));
        }),
      );
      ad.load();
    }
  }, []);

  // UMP consent first, then the SDK. Ads stay off on any failure.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info = await gatherConsent();
        if (cancelled) return;
        setPrivacyRequired(privacyOptionsRequired(info));
        if (!info.canRequestAds) {
          logAdDecision('consent does not allow ad requests');
          return;
        }
        const ads = loadGoogleMobileAds();
        if (isTestAdsMode()) {
          await ads.default().setRequestConfiguration({ testDeviceIdentifiers: [...TEST_DEVICE_IDENTIFIERS] });
        }
        await ads.default().initialize();
        if (cancelled) return;
        setUp();
        readyRef.current = true;
        setReady(true);
        logAdDecision('ads ready');
      } catch (error) {
        logAdDecision('ads disabled', { error: String(error) });
      }
    })();
    const pending = timers.current;
    const subs = unsubscribers.current;
    return () => {
      cancelled = true;
      pending.forEach(clearTimeout);
      subs.forEach((unsubscribe) => unsubscribe());
    };
  }, [setUp]);

  const showRewarded = useCallback(async (): Promise<boolean> => {
    const holder = rewarded.current;
    const now = Date.now();
    const s = normalizeClock(stateRef.current, now);
    if (!holder || !holder.loaded || rewardResolver.current) return false;
    if (!canOfferRewarded(s, now, { ready: readyRef.current })) {
      logAdDecision('rewarded blocked');
      return false;
    }
    earned.current = false;
    const got = await new Promise<boolean>((resolve) => {
      rewardResolver.current = resolve;
      holder.ad.show().catch(() => {
        rewardResolver.current = null;
        resolve(false);
      });
    });
    const closedAt = Date.now();
    const base = normalizeClock(stateRef.current, closedAt);
    if (got) commit(recordRewarded(base, closedAt));
    logAdDecision('rewarded closed', { earned: got });
    return got;
  }, [commit]);

  const levelCompleted = useCallback(async (): Promise<boolean> => {
    const now = Date.now();
    const s = noteLevelComplete(normalizeClock(stateRef.current, now));
    const holder = interstitial.current;
    const reason = interstitialBlockReason(s, { now, ready: readyRef.current, loaded: Boolean(holder?.loaded) });
    logAdDecision('interstitial check', { reason, levelsThisSession: s.levelsThisSession });
    if (reason || !holder) {
      commit(s);
      return false;
    }
    commit(recordInterstitial(s, now));
    holder.loaded = false;
    return new Promise<boolean>((resolve) => {
      holder.onClosed = () => resolve(true);
      holder.ad.show().catch(() => {
        holder.onClosed = null;
        resolve(false);
      });
    });
  }, [commit]);

  const openPrivacyOptions = useCallback(async () => {
    try {
      const info = await showPrivacyOptions();
      setPrivacyRequired(privacyOptionsRequired(info));
    } catch (error) {
      logAdDecision('privacy options failed', { error: String(error) });
    }
  }, []);

  const value = useMemo<AdsContextValue>(
    () => ({
      ready,
      privacyOptionsRequired: privacyRequired,
      rewardedReady: ready && rewardedLoaded,
      showRewarded,
      levelCompleted,
      openPrivacyOptions,
    }),
    [ready, privacyRequired, rewardedLoaded, showRewarded, levelCompleted, openPrivacyOptions],
  );

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}
