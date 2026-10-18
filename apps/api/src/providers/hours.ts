import type { OpenInterval } from '../planner/validate.js';
import type { HoursPeriod, PlaceDetails } from './types.js';

/**
 * Opening intervals for one calendar date ("YYYY-MM-DD", the city's local date), or 'unknown' if
 * Google lists no hours (common for ghats, viewpoints and street stalls).
 * Overnight periods are split at midnight. A single period with no close means open 24/7.
 */
export function hoursOn(place: Pick<PlaceDetails, 'regularHours' | 'currentHours'>, date: string): OpenInterval[] | 'unknown' {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const [y, m, d] = date.split('-').map(Number);

  // currentHours carries real dates (holidays, special closures) for the next 7 days.
  const current = place.currentHours?.filter((p) => p.open.date);
  if (current?.length) {
    const covers = current.some((p) => sameDate(p.open.date, y, m, d) || sameDate(p.close?.date, y, m, d));
    const inWindow = withinWeek(current, y, m, d);
    if (covers) return intervalsFor(current, (p) => sameDate(p.open.date, y, m, d), (p) => sameDate(p.close?.date, y, m, d));
    if (inWindow) return []; // inside the 7-day window with no period: closed that day
  }

  if (!place.regularHours?.length) return 'unknown';
  return intervalsFor(place.regularHours, (p) => p.open.day === weekday, (p) => p.close?.day === weekday);
}

function intervalsFor(
  periods: HoursPeriod[],
  opensToday: (p: HoursPeriod) => boolean,
  closesToday: (p: HoursPeriod) => boolean,
): OpenInterval[] {
  if (periods.length === 1 && !periods[0].close) return [{ open: '00:00', close: '24:00' }];

  const out: OpenInterval[] = [];
  for (const p of periods) {
    if (!p.close) continue;
    const overnight = p.close.day !== p.open.day || toMin(p.close) <= toMin(p.open);
    if (opensToday(p)) out.push({ open: hhmm(p.open), close: overnight ? '24:00' : hhmm(p.close) });
    if (overnight && closesToday(p) && toMin(p.close) > 0) out.push({ open: '00:00', close: hhmm(p.close) });
  }
  return merge(out);
}

function merge(list: OpenInterval[]): OpenInterval[] {
  const sorted = [...list].sort((a, b) => a.open.localeCompare(b.open));
  const out: OpenInterval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.open <= last.close) last.close = i.close > last.close ? i.close : last.close;
    else out.push({ ...i });
  }
  return out;
}

function withinWeek(periods: HoursPeriod[], y: number, m: number, d: number): boolean {
  const t = Date.UTC(y, m - 1, d);
  const dates = periods.flatMap((p) => [p.open.date, p.close?.date]).filter(Boolean) as { year: number; month: number; day: number }[];
  const times = dates.map((x) => Date.UTC(x.year, x.month - 1, x.day));
  return times.length > 0 && t >= Math.min(...times) && t <= Math.max(...times);
}

function sameDate(x: { year: number; month: number; day: number } | undefined, y: number, m: number, d: number): boolean {
  return !!x && x.year === y && x.month === m && x.day === d;
}

const toMin = (p: { hour: number; minute: number }) => p.hour * 60 + p.minute;
const hhmm = (p: { hour: number; minute: number }) => `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
