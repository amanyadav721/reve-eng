import type { Memory } from '@tagalong/shared';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Laddoo } from '@/components/Laddoo';
import { MiniScene } from '@/components/MiniScene';
import { Txt } from '@/components/Txt';
import { aboutYou, companions, learnedThisWeek, loves, skips, trips } from '@/data/mock';
import { palette } from '@/theme/colors';

const tripLooks: { sky: [string, string]; hill: string }[] = [
  { sky: ['#6F8FCB', '#F6CDA4'], hill: '#E08A74' },
  { sky: ['#3E56A8', '#9AB0C2'], hill: '#5A7FC4' },
  { sky: ['#F2B33D', '#FCE6CD'], hill: '#3F7A4E' },
];

const month = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

/** "What Laddoo remembers": every memory, where it came from, and a way to forget it. */
export default function Me() {
  const insets = useSafeAreaInsets();
  const [facts, setFacts] = useState(aboutYou);
  const [people, setPeople] = useState(companions);
  const [learnedUndone, setLearnedUndone] = useState(false);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 110 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Laddoo size={66} variant="head" />
          <View style={{ flex: 1 }}>
            <Txt size={23} weight="bold" tight style={{ lineHeight: 27 }}>
              What Laddoo remembers
            </Txt>
            <Txt size={13} color={palette.cocoa} style={{ marginTop: 4 }}>
              Only you can see this. Tap anything to change it, or forget it.
            </Txt>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {!learnedUndone && (
            <Animated.View exiting={FadeOut}>
              <Section title="Learned this week" />
              <View style={styles.learned}>
                <Laddoo size={40} variant="head" />
                <View style={{ flex: 1 }}>
                  <Txt size={13.5} color={palette.cream}>
                    {learnedThisWeek.text}
                  </Txt>
                  <Pressable onPress={() => setLearnedUndone(true)} accessibilityRole="button" accessibilityLabel="Undo this memory">
                    <Txt size={11.5} color="#C9AE98" style={{ marginTop: 4 }}>
                      {learnedThisWeek.evidence} · <Txt size={11.5} weight="semibold" color={palette.cream}>Undo</Txt>
                    </Txt>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          )}

          <Section title="About you" />
          <Card>
            {facts.map((m, i) => (
              <MemoryRow key={m.id} memory={m} first={i === 0} onForget={() => setFacts((f) => f.filter((x) => x.id !== m.id))} />
            ))}
          </Card>

          <Section title="You love · you skip" />
          <View style={styles.tags}>
            {loves.map((t) => (
              <View key={t} style={styles.tag}>
                <Txt size={13} weight="semibold">
                  {t}
                </Txt>
              </View>
            ))}
            {skips.map((t) => (
              <View key={t} style={[styles.tag, styles.tagSkip]}>
                <Txt size={13} weight="semibold" color={palette.cocoa} style={{ textDecorationLine: 'line-through' }}>
                  {t}
                </Txt>
              </View>
            ))}
          </View>

          <Section title="Travels with" />
          <Card>
            {people.map((m, i) => (
              <MemoryRow key={m.id} memory={m} first={i === 0} iconBg="#E5D0F0" onForget={() => setPeople((p) => p.filter((x) => x.id !== m.id))} />
            ))}
          </Card>

          <Section title="Trips together" right={`${trips.length} trips`} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
            {trips.map((t, i) => (
              <View key={t.id} style={styles.trip}>
                <MiniScene width={128} height={76} sky={tripLooks[i % 3].sky} hill={tripLooks[i % 3].hill} />
                <View style={{ padding: 10, paddingTop: 8 }}>
                  <Txt size={14} weight="semibold">
                    {t.city}
                  </Txt>
                  <Txt size={12} color={palette.cocoa}>
                    {t.status === 'active' ? 'Now · Day 2' : `${month(t.startDate)} · ${t.stamps} stamps`}
                  </Txt>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, right }: { title: string; right?: string }) {
  return (
    <View style={styles.section}>
      <Txt size={16} weight="semibold" tight>
        {title}
      </Txt>
      {right && (
        <Txt size={13} weight="medium" color={palette.cocoa}>
          {right}
        </Txt>
      )}
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function MemoryRow({ memory, first, iconBg = palette.sand, onForget }: { memory: Memory; first: boolean; iconBg?: string; onForget: () => void }) {
  return (
    <Animated.View layout={LinearTransition.springify()} exiting={FadeOut.duration(180)} style={[styles.row, !first && styles.rowDivider]}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Txt size={16} weight="bold">
          {memory.icon}
        </Txt>
      </View>
      <View style={{ flex: 1 }}>
        <Txt size={14} weight="semibold">
          {memory.text}
        </Txt>
        <Txt size={11.5} color={palette.cocoa}>
          {memory.evidence}
        </Txt>
      </View>
      <Pressable onPress={onForget} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Forget: ${memory.text}`} style={styles.forget}>
        <Txt size={18} color={palette.dune}>
          ×
        </Txt>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.peach },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingBottom: 6 },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 22, marginBottom: 10, marginHorizontal: 4 },
  learned: { backgroundColor: palette.ink, borderRadius: 20, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  card: { backgroundColor: palette.cream, borderWidth: 1.5, borderColor: palette.creamLine, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowDivider: { borderTopWidth: 1.5, borderStyle: 'dashed', borderTopColor: palette.creamLine },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  forget: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: palette.cream, borderWidth: 1.5, borderColor: palette.creamLine },
  tagSkip: { backgroundColor: 'transparent' },
  trip: { width: 128, borderRadius: 18, overflow: 'hidden', backgroundColor: palette.cream, borderWidth: 1.5, borderColor: palette.creamLine },
});
