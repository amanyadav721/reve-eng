import { useAuth } from '@clerk/expo';
import type { TripPreferences } from '@tagalong/shared';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Laddoo } from '@/components/Laddoo';
import { PillButton } from '@/components/PillButton';
import { Txt } from '@/components/Txt';
import { ApiError, useApi } from '@/lib/api';
import { addDays, localDate, type Leg, type NewMemory, type Trip } from '@/lib/trips';
import { useTrip } from '@/state/trip';
import { palette } from '@/theme/colors';
import { fonts } from '@/theme/type';

// The pre-trip quiz: one question at a time. Answers become the trip's preferences and, where they
// say something lasting about the traveler ("Vegetarian", "Loves sunsets"), memories Laddoo keeps.

type Group = NonNullable<TripPreferences['group']>;
type Pace = NonNullable<TripPreferences['pace']>;
type Diet = NonNullable<TripPreferences['diet']>;
type Spice = NonNullable<TripPreferences['spice']>;

interface Answers {
  destination: string;
  start: string;
  days: number;
  group?: Group;
  pace?: Pace;
  dayStart?: string;
  diet?: Diet;
  spice?: Spice;
  loves: string[];
  budget?: 'shoestring' | 'comfortable' | 'splurge';
  note: string;
}

const LOVES = [
  ['🌅', 'Sunsets'],
  ['🌄', 'Sunrises'],
  ['🥟', 'Street food'],
  ['🏰', 'Forts and palaces'],
  ['🏛️', 'Museums'],
  ['🛍️', 'Markets'],
  ['🌿', 'Nature'],
  ['🛕', 'Temples'],
  ['☕', 'Cafés'],
  ['📸', 'Photo spots'],
  ['🌙', 'Nightlife'],
  ['🎨', 'Art and crafts'],
] as const;

const EVIDENCE = 'You told me in the trip quiz';

const STEPS = ['where', 'when', 'who', 'pace', 'food', 'loves', 'budget', 'note'] as const;
type Step = (typeof STEPS)[number];

export default function Plan() {
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const { reload } = useTrip();
  const [step, setStep] = useState<Step>('where');
  const [a, setA] = useState<Answers>({ destination: '', start: addDays(localDate(), 1), days: 3, loves: [], note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [question, setQuestion] = useState<string>();
  const [route, setRoute] = useState<Leg[]>();

  if (isLoaded && !isSignedIn) return <Redirect href="/sign-in" />;

  const index = STEPS.indexOf(step);
  const set = (patch: Partial<Answers>) => setA((x) => ({ ...x, ...patch }));
  const canNext = step !== 'where' || a.destination.trim().length > 1;
  const next = () => (index < STEPS.length - 1 ? setStep(STEPS[index + 1]) : submit());
  const back = () => (index > 0 ? setStep(STEPS[index - 1]) : router.back());

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    setQuestion(undefined);
    try {
      const memories = memoriesFrom(a);
      if (memories.length) await api('/v1/memories', { body: { memories } });
      const preferences: Partial<TripPreferences> = {
        ...(a.group ? { group: a.group } : {}),
        ...(a.pace ? { pace: a.pace } : {}),
        ...(a.diet ? { diet: a.diet } : {}),
        ...(a.spice ? { spice: a.spice } : {}),
        ...(a.dayStart ? { dayStart: a.dayStart } : {}),
        interests: a.loves,
      };
      const res = await api<{ trip?: Trip; question?: string }>('/v1/trips', { body: { destination: a.destination.trim(), startDate: a.start, days: a.days, preferences } });
      if (res.question || !res.trip) {
        // Too vague to plan ("somewhere nice"): Laddoo asks, and the traveler edits the destination.
        setQuestion(res.question ?? 'Where exactly should we go?');
        setStep('where');
        return;
      }
      setRoute(res.trip.legs);
    } catch (err) {
      setError(err instanceof ApiError ? ((err.body as { message?: string })?.message ?? `Something went wrong (${err.status}). Try again.`) : "Couldn't reach Laddoo. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  if (route) return <RouteReady legs={route} onStart={async () => (await reload(), router.replace('/today'))} />;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <Txt size={22} weight="semibold">
            ←
          </Txt>
        </Pressable>
        <View style={styles.progress}>
          {STEPS.map((s, i) => (
            <View key={s} style={[styles.dot, i <= index && styles.dotOn]} />
          ))}
        </View>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Animated.View key={step} entering={FadeInRight.duration(260)} exiting={FadeOutLeft.duration(160)}>
          <View style={styles.ask}>
            <Laddoo size={64} variant="head" />
            <View style={styles.bubble}>
              <Txt size={16} weight="semibold" style={{ lineHeight: 22 }}>
                {step === 'where' && question ? question : PROMPTS[step]}
              </Txt>
            </View>
          </View>

          {step === 'where' && (
            <>
              <TextInput
                value={a.destination}
                onChangeText={(t) => set({ destination: t })}
                placeholder="A city, a country, anywhere"
                placeholderTextColor={palette.dune}
                autoFocus
                returnKeyType="next"
                onSubmitEditing={() => canNext && next()}
                style={styles.input}
                accessibilityLabel="Destination"
              />
              <Chips options={['Jaipur', 'Rajasthan', 'Goa', 'Varanasi', 'Japan', 'Miami'].map((v) => [v, v])} value={a.destination} onChange={(v) => set({ destination: v })} />
            </>
          )}

          {step === 'when' && (
            <>
              <Label>Starting</Label>
              <Chips
                options={[
                  [localDate(), 'Today'],
                  [addDays(localDate(), 1), 'Tomorrow'],
                  [addDays(localDate(), 7), 'In a week'],
                ]}
                value={a.start}
                onChange={(v) => set({ start: v })}
              />
              <Stepper label="Start date" value={new Date(`${a.start}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} onMinus={() => a.start > localDate() && set({ start: addDays(a.start, -1) })} onPlus={() => set({ start: addDays(a.start, 1) })} />
              <Label>For how long</Label>
              <Stepper label="Days" value={`${a.days} day${a.days === 1 ? '' : 's'}`} onMinus={() => set({ days: Math.max(1, a.days - 1) })} onPlus={() => set({ days: Math.min(14, a.days + 1) })} />
            </>
          )}

          {step === 'who' && (
            <Chips
              options={[
                ['solo', '🎒 Just me'],
                ['partner', '💞 With my partner'],
                ['friends', '🎉 With friends'],
                ['family', '👨‍👩‍👧 Family with kids'],
                ['parents', '🧓 With my parents'],
              ]}
              value={a.group}
              onChange={(v) => set({ group: v as Group })}
              column
            />
          )}

          {step === 'pace' && (
            <>
              <Chips
                options={[
                  ['chill', '🐢 Chill: a few things, done well'],
                  ['balanced', '🚶 Balanced'],
                  ['packed', '🏃 Packed: see everything'],
                ]}
                value={a.pace}
                onChange={(v) => set({ pace: v as Pace })}
                column
              />
              <Label>Start the day around</Label>
              <Chips options={['07:00', '08:00', '09:00', '10:00'].map((t) => [t, `${Number(t.slice(0, 2))} AM`])} value={a.dayStart} onChange={(v) => set({ dayStart: v })} />
            </>
          )}

          {step === 'food' && (
            <>
              <Chips
                options={[
                  ['veg', '🥗 Vegetarian'],
                  ['egg', '🍳 Veg + eggs'],
                  ['nonveg', '🍗 Everything'],
                  ['vegan', '🌱 Vegan'],
                  ['jain', '🙏 Jain'],
                ]}
                value={a.diet}
                onChange={(v) => set({ diet: v as Diet })}
              />
              <Label>Spice</Label>
              <Chips
                options={[
                  ['mild', 'Mild'],
                  ['medium', 'Medium'],
                  ['hot', '🌶️ Bring it on'],
                ]}
                value={a.spice}
                onChange={(v) => set({ spice: v as Spice })}
              />
            </>
          )}

          {step === 'loves' && (
            <Chips
              options={LOVES.map(([icon, label]) => [label, `${icon} ${label}`])}
              value={a.loves}
              onChange={(v) => set({ loves: a.loves.includes(v) ? a.loves.filter((x) => x !== v) : [...a.loves, v] })}
            />
          )}

          {step === 'budget' && (
            <Chips
              options={[
                ['shoestring', '🪙 Keep it cheap'],
                ['comfortable', '💳 Comfortable'],
                ['splurge', '💎 Treat myself'],
              ]}
              value={a.budget}
              onChange={(v) => set({ budget: v as Answers['budget'] })}
              column
            />
          )}

          {step === 'note' && (
            <TextInput
              value={a.note}
              onChangeText={(t) => set({ note: t })}
              placeholder="e.g. My mom can't climb many stairs. I hate crowds."
              placeholderTextColor={palette.dune}
              multiline
              style={[styles.input, { minHeight: 110, textAlignVertical: 'top' }]}
              accessibilityLabel="Anything else"
            />
          )}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        {error && (
          <Txt size={13} color={palette.terracotta} style={{ textAlign: 'center', marginBottom: 10 }}>
            {error}
          </Txt>
        )}
        {busy ? (
          <Animated.View entering={FadeIn} style={styles.busy}>
            <ActivityIndicator color={palette.ink} />
            <Txt size={14} weight="semibold">
              Laddoo is mapping out {a.destination.trim()}…
            </Txt>
          </Animated.View>
        ) : (
          <PillButton label={index === STEPS.length - 1 ? 'Plan my trip' : 'Next'} onPress={() => canNext && next()} style={!canNext && { opacity: 0.4 }} />
        )}
        {!busy && index > 0 && index < STEPS.length - 1 && (
          <Pressable onPress={next} hitSlop={10} accessibilityRole="button">
            <Txt size={13} weight="semibold" color={palette.cocoa} style={{ textAlign: 'center', marginTop: 12 }}>
              Skip
            </Txt>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const PROMPTS: Record<Step, string> = {
  where: 'Where are we going?',
  when: 'When, and for how long?',
  who: "Who's coming along?",
  pace: 'How do you like to travel?',
  food: 'What do you eat?',
  loves: 'What makes a day great for you? Pick as many as you like.',
  budget: 'How should we spend?',
  note: 'Anything else I should know? I never forget.',
};

/** The lasting things the quiz says about a traveler. Taking the quiz again adds nothing twice. */
function memoriesFrom(a: Answers): NewMemory[] {
  const out: NewMemory[] = [];
  const add = (kind: NewMemory['kind'], text: string, icon: string) => out.push({ kind, text, icon, evidence: EVIDENCE, source: 'quiz' });
  const diet: Record<Diet, string> = { veg: 'Vegetarian', egg: 'Vegetarian, eats eggs', nonveg: 'Eats meat and fish', vegan: 'Vegan', jain: 'Jain: no onion, garlic or root vegetables' };
  if (a.diet) add('fact', diet[a.diet], '🥗');
  if (a.spice) add('habit', { mild: 'Likes food mild', medium: 'Likes medium spice', hot: 'Loves spicy food' }[a.spice], '🌶️');
  if (a.dayStart) add('habit', Number(a.dayStart.slice(0, 2)) >= 9 ? `Not a morning person: starts around ${Number(a.dayStart.slice(0, 2))} AM` : `Early riser: starts around ${Number(a.dayStart.slice(0, 2))} AM`, '⏰');
  if (a.pace) add('habit', { chill: 'Likes a chill pace', balanced: 'Likes a balanced pace', packed: 'Likes packed days' }[a.pace], '🚶');
  if (a.group) add('person', { solo: 'Travels solo', partner: 'Travels with their partner', friends: 'Travels with friends', family: 'Travels with family and kids', parents: 'Travels with their parents' }[a.group], '👥');
  if (a.budget) add('fact', { shoestring: 'Travels on a tight budget', comfortable: 'Travels on a comfortable budget', splurge: 'Happy to splurge on travel' }[a.budget], '💳');
  for (const love of a.loves) add('love', `Loves ${love.toLowerCase()}`, LOVES.find(([, l]) => l === love)?.[0] ?? '❤️');
  if (a.note.trim()) add('fact', a.note.trim().slice(0, 300), '📝');
  return out;
}

function RouteReady({ legs, onStart }: { legs: Leg[]; onStart: () => void }) {
  const insets = useSafeAreaInsets();
  const [starting, setStarting] = useState(false);
  return (
    <View style={[styles.root, { paddingTop: insets.top + 40, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
      <View style={{ alignItems: 'center' }}>
        <Laddoo size={110} />
        <Txt size={26} weight="bold" tight style={{ marginTop: 16, textAlign: 'center' }}>
          Your route is ready
        </Txt>
      </View>
      <View style={{ marginTop: 24, gap: 10, flex: 1 }}>
        {legs.map((l, i) => (
          <Animated.View key={`${l.city}-${i}`} entering={FadeInRight.delay(i * 120)} style={styles.leg}>
            <Txt size={16} weight="bold">
              {l.city} · {l.days} day{l.days === 1 ? '' : 's'}
            </Txt>
            {l.why && (
              <Txt size={13} color={palette.cocoa} style={{ marginTop: 2 }}>
                {l.why}
              </Txt>
            )}
          </Animated.View>
        ))}
      </View>
      {starting ? (
        <ActivityIndicator color={palette.ink} />
      ) : (
        <PillButton label="Plan day 1" onPress={() => (setStarting(true), onStart())} />
      )}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Txt size={13} weight="semibold" color={palette.cocoa} style={{ marginTop: 22, marginBottom: 10, marginLeft: 4 }}>
      {children}
    </Txt>
  );
}

function Chips({ options, value, onChange, column }: { options: (readonly [string, string])[]; value?: string | string[]; onChange: (v: string) => void; column?: boolean }) {
  const on = (v: string) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <View style={[styles.chips, column && { flexDirection: 'column', alignItems: 'stretch' }]}>
      {options.map(([v, label]) => (
        <Pressable key={v} onPress={() => onChange(v)} accessibilityRole="button" accessibilityState={{ selected: on(v) }} style={[styles.chip, on(v) && styles.chipOn]}>
          <Txt size={14.5} weight="semibold" color={on(v) ? palette.cream : palette.ink}>
            {label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onMinus} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`${label}: less`}>
        <Txt size={20} weight="bold">
          −
        </Txt>
      </Pressable>
      <Txt size={16} weight="semibold">
        {value}
      </Txt>
      <Pressable onPress={onPlus} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`${label}: more`}>
        <Txt size={20} weight="bold">
          +
        </Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.peach },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  progress: { flexDirection: 'row', gap: 6 },
  dot: { width: 18, height: 6, borderRadius: 3, backgroundColor: palette.creamLine },
  dotOn: { backgroundColor: palette.ink },
  body: { padding: 20, paddingTop: 28 },
  ask: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 22 },
  bubble: { flex: 1, backgroundColor: palette.cream, borderRadius: 20, borderBottomLeftRadius: 6, padding: 14, borderWidth: 1.5, borderColor: palette.creamLine },
  input: {
    backgroundColor: palette.cream,
    borderWidth: 1.5,
    borderColor: palette.creamLine,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontSize: 17,
    fontFamily: fonts.medium,
    color: palette.ink,
    marginBottom: 14,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, backgroundColor: palette.cream, borderWidth: 1.5, borderColor: palette.creamLine },
  chipOn: { backgroundColor: palette.ink, borderColor: palette.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: palette.cream, borderRadius: 18, borderWidth: 1.5, borderColor: palette.creamLine, padding: 8, marginTop: 10 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.sand, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 20, paddingTop: 8 },
  busy: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  leg: { backgroundColor: palette.cream, borderRadius: 20, padding: 14, borderWidth: 1.5, borderColor: palette.creamLine },
});
