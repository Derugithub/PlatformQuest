import { StyleSheet, Text, View } from 'react-native';

/** Placeholder home screen. The game arrives in the Zone 1 pull request. */
export default function Home() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>PlatformQuest</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#8FD3FF' },
  title: { fontSize: 32, fontWeight: '700', color: '#1B2A4A' },
});
