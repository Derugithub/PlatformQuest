import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';

import { COLORS, FONTS, POPUP_MAX_WIDTH } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Weight = keyof typeof FONTS;

export function GameText({
  weight = 'bold',
  size = 16,
  color = COLORS.white,
  outline = false,
  style,
  ...rest
}: TextProps & { weight?: Weight; size?: number; color?: string; outline?: boolean; style?: StyleProp<TextStyle> }) {
  return (
    <Text
      {...rest}
      allowFontScaling={false}
      style={[{ fontFamily: FONTS[weight], fontSize: size, color }, outline ? styles.outline : null, style]}
    />
  );
}

const BUTTON_COLORS = {
  green: [COLORS.green, COLORS.greenDark],
  blue: [COLORS.blue, COLORS.blueDark],
  orange: [COLORS.orange, COLORS.orangeDark],
  red: [COLORS.red, COLORS.redDark],
  grey: [COLORS.grey, COLORS.greyDark],
  gold: [COLORS.gold, COLORS.goldDark],
} as const;

export type ButtonColor = keyof typeof BUTTON_COLORS;

/** Chunky cartoon button with a darker bottom edge. */
export function GameButton({
  label,
  onPress,
  color = 'green',
  icon,
  disabled,
  size = 'md',
  detail,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  color?: ButtonColor;
  icon?: IconName;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  detail?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const [face, edge] = disabled ? BUTTON_COLORS.grey : BUTTON_COLORS[color];
  const height = size === 'lg' ? 60 : size === 'md' ? 50 : 42;
  const font = size === 'lg' ? 22 : size === 'md' ? 18 : 15;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { height, backgroundColor: face, borderBottomColor: edge, opacity: disabled ? 0.55 : 1 },
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}>
      {icon ? <Ionicons name={icon} size={font + 4} color={COLORS.white} /> : null}
      <View style={styles.buttonText}>
        <GameText size={font} weight="black" outline numberOfLines={1}>
          {label}
        </GameText>
        {detail ? (
          <GameText size={11} weight="semibold" numberOfLines={1}>
            {detail}
          </GameText>
        ) : null}
      </View>
    </Pressable>
  );
}

export function RoundButton({
  icon,
  onPress,
  color = 'blue',
  size = 48,
  accessibilityLabel,
}: {
  icon: IconName;
  onPress: () => void;
  color?: ButtonColor;
  size?: number;
  accessibilityLabel: string;
}) {
  const [face, edge] = BUTTON_COLORS[color];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.round,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: face, borderBottomColor: edge },
        pressed ? styles.pressed : null,
      ]}>
      <Ionicons name={icon} size={size * 0.5} color={COLORS.white} />
    </Pressable>
  );
}

/** Wooden panel used by every popup. Original art: layered rounded planks with a cream inset. */
export function Panel({ title, children, style }: { title?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.panel, style]}>
      {title ? (
        <View style={styles.titleBar}>
          <GameText size={26} weight="black" outline accessibilityRole="header" numberOfLines={1}>
            {title}
          </GameText>
        </View>
      ) : null}
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

export function StarRow({ stars, size = 28 }: { stars: readonly boolean[]; size?: number }) {
  return (
    <View style={styles.starRow} accessibilityLabel={`${stars.filter(Boolean).length} of 3 stars`}>
      {stars.map((on, i) => (
        <Ionicons key={i} name={on ? 'star' : 'star-outline'} size={size} color={on ? COLORS.gold : 'rgba(42,30,59,0.35)'} />
      ))}
    </View>
  );
}

export function ToggleRow({ label, value, onChange, icon }: { label: string; value: boolean; onChange: (next: boolean) => void; icon: IconName }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={styles.toggleRow}>
      <Ionicons name={icon} size={22} color={COLORS.ink} />
      <GameText size={17} color={COLORS.ink} style={styles.toggleLabel}>
        {label}
      </GameText>
      <View style={[styles.switch, { backgroundColor: value ? COLORS.green : COLORS.grey }]}>
        <View style={[styles.knob, value ? styles.knobOn : null]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outline: {
    textShadowColor: 'rgba(42,30,59,0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
  },
  button: {
    borderRadius: 16,
    borderBottomWidth: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: 'rgba(42,30,59,0.35)',
  },
  buttonText: { alignItems: 'center', flexShrink: 1 },
  pressed: { transform: [{ translateY: 2 }], borderBottomWidth: 2 },
  round: { alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderWidth: 2, borderColor: 'rgba(42,30,59,0.35)' },
  panel: {
    width: '100%',
    maxWidth: POPUP_MAX_WIDTH,
    backgroundColor: COLORS.panel,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: COLORS.panelDark,
    borderBottomWidth: 8,
    padding: 10,
    alignItems: 'stretch',
  },
  titleBar: {
    alignSelf: 'center',
    marginTop: -34,
    marginBottom: 6,
    backgroundColor: COLORS.orange,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: COLORS.panelDark,
    borderBottomWidth: 6,
    paddingHorizontal: 24,
    paddingVertical: 4,
  },
  inner: { backgroundColor: COLORS.panelInner, borderRadius: 16, padding: 14, gap: 10, borderWidth: 2, borderColor: COLORS.panelLight },
  starRow: { flexDirection: 'row', gap: 4, justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  toggleLabel: { flex: 1 },
  switch: { width: 52, height: 30, borderRadius: 15, padding: 3, justifyContent: 'center' },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.white },
  knobOn: { alignSelf: 'flex-end' },
});
