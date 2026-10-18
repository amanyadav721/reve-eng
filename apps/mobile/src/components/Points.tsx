import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { palette } from '@/theme/colors';
import { Txt } from './Txt';

export function Coin({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Defs>
        <RadialGradient id="coin" cx="35%" cy="35%" r="65%">
          <Stop offset="0" stopColor="#FFD877" />
          <Stop offset="0.6" stopColor={palette.gold} />
          <Stop offset="1" stopColor="#C98A12" />
        </RadialGradient>
      </Defs>
      <Circle cx="8" cy="8" r="8" fill="url(#coin)" />
      <Circle cx="8" cy="8" r="7.25" fill="none" stroke="rgba(150,95,10,0.35)" strokeWidth="1.5" />
    </Svg>
  );
}

/** Cream chip with a gold coin: "+25 pts", "1,240". */
export function PointsChip({ label, background = 'rgba(252,230,205,0.95)', style }: { label: string; background?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: background, borderRadius: 999, paddingVertical: 5, paddingLeft: 6, paddingRight: 10, alignSelf: 'flex-start' },
        style,
      ]}
    >
      <Coin />
      <Txt size={12.5} weight="semibold">
        {label}
      </Txt>
    </View>
  );
}
