import { useId } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { palette } from '@/theme/colors';

/** A tiny landscape in the scene style, used for dish cards, trip cards and stamps. */
export function MiniScene({ width, height, sky, hill, emoji }: { width: number; height: number; sky: [string, string]; hill: string; emoji?: string }) {
  const id = `ms${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const w = width;
  const h = height;
  return (
    <View style={{ width, height }}>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={sky[0]} />
            <Stop offset="1" stopColor={sky[1]} />
          </LinearGradient>
        </Defs>
        <Rect width={w} height={h} fill={`url(#${id})`} />
        <Circle cx={w * 0.78} cy={h * 0.34} r={h * 0.12} fill={palette.cream} opacity={0.7} />
        <Path d={`M0 ${h * 0.68} C${w * 0.25} ${h * 0.52} ${w * 0.55} ${h * 0.62} ${w} ${h * 0.5} V${h} H0Z`} fill={hill} opacity={0.8} />
        <Path d={`M0 ${h * 0.84} C${w * 0.35} ${h * 0.74} ${w * 0.65} ${h * 0.88} ${w} ${h * 0.78} V${h} H0Z`} fill={hill} />
        {emoji && <Ellipse cx={w * 0.38} cy={h * 0.8} rx={w * 0.23} ry={h * 0.09} fill={palette.cream} />}
      </Svg>
      {emoji && (
        <Text style={{ position: 'absolute', left: w * 0.38 - h * 0.2, top: h * 0.5, width: h * 0.4, textAlign: 'center', fontSize: h * 0.3 }}>{emoji}</Text>
      )}
    </View>
  );
}
