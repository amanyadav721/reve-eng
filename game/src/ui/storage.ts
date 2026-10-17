import type { RunState } from '../engine';

const RUN_KEY = 'little-hamlet:run';
const BEST_KEY = 'little-hamlet:best';

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    return raw ? (JSON.parse(raw) as RunState) : null;
  } catch {
    return null;
  }
}

export function saveRun(run: RunState): void {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    // Storage can be unavailable (private mode); the game still works without saving.
  }
}

export function loadBest(): number {
  return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
}

export function saveBest(seasonsCleared: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(seasonsCleared));
  } catch {
    // Ignore.
  }
}
