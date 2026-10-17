import { describe, expect, it } from 'vitest';
import { DISCARDS_PER_SEASON, HAND_SIZE, PLACEMENTS_PER_SEASON, STARTING_DECK } from './content';
import {
  buyItem,
  canBuy,
  deckCards,
  discardCard,
  goldForResult,
  leaveShop,
  newRun,
  openShop,
  placeCard,
  rerollShop,
  type RunState,
} from './run';

function firstEmpty(s: RunState): number {
  return s.board.findIndex((t) => t === null);
}

function playSeason(s: RunState): RunState {
  for (let i = 0; i < PLACEMENTS_PER_SEASON; i++) s = placeCard(s, 0, firstEmpty(s));
  return s;
}

describe('run flow', () => {
  it('starts with a full hand and the starting deck', () => {
    const s = newRun(1);
    expect(s.hand).toHaveLength(HAND_SIZE);
    expect(deckCards(s).sort()).toEqual([...STARTING_DECK].sort());
    expect(s.phase).toBe('placing');
  });

  it('is deterministic for a seed', () => {
    expect(newRun(42).hand).toEqual(newRun(42).hand);
  });

  it('does not mutate the previous state', () => {
    const s = newRun(3);
    const snapshot = JSON.stringify(s);
    placeCard(s, 0, 0);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('placing keeps the card in the deck and refills the hand', () => {
    let s = newRun(5);
    const kind = s.hand[0];
    s = placeCard(s, 0, 12);
    expect(s.board[12]).toBe(kind);
    expect(s.hand).toHaveLength(HAND_SIZE);
    expect(deckCards(s)).toHaveLength(STARTING_DECK.length);
  });

  it('refuses occupied cells and wrong phases', () => {
    const s = placeCard(newRun(5), 0, 0);
    expect(() => placeCard(s, 0, 0)).toThrow();
    expect(() => openShop(s)).toThrow();
  });

  it('limits discards per season', () => {
    let s = newRun(6);
    for (let i = 0; i < DISCARDS_PER_SEASON; i++) s = discardCard(s, 0);
    expect(s.hand).toHaveLength(HAND_SIZE);
    expect(() => discardCard(s, 0)).toThrow();
  });

  it('scores the season after the last placement', () => {
    const s = playSeason(newRun(7));
    expect(s.lastResult).not.toBeNull();
    expect(['result', 'lost']).toContain(s.phase);
    if (s.lastResult!.passed) expect(s.gold).toBeGreaterThan(2);
  });

  it('goes through the shop into the next season', () => {
    // Find a seed whose naive first season passes.
    let s: RunState | null = null;
    for (let seed = 1; seed < 200 && !s; seed++) {
      const played = playSeason(newRun(seed));
      if (played.phase === 'result') s = played;
    }
    expect(s).not.toBeNull();
    let state = openShop(s!);
    expect(state.shop).toHaveLength(5);
    state = { ...state, gold: 50 };
    const cardIndex = state.shop.findIndex((i) => i.type === 'card');
    const deckBefore = deckCards(state).length;
    state = buyItem(state, cardIndex);
    expect(deckCards(state)).toHaveLength(deckBefore + 1);
    expect(canBuy(state, cardIndex)).toBe(false);
    const charmIndex = state.shop.findIndex((i) => i.type === 'charm');
    state = buyItem(state, charmIndex);
    expect(state.charms).toHaveLength(1);
    const gold = state.gold;
    state = rerollShop(state);
    expect(state.gold).toBe(gold - 1);
    expect(state.rerollCost).toBe(2);
    state = leaveShop(state);
    expect(state.season).toBe(1);
    expect(state.phase).toBe('placing');
    expect(state.placementsLeft).toBe(PLACEMENTS_PER_SEASON);
    expect(state.hand).toHaveLength(HAND_SIZE);
  });

  it('pays more gold for beating the target by more', () => {
    expect(goldForResult(10, 10, [])).toBe(3);
    expect(goldForResult(15, 10, [])).toBe(5);
    expect(goldForResult(100, 10, [])).toBe(7);
    expect(goldForResult(10, 10, ['luckyCoin'])).toBe(5);
  });
});
