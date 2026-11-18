import assert from 'node:assert/strict';
import test from 'node:test';
import { slugifyCategoryName } from '../src/admin/labels';

test('Georgian category names become readable URL codes', () => {
  assert.equal(slugifyCategoryName('შეფუთვის დიზაინი'), 'sheputvis-dizaini');
  assert.equal(slugifyCategoryName('ბილბორდები და ბეჭდური მასალა'), 'bilbordebi-da-bechduri-masala');
});

test('Latin names, digits and punctuation are normalised', () => {
  assert.equal(slugifyCategoryName('  Branding & Identity 2026! '), 'branding-identity-2026');
  assert.equal(slugifyCategoryName('Café'), 'cafe');
});

test('names with nothing usable give an empty code', () => {
  assert.equal(slugifyCategoryName('   '), '');
  assert.equal(slugifyCategoryName('!!!'), '');
});
