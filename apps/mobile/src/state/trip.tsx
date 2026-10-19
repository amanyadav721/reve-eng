import { useAuth } from '@clerk/expo';
import type { Stop } from '@tagalong/shared';
import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { ApiError, useApi } from '@/lib/api';
import { dayToShow, localDate, localTime, type Day, type ReplanReply, type ReplanTrigger, type Trip } from '@/lib/trips';

// The traveler's current trip and the day on screen, shared by the Today and Explore tabs.
// Everything is saved through our API to Supabase, so a check-in or re-plan survives a restart.

type Status = 'loading' | 'none' | 'ready' | 'error';

interface Planning {
  dayNumber: number;
  startedAt: number;
  error?: string;
}

interface TripState {
  status: Status;
  error?: string;
  trip?: Trip;
  day?: Day;
  stops: Stop[];
  points: number;
  now?: Stop;
  lastEarned?: { stopId: string; points: number; key: number };
  /** The AI is planning this day. */
  planning?: Planning;
  /** A re-plan in flight. */
  replanning?: ReplanTrigger;
  /** Laddoo's answer to the last re-plan, until dismissed. */
  reply?: ReplanReply & { trigger: ReplanTrigger };
  reload: () => Promise<void>;
  planDay: () => Promise<void>;
  checkIn: () => void;
  replan: (trigger: ReplanTrigger, extra?: { stopId?: string; note?: string }) => Promise<void>;
  /** Hungry: switch the meal Laddoo picked for another of the options. */
  chooseFood: (option: Stop) => Promise<void>;
  dismissReply: () => void;
}

const TripContext = createContext<TripState | null>(null);

export function TripProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string>();
  const [trip, setTrip] = useState<Trip>();
  const [day, setDay] = useState<Day>();
  const [points, setPoints] = useState(0);
  const [lastEarned, setLastEarned] = useState<TripState['lastEarned']>();
  const [planning, setPlanning] = useState<Planning>();
  const [replanning, setReplanning] = useState<ReplanTrigger>();
  const [reply, setReply] = useState<TripState['reply']>();
  const planningRef = useRef(false);

  const stops = day?.stops ?? [];
  const now = stops.find((s) => s.status === 'now');

  const planDay = useCallback(async () => {
    if (!trip || !day || planningRef.current) return;
    planningRef.current = true;
    setPlanning({ dayNumber: day.dayNumber, startedAt: Date.now() });
    try {
      const res = await api<{ day: Day }>(`/v1/trips/${trip.id}/days/${day.dayNumber}/plan`, { method: 'POST' });
      setDay(res.day);
      setTrip((t) => t && { ...t, days: t.days.map((d) => (d.dayNumber === res.day.dayNumber ? { ...d, planned: true } : d)) });
      setPlanning(undefined);
    } catch (err) {
      setPlanning({ dayNumber: day.dayNumber, startedAt: Date.now(), error: describe(err) });
    } finally {
      planningRef.current = false;
    }
  }, [api, trip, day]);

  const reload = useCallback(async () => {
    setStatus('loading');
    setReply(undefined);
    try {
      const res = await api<{ trip: Trip | null; day: Day | null; points: number }>(`/v1/trips/current?today=${localDate()}`);
      setPoints(res.points);
      if (!res.trip) {
        setTrip(undefined);
        setDay(undefined);
        setStatus('none');
        return;
      }
      const info = dayToShow(res.trip);
      const loaded = res.day ?? { ...info, tripId: res.trip.id, stops: [] };
      setTrip(res.trip);
      setDay(loaded);
      setStatus('ready');
    } catch (err) {
      setError(describe(err));
      setStatus('error');
    }
  }, [api]);

  useEffect(() => {
    if (isLoaded && isSignedIn) reload();
    if (isLoaded && !isSignedIn) {
      setTrip(undefined);
      setDay(undefined);
      setStatus('loading');
    }
  }, [isLoaded, isSignedIn, userId, reload]);

  // A day nobody has planned yet gets planned as soon as it's on screen.
  useEffect(() => {
    if (status === 'ready' && day && !day.planned && !planning) planDay();
  }, [status, day, planning, planDay]);

  const save = useCallback(
    async (next: Stop[]) => {
      if (!trip || !day) return;
      const res = await api<{ day: Day; points: number; earned: number }>(`/v1/trips/${trip.id}/days/${day.dayNumber}/stops`, { method: 'PUT', body: { stops: next } });
      setPoints(res.points);
      setDay(res.day);
    },
    [api, trip, day],
  );

  const checkIn = useCallback(() => {
    if (!day || !now) return;
    const i = day.stops.indexOf(now);
    const nextIndex = day.stops.findIndex((s, j) => j > i && s.status === 'upcoming');
    const next = day.stops.map((s, j) => (j === i ? { ...s, status: 'done' as const } : j === nextIndex ? { ...s, status: 'now' as const } : s));
    // Show it at once; the save confirms the points.
    setDay({ ...day, stops: next });
    setPoints((p) => p + now.points);
    setLastEarned({ stopId: now.id, points: now.points, key: Date.now() });
    setReply(undefined);
    save(next).catch((err) => setError(describe(err)));
  }, [day, now, save]);

  const replan = useCallback(
    async (trigger: ReplanTrigger, extra: { stopId?: string; note?: string } = {}) => {
      if (!trip || !day || replanning) return;
      setReplanning(trigger);
      setReply(undefined);
      try {
        const where = await whereAndWhen(day, now);
        const res = await api<ReplanReply>(`/v1/trips/${trip.id}/days/${day.dayNumber}/replan`, { body: { trigger, ...where, ...extra } });
        setDay(res.day);
        setReply({ ...res, trigger });
      } catch (err) {
        setReply({ trigger, ok: false, message: describe(err), changes: [], usedAI: false, day });
      } finally {
        setReplanning(undefined);
      }
    },
    [api, trip, day, now, replanning],
  );

  const chooseFood = useCallback(
    async (option: Stop) => {
      if (!day || !now || now.category !== 'food' || now.placeId === option.placeId) return;
      const next = day.stops.map((s) => (s.id === now.id ? { ...option, id: now.id, status: 'now' as const } : s));
      setDay({ ...day, stops: next });
      await save(next);
      setReply((r) => r && { ...r, message: `Switched to ${option.name.split(' at ').pop()}.`, changes: [`Lunch now at ${option.name}.`] });
    },
    [day, now, save],
  );

  const value = useMemo<TripState>(
    () => ({
      status,
      error,
      trip,
      day,
      stops,
      points,
      now,
      lastEarned,
      planning,
      replanning,
      reply,
      reload,
      planDay,
      checkIn,
      replan,
      chooseFood,
      dismissReply: () => setReply(undefined),
    }),
    [status, error, trip, day, stops, points, now, lastEarned, planning, replanning, reply, reload, planDay, checkIn, replan, chooseFood],
  );
  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripState {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used inside <TripProvider>');
  return ctx;
}

/**
 * On the day itself: the phone's clock and position. Looking at a day that hasn't come yet: the
 * current stop's planned time. Without the phone's position, the traveler is where they last checked
 * in (they haven't reached the current stop yet), or at the current stop if they haven't started.
 */
async function whereAndWhen(day: Day, current?: Stop): Promise<{ now: string; location: { lat: number; lng: number } }> {
  const anchor = [...day.stops].reverse().find((s) => s.status === 'done' && s.location) ?? current ?? day.stops[0];
  const fallback = anchor?.location ?? day.stops.find((s) => s.location)?.location ?? { lat: 0, lng: 0 };
  if (day.date !== localDate()) return { now: current?.startTime ?? day.stops[0]?.startTime ?? '09:00', location: fallback };
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.granted) {
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<undefined>((r) => setTimeout(() => r(undefined), 6000)),
      ]);
      const here = pos && { lat: pos.coords.latitude, lng: pos.coords.longitude };
      // Far from today's city (planning from home): the current stop is the better starting point.
      if (here && (!anchor?.location || km(here, anchor.location) < 50)) return { now: localTime(), location: here };
    }
  } catch {
    // No position: plan from the current stop instead.
  }
  return { now: localTime(), location: fallback };
}

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function describe(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { message?: string; error?: string; missing?: string[] } | undefined;
    if (body?.missing?.length) return `The server is missing ${body.missing.join(', ')}.`;
    return body?.message ?? (err.status >= 500 ? 'Something went wrong on our side. Try again.' : `Request failed (${body?.error ?? err.status}).`);
  }
  return "Couldn't reach Laddoo. Check your connection.";
}
