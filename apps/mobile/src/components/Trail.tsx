import type { Stop } from '@tagalong/shared';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import type { CityScene, TrailSlot } from '@/scenes/types';
import { palette } from '@/theme/colors';
import { fonts } from '@/theme/type';
import { Laddoo } from './Laddoo';

type Props = {
  scene: CityScene;
  stops: Stop[];
  width: number;
  /** Bumps each time the user checks in, to fire the "+pts" float. */
  lastEarned?: { stopId: string; points: number; key: number };
  onStopPress?: (stop: Stop) => void;
};

const MOVE = { duration: 900, easing: Easing.bezier(0.45, 0, 0.2, 1) };

export function Trail({ scene, stops, width, lastEarned, onStopPress }: Props) {
  const k = width / scene.width;
  const height = scene.height * k;
  const slotFor = (i: number): TrailSlot => scene.slots[Math.min(i, scene.slots.length - 1)];
  const nowIndex = Math.max(0, stops.findIndex((s) => s.status === 'now'));
  const mascotIndex = stops.some((s) => s.status === 'now') ? nowIndex : stops.length - 1;

  return (
    <View style={{ width, height }}>
      <scene.Art width={width} />

      <Svg width={width} height={height} viewBox={`0 0 ${scene.width} ${scene.height}`} style={StyleSheet.absoluteFill} pointerEvents="none">
        {stops.map((s, i) => {
          const { x, y, r } = slotFor(i);
          const done = s.status === 'done';
          const now = s.status === 'now';
          const base = done ? '#14100c' : now ? '#9C3B22' : '#D7B48F';
          const face = done ? palette.ink : now ? palette.terracotta : palette.cream;
          const bx = x + r * 0.72;
          const by = y - r * 0.72;
          return (
            <G key={s.id}>
              <Ellipse cx={x} cy={y + r * 0.22} rx={r} ry={r} fill={base} />
              <Circle cx={x} cy={y} r={r} fill={face} stroke={now ? palette.cream : 'none'} strokeWidth={3} />
              {done && (
                <>
                  <Circle cx={bx} cy={by} r={Math.max(7, r * 0.38)} fill={palette.leaf} stroke={palette.cream} strokeWidth={2} />
                  <Path d={`M${bx - 3.5} ${by} l2.5 2.5 l4.5 -5`} stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </>
              )}
            </G>
          );
        })}
      </Svg>

      {stops.map((s, i) => {
        const { x, y, r } = slotFor(i);
        const size = r * 2 * k;
        return (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityLabel={`${s.name}, ${s.status}`}
            onPress={() => onStopPress?.(s)}
            style={{ position: 'absolute', left: (x - r) * k, top: (y - r) * k, width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
          >
            {s.status === 'now' && <Pulse size={size} />}
            <Text style={{ fontSize: r * 1.05 * k, opacity: s.status === 'done' ? 0.55 : 1 }}>{s.icon}</Text>
          </Pressable>
        );
      })}

      <WalkingLaddoo slot={slotFor(mascotIndex)} k={k} centerX={scene.width / 2} maxR={Math.max(...scene.slots.map((s) => s.r))} />

      {lastEarned && <FloatingPoints key={lastEarned.key} slot={slotFor(stops.findIndex((s) => s.id === lastEarned.stopId))} k={k} points={lastEarned.points} />}
    </View>
  );
}

/** Laddoo stands beside the current stop, on the side facing the middle of the scene, and hops to the next one. */
function WalkingLaddoo({ slot, k, centerX, maxR }: { slot: TrailSlot; k: number; centerX: number; maxR: number }) {
  const reduceMotion = useReducedMotion();
  // Render once at the largest size and scale down toward the horizon.
  const renderSize = maxR * 2.7 * k;
  const place = (sl: TrailSlot) => {
    const size = sl.r * 2.7;
    const left = sl.x > centerX ? sl.x - sl.r * 0.5 - size : sl.x + sl.r * 0.5;
    return { left: left * k, top: (sl.y - size * 0.86) * k, scale: (size * k) / renderSize };
  };
  const start = place(slot);
  const left = useSharedValue(start.left);
  const top = useSharedValue(start.top);
  const scale = useSharedValue(start.scale);
  const hop = useSharedValue(0);

  useEffect(() => {
    const next = place(slot);
    const opts = reduceMotion ? { duration: 0 } : MOVE;
    left.value = withTiming(next.left, opts);
    top.value = withTiming(next.top, opts);
    scale.value = withTiming(next.scale, opts);
    if (!reduceMotion) {
      hop.value = withSequence(withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 540, easing: Easing.bounce }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot.x, slot.y, slot.r, k]);

  const style = useAnimatedStyle(() => ({
    left: left.value,
    top: top.value,
    transform: [{ scale: scale.value }, { translateY: -22 * k * hop.value }, { rotate: `${-6 * hop.value}deg` }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', transformOrigin: '0% 0%' }, style]}>
      <Laddoo size={renderSize} />
    </Animated.View>
  );
}

function Pulse({ size }: { size: number }) {
  const p = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (!reduceMotion) p.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1);
  }, [p, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: 0.9 * (1 - p.value), transform: [{ scale: 1.15 + p.value * 0.9 }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size, borderWidth: 3, borderColor: palette.cream }, style]} />;
}

function FloatingPoints({ slot, k, points }: { slot: TrailSlot; k: number; points: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 1300, easing: Easing.out(Easing.cubic) });
  }, [p]);
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.15 ? p.value / 0.15 : 1 - (p.value - 0.15) / 0.85,
    transform: [{ translateY: 8 - 54 * p.value }, { scale: p.value < 0.15 ? 0.8 + (p.value / 0.15) * 0.28 : 1.08 - (p.value - 0.15) * 0.1 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: (slot.x - 30) * k, top: (slot.y - slot.r - 44) * k, backgroundColor: palette.gold, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }, style]}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: palette.ink }}>+{points} pts</Text>
    </Animated.View>
  );
}
