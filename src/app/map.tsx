import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuBanner } from '@/components/ad-banner';
import { Scenery } from '@/components/scenery';
import { GameText, RoundButton, StarRow } from '@/components/ui';
import { LEVEL_IDS, type LevelId } from '@/core/level-format';
import { getLevel } from '@/core/levels';
import { isUnlocked } from '@/core/progress';
import { useGameData } from '@/lib/game-data';
import { COLORS, MAX_CONTENT_WIDTH } from '@/theme/tokens';

/** Vertical offsets that make the five nodes wander along a path. */
const NODE_LIFT = [0, -46, 10, -40, -14];

/** World map of Zone 1: five nodes, locked until the previous level is cleared. */
export default function WorldMap() {
  const insets = useSafeAreaInsets();
  const { progress } = useGameData();
  return (
    <View style={styles.root}>
      <Scenery />
      <View style={[styles.top, { paddingTop: insets.top + 10, paddingLeft: insets.left + 14, paddingRight: insets.right + 14 }]}>
        <RoundButton icon="arrow-back" onPress={() => router.back()} accessibilityLabel="Back" />
        <GameText size={28} weight="black" outline style={styles.title} accessibilityRole="header">
          Zone 1 · Berry Hill
        </GameText>
        <View style={styles.pill}>
          <View style={styles.coin} />
          <GameText>{progress.totalCoins}</GameText>
          <Ionicons name="heart" size={18} color={COLORS.gold} style={styles.gap} />
          <GameText accessibilityLabel={`${progress.storedHearts} stored hearts`}>{progress.storedHearts}</GameText>
        </View>
      </View>
      <ScrollView
        horizontal
        contentContainerStyle={[styles.path, { paddingLeft: insets.left + 24, paddingRight: insets.right + 24 }]}
        showsHorizontalScrollIndicator={false}>
        <View style={styles.pathInner}>
          <View style={styles.trail} />
          {LEVEL_IDS.map((id, i) => (
            <Node key={id} id={id} lift={NODE_LIFT[i] ?? 0} unlocked={isUnlocked(progress, id)} stars={progress.levels[id].stars} />
          ))}
        </View>
      </ScrollView>
      <MenuBanner screen="map" />
    </View>
  );
}

function Node({ id, lift, unlocked, stars }: { id: LevelId; lift: number; unlocked: boolean; stars: readonly boolean[] }) {
  const def = getLevel(id);
  const boss = id === '1-5';
  return (
    <View style={[styles.node, { transform: [{ translateY: lift }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={unlocked ? `Level ${id}, ${def.name}` : `Level ${id}, locked`}
        accessibilityState={{ disabled: !unlocked }}
        disabled={!unlocked}
        onPress={() => router.push({ pathname: '/play', params: { level: id } })}
        style={({ pressed }) => [
          styles.circle,
          boss ? styles.boss : null,
          !unlocked ? styles.locked : null,
          pressed ? styles.pressed : null,
        ]}>
        {unlocked ? (
          <GameText size={boss ? 22 : 24} weight="black" outline>
            {boss ? '' : id}
          </GameText>
        ) : (
          <Ionicons name="lock-closed" size={28} color={COLORS.white} />
        )}
        {boss && unlocked ? <Ionicons name="flame" size={34} color={COLORS.white} /> : null}
      </Pressable>
      <StarRow stars={stars} size={20} />
      <GameText size={13} weight="bold" color={COLORS.ink} numberOfLines={1} style={styles.name}>
        {unlocked ? def.name : '???'}
      </GameText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', maxWidth: MAX_CONTENT_WIDTH + 200, alignSelf: 'center' },
  title: { flex: 1, textAlign: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.hudBg, borderRadius: 16, paddingHorizontal: 12, height: 34 },
  gap: { marginLeft: 8 },
  coin: { width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, borderWidth: 2, borderColor: COLORS.goldDark },
  path: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  pathInner: { flexDirection: 'row', alignItems: 'center', gap: 22, paddingTop: 40 },
  trail: { position: 'absolute', left: 40, right: 40, top: 76, height: 10, borderRadius: 5, backgroundColor: COLORS.dirt, opacity: 0.8 },
  node: { width: 128, alignItems: 'center', gap: 4 },
  circle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.green,
    borderWidth: 4,
    borderColor: COLORS.white,
    borderBottomWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boss: { backgroundColor: COLORS.red, width: 86, height: 86, borderRadius: 43 },
  locked: { backgroundColor: COLORS.grey },
  pressed: { transform: [{ translateY: 2 }], borderBottomWidth: 4 },
  name: { maxWidth: 128, textAlign: 'center' },
});
