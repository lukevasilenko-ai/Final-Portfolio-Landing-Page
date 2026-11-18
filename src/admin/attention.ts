import type { AdminCategoryRow, AdminProjectRow } from './types';

/** Project list filters; the issue filters double as "needs attention" shortcuts from the dashboard. */
export type ProjectStatusFilter = 'all' | 'published' | 'draft' | 'no-cover' | 'placeholder-title';
export type ProjectSort = 'newest' | 'oldest' | 'title' | 'portfolio-order';

export type AttentionIssue = {
  id: 'placeholder-title' | 'no-cover' | 'draft' | 'empty-category';
  count: number;
  samples: string[];
};

/**
 * Titles that were generated from file names during the import ("1", "1 result",
 * "18 (2) result", "5(1)") rather than written by hand.
 */
export function isPlaceholderTitle(title: string) {
  const value = title.trim().toLowerCase();
  if (!value) return true;
  return /^[\d\s()._-]*(result)?[\d\s()._-]*$/.test(value) && /\d|result/.test(value);
}

export function matchesProjectStatus(project: AdminProjectRow, filter: ProjectStatusFilter) {
  switch (filter) {
    case 'published': return project.is_published;
    case 'draft': return !project.is_published;
    case 'no-cover': return !project.cover_image_path;
    case 'placeholder-title': return isPlaceholderTitle(project.title);
    default: return true;
  }
}

const collator = new Intl.Collator('ka-GE', { numeric: true, sensitivity: 'base' });

export function sortProjects(projects: AdminProjectRow[], sort: ProjectSort) {
  const list = [...projects];
  switch (sort) {
    case 'oldest': return list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    case 'title': return list.sort((a, b) => collator.compare(a.title, b.title));
    case 'portfolio-order': return list.sort((a, b) => a.display_order - b.display_order || b.created_at.localeCompare(a.created_at));
    default: return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

/** Things worth fixing, most important first; only issues that actually occur are returned. */
export function getAttentionIssues(activeProjects: AdminProjectRow[], categories: AdminCategoryRow[]): AttentionIssue[] {
  const samplesOf = (items: { title?: string; name?: string }[]) => items.slice(0, 3).map((item) => item.title ?? item.name ?? '');
  const noCover = activeProjects.filter((project) => !project.cover_image_path);
  const drafts = activeProjects.filter((project) => !project.is_published);
  const emptyCategories = categories.filter((category) => category.is_active
    && !activeProjects.some((project) => project.category_id === category.id));

  // Titles are optional now (works get a neutral name), so imported file-name titles are not an issue.
  const issues: AttentionIssue[] = [
    { id: 'no-cover', count: noCover.length, samples: samplesOf(noCover) },
    { id: 'draft', count: drafts.length, samples: samplesOf(drafts) },
    { id: 'empty-category', count: emptyCategories.length, samples: samplesOf(emptyCategories) },
  ];
  return issues.filter((issue) => issue.count > 0);
}
