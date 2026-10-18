import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { palette } from '@/theme/colors';
import { Laddoo } from './Laddoo';
import { Txt } from './Txt';

/** Placeholder for tabs that aren't built yet. Says what will live here. */
export function ComingSoon({ title, line }: { title: string; line: string }) {
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Laddoo size={120} />
      <Txt size={22} weight="bold" tight style={{ marginTop: 18 }}>
        {title}
      </Txt>
      <Txt size={14} color={palette.cocoa} style={{ marginTop: 6, textAlign: 'center', maxWidth: 280 }}>
        {line}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.peach, alignItems: 'center', justifyContent: 'center', padding: 24, paddingBottom: 120 },
});
