import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { canShowBanner, type AdScreen } from '@/lib/ads/ad-policy';
import { getUnitId } from '@/lib/ads/ad-units';
import { useAds } from '@/lib/ads/ads-context';
import { isTestAdsMode, logAdDecision } from '@/lib/ads/ads-mode';
import { loadGoogleMobileAds } from '@/lib/ads/native-ads';

/**
 * Anchored adaptive banner for the main menu and world map only (never in a level, so it never
 * covers the controls). Renders nothing until consent and the SDK are ready.
 */
export function MenuBanner({ screen }: { screen: Extract<AdScreen, 'menu' | 'map'> }) {
  const { ready } = useAds();
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);
  if (!canShowBanner(screen, { ready }) || failed) return null;

  const ads = loadGoogleMobileAds();
  const unitId = getUnitId('menu_banner', {
    testMode: isTestAdsMode(),
    testIds: { menu_banner: ads.TestIds.ADAPTIVE_BANNER },
  });
  if (!unitId) return null;
  const { BannerAd, BannerAdSize } = ads;

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={(error) => {
          logAdDecision('banner failed', { error: String(error) });
          setFailed(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
});
