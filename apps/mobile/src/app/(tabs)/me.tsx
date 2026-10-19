import { useClerk, useUser } from '@clerk/expo';
import type { Memory } from '@tagalong/shared';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Laddoo } from '@/components/Laddoo';
import { MiniScene } from '@/components/MiniScene';
import { PillButton } from '@/components/PillButton';
import { Txt } from '@/components/Txt';
import { useApi } from '@/lib/api';
import { useTrip } from '@/state/trip';
import { palette } from '@/theme/colors';

const tripLooks: { sky: [string, string]; hill: string }[] = [
  { sky: ['#6F8FCB', '#F6CDA4'], hill: '#E08A74' },
  { sky: ['#3E56A8', '#9AB0C2'], hill: '#5A7FC4' },
  { sky: ['#F2B33D', '#FCE6CD'], hill: '#3F7A4E' },
];

const month = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const WEEK = 7 * 86_400_000;

/** "What Laddoo remembers": every memory, where it came from, and a way to forget it. */
export default function Me() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { signOut } = useClerk();
  const api = useApi();
  const { trip } = useTrip();
  const [memories, setMemories] = useState<Memory[]>();
  const [error, setError] = useState<string>();

  // Fresh every time the tab opens: the quiz, chats and check-ins all add memories.
  useFocusEffect(
    useCallback(() => {
      api<{ memories: Memory[] }>('/v1/memories')
        .then((r) => (setMemories(r.memories), setError(undefined)))
        .catch(() => setError("Couldn't load what Laddoo remembers. Pull to try again."));
    }, [api]),
  );

  const forget = async (m: Memory) => {
    setMemories((list) => list?.filter((x) => x.id !== m.id));
    try {
      await api(`/v1/memories/${m.id}`, { method: 'DELETE' });
    } catch {
      setMemories((list) => (list ? [...list, m] : [m]));
      setError(`Couldn't forget "${m.text}". Try again.`);
    }
  };

  const all = memories ?? [];
  const facts = all.filter((m) => m.kind === 'fact' || m.kind === 'habit' || m.kind === 'promise');
  const people = all.filter((m) => m.kind === 'person');
  const loves = all.filter((m) => m.kind === 'love');
  const skips = all.filter((m) => m.kind === 'skip');
  // Something Laddoo noticed on its own (not from the quiz) this week.
  const learned = all.filter((m) => m.source !== 'quiz' && Date.now() - Date.parse(m.createdAt) < WEEK).at(-1);

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
          {!memories && !error && <ActivityIndicator color={palette.ink} style={{ marginTop: 30 }} />}
          {error && (
            <Txt size={13} color={palette.terracotta} style={{ marginTop: 16, textAlign: 'center' }}>
              {error}
            </Txt>
          )}
          {memories?.length === 0 && (
            <Card>
              <View style={styles.row}>
                <Txt size={14} color={palette.cocoa} style={{ flex: 1 }}>
                  Nothing yet. Take the trip quiz and I'll remember how you like to travel.
                </Txt>
              </View>
            </Card>
          )}

          {learned && (
            <Animated.View exiting={FadeOut}>
              <Section title="Learned this week" />
              <View style={styles.learned}>
                <Laddoo size={40} variant="head" />
                <View style={{ flex: 1 }}>
                  <Txt size={13.5} color={palette.cream}>
                    {learned.text}
                  </Txt>
                  <Pressable onPress={() => forget(learned)} accessibilityRole="button" accessibilityLabel="Undo this memory">
                    <Txt size={11.5} color="#C9AE98" style={{ marginTop: 4 }}>
                      {learned.evidence} · <Txt size={11.5} weight="semibold" color={palette.cream}>Undo</Txt>
                    </Txt>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          )}

          {facts.length > 0 && (
            <>
              <Section title="About you" />
              <Card>
                {facts.map((m, i) => (
                  <MemoryRow key={m.id} memory={m} first={i === 0} onForget={() => forget(m)} />
                ))}
              </Card>
            </>
          )}

          {(loves.length > 0 || skips.length > 0) && (
            <>
              <Section title="You love · you skip" />
              <View style={styles.tags}>
                {loves.map((m) => (
                  <Pressable key={m.id} onLongPress={() => forget(m)} accessibilityHint="Long-press to forget" style={styles.tag}>
                    <Txt size={13} weight="semibold">
                      {m.icon ? `${m.icon} ` : ''}
                      {m.text.replace(/^Loves /, '')}
                    </Txt>
                  </Pressable>
                ))}
                {skips.map((m) => (
                  <Pressable key={m.id} onLongPress={() => forget(m)} accessibilityHint="Long-press to forget" style={[styles.tag, styles.tagSkip]}>
                    <Txt size={13} weight="semibold" color={palette.cocoa} style={{ textDecorationLine: 'line-through' }}>
                      {m.text.replace(/^Skips /, '')}
                    </Txt>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {people.length > 0 && (
            <>
              <Section title="Travels with" />
              <Card>
                {people.map((m, i) => (
                  <MemoryRow key={m.id} memory={m} first={i === 0} iconBg="#E5D0F0" onForget={() => forget(m)} />
                ))}
              </Card>
            </>
          )}

          {trip && (
            <>
              <Section title="Your trip" />
              <View style={styles.trip}>
                <MiniScene width={128} height={76} sky={tripLooks[0].sky} hill={tripLooks[0].hill} />
                <View style={{ padding: 10, paddingTop: 8 }}>
                  <Txt size={14} weight="semibold">
                    {trip.destination}
                  </Txt>
                  <Txt size={12} color={palette.cocoa}>
                    {month(trip.startDate)} · {trip.days.length} day{trip.days.length === 1 ? '' : 's'}
                  </Txt>
                </View>
              </View>
            </>
          )}

          <Section title="Account" />
          <Card>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <View style={{ flex: 1 }}>
                <Txt size={14} weight="semibold">
                  {user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Signed in'}
                </Txt>
                {user?.fullName && user.primaryEmailAddress && (
                  <Txt size={11.5} color={palette.cocoa}>
                    {user.primaryEmailAddress.emailAddress}
                  </Txt>
                )}
              </View>
            </View>
          </Card>
          <PillButton variant="chip" label="Sign out" onPress={() => signOut()} style={{ marginTop: 12 }} />
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
