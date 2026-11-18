import assert from 'node:assert/strict';
import test from 'node:test';
import { getAttentionIssues, isPlaceholderTitle, matchesProjectStatus, sortProjects } from '../src/admin/attention';
import type { AdminCategoryRow, AdminProjectRow } from '../src/admin/types';

const project = (overrides: Partial<AdminProjectRow>): AdminProjectRow => ({
  id: 'p', source_key: null, slug: 's', title: 'Focus · ფოკუსი', description: '', category_id: 'c1',
  presentation_type: 'image', cover_image_path: 'path.webp', display_order: 0, is_published: true,
  is_featured: false, deleted_at: null, deleted_by: null, tags: [], tools: [], year: null,
  created_at: '2026-10-21T00:00:00Z', ...overrides,
});
const category = (overrides: Partial<AdminCategoryRow>): AdminCategoryRow => ({
  id: 'c1', slug: 'c1', name: 'Posters', description: '', display_order: 0, is_active: true, ...overrides,
});

test('import-generated titles are flagged, hand-written ones are not', () => {
  for (const title of ['1', '1 result', '2 result', '18 (2) result', '5(1)', '', '  ']) assert.equal(isPlaceholderTitle(title), true, title);
  for (const title of ['Focus · ფოკუსი', 'პანორამა რედი 2', 'კარდიო ქირურგია', 'Result driven']) assert.equal(isPlaceholderTitle(title), false, title);
});

test('status filters match published, drafts, missing covers and placeholder titles', () => {
  const draft = project({ is_published: false });
  const noCover = project({ cover_image_path: null });
  const placeholder = project({ title: '3 result' });
  assert.equal(matchesProjectStatus(draft, 'draft'), true);
  assert.equal(matchesProjectStatus(draft, 'published'), false);
  assert.equal(matchesProjectStatus(noCover, 'no-cover'), true);
  assert.equal(matchesProjectStatus(placeholder, 'placeholder-title'), true);
  assert.equal(matchesProjectStatus(placeholder, 'all'), true);
});

test('sorting by newest, oldest, title and site order', () => {
  const list = [
    project({ id: 'a', title: 'ბ', created_at: '2026-01-02', display_order: 2 }),
    project({ id: 'b', title: 'ა', created_at: '2026-01-03', display_order: 1 }),
    project({ id: 'c', title: 'გ', created_at: '2026-01-01', display_order: 3 }),
  ];
  assert.deepEqual(sortProjects(list, 'newest').map((item) => item.id), ['b', 'a', 'c']);
  assert.deepEqual(sortProjects(list, 'oldest').map((item) => item.id), ['c', 'a', 'b']);
  assert.deepEqual(sortProjects(list, 'title').map((item) => item.id), ['b', 'a', 'c']);
  assert.deepEqual(sortProjects(list, 'portfolio-order').map((item) => item.id), ['b', 'a', 'c']);
  assert.equal(list[0].id, 'a', 'sorting does not mutate the input');
});

test('attention issues list only what occurs, with counts and samples', () => {
  const projects = [
    project({ id: '1', title: '1 result' }),
    project({ id: '2', title: '2 result', is_published: false }),
    project({ id: '3', cover_image_path: null, is_published: false }),
  ];
  const categories = [category({ id: 'c1' }), category({ id: 'c2', name: 'Empty' }), category({ id: 'c3', name: 'Hidden', is_active: false })];
  const issues = getAttentionIssues(projects, categories);
  // File-name titles are no longer reported: works don't need hand-written titles.
  assert.deepEqual(issues.map((issue) => [issue.id, issue.count]), [
    ['no-cover', 1],
    ['draft', 2],
    ['empty-category', 1],
  ]);
  assert.deepEqual(issues[1].samples, ['2 result', 'Focus · ფოკუსი']);
  assert.deepEqual(getAttentionIssues([project({})], [category({})]), []);
});
