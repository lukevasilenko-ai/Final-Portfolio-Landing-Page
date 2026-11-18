import assert from 'node:assert/strict';
import test from 'node:test';
import { isThumbnailPath, thumbnailPath } from '../src/lib/imageThumbnail';

// The storage rule (supabase/migrations/20261119120000_portfolio_thumbnails.sql) builds the same
// names in SQL; these cases are the ones that rule has to agree with.
test('light copy sits next to the original, as thumb-<name>.webp', () => {
  assert.equal(thumbnailPath('a1/b2-poster.jpg'), 'a1/thumb-b2-poster.webp');
  assert.equal(thumbnailPath('a1/18 (2)_result.webp'), 'a1/thumb-18 (2)_result.webp');
  assert.equal(thumbnailPath('a1/5(1).png'), 'a1/thumb-5(1).webp');
  assert.equal(thumbnailPath('a1/name.with.dots.jpeg'), 'a1/thumb-name.with.dots.webp');
  assert.equal(thumbnailPath('a1/no-extension'), 'a1/thumb-no-extension.webp');
  assert.equal(thumbnailPath('a.1/file'), 'a.1/thumb-file.webp');
  assert.equal(thumbnailPath('plain.jpg'), 'thumb-plain.webp');
});

test('light copies are recognised (and never get copies of their own)', () => {
  assert.equal(isThumbnailPath('a1/thumb-b2-poster.webp'), true);
  assert.equal(isThumbnailPath('a1/b2-poster.jpg'), false);
  assert.equal(isThumbnailPath('thumb-x/b2-poster.jpg'), false);
});
