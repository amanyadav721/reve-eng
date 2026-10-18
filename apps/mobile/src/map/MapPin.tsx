import type { Stop } from '@tagalong/shared';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';

import { palette } from '@/theme/colors';
import { fonts } from '@/theme/type';

const SIZE = 40;

/** A stop on the map: same language as the trail nodes. Ink when done, terracotta now, cream ahead. */
export function MapPin({ stop, index, selected, onPress }: { stop: Stop; index: number; selected?: boolean; onPress?: () => void }) {
  const done = stop.status === 'done';
  const now = stop.status === 'now';
  const face = done ? palette.ink : now ? palette.terracotta : palette.cream;
  const base = done ? '#14100c' : now ? '#9C3B22' : '#D7B48F';

  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSpring(selected ? 1.18 : 1, { damping: 12, stiffness: 220 });
  }, [selected, scale]);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${index + 1}. ${stop.name}`} hitSlop={8}>
      <Animated.View style={[styles.wrap, { transformOrigin: '50% 100%' }, lift]}>
        {now && <Pulse />}
        <View style={[styles.base, { backgroundColor: base }]} />
        <View style={[styles.face, { backgroundColor: face, borderColor: selected || now ? palette.cream : 'transparent' }]}>
          <Text style={{ fontSize: 19, opacity: done ? 0.55 : 1 }}>{stop.icon}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: done ? palette.leaf : palette.ink }]}>
          <Text style={styles.badgeText}>{done ? '✓' : index + 1}</Text>
        </View>
        <View style={[styles.tail, { borderTopColor: base }]} />
      </Animated.View>
    </Pressable>
  );
}

function Pulse() {
  const p = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (!reduceMotion) p.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1);
  }, [p, reduceMotion]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.8 * (1 - p.value), transform: [{ scale: 1 + p.value * 0.9 }] }));
  return <Animated.View pointerEvents="none" style={[styles.pulse, ring]} />;
}

const styles = StyleSheet.create({
  wrap: { width: SIZE + 8, height: SIZE + 14, alignItems: 'center' },
  base: { position: 'absolute', top: 4, width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  face: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  pulse: { position: 'absolute', top: 0, width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 3, borderColor: palette.terracotta },
  badge: {
    position: 'absolute',
    top: -4,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.cream,
  },
  badgeText: { color: '#fff', fontSize: 10, fontFamily: fonts.bold, lineHeight: 12 },
  tail: { marginTop: -1, width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
});
