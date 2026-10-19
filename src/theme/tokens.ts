/** Bright cartoon palette shared by every screen, plus the Inter font faces. */

export const COLORS = {
  sky: '#8FD3FF',
  skyDeep: '#5BB8F5',
  grass: '#5BD35B',
  grassDark: '#2F9E44',
  dirt: '#C8813F',
  ink: '#2A1E3B',
  white: '#FFFFFF',
  panel: '#C98B4E',
  panelLight: '#E7B57A',
  panelDark: '#7C4A22',
  panelInner: '#FFF1D6',
  green: '#22C55E',
  greenDark: '#15803D',
  blue: '#3B82F6',
  blueDark: '#1D4ED8',
  orange: '#F97316',
  orangeDark: '#C2410C',
  red: '#EF4444',
  redDark: '#B91C1C',
  gold: '#FFD23F',
  goldDark: '#E6A800',
  grey: '#94A3B8',
  greyDark: '#64748B',
  scrim: 'rgba(15, 23, 42, 0.55)',
  hudBg: 'rgba(15, 23, 42, 0.45)',
  cap: '#14B8A6',
  skin: '#FFD2A6',
} as const;

export const FONTS = {
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  black: 'Inter_800ExtraBold',
} as const;

/** Content stays within this width on tablets and wide phones. */
export const MAX_CONTENT_WIDTH = 860;
/** Popups never get wider than this. */
export const POPUP_MAX_WIDTH = 440;
