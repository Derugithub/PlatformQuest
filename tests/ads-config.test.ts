import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import { AD_PLACEMENTS, getUnitId, GOOGLE_TEST_UNIT_IDS, usesTestUnits } from '../src/lib/ads/ad-units.ts';

const require = createRequire(import.meta.url);
const units = require('../src/lib/ads/production-unit-ids.js');
const appId = require('../src/lib/ads/android-app-id.js');
const appJson = require('../app.json');

const SAMPLE = 'ca-app-pub-3940256099942544~3347511713';

test('first version: real unit IDs are switched off', () => {
  assert.equal(units.PRODUCTION_UNIT_IDS, null);
  assert.equal(units.LIVE_AD_UNITS_ENABLED, false);
  assert.deepEqual(units.missingProductionUnits(), ['menu_banner', 'level_interstitial', 'continue_rewarded']);
  assert.doesNotThrow(() => units.checkLiveAdUnits(true));
});

test('enabling live units without real IDs stops the build', () => {
  assert.throws(() => units.checkLiveAdUnits(true, true, { menu_banner: 'ca-app-pub-3940256099942544/9214589741' }));
  assert.doesNotThrow(() =>
    units.checkLiveAdUnits(true, true, {
      menu_banner: 'ca-app-pub-1111111111111111/1234567890',
      level_interstitial: 'ca-app-pub-1111111111111111/1234567891',
      continue_rewarded: 'ca-app-pub-1111111111111111/1234567892',
    }),
  );
});

test('the Google sample app ID is used everywhere and allowed only with test units', () => {
  assert.equal(appId.ADMOB_ANDROID_APP_ID, SAMPLE);
  const plugin = appJson.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'react-native-google-mobile-ads');
  assert.equal(plugin[1].androidAppId, SAMPLE);
  assert.equal(appJson['react-native-google-mobile-ads'].android_app_id, SAMPLE);
  assert.equal(
    appId.resolveAndroidAppId({ profile: 'production', adsMode: 'live', fromConfig: SAMPLE, liveUnitsEnabled: false }),
    SAMPLE,
  );
  assert.throws(() => appId.resolveAndroidAppId({ profile: 'production', adsMode: 'live', fromConfig: SAMPLE, liveUnitsEnabled: true }));
  assert.throws(() => appId.resolveAndroidAppId({ profile: 'preview', fromConfig: 'ca-app-pub-XXXXXXXX~YYYYYYYY' }));
});

test('the root app.json block is rewritten for Gradle without comment lines', () => {
  const text = '{\n  "x": 1,\n  "react-native-google-mobile-ads": {\n    "android_app_id": "old",\n    // comment\n    "delay_app_measurement_init": true\n  }\n}';
  const next = appId.applyRootMobileAdsAppIds(text, { androidAppId: SAMPLE });
  assert.ok(!next.includes('// comment'));
  assert.equal(JSON.parse(next)['react-native-google-mobile-ads'].android_app_id, SAMPLE);
});

test('every placement resolves to a Google test unit', () => {
  assert.equal(usesTestUnits(false), true);
  for (const placement of AD_PLACEMENTS) {
    assert.equal(getUnitId(placement, { testMode: false }), GOOGLE_TEST_UNIT_IDS[placement]);
    assert.ok(GOOGLE_TEST_UNIT_IDS[placement].startsWith('ca-app-pub-3940256099942544/'));
  }
});
