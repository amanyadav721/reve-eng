import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { laddoo as c } from '@/theme/colors';

// Laddoo the baby elephant. A stand-in for the Rive character: same art, same idle loop.
// Each moving part is its own full-size SVG layer so it can be animated with plain view
// transforms, which behave the same on iOS, Android and web.

type Variant = 'full' | 'head';

const VIEWBOX = {
  full: { x: 0, y: 0, w: 120, h: 130 },
  head: { x: 8, y: 8, w: 104, h: 92 },
} as const;

type Props = { size: number; variant?: Variant; animated?: boolean };

export function Laddoo({ size, variant = 'full', animated = true }: Props) {
  const vb = VIEWBOX[variant];
  const height = (size * vb.h) / vb.w;
  const reduceMotion = useReducedMotion();
  const live = animated && !reduceMotion;

  // 0 → 1 → 0 breathing cycle drives the bob and the ears.
  const breath = useSharedValue(0);
  const trunk = useSharedValue(0);
  const lids = useSharedValue(0);

  useEffect(() => {
    if (!live) return;
    const ease = Easing.inOut(Easing.sin);
    breath.value = withRepeat(withSequence(withTiming(1, { duration: 1400, easing: ease }), withTiming(0, { duration: 1400, easing: ease })), -1);
    trunk.value = withRepeat(withSequence(withTiming(1, { duration: 1800, easing: ease }), withTiming(0, { duration: 1800, easing: ease })), -1);
    lids.value = withRepeat(withSequence(withDelay(4200, withTiming(1, { duration: 90 })), withTiming(0, { duration: 140 })), -1);
  }, [live, breath, trunk, lids]);

  // Pivot points in viewBox units, converted to percentages of the layer.
  const origin = (x: number, y: number) => `${((x - vb.x) / vb.w) * 100}% ${((y - vb.y) / vb.h) * 100}%`;

  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -breath.value * (height / 65) }, { scaleY: 1 - breath.value * 0.015 }, { scaleX: 1 + breath.value * 0.015 }],
  }));
  const earLStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-7 * breath.value}deg` }] }));
  const earRStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${7 * breath.value}deg` }] }));
  const trunkStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-6 * trunk.value}deg` }] }));
  const lidStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: lids.value }] }));

  const layer = (children: ReactNode) => (
    <Svg width={size} height={height} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} style={StyleSheet.absoluteFill}>
      {children}
    </Svg>
  );

  return (
    <View style={{ width: size, height }} accessibilityRole="image" accessibilityLabel="Laddoo the elephant">
      {variant === 'full' && layer(<Ellipse cx="60" cy="123" rx="32" ry="5" fill="#2b1a10" opacity={0.18} />)}
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: '50% 100%' }, bobStyle]}>
        {variant === 'full' && layer(<Body />)}
        <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin(72, 52) }, earRStyle]}>
          {layer(<Ellipse cx="88" cy="52" rx="16" ry="20" fill="#7F8DAD" />)}
        </Animated.View>
        {layer(
          <G>
            <Circle cx="58" cy="52" r="29" fill={c.skin} />
            <Path d="M78 31 a29 29 0 0 1 4 39 a26 26 0 0 0 -4 -39z" fill={c.skinShade} />
          </G>,
        )}
        <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin(45, 54) }, earLStyle]}>
          {layer(
            <G>
              <Ellipse cx="27" cy="54" rx="18" ry="22" fill={c.ear} />
              <Ellipse cx="29" cy="55" rx="11" ry="15" fill={c.earInner} />
            </G>,
          )}
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin(56, 64) }, trunkStyle]}>
          {layer(
            <G>
              <Path d="M56 64 C 54 80, 60 92, 74 88" fill="none" stroke={c.skin} strokeWidth="13" strokeLinecap="round" />
              <Path d="M50 74 q6 2 12 0 M53 82 q6 2 11 -1" fill="none" stroke="#8492B1" strokeWidth="1.6" strokeLinecap="round" />
            </G>,
          )}
        </Animated.View>
        {layer(<Face />)}
        <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin(57, 44) }, lidStyle]}>
          {layer(
            <G>
              <Ellipse cx="47" cy="50" rx="5.2" ry="6.2" fill={c.skin} />
              <Ellipse cx="67" cy="50" rx="5.2" ry="6.2" fill={c.skin} />
            </G>,
          )}
        </Animated.View>
        {layer(<Hat />)}
      </Animated.View>
    </View>
  );
}

function Body() {
  return (
    <G>
      <Rect x="74" y="64" width="24" height="32" rx="8" fill={c.backpack} />
      <Rect x="74" y="64" width="24" height="12" rx="6" fill="#9C3B22" />
      <Rect x="64" y="96" width="16" height="24" rx="7" fill="#7D89A6" />
      <Ellipse cx="56" cy="92" rx="28" ry="24" fill={c.body} />
      <Ellipse cx="66" cy="98" rx="16" ry="16" fill="#8695B5" opacity={0.6} />
      <Rect x="38" y="98" width="17" height="23" rx="7" fill={c.skin} />
      <Circle cx="42" cy="119" r="2" fill="#EFE3D3" />
      <Circle cx="46.5" cy="120" r="2" fill="#EFE3D3" />
      <Circle cx="51" cy="119" r="2" fill="#EFE3D3" />
      <Path d="M72 70 L60 100" stroke="#9C3B22" strokeWidth="5" strokeLinecap="round" />
    </G>
  );
}

function Face() {
  return (
    <G>
      <Path d="M66 67 q4 4 8 0" fill="none" stroke="#5B4A55" strokeWidth="2" strokeLinecap="round" />
      <Ellipse cx="47" cy="50" rx="4" ry="5" fill={c.eyes} />
      <Ellipse cx="67" cy="50" rx="4" ry="5" fill={c.eyes} />
      <Circle cx="48.6" cy="48" r="1.5" fill="#fff" />
      <Circle cx="68.6" cy="48" r="1.5" fill="#fff" />
      <Ellipse cx="39" cy="61" rx="5" ry="3.2" fill={c.cheeks} opacity={0.85} />
      <Ellipse cx="76" cy="60" rx="4.5" ry="3" fill={c.cheeks} opacity={0.85} />
    </G>
  );
}

function Hat() {
  return (
    <G>
      <Ellipse cx="58" cy="28" rx="30" ry="7.5" fill={c.hatBrim} />
      <Path d="M36 28 C 37 11, 79 11, 80 28 Z" fill={c.hat} />
      <Rect x="37" y="21" width="42" height="5" rx="2" fill={c.hatBand} />
    </G>
  );
}
