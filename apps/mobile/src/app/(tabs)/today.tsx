import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DishCard } from '@/components/DishCard';
import { LaterToday } from '@/components/LaterToday';
import { NowCard } from '@/components/NowCard';
import { PointsChip } from '@/components/Points';
import { Trail } from '@/components/Trail';
import { Txt } from '@/components/Txt';
import { jaipurDishes, today, traveler } from '@/data/mock';
import { jaipur } from '@/scenes/jaipur';
import { useTrip } from '@/state/trip';
import { palette } from '@/theme/colors';

const TAB_BAR_SPACE = 96;

export default function Today() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { stops, points, now, lastEarned, checkIn, restart } = useTrip();

  const nowIndex = stops.findIndex((s) => s.status === 'now');
  const later = useMemo(() => (nowIndex >= 0 ? stops.slice(nowIndex + 1) : []), [stops, nowIndex]);
  const earnedToday = stops.filter((s) => s.status === 'done').reduce((sum, s) => sum + s.points, 0);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View>
          <Trail scene={jaipur} stops={stops} width={width} lastEarned={lastEarned} />
          <View style={[styles.hello, { top: insets.top + 14 }]}>
            <View style={styles.avatar}>
              <Txt size={16} weight="bold">
                {traveler.initial}
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={12.5} weight="medium" color="rgba(255,255,255,0.85)">
                Hi {traveler.firstName}
              </Txt>
              <Txt size={18} weight="semibold" color="#fff" tight numberOfLines={1}>
                Day {today.dayNumber} in {today.city}
              </Txt>
            </View>
            <PointsChip label={points.toLocaleString('en-IN')} />
          </View>
        </View>

        <View style={styles.content}>
          <NowCard stop={now} dayNumber={today.dayNumber} earnedToday={earnedToday} onCheckIn={checkIn} onRestart={restart} />

          <View style={styles.sectionHead}>
            <Txt size={16} weight="semibold" tight>
              Later today
            </Txt>
            <Txt size={13} weight="medium" color={palette.cocoa}>
              Edit
            </Txt>
          </View>
          <LaterToday stops={later} />

          <View style={styles.sectionHead}>
            <Txt size={16} weight="semibold" tight>
              Your {today.city} food list
            </Txt>
            <Txt size={13} weight="medium" color={palette.cocoa}>
              {jaipurDishes.filter((d) => d.tasted).length} of 6
            </Txt>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dishes} style={{ marginHorizontal: -16 }}>
            {jaipurDishes.map((d, i) => (
              <DishCard key={d.id} dish={d} index={i} />
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.peach },
  hello: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.saffron,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: 16, marginTop: -20 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 26, marginBottom: 10, marginHorizontal: 4 },
  dishes: { gap: 12, paddingHorizontal: 20, paddingBottom: 6 },
});
