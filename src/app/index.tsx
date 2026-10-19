import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuBanner } from '@/components/ad-banner';
import { Scenery } from '@/components/scenery';
import { GameButton, GameText } from '@/components/ui';
import { useGameData } from '@/lib/game-data';
import { COLORS, MAX_CONTENT_WIDTH } from '@/theme/tokens';

/** Main menu: Play and Settings, with the banner along the bottom edge. */
export default function MainMenu() {
  const insets = useSafeAreaInsets();
  const { progress } = useGameData();
  const stars = Object.values(progress.levels).reduce((sum, l) => sum + l.stars.filter(Boolean).length, 0);
  return (
    <View style={styles.root}>
      <Scenery />
      <View style={[styles.content, { paddingTop: insets.top + 12, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
        <GameText size={56} weight="black" outline style={styles.title} accessibilityRole="header">
          PlatformQuest
        </GameText>
        <GameText size={16} weight="bold" color={COLORS.ink} style={styles.subtitle}>
          {`Zone 1: Berry Hill  ·  ${stars}/15 stars  ·  ${progress.totalCoins} coins`}
        </GameText>
        <View style={styles.buttons}>
          <GameButton label="Play" icon="play" size="lg" color="green" onPress={() => router.push('/map')} style={styles.button} />
          <GameButton label="Settings" icon="settings" color="blue" onPress={() => router.push('/settings')} style={styles.button} />
        </View>
      </View>
      <MenuBanner screen="menu" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', width: '100%', maxWidth: MAX_CONTENT_WIDTH, gap: 6 },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: 14 },
  buttons: { width: 280, gap: 12 },
  button: { alignSelf: 'stretch' },
});
