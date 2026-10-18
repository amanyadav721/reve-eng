import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

// The welcome scene: Hawa Mahal, a kite, hills and the red soil the button sits on.

const W = 340;
export const WELCOME_ART_HEIGHT = 470;

const arches = (y: number, xs: number[], w: number, h: number) => xs.map((x) => `M${x} ${y} v-${h} q${w / 2} -${w * 0.6} ${w} 0 v${h}z`).join(' ');

export function WelcomeArt({ width }: { width: number }) {
  const H = WELCOME_ART_HEIGHT;
  return (
    <Svg width={width} height={(width * H) / W} viewBox={`0 0 ${W} ${H}`}>
      <G fill="#FBEFE2">
        <Ellipse cx="250" cy="70" rx="34" ry="11" />
        <Ellipse cx="272" cy="62" rx="20" ry="12" />
        <Ellipse cx="232" cy="64" rx="15" ry="9" />
      </G>
      <G transform="translate(118 58) rotate(14)">
        <Path d="M0 -16 L12 0 L0 18 L-12 0 Z" fill="#B8482A" />
        <Path d="M0 -16 L12 0 L0 0 Z" fill="#E9963A" />
        <Path d="M0 18 q-6 14 4 26 q8 10 -2 22" stroke="#6E5142" strokeWidth="1" fill="none" />
      </G>
      <Path d="M0 200 L38 176 L72 190 L120 160 L160 184 L200 168 L250 190 L290 166 L340 186 V280 H0Z" fill="#8FA7BC" />
      <Path d="M0 236 C60 200 120 214 170 222 C230 232 280 206 340 214 V300 H0Z" fill="#5F8D63" />

      <G transform="translate(172 150)">
        <Rect x="0" y="90" width="168" height="150" fill="#D9705E" />
        <Rect x="18" y="58" width="132" height="40" fill="#E08A74" />
        <Rect x="40" y="30" width="88" height="34" fill="#E5977F" />
        <Rect x="62" y="6" width="44" height="30" fill="#EAA48A" />
        <Path d="M62 6 q22 -18 44 0z" fill="#EAA48A" />
        <Path d="M40 30 q10 -10 20 0z M108 30 q10 -10 20 0z M18 58 q10 -10 20 0z M130 58 q10 -10 20 0z" fill="#E5977F" />
        <Path
          fill="#F8D9C2"
          d={[
            arches(30, [72, 90], 12, 12),
            arches(58, [50, 68, 86, 104], 12, 14),
            arches(90, [28, 48, 68, 88, 108, 128], 12, 16),
            arches(130, [12, 36, 60, 84, 108, 132], 14, 18),
            arches(170, [12, 36, 60, 84, 108, 132], 14, 18),
          ].join(' ')}
        />
        <Rect x="0" y="90" width="168" height="5" fill="#C25F4E" />
        <Rect x="0" y="136" width="168" height="4" fill="#C25F4E" />
        <Rect x="140" y="58" width="10" height="182" fill="#C96B59" opacity={0.6} />
      </G>

      <G>
        <Rect x="34" y="240" width="5" height="40" fill="#6B4A2F" />
        <Circle cx="36" cy="232" r="22" fill="#3F7A4E" />
        <Circle cx="22" cy="246" r="14" fill="#4E8F57" />
        <Circle cx="52" cy="244" r="15" fill="#4E8F57" />
      </G>
      <Path d={`M0 290 C80 270 200 300 340 280 V${H} H0Z`} fill="#7DA857" />
      <Path d={`M0 340 C100 320 220 350 340 330 V${H} H0Z`} fill="#6A9A4A" />
      <Path d={`M0 370 C90 352 230 380 340 360 V${H} H0Z`} fill="#9A4326" />
      <Path d={`M0 392 C110 376 230 400 340 384 V${H} H0Z`} fill="#8C3B22" />
      <G fill="#7A321C" opacity={0.7}>
        <Ellipse cx="60" cy="420" rx="18" ry="3" />
        <Ellipse cx="250" cy="440" rx="24" ry="3" />
        <Ellipse cx="160" cy="455" rx="12" ry="2.5" />
      </G>
    </Svg>
  );
}
