import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MISSION_FAILED_ACTIONS, type MissionFailedAction } from '@/core/run-flow';
import { STAR_LABELS, type Stars } from '@/core/scoring';
import { formatClock } from '@/core/timer';
import { GameButton, GameText, Panel, StarRow, ToggleRow, type ButtonColor, type IconName } from '@/components/ui';
import { COLORS } from '@/theme/tokens';

/** Full-screen scrim with a centred panel, padded by the safe-area insets on all four sides. */
export function Overlay({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const pad = { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 12, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 };
  return (
    <View style={[StyleSheet.absoluteFill, styles.scrim]} accessibilityViewIsModal>
      <ScrollView contentContainerStyle={[styles.center, pad, { minHeight: height }]} bounces={false}>
        {children}
      </ScrollView>
    </View>
  );
}

export function PausePopup({
  music,
  sound,
  onMusic,
  onSound,
  onResume,
  onRestart,
  onMenu,
}: {
  music: boolean;
  sound: boolean;
  onMusic: (v: boolean) => void;
  onSound: (v: boolean) => void;
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  return (
    <Overlay>
      <Panel title="Paused">
        <ToggleRow label="Music" icon="musical-notes" value={music} onChange={onMusic} />
        <ToggleRow label="Sound" icon="volume-high" value={sound} onChange={onSound} />
        <GameButton label="Resume" icon="play" color="green" onPress={onResume} />
        <View style={styles.row}>
          <GameButton label="Restart" icon="refresh" color="orange" onPress={onRestart} style={styles.flex} />
          <GameButton label="Main Menu" icon="home" color="blue" onPress={onMenu} style={styles.flex} />
        </View>
      </Panel>
    </Overlay>
  );
}

export function TipPopup({ title, body, onClose, onSkipAll }: { title: string; body: string; onClose: () => void; onSkipAll: () => void }) {
  return (
    <Overlay>
      <Panel title="Tip">
        <GameText size={20} weight="black" color={COLORS.ink} style={styles.centerText}>
          {title}
        </GameText>
        <GameText size={16} weight="semibold" color={COLORS.ink} style={styles.centerText}>
          {body}
        </GameText>
        <View style={styles.row}>
          <GameButton label="Skip tips" color="grey" size="sm" onPress={onSkipAll} style={styles.flex} />
          <GameButton label="Got it" color="green" size="sm" onPress={onClose} style={styles.flex} />
        </View>
      </Panel>
    </Overlay>
  );
}

export function AnotherChancePopup({
  storedHearts,
  useEnabled,
  rewardedEnabled,
  busy,
  onNoThanks,
  onUse,
  onRewarded,
}: {
  storedHearts: number;
  useEnabled: boolean;
  rewardedEnabled: boolean;
  busy: boolean;
  onNoThanks: () => void;
  onUse: () => void;
  onRewarded: () => void;
}) {
  return (
    <Overlay>
      <Panel title="Another chance?">
        <View style={styles.heartBadge}>
          <Ionicons name="heart" size={54} color={COLORS.red} />
        </View>
        <GameText size={19} weight="bold" color={COLORS.ink} style={styles.centerText}>
          Do you want to continue?
        </GameText>
        <GameText size={13} weight="semibold" color={COLORS.greyDark} style={styles.centerText}>
          {`Stored extra hearts: ${storedHearts}`}
        </GameText>
        <View style={styles.row}>
          <GameButton label="No, thanks" color="red" size="sm" onPress={onNoThanks} style={styles.flex} disabled={busy} />
          <GameButton label="Use" icon="heart" color="orange" size="sm" onPress={onUse} style={styles.flex} disabled={!useEnabled || busy} accessibilityLabel="Use a stored heart" />
        </View>
        <GameButton
          label="+1 heart"
          icon="play-circle"
          color="green"
          detail={rewardedEnabled ? 'Watch a short ad' : 'Ad not available right now'}
          onPress={onRewarded}
          disabled={!rewardedEnabled || busy}
          accessibilityLabel="Watch an ad for one heart"
        />
      </Panel>
    </Overlay>
  );
}

const FAILED_BUTTONS: Record<MissionFailedAction, { label: string; icon: IconName; color: ButtonColor }> = {
  replay: { label: 'Replay', icon: 'refresh', color: 'green' },
  map: { label: 'Map', icon: 'map', color: 'blue' },
  home: { label: 'Home', icon: 'home', color: 'orange' },
};

/** Shown after a time-out, or after "No, thanks". The button list comes from run-flow, so a Shop button slots in later. */
export function MissionFailedPopup({ reason, onAction }: { reason: 'hearts' | 'pit' | 'time'; onAction: (a: MissionFailedAction) => void }) {
  return (
    <Overlay>
      <Panel title="Mission Failed">
        <GameText size={16} weight="semibold" color={COLORS.ink} style={styles.centerText}>
          {reason === 'time' ? 'The clock ran out. Try a faster route!' : 'Out of hearts this time. You will get it!'}
        </GameText>
        <View style={styles.row}>
          {MISSION_FAILED_ACTIONS.map((action) => {
            const b = FAILED_BUTTONS[action];
            return <GameButton key={action} label={b.label} icon={b.icon} color={b.color} onPress={() => onAction(action)} style={styles.flex} />;
          })}
        </View>
      </Panel>
    </Overlay>
  );
}

export function MissionCompletePopup({
  stars,
  coins,
  score,
  timeSeconds,
  targetSeconds,
  newBest,
  nextLabel,
  busy,
  onReplay,
  onNext,
}: {
  stars: Stars;
  coins: number;
  score: number;
  timeSeconds: number;
  targetSeconds: number;
  newBest: boolean;
  nextLabel: string;
  busy: boolean;
  onReplay: () => void;
  onNext: () => void;
}) {
  return (
    <Overlay>
      <Panel title="Mission Completed">
        <StarRow stars={stars} size={40} />
        <View style={styles.stats}>
          <Stat icon="ellipse" color={COLORS.gold} label="Coins" value={String(coins)} />
          <Stat icon="time" color={COLORS.blue} label="Time" value={formatClock(timeSeconds)} />
          <Stat icon="trophy" color={COLORS.orange} label={newBest ? 'New best' : 'Score'} value={String(score)} />
        </View>
        <View style={styles.starList}>
          {STAR_LABELS.map((label, i) => (
            <View key={label} style={styles.starItem}>
              <Ionicons name={stars[i] ? 'star' : 'star-outline'} size={16} color={stars[i] ? COLORS.goldDark : COLORS.grey} />
              <GameText size={13} weight="semibold" color={COLORS.ink}>
                {i === 2 ? `${label} (${formatClock(targetSeconds)})` : label}
              </GameText>
            </View>
          ))}
        </View>
        <View style={styles.row}>
          <GameButton label="Replay" icon="refresh" color="orange" onPress={onReplay} style={styles.flex} disabled={busy} />
          <GameButton label={nextLabel} icon="arrow-forward" color="green" onPress={onNext} style={styles.flex} disabled={busy} />
        </View>
      </Panel>
    </Overlay>
  );
}

function Stat({ icon, color, label, value }: { icon: IconName; color: string; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={color} />
      <GameText size={12} weight="semibold" color={COLORS.greyDark}>
        {label}
      </GameText>
      <GameText size={18} weight="black" color={COLORS.ink}>
        {value}
      </GameText>
    </View>
  );
}

/** "Time's up!" banner over the frozen level, before Mission Failed. */
export function TimeUpBanner() {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.bannerWrap]}>
      <View style={styles.banner}>
        <GameText size={44} weight="black" outline>
          {"Time's up!"}
        </GameText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: COLORS.scrim },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  centerText: { textAlign: 'center' },
  heartBadge: { alignSelf: 'center' },
  stats: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 1 },
  starList: { gap: 2, alignSelf: 'center' },
  starItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bannerWrap: { alignItems: 'center', justifyContent: 'center' },
  banner: { backgroundColor: COLORS.red, borderRadius: 22, borderWidth: 4, borderColor: COLORS.white, paddingHorizontal: 36, paddingVertical: 10, transform: [{ rotate: '-3deg' }] },
});
