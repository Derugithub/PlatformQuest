import { StyleSheet, View } from 'react-native';

import { COLORS } from '@/theme/tokens';

/** Simple drawn backdrop for the menu screens: sky, clouds and rolling hills. */
export function Scenery() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.sky }]} />
      <View style={[styles.cloud, { top: '10%', left: '8%' }]} />
      <View style={[styles.cloud, styles.cloudSmall, { top: '18%', left: '62%' }]} />
      <View style={[styles.cloud, styles.cloudSmall, { top: '6%', left: '84%' }]} />
      <View style={[styles.hill, { left: '-10%', width: '70%', backgroundColor: '#9BE7A6' }]} />
      <View style={[styles.hill, { left: '45%', width: '75%', backgroundColor: '#9BE7A6', bottom: '-30%' }]} />
      <View style={[styles.hill, styles.near, { left: '-20%', width: '60%' }]} />
      <View style={[styles.hill, styles.near, { left: '50%', width: '70%', bottom: '-52%' }]} />
      <View style={styles.ground} />
    </View>
  );
}

const styles = StyleSheet.create({
  cloud: { position: 'absolute', width: 140, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.95)' },
  cloudSmall: { width: 100, height: 34, borderRadius: 17 },
  hill: { position: 'absolute', bottom: '-40%', height: '80%', borderRadius: 1000 },
  near: { backgroundColor: '#6FD17F', bottom: '-48%' },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 18, backgroundColor: COLORS.grass, borderTopWidth: 3, borderTopColor: COLORS.grassDark },
});
