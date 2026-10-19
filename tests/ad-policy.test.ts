import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AD_RULES,
  canOfferRewarded,
  canShowBanner,
  emptyAdState,
  interstitialBlockReason,
  MINUTE,
  nextSession,
  noteLevelComplete,
  normalizeClock,
  parseAdState,
  recordInterstitial,
  recordRewarded,
  type AdState,
} from '../src/lib/ads/ad-policy.ts';

const ready = { ready: true, canRequestAds: true, loaded: true };
const T0 = Date.UTC(2026, 9, 19, 9, 0, 0);

function firstSession(): AdState {
  return nextSession(emptyAdState(), 'launch', T0);
}

test('banner only on the main menu and the world map', () => {
  assert.equal(canShowBanner('menu', ready), true);
  assert.equal(canShowBanner('map', ready), true);
  assert.equal(canShowBanner('play', ready), false);
  assert.equal(canShowBanner('settings', ready), false);
  assert.equal(canShowBanner('menu', { ready: false }), false);
  assert.equal(canShowBanner('menu', { ready: true, canRequestAds: false }), false);
});

test('no interstitial after the first two levels of the first session', () => {
  let s = firstSession();
  s = noteLevelComplete(s);
  assert.equal(interstitialBlockReason(s, { ...ready, now: T0 }), 'first two levels of the first session');
  s = noteLevelComplete(s);
  assert.equal(interstitialBlockReason(s, { ...ready, now: T0 }), 'first two levels of the first session');
  s = noteLevelComplete(s);
  assert.equal(interstitialBlockReason(s, { ...ready, now: T0 }), null, 'third level may show one');
});

test('a later session may show one after the first level', () => {
  let s = firstSession();
  s = nextSession(s, 'background', T0 + MINUTE);
  s = nextSession(s, 'active', T0 + MINUTE + AD_RULES.sessionGapMs);
  assert.equal(s.sessionCount, 2);
  assert.equal(s.levelsThisSession, 0);
  s = noteLevelComplete(s);
  assert.equal(interstitialBlockReason(s, { ...ready, now: T0 + 40 * MINUTE }), null);
});

test('a short background does not start a new session', () => {
  let s = firstSession();
  s = nextSession(s, 'background', T0);
  s = nextSession(s, 'active', T0 + 5 * MINUTE);
  assert.equal(s.sessionCount, 1);
});

test('interstitials are at most once every 3 minutes', () => {
  let s = { ...firstSession(), sessionCount: 2, levelsThisSession: 3 };
  s = recordInterstitial(s, T0);
  assert.equal(interstitialBlockReason(s, { ...ready, now: T0 + 2 * MINUTE }), 'shown less than 3 minutes ago');
  assert.equal(interstitialBlockReason(s, { ...ready, now: T0 + 3 * MINUTE }), null);
});

test('never during gameplay, never before consent or load', () => {
  const s = { ...firstSession(), sessionCount: 3, levelsThisSession: 5 };
  assert.equal(interstitialBlockReason(s, { ...ready, now: T0, inLevel: true }), 'during gameplay');
  assert.equal(interstitialBlockReason(s, { ready: false, now: T0 }), 'sdk not ready');
  assert.equal(interstitialBlockReason(s, { ready: true, canRequestAds: false, now: T0 }), 'consent does not allow ad requests');
  assert.equal(interstitialBlockReason(s, { ready: true, loaded: false, now: T0 }), 'not loaded');
});

test('a clock set back cannot lock the cooldown', () => {
  const s = normalizeClock(recordInterstitial(emptyAdState(), T0 + 60 * MINUTE), T0);
  assert.equal(s.lastInterstitialAt, T0);
});

test('rewarded has a daily safety cap', () => {
  let s = emptyAdState();
  for (let i = 0; i < AD_RULES.rewardedDailyCap; i++) s = recordRewarded(s, T0);
  assert.equal(canOfferRewarded(s, T0, ready), false);
  assert.equal(canOfferRewarded(s, T0 + 24 * 60 * MINUTE, ready), true);
});

test('saved ad state parses defensively', () => {
  assert.deepEqual(parseAdState(null), emptyAdState());
  assert.deepEqual(parseAdState('{bad'), emptyAdState());
  const round = parseAdState(JSON.stringify(recordInterstitial(firstSession(), T0)));
  assert.equal(round.lastInterstitialAt, T0);
  assert.equal(round.sessionCount, 1);
});
