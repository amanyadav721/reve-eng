import { Text, type TextProps } from 'react-native';

import { light } from '@/theme/colors';
import { fonts, type FontWeight } from '@/theme/type';

type Props = TextProps & {
  size?: number;
  weight?: FontWeight;
  color?: string;
  /** Tighten letter spacing for headings, as in the mockup. */
  tight?: boolean;
};

export function Txt({ size = 15, weight = 'regular', color = light.text, tight, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: fonts[weight],
          fontSize: size,
          lineHeight: Math.round(size * 1.4),
          color,
          letterSpacing: tight ? -size * 0.025 : 0,
        },
        style,
      ]}
    />
  );
}
