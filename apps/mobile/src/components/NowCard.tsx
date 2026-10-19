import { formatMoneyRange, formatTime12, type Stop, type TransportMode } from '@tagalong/shared';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, FadeInDown } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { palette } from '@/theme/colors';
import { Laddoo } from './Laddoo';
import { PillButton } from './PillButton';
import { PointsChip } from './Points';
import { RichText } from './RichText';
import { Txt } from './Txt';

const modeIcon: Record<TransportMode, string> = { walk: '🚶', auto: '🛺', cab: '🚕', metro: '🚇', bus: '🚌', train: '🚆', scooter: '🛵' };
const modeVerb: Record<TransportMode, string> = { walk: 'walk', auto: 'by auto', cab: 'by cab', metro: 'by metro', bus: 'by bus', train: 'by train', scooter: 'by scooter' };

export function stopMeta(stop: Stop, currency = 'INR'): string {
  const parts: string[] = [];
  if (stop.hop) {
    const fare = formatMoneyRange(stop.hop.fareMin, stop.hop.fareMax, currency);
    parts.push(`${modeIcon[stop.hop.mode]} ${stop.hop.estimated ? '~' : ''}${stop.hop.minutes} min ${modeVerb[stop.hop.mode]}${fare ? ` · ${fare}` : ''}`);
  }
  if (stop.cost) parts.push(`${formatMoneyRange(stop.cost, undefined, currency)}${stop.category === 'sight' ? ' entry' : ''}`);
  if (stop.openUntil) parts.push(`open till ${formatTime12(stop.openUntil).replace(':00', '')}`);
  return parts.join(' · ');
}

type Props = {
  stop?: Stop;
  dayNumber: number;
  earnedToday: number;
  currency?: string;
  /** When the day is done: "5 stops, 2 dishes, 1 sunset". */
  summary?: string;
  /** When the day is done: what's next ("Tomorrow: Udaipur"). */
  tomorrow?: string;
  onCheckIn: () => void;
  onDirections?: () => void;
  onNext?: () => void;
  nextLabel?: string;
};

export function NowCard({ stop, dayNumber, earnedToday, currency, summary, tomorrow, onCheckIn, onDirections, onNext, nextLabel }: Props) {
  return (
    <Animated.View key={stop?.id ?? 'done'} entering={FadeInDown.springify().damping(16)} style={styles.card}>
      {stop ? (
        <>
          <View style={styles.top}>
            <View style={styles.when}>
              <LiveDot />
              <Txt size={11.5} weight="bold" color={palette.terracotta} style={styles.caps}>
                Now{stop.distanceKm !== undefined ? ` · ${stop.distanceKm < 1 ? `${Math.round(stop.distanceKm * 1000)} m` : `${stop.distanceKm} km`}` : ''}
              </Txt>
            </View>
            <PointsChip label={`+${stop.points} pts`} background={palette.sand} />
          </View>
          <Txt size={22} weight="bold" tight style={{ marginTop: 6 }}>
            {stop.name}
          </Txt>
          <Txt size={13} color={palette.cocoa} style={{ marginTop: 2 }}>
            {stopMeta(stop, currency)}
          </Txt>
          {stop.reason && (
            <View style={styles.memory}>
              <Laddoo size={38} variant="head" />
              <RichText text={stop.reason} />
            </View>
          )}
          <View style={styles.actions}>
            <PillButton label="I'm here" onPress={onCheckIn} style={{ flex: 1 }} />
            <PillButton variant="chip" onPress={onDirections} accessibilityLabel="Directions" style={styles.iconBtn}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={palette.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M3 11l18-8-8 18-2-8z" />
              </Svg>
            </PillButton>
          </View>
        </>
      ) : (
        <>
          <View style={styles.top}>
            <Txt size={11.5} weight="bold" color={palette.leaf} style={styles.caps}>
              Day {dayNumber} complete
            </Txt>
            <PointsChip label={`+${earnedToday} pts`} background={palette.sand} />
          </View>
          <Txt size={22} weight="bold" tight style={{ marginTop: 6 }}>
            {summary ?? 'All done for today'}
          </Txt>
          {tomorrow && (
            <Txt size={13} color={palette.cocoa} style={{ marginTop: 2 }}>
              {tomorrow}
            </Txt>
          )}
          <View style={styles.memory}>
            <Laddoo size={38} variant="head" />
            <RichText text="Rest up. Tell me what you **loved or skipped** today and I'll remember it for next time." />
          </View>
          {onNext && <PillButton label={nextLabel ?? 'Plan another trip'} onPress={onNext} />}
        </>
      )}
    </Animated.View>
  );
}

function LiveDot() {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1);
  }, [p]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - p.value), transform: [{ scale: 1 + p.value * 1.6 }] }));
  return (
    <View style={{ width: 7, height: 7 }}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 4, backgroundColor: palette.terracotta }, ring]} />
      <View style={[StyleSheet.absoluteFill, { borderRadius: 4, backgroundColor: palette.terracotta }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.cream,
    borderRadius: 26,
    padding: 16,
    paddingBottom: 14,
    shadowColor: '#5E2716',
    shadowOpacity: 0.16,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  when: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  caps: { textTransform: 'uppercase', letterSpacing: 0.8 },
  memory: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginVertical: 14,
    paddingTop: 14,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.creamLine,
  },
  actions: { flexDirection: 'row', gap: 10 },
  iconBtn: { width: 52, height: 52, paddingVertical: 0, paddingHorizontal: 0 },
});
