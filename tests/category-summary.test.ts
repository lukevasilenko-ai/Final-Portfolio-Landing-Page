import assert from 'node:assert/strict';
import test from 'node:test';
import { categoryCountLabel, summarizeCategories } from '../src/data/categorySummary';

const categories = [
  { id: 'c1', slug: 'product-posters', name: 'Product Posters' },
  { id: 'c2', slug: 'branding', name: 'Branding & Identity' },
  { id: 'c3', slug: 'logos', name: 'ლოგოები' },
  { id: 'c4', slug: 'empty', name: 'Empty' },
];

test('home categories keep the admin order and count only their own published works', () => {
  const summaries = summarizeCategories(categories, [
    { category_id: 'c1', presentation_type: 'image' },
    { category_id: 'c1', presentation_type: 'image' },
    { category_id: 'c2', presentation_type: 'project' },
    { category_id: 'c3', presentation_type: 'image' },
    { category_id: 'c3', presentation_type: 'project' },
    { category_id: 'gone', presentation_type: 'image' },
  ]);
  assert.deepEqual(summaries.map((item) => [item.id, item.count, item.unit]), [
    ['product-posters', 2, 'photo'],
    ['branding', 1, 'project'],
    ['logos', 2, 'work'],
    ['empty', 0, 'photo'],
  ]);
  assert.equal(summaries[2].label, 'ლოგოები');
});

test('count labels read naturally in Georgian', () => {
  assert.equal(categoryCountLabel(27, 'photo'), '27 ფოტო');
  assert.equal(categoryCountLabel(1, 'project'), '1 პროექტი');
  assert.equal(categoryCountLabel(5, 'work'), '5 ნამუშევარი');
});
