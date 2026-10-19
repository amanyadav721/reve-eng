import type { Stop } from '@tagalong/shared';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import type { ReplanReply, ReplanTrigger } from '@/lib/trips';
import { palette } from '@/theme/colors';
import { Laddoo } from './Laddoo';
import { Txt } from './Txt';

// "Something changed": one tap re-plans the rest of today. Late, skip, tired and hungry answer in
// a moment; rain and bored ask the AI, which takes a little while.

const TRIGGERS: { trigger: ReplanTrigger; icon: string; label: string; ai?: boolean }[] = [
  { trigger: 'late', icon: '⏰', label: 'Running late' },
  { trigger: 'hungry', icon: '🍽️', label: "I'm hungry" },
  { trigger: 'tired', icon: '😮‍💨', label: "I'm tired" },
  { trigger: 'skip', icon: '⏭️', label: 'Skip this' },
  { trigger: 'rain', icon: '🌧️', label: "It's raining", ai: true },
  { trigger: 'bored', icon: '🥱', label: 'Bored', ai: true },
];

const THINKING: Partial<Record<ReplanTrigger, string>> = {
  rain: 'Finding indoor places near you…',
  bored: 'Looking for something more fun nearby…',
};

export function ReplanBar({ busy, onPick }: { busy?: ReplanTrigger; onPick: (t: ReplanTrigger) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={styles.bar}>
      {TRIGGERS.map((t) => {
        const active = busy === t.trigger;
        return (
          <Pressable
            key={t.trigger}
            disabled={!!busy}
            onPress={() => onPick(t.trigger)}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            accessibilityState={{ busy: active, disabled: !!busy }}
            style={[styles.chip, active && styles.chipActive, busy && !active && { opacity: 0.45 }]}
          >
            {active ? <ActivityIndicator size="small" color={palette.cream} /> : <Txt size={14}>{t.icon}</Txt>}
            <Txt size={13.5} weight="semibold" color={active ? palette.cream : palette.ink}>
              {t.label}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** While the AI re-plans: Laddoo thinking, with a running clock so the wait feels honest. */
export function Thinking({ trigger }: { trigger: ReplanTrigger }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (!THINKING[trigger]) return null;
  return (
    <Animated.View entering={FadeInDown} exiting={FadeOut} style={styles.reply}>
      <Laddoo size={40} variant="head" />
      <View style={{ flex: 1 }}>
        <Txt size={14} weight="semibold">
          {THINKING[trigger]}
        </Txt>
        <Txt size={12} color={palette.cocoa} style={{ marginTop: 2 }}>
          Checking opening hours and rides · {seconds}s
        </Txt>
      </View>
    </Animated.View>
  );
}

export function ReplanReplyCard({ reply, currentFoodId, onChoose, onDismiss }: { reply: ReplanReply; currentFoodId?: string; onChoose: (s: Stop) => void; onDismiss: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Animated.View entering={FadeInDown.springify().damping(16)} exiting={FadeOut} layout={LinearTransition} style={styles.reply}>
      <Laddoo size={40} variant="head" />
      <View style={{ flex: 1 }}>
        <Txt size={14} weight="semibold" style={{ lineHeight: 20 }}>
          {reply.message}
        </Txt>
        {!reply.ok && (
          <Txt size={12} color={palette.terracotta} style={{ marginTop: 4 }}>
            Some of it may not fit perfectly. Check the times below.
          </Txt>
        )}

        {reply.options && reply.options.length > 1 && (
          <View style={{ marginTop: 10, gap: 6 }}>
            {reply.options.map((o) => {
              const picked = o.placeId === currentFoodId;
              return (
                <Pressable key={o.id} onPress={() => onChoose(o)} accessibilityRole="button" accessibilityState={{ selected: picked }} style={[styles.option, picked && styles.optionOn]}>
                  <Txt size={13.5} weight="semibold" color={picked ? palette.cream : palette.ink}>
                    {o.name}
                  </Txt>
                  {o.reason && (
                    <Txt size={11.5} color={picked ? '#E8D5C0' : palette.cocoa}>
                      {o.reason}
                    </Txt>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {reply.changes.length > 0 && (
          <Pressable onPress={() => setOpen((x) => !x)} hitSlop={8} accessibilityRole="button">
            <Txt size={12.5} weight="semibold" color={palette.cocoa} style={{ marginTop: 8 }}>
              {open ? 'Hide' : 'What changed'} ({reply.changes.length})
            </Txt>
          </Pressable>
        )}
        {open && (
          <Animated.View entering={FadeIn} style={{ marginTop: 4, gap: 3 }}>
            {reply.changes.map((c) => (
              <Txt key={c} size={12.5} color={palette.cocoa}>
                · {c}
              </Txt>
            ))}
          </Animated.View>
        )}
      </View>
      <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss">
        <Txt size={18} color={palette.dune}>
          ×
        </Txt>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: palette.cream,
    borderWidth: 1.5,
    borderColor: palette.creamLine,
  },
  chipActive: { backgroundColor: palette.ink, borderColor: palette.ink },
  reply: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: palette.cream,
    borderRadius: 20,
    padding: 14,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: palette.creamLine,
  },
  option: { backgroundColor: palette.sand, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  optionOn: { backgroundColor: palette.ink },
});
