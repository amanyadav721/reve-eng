import { formatTime12 } from '@tagalong/shared';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { stopMeta } from '@/components/NowCard';
import { PillButton } from '@/components/PillButton';
import { PointsChip } from '@/components/Points';
import { RichText } from '@/components/RichText';
import { Txt } from '@/components/Txt';
import { MAP_ATTRIBUTION } from '@/map/style';
import { TripMap } from '@/map/TripMap';
import { useTrip } from '@/state/trip';
import { palette } from '@/theme/colors';

const TAB_BAR = 84;
const CARD = 236;

/** The day on a real, interactive map: our own style on OpenStreetMap data, no Google. */
export default function Explore() {
  const insets = useSafeAreaInsets();
  const { stops: all, now, checkIn, day } = useTrip();
  const stops = all.filter((s) => s.status !== 'skipped');
  const [selectedId, setSelectedId] = useState<string | undefined>(now?.id);
  const [fitKey, setFitKey] = useState(0);
  const selected = stops.find((s) => s.id === selectedId) ?? now ?? stops[stops.length - 1];
  const index = stops.indexOf(selected);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <TripMap
        stops={stops}
        selectedId={selected?.id}
        onSelect={setSelectedId}
        fitKey={fitKey}
        padding={{ top: insets.top + 90, right: 40, bottom: CARD + TAB_BAR + insets.bottom + 30, left: 40 }}
      />

      {/* Header */}
      <View style={[styles.header, { top: insets.top + 12 }]} pointerEvents="box-none">
        <View style={styles.titleChip}>
          <Txt size={12} weight="medium" color={palette.cocoa}>
            Day {day?.dayNumber ?? 1} · {stops.filter((s) => s.status === 'done').length} of {stops.length} done
          </Txt>
          <Txt size={17} weight="semibold" tight>
            {day?.city ?? 'Your trip'}
          </Txt>
        </View>
        <Pressable onPress={() => setFitKey((k) => k + 1)} style={styles.round} accessibilityRole="button" accessibilityLabel="Show the whole day">
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={palette.ink} strokeWidth={2} strokeLinecap="round">
            <Circle cx="12" cy="12" r="7" />
            <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </Svg>
        </Pressable>
      </View>

      {/* Selected stop */}
      {selected && (
        <View style={[styles.sheet, { bottom: TAB_BAR + insets.bottom + 10 }]} pointerEvents="box-none">
          <View style={styles.attribution} pointerEvents="none">
            <Txt size={10} color={palette.cocoa}>
              {MAP_ATTRIBUTION}
            </Txt>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ marginBottom: 10 }}>
            {stops.map((s, i) => {
              const on = s.id === selected.id;
              return (
                <Pressable key={s.id} onPress={() => setSelectedId(s.id)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Txt size={12.5} weight="semibold" color={on ? palette.cream : palette.ink}>
                    {s.status === 'done' ? '✓' : i + 1} · {s.name.split(' at ')[0]}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>

          <Animated.View key={selected.id} entering={FadeInDown.springify().damping(16)} style={styles.card}>
            <View style={styles.cardTop}>
              <Txt size={11.5} weight="bold" color={selected.status === 'now' ? palette.terracotta : palette.cocoa} style={styles.caps}>
                {selected.status === 'now' ? 'Now' : selected.status === 'done' ? 'Done' : formatTime12(selected.startTime)} · Stop {index + 1}
              </Txt>
              <PointsChip label={`${selected.status === 'done' ? '' : '+'}${selected.points} pts`} background={palette.sand} />
            </View>
            <Txt size={19} weight="bold" tight numberOfLines={1} style={{ marginTop: 4 }}>
              {selected.name}
            </Txt>
            {!!stopMeta(selected) && (
              <Txt size={12.5} color={palette.cocoa} numberOfLines={1}>
                {stopMeta(selected)}
              </Txt>
            )}
            {selected.reason && (
              <View style={{ marginTop: 8 }}>
                <RichText text={selected.reason} size={13} />
              </View>
            )}
            {selected.status === 'now' && <PillButton label="I'm here" onPress={checkIn} style={{ marginTop: 12 }} />}
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.peach },
  header: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleChip: {
    backgroundColor: palette.cream,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#5E2716',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.cream,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5E2716',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  sheet: { position: 'absolute', left: 0, right: 0 },
  attribution: { alignSelf: 'flex-end', marginRight: 16, marginBottom: 8, backgroundColor: 'rgba(252,230,205,0.85)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  chips: { gap: 8, paddingHorizontal: 16 },
  chip: { backgroundColor: palette.cream, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1.5, borderColor: palette.creamLine },
  chipOn: { backgroundColor: palette.ink, borderColor: palette.ink },
  card: {
    marginHorizontal: 16,
    backgroundColor: palette.cream,
    borderRadius: 24,
    padding: 16,
    shadowColor: '#5E2716',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  caps: { textTransform: 'uppercase', letterSpacing: 0.8 },
});
