import type { Dish } from '@tagalong/shared';
import { StyleSheet, View } from 'react-native';

import { palette } from '@/theme/colors';
import { MiniScene } from './MiniScene';
import { PointsChip } from './Points';
import { Txt } from './Txt';

const looks: { sky: [string, string]; hill: string }[] = [
  { sky: ['#E9963A', '#F6CDA4'], hill: '#B8482A' },
  { sky: ['#6F8FCB', '#C7D3DA'], hill: '#5F8D63' },
  { sky: ['#F2B33D', '#FCE6CD'], hill: '#E08A74' },
  { sky: ['#3E56A8', '#9AB0C2'], hill: '#3F7A4E' },
];

export function DishCard({ dish, index }: { dish: Dish; index: number }) {
  const look = looks[index % looks.length];
  return (
    <View style={{ width: 150 }}>
      <View style={styles.art}>
        <MiniScene width={150} height={110} sky={look.sky} hill={look.hill} emoji={dish.emoji} />
        <PointsChip label={String(dish.points)} style={styles.pts} />
        {dish.tasted && (
          <View style={styles.tasted}>
            <Txt size={11.5} weight="bold" color={palette.cream}>
              ✓ Tasted
            </Txt>
          </View>
        )}
      </View>
      <Txt size={14} weight="semibold" style={{ marginTop: 8, marginHorizontal: 2 }}>
        {dish.name}
      </Txt>
      <Txt size={12} color={palette.cocoa} style={{ marginHorizontal: 2 }}>
        {dish.place}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  art: { height: 110, borderRadius: 18, overflow: 'hidden' },
  pts: { position: 'absolute', top: 8, right: 8 },
  tasted: { position: 'absolute', left: 8, bottom: 8, backgroundColor: palette.ink, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
});
