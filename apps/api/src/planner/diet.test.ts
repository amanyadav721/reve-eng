import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dietConflict } from './diet.js';

describe('dietConflict', () => {
  it('stops meat for vegetarians, including dishes the model mislabels', () => {
    assert.ok(dietConflict('veg', 'laal maas kachori'));
    assert.ok(dietConflict('egg', 'chicken tikka'));
    assert.equal(dietConflict('nonveg', 'laal maas'), undefined);
  });
  it('allows eggs only for the egg diet', () => {
    assert.equal(dietConflict('egg', 'egg bhurji'), undefined);
    assert.ok(dietConflict('veg', 'egg bhurji'));
  });
  it('ignores what a dish says it leaves out', () => {
    assert.equal(dietConflict('jain', 'plain jain thali with dal, roti, rice and sweet (no onion garlic or root veg)'), undefined);
    assert.equal(dietConflict('vegan', 'dairy-free coconut curry, without ghee'), undefined);
    assert.ok(dietConflict('jain', 'onion pakora, no garlic'), 'the onion pakora still has onion');
  });

  it('catches dairy for vegans and onion for Jains', () => {
    assert.ok(dietConflict('vegan', 'lassi'));
    assert.ok(dietConflict('jain', 'pyaaz kachori'));
    assert.equal(dietConflict('veg', 'pyaaz kachori'), undefined);
    assert.equal(dietConflict('vegan', 'dal baati with oil, no ghee'.replace('ghee', '')), undefined);
  });
});
