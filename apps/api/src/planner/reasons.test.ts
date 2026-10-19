import type { Memory } from '@tagalong/shared';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { inventedClaims, knownAbout, withoutInventedClaims } from './reasons.js';

const memory = (kind: Memory['kind'], text: string, evidence = 'Earlier trip'): Memory => ({ id: text, kind, text, evidence, source: 'chat', sensitive: false, createdAt: '2026-01-01' });

describe('inventedClaims', () => {
  const known = knownAbout([memory('love', 'Loved the mirchi vada in Jodhpur', 'Jodhpur, Mar 2026'), memory('skip', 'No animal rides')], { interests: ['history', 'street food', 'cafés'] });

  it('flags loves the traveler never gave', () => {
    assert.deepEqual(inventedClaims('Since you love forts, start at Amber before the crowds.', known), ['forts']);
    assert.deepEqual(inventedClaims('**You loved the thrill of bungee in Jodhpur**, so go big here.', known), ['the thrill of bungee']);
    assert.deepEqual(inventedClaims('You loved the kachori sabzi in Jodhpur, so this is your opener.', known), ['the kachori sabzi']);
    assert.deepEqual(inventedClaims('Your love of palaces and history pays off here.', known), ['palaces']);
    // A skip is not a love.
    assert.deepEqual(inventedClaims('You love animal rides, so hop on.', known), ['animal rides']);
  });

  it('accepts claims backed by memories and interests', () => {
    assert.deepEqual(inventedClaims('You loved the **mirchi vada in Jodhpur**, so try the kachori here.', known), []);
    assert.deepEqual(inventedClaims('You love history, and this palace is full of it.', known), []);
    assert.deepEqual(inventedClaims("You're a true street-food lover: no day here is complete without chaat.", known), []);
    assert.deepEqual(inventedClaims("You've loved historic architecture on past trips.", known), []);
    assert.deepEqual(inventedClaims('You love cafes, and this one has the best rooftop.', known), []);
  });

  it('can take the made-up sentences out', () => {
    assert.equal(withoutInventedClaims('The pink facade glows at 9 AM. Since you love forts, go early!', known), 'The pink facade glows at 9 AM.');
    assert.equal(withoutInventedClaims('Since you love forts, go early!', known), undefined);
  });

  it('ignores what is not a claim about them', () => {
    assert.deepEqual(inventedClaims("You'll love the view from the ramparts.", known), []);
    assert.deepEqual(inventedClaims('If you love forts, this is the one.', known), []);
    assert.deepEqual(inventedClaims('Lunch, the way you like it.', known), []);
  });
});
