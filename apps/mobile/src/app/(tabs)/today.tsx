import { useUser } from '@clerk/expo';
import type { Dish, Stop } from '@tagalong/shared';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DishCard } from '@/components/DishCard';
import { Laddoo } from '@/components/Laddoo';
import { LaterToday } from '@/components/LaterToday';
import { NowCard } from '@/components/NowCard';
import { PillButton } from '@/components/PillButton';
import { PointsChip } from '@/components/Points';
import { ReplanBar, ReplanReplyCard, Thinking } from '@/components/Replan';
import { Trail } from '@/components/Trail';
import { Txt } from '@/components/Txt';
import { localDate } from '@/lib/trips';
import { jaipur } from '@/scenes/jaipur';
import { useTrip } from '@/state/trip';
import { palette } from '@/theme/colors';

const TAB_BAR_SPACE = 96;

export default function Today() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const t = useTrip();
  const { day, trip, stops, points, now, lastEarned } = t;

  const active = useMemo(() => stops.filter((s) => s.status !== 'skipped'), [stops]);
  const nowIndex = stops.findIndex((s) => s.status === 'now');
  const later = useMemo(() => (nowIndex >= 0 ? stops.slice(nowIndex + 1).filter((s) => s.status !== 'skipped') : []), [stops, nowIndex]);
  const earnedToday = stops.filter((s) => s.status === 'done').reduce((sum, s) => sum + s.points, 0);
  const dishes = useMemo(() => dishesOf(stops, day?.city ?? ''), [stops, day?.city]);
  const firstName = user?.firstName ?? user?.primaryEmailAddress?.emailAddress.split('@')[0] ?? 'traveler';

  if (t.status === 'loading') return <Centered title="Opening your trip…" busy />;
  if (t.status === 'error') return <Centered title="Couldn't load your trip" body={t.error} action={{ label: 'Try again', onPress: t.reload }} />;
  if (t.status === 'none' || !trip || !day) {
    return <Centered title={`Hi ${firstName}! Where to next?`} body="Tell me about your trip and I'll plan every day around you: what to see, what to eat, and how to get there." action={{ label: 'Plan a trip', onPress: () => router.push('/plan') }} />;
  }
  if (!day.planned || t.planning) return <PlanningDay city={day.city} dayNumber={day.dayNumber} error={t.planning?.error} onRetry={t.planDay} />;

  const next = trip.days.find((d) => d.dayNumber === day.dayNumber + 1);
  const isToday = day.date === localDate();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View>
          <Trail scene={jaipur} stops={active} width={width} lastEarned={lastEarned} />
          <View style={[styles.hello, { top: insets.top + 14 }]}>
            <View style={styles.avatar}>
              <Txt size={16} weight="bold">
                {firstName[0]?.toUpperCase()}
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={12.5} weight="medium" color="rgba(255,255,255,0.85)">
                {isToday ? `Hi ${firstName}` : `Coming up · ${new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`}
              </Txt>
              <Txt size={18} weight="semibold" color="#fff" tight numberOfLines={1}>
                Day {day.dayNumber} in {day.city}
              </Txt>
            </View>
            <PointsChip label={points.toLocaleString('en-IN')} />
          </View>
        </View>

        <View style={styles.content}>
          <NowCard
            stop={now}
            dayNumber={day.dayNumber}
            earnedToday={earnedToday}
            currency={day.currency}
            summary={summaryOf(stops)}
            tomorrow={next ? `Tomorrow: day ${next.dayNumber} in ${next.city}.` : 'That was the last day of this trip.'}
            onCheckIn={t.checkIn}
            onNext={() => router.push('/plan')}
          />

          {now && (
            <>
              <Txt size={12.5} weight="semibold" color={palette.cocoa} style={styles.changeHead}>
                Something changed?
              </Txt>
              <ReplanBar busy={t.replanning} onPick={(trigger) => t.replan(trigger)} />
            </>
          )}
          {t.replanning && <Thinking trigger={t.replanning} />}
          {t.reply && !t.replanning && <ReplanReplyCard reply={t.reply} currentFoodId={now?.category === 'food' ? now.placeId : undefined} onChoose={t.chooseFood} onDismiss={t.dismissReply} />}

          <View style={styles.sectionHead}>
            <Txt size={16} weight="semibold" tight>
              Later today
            </Txt>
          </View>
          <LaterToday stops={later} currency={day.currency} />

          {dishes.length > 0 && (
            <>
              <View style={styles.sectionHead}>
                <Txt size={16} weight="semibold" tight>
                  Your {day.city} food list
                </Txt>
                <Txt size={13} weight="medium" color={palette.cocoa}>
                  {dishes.filter((d) => d.tasted).length} of {dishes.length}
                </Txt>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dishes} style={{ marginHorizontal: -16 }}>
                {dishes.map((d, i) => (
                  <DishCard key={d.id} dish={d} index={i} />
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** Food stops are named "Dish at Place". */
function dishesOf(stops: Stop[], city: string): Dish[] {
  return stops
    .filter((s) => s.category === 'food' && s.status !== 'skipped')
    .map((s) => {
      const [name, place] = s.name.includes(' at ') ? [s.name.slice(0, s.name.indexOf(' at ')), s.name.slice(s.name.indexOf(' at ') + 4)] : [s.name, ''];
      return { id: s.id, name: name.charAt(0).toUpperCase() + name.slice(1), city, place, emoji: s.icon, points: s.points, tasted: s.status === 'done' };
    });
}

function summaryOf(stops: Stop[]): string {
  const done = stops.filter((s) => s.status === 'done');
  const food = done.filter((s) => s.category === 'food').length;
  const moments = done.filter((s) => s.moment).length;
  return [`${done.length} stop${done.length === 1 ? '' : 's'}`, food && `${food} dish${food === 1 ? '' : 'es'}`, moments && `${moments} ${done.find((s) => s.moment)!.moment!.replace('_', ' ')}`].filter(Boolean).join(', ');
}

function Centered({ title, body, busy, action }: { title: string; body?: string; busy?: boolean; action?: { label: string; onPress: () => void } }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, styles.centered, { paddingTop: insets.top, paddingBottom: TAB_BAR_SPACE + insets.bottom }]}>
      <StatusBar style="dark" />
      <Laddoo size={120} />
      <Txt size={22} weight="bold" tight style={{ marginTop: 18, textAlign: 'center' }}>
        {title}
      </Txt>
      {body && (
        <Txt size={14} color={palette.cocoa} style={{ marginTop: 8, textAlign: 'center', lineHeight: 21, maxWidth: 320 }}>
          {body}
        </Txt>
      )}
      {busy && <ActivityIndicator color={palette.ink} style={{ marginTop: 18 }} />}
      {action && <PillButton label={action.label} onPress={action.onPress} style={{ marginTop: 22, alignSelf: 'stretch' }} />}
    </View>
  );
}

const PLANNING_STEPS = ['Reading what I remember about you', 'Finding places and famous dishes', 'Checking opening hours', 'Working out rides and fares', 'Timing the sunset', 'Putting it all together'];

/** The AI plans a day in 20–90 seconds: show what it's doing, honestly. */
function PlanningDay({ city, dayNumber, error, onRetry }: { city: string; dayNumber: number; error?: string; onRetry: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (error) return;
    const timer = setInterval(() => setI((x) => Math.min(x + 1, PLANNING_STEPS.length - 1)), 9000);
    return () => clearInterval(timer);
  }, [error]);
  if (error) return <Centered title={`Day ${dayNumber} didn't come together`} body={error} action={{ label: 'Try again', onPress: onRetry }} />;
  return (
    <View style={[styles.root, styles.centered]}>
      <StatusBar style="dark" />
      <Laddoo size={120} />
      <Txt size={22} weight="bold" tight style={{ marginTop: 18, textAlign: 'center' }}>
        Planning day {dayNumber} in {city}
      </Txt>
      <Animated.View key={i} entering={FadeIn}>
        <Txt size={14} color={palette.cocoa} style={{ marginTop: 8, textAlign: 'center' }}>
          {PLANNING_STEPS[i]}…
        </Txt>
      </Animated.View>
      <ActivityIndicator color={palette.ink} style={{ marginTop: 18 }} />
      <Txt size={12} color={palette.dune} style={{ marginTop: 18, textAlign: 'center' }}>
        This takes about a minute. Every place is checked against real data.
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.peach },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
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
  changeHead: { marginTop: 18, marginBottom: 8, marginLeft: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 26, marginBottom: 10, marginHorizontal: 4 },
  dishes: { gap: 12, paddingHorizontal: 20, paddingBottom: 6 },
});
