import { Text } from 'react-native';

import { fonts } from '@/theme/type';
import { Txt } from './Txt';

/** Renders Laddoo's lines, where **double asterisks** mark the remembered detail. */
export function RichText({ text, size = 13.5, color }: { text: string; size?: number; color?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Txt size={size} color={color} style={{ flex: 1 }}>
      {parts.map((part, i) =>
        part.startsWith('**') ? (
          <Text key={i} style={{ fontFamily: fonts.semibold }}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          part
        ),
      )}
    </Txt>
  );
}
