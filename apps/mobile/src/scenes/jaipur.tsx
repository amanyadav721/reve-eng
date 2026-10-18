import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { CityScene } from './types';

// Jaipur at golden hour: Nahargarh fort on the hill, Hawa Mahal, a bazaar and a kachori cart.
// The trail runs from the foreground (morning) to the hilltop (sunset).

const W = 340;
const H = 392;

const TRAIL = 'M 30 420 C 40 385, 50 358, 72 342 C 110 318, 175 335, 205 312 C 232 292, 150 292, 120 272 C 92 254, 200 258, 222 240 C 240 225, 175 218, 158 202';

const archRow = (y: number, xs: number[], w: number, h: number) =>
  xs.map((x) => `M${x} ${y} v-${h} q${w / 2} -${w * 0.6} ${w} 0 v${h}z`).join(' ');

function Art({ width }: { width: number }) {
  return (
    <Svg width={width} height={(width * H) / W} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="jp-sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3E56A8" />
          <Stop offset="0.4" stopColor="#6F8FCB" />
          <Stop offset="0.58" stopColor="#C7D3DA" />
          <Stop offset="0.68" stopColor="#F6CDA4" />
        </LinearGradient>
        <RadialGradient id="jp-glow">
          <Stop offset="0" stopColor="#FCE3A8" stopOpacity="0.9" />
          <Stop offset="1" stopColor="#FCE3A8" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width={W} height={H} fill="url(#jp-sky)" />
      <Circle cx="196" cy="186" r="70" fill="url(#jp-glow)" />
      <Circle cx="196" cy="186" r="20" fill="#F7C873" />

      {/* clouds */}
      <G fill="#F4F0F0" opacity={0.9}>
        <Ellipse cx="282" cy="140" rx="30" ry="9" />
        <Ellipse cx="300" cy="133" rx="17" ry="10" />
        <Ellipse cx="266" cy="135" rx="13" ry="8" />
      </G>
      <G fill="#F4F0F0" opacity={0.7}>
        <Ellipse cx="54" cy="156" rx="26" ry="7" />
        <Ellipse cx="68" cy="150" rx="14" ry="8" />
      </G>

      {/* mountains, Nahargarh hill and fort */}
      <Path d="M0 206 L36 186 L78 198 L120 178 L160 196 L210 182 L256 198 L300 180 L340 194 V240 H0Z" fill="#9AB0C2" />
      <Path d="M70 236 C108 200 168 190 222 204 C262 214 300 224 340 230 V270 H0 V244Z" fill="#5F8D63" />
      <G fill="#D7A46F">
        <Rect x="128" y="194" width="62" height="9" />
        {[128, 138, 148, 168, 178, 185].map((x) => (
          <Rect key={x} x={x} y="190" width="5" height="5" />
        ))}
        <Rect x="154" y="181" width="12" height="22" />
        <Path d="M154 181 q6 -9 12 0z" />
      </G>
      <Rect x="128" y="201" width="62" height="2" fill="#B98552" />

      {/* city ground */}
      <Path d={`M0 256 C80 240 170 250 340 242 V${H} H0Z`} fill="#7DA857" />

      {/* Hawa Mahal */}
      <G transform="translate(16 222)">
        <Rect x="0" y="26" width="70" height="44" fill="#D9705E" />
        <Rect x="8" y="12" width="54" height="18" fill="#E08A74" />
        <Rect x="20" y="2" width="30" height="13" fill="#E5977F" />
        <Path d="M20 2 q15 -10 30 0z" fill="#E5977F" />
        <Path
          fill="#F8D9C2"
          d={[archRow(15, [26, 38], 6, 6), archRow(30, [13, 25, 37, 49], 6, 8), archRow(46, [6, 18, 30, 42, 54], 7, 9), archRow(64, [6, 18, 30, 42, 54], 7, 9)].join(' ')}
        />
      </G>

      {/* bazaar awnings */}
      <G transform="translate(250 222)">
        <Rect x="0" y="12" width="30" height="18" fill="#F1D3B0" />
        <Path d="M-3 12 h36 l-4 -9 h-28z" fill="#B8482A" />
        <Path d="M5 12 l2 -9 M13 12 l1 -9 M21 12 l-1 -9 M29 12 l-2 -9" stroke="#F6E7C8" strokeWidth="3" />
        <Rect x="40" y="16" width="30" height="16" fill="#F1D3B0" />
        <Path d="M37 16 h36 l-4 -9 h-28z" fill="#3F7A4E" />
        <Path d="M45 16 l2 -9 M53 16 l1 -9 M61 16 l-1 -9 M69 16 l-2 -9" stroke="#F6E7C8" strokeWidth="3" />
      </G>

      {/* trees */}
      <G>
        <Rect x="20" y="320" width="4" height="30" fill="#6B4A2F" />
        <Circle cx="22" cy="312" r="18" fill="#3F7A4E" />
        <Circle cx="8" cy="324" r="12" fill="#4E8F57" />
      </G>

      {/* foreground */}
      <Path d={`M0 326 C90 306 250 336 340 312 V${H} H0Z`} fill="#6A9A4A" />

      {/* kachori cart */}
      <G transform="translate(284 292)">
        <Rect x="0" y="16" width="44" height="20" rx="3" fill="#B8482A" />
        <Rect x="0" y="16" width="44" height="5" fill="#9C3B22" />
        <Circle cx="9" cy="39" r="5" fill="#3A2A20" />
        <Circle cx="35" cy="39" r="5" fill="#3A2A20" />
        <Rect x="20" y="-10" width="3" height="27" fill="#6B4A2F" />
        <Path d="M-6 -8 q27 -22 56 0z" fill="#E9963A" />
        <Path d="M8 -8 q14 -14 28 0z" fill="#F2B33D" />
      </G>

      {/* the trail: wide in front, narrow toward the hill */}
      <Path d="M 30 420 C 40 385, 50 358, 72 342 C 110 318, 175 335, 205 312 C 232 292, 150 292, 120 272" fill="none" stroke="#F4DDBF" strokeWidth="18" strokeLinecap="round" />
      <Path d="M 120 272 C 92 254, 200 258, 222 240 C 240 225, 175 218, 158 202" fill="none" stroke="#F4DDBF" strokeWidth="10" strokeLinecap="round" />
      <Path d={TRAIL} fill="none" stroke="#E5C29C" strokeWidth="2.5" strokeDasharray="5 9" strokeLinecap="round" />
    </Svg>
  );
}

export const jaipur: CityScene = {
  city: 'Jaipur',
  width: W,
  height: H,
  // Near to far. A day with more stops than slots reuses the last slot.
  slots: [
    { x: 72, y: 342, r: 20 },
    { x: 205, y: 312, r: 21 },
    { x: 120, y: 272, r: 17 },
    { x: 222, y: 240, r: 14 },
    { x: 158, y: 202, r: 12 },
  ],
  Art,
};
