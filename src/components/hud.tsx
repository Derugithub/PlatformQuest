import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_HEARTS } from '@/core/hearts';
import type { HudState } from '@/core/protocol';
import { formatClock } from '@/core/timer';
import { GameText, RoundButton } from '@/components/ui';
import { COLORS } from '@/theme/tokens';

/** Top bar over the level: pause, hearts, progress with a head marker, coins, score and timer. */
export function Hud({ hud, onPause }: { hud: HudState; onPause: () => void }) {
  const insets = useSafeAreaInsets();
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (!hud.hurry) return;
    const id = setInterval(() => setBlink((f) => !f), 500);
    return () => clearInterval(id);
  }, [hud.hurry]);
  const flash = hud.hurry && blink;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.bar, { paddingTop: Math.max(6, insets.top), paddingLeft: Math.max(10, insets.left), paddingRight: Math.max(10, insets.right) }]}>
      <View style={styles.side}>
        <RoundButton icon="pause" onPress={onPause} size={42} color="blue" accessibilityLabel="Pause" />
        <View style={styles.pill} accessibilityLabel={`${hud.hearts} hearts`}>
          {Array.from({ length: Math.max(hud.hearts, 1) }, (_, i) => (
            <Ionicons key={i} name={i < hud.hearts ? 'heart' : 'heart-outline'} size={20} color={COLORS.red} />
          ))}
          {hud.hearts >= MAX_HEARTS ? <GameText size={11}>MAX</GameText> : null}
        </View>
      </View>

      <View style={styles.center} pointerEvents="none">
        <View style={styles.track} accessibilityLabel={`Level progress ${Math.round(hud.progress * 100)} percent`}>
          <View style={[styles.fill, { width: `${hud.progress * 100}%` }]} />
          <View style={[styles.head, { left: `${hud.progress * 100}%` }]}>
            <View style={styles.cap} />
          </View>
          <Ionicons name="home" size={16} color={COLORS.white} style={styles.goal} />
        </View>
        {hud.boss ? (
          <View style={styles.bossRow} accessibilityLabel={`Boss health ${hud.boss.hp} of ${hud.boss.max}`}>
            <GameText size={12} outline>
              Cinderhorn
            </GameText>
            <View style={styles.bossTrack}>
              <View style={[styles.bossFill, { width: `${(hud.boss.hp / hud.boss.max) * 100}%` }]} />
            </View>
          </View>
        ) : null}
      </View>

      <View style={[styles.side, styles.right]}>
        <View style={styles.pill}>
          <View style={styles.coin} />
          <GameText size={16}>{hud.coins}</GameText>
        </View>
        <View style={styles.pill}>
          <GameText size={16}>{hud.score.toString().padStart(6, '0')}</GameText>
        </View>
        <View style={[styles.pill, flash ? styles.hurry : null]} accessibilityLabel={`${hud.time} seconds left`}>
          <Ionicons name="time" size={18} color={hud.hurry ? (flash ? COLORS.white : COLORS.red) : COLORS.white} />
          <GameText size={16} color={hud.hurry && !flash ? '#FECACA' : COLORS.white}>
            {formatClock(hud.time)}
          </GameText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  side: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  right: { justifyContent: 'flex-end' },
  center: { width: '26%', maxWidth: 260, paddingTop: 10, alignItems: 'stretch', gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.hudBg, borderRadius: 14, paddingHorizontal: 10, height: 32 },
  hurry: { backgroundColor: COLORS.red },
  coin: { width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, borderWidth: 2, borderColor: COLORS.goldDark },
  track: { height: 14, borderRadius: 7, backgroundColor: COLORS.hudBg, justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 7, backgroundColor: COLORS.green },
  head: { position: 'absolute', width: 22, height: 22, marginLeft: -11, borderRadius: 11, backgroundColor: COLORS.skin, borderWidth: 2, borderColor: COLORS.ink, overflow: 'hidden' },
  cap: { height: 9, backgroundColor: COLORS.cap },
  goal: { position: 'absolute', right: -20 },
  bossRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bossTrack: { flex: 1, height: 12, borderRadius: 6, backgroundColor: COLORS.hudBg, overflow: 'hidden', borderWidth: 1.5, borderColor: COLORS.white },
  bossFill: { height: '100%', backgroundColor: COLORS.red },
});
