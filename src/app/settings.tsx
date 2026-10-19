import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Scenery } from '@/components/scenery';
import { GameButton, GameText, Panel, RoundButton, ToggleRow } from '@/components/ui';
import { useAds } from '@/lib/ads/ads-context';
import { useGameData } from '@/lib/game-data';
import { COLORS } from '@/theme/tokens';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, updateProgress } = useGameData();
  const ads = useAds();
  return (
    <View style={styles.root}>
      <Scenery />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 16, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 },
        ]}>
        <Panel title="Settings">
          <ToggleRow label="Music" icon="musical-notes" value={settings.music} onChange={(music) => updateSettings({ music })} />
          <ToggleRow label="Sound" icon="volume-high" value={settings.sound} onChange={(sound) => updateSettings({ sound })} />
          <ToggleRow label="Tutorial tips" icon="bulb" value={settings.tips} onChange={(tips) => updateSettings({ tips })} />
          {settings.tips ? (
            <GameButton
              label="Show all tips again"
              size="sm"
              color="orange"
              onPress={() => updateProgress((p) => ({ ...p, tutorialsSeen: [] }))}
            />
          ) : null}
          {ads.privacyOptionsRequired ? (
            <GameButton label="Privacy options" icon="shield-checkmark" size="sm" color="blue" onPress={() => void ads.openPrivacyOptions()} />
          ) : null}
          <GameText size={12} weight="semibold" color={COLORS.greyDark} style={styles.note}>
            PlatformQuest · Zone 1 preview
          </GameText>
        </Panel>
      </ScrollView>
      <View style={[styles.back, { top: insets.top + 10, left: insets.left + 14 }]}>
        <RoundButton icon="arrow-back" onPress={() => router.back()} accessibilityLabel="Back" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  note: { textAlign: 'center' },
  back: { position: 'absolute' },
});
