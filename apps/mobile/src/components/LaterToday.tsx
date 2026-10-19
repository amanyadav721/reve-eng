import { formatTime12, type Stop } from '@tagalong/shared';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { palette } from '@/theme/colors';
import { stopMeta } from './NowCard';
import { Txt } from './Txt';

/** A quiet timeline of what's left after the current stop. */
export function LaterToday({ stops, currency }: { stops: Stop[]; currency?: string }) {
  const rows = stops.length
    ? stops.map((s) => ({ key: s.id, time: formatTime12(s.startTime).replace(/ (AM|PM)$/, ''), title: s.name, sub: stopMeta(s, currency).replace(/^\S+\s/, '') }))
    : [{ key: 'none', time: '—', title: 'Nothing left today', sub: 'Rest up. Laddoo will brief you at 8 AM.' }];

  return (
    <View style={{ paddingHorizontal: 4 }}>
      {rows.map((r, i) => (
        <Animated.View key={r.key} entering={FadeIn} layout={LinearTransition.springify()} style={styles.row}>
          <Txt size={13} weight="semibold" color={palette.cocoa} style={styles.time}>
            {r.time}
          </Txt>
          <View style={styles.rail}>
            <View style={styles.dot} />
            {i < rows.length - 1 && <View style={styles.line} />}
          </View>
          <View style={{ flex: 1, paddingBottom: 16 }}>
            <Txt size={14.5} weight="semibold">
              {r.title}
            </Txt>
            <Txt size={12.5} color={palette.cocoa}>
              {r.sub}
            </Txt>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  time: { width: 46, textAlign: 'right', paddingTop: 1 },
  rail: { width: 14, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: palette.cocoa, backgroundColor: palette.peach, marginTop: 5, zIndex: 1 },
  line: { position: 'absolute', top: 16, bottom: -4, width: 2, backgroundColor: palette.creamLine },
});
