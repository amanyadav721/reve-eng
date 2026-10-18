import type { Stop } from '@tagalong/shared';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { jaipurDay2, traveler } from '@/data/mock';

// Today's trip, shared by the Today and Explore (map) tabs. Mock data until the API serves plans.

interface TripState {
  stops: Stop[];
  points: number;
  now?: Stop;
  lastEarned?: { stopId: string; points: number; key: number };
  checkIn: () => void;
  restart: () => void;
}

const TripContext = createContext<TripState | null>(null);

export function TripProvider({ children }: { children: ReactNode }) {
  const [stops, setStops] = useState<Stop[]>(jaipurDay2);
  const [points, setPoints] = useState(traveler.points);
  const [lastEarned, setLastEarned] = useState<TripState['lastEarned']>();

  const nowIndex = stops.findIndex((s) => s.status === 'now');
  const now = nowIndex >= 0 ? stops[nowIndex] : undefined;

  const checkIn = useCallback(() => {
    if (!now) return;
    setPoints((p) => p + now.points);
    setLastEarned({ stopId: now.id, points: now.points, key: Date.now() });
    setStops((prev) => prev.map((s, i) => (i === nowIndex ? { ...s, status: 'done' } : i === nowIndex + 1 ? { ...s, status: 'now' } : s)));
  }, [now, nowIndex]);

  // Demo only: replay the day from the second stop.
  const restart = useCallback(() => {
    setStops(jaipurDay2);
    setPoints(traveler.points);
    setLastEarned(undefined);
  }, []);

  const value = useMemo(() => ({ stops, points, now, lastEarned, checkIn, restart }), [stops, points, now, lastEarned, checkIn, restart]);
  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripState {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used inside <TripProvider>');
  return ctx;
}
