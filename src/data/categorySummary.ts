/**
 * Category list for the home page: each active category with how many published works it has.
 * Pure helpers (no Supabase or Vite imports) so they can be tested on their own.
 */

export type CategoryUnit = 'project' | 'photo' | 'work';

export interface CategorySummary {
  /** The category's slug (also its id on the site). */
  id: string;
  slug: string;
  label: string;
  count: number;
  /** What the works are: all projects, all single pictures, or a mix. */
  unit: CategoryUnit;
}

export interface SummaryCategoryRow { id: string; slug: string; name: string }
export interface SummaryProjectRow { category_id: string; presentation_type: 'image' | 'project' }

/** Categories in the given order, each with its published works counted. */
export function summarizeCategories(categories: SummaryCategoryRow[], projects: SummaryProjectRow[]): CategorySummary[] {
  return categories.map((category) => {
    const own = projects.filter((project) => project.category_id === category.id);
    const projectCount = own.filter((project) => project.presentation_type === 'project').length;
    const unit: CategoryUnit = own.length > 0 && projectCount === own.length ? 'project' : projectCount === 0 ? 'photo' : 'work';
    return { id: category.slug, slug: category.slug, label: category.name, count: own.length, unit };
  });
}

/** "27 ფოტო", "1 პროექტი", "5 ნამუშევარი". */
export function categoryCountLabel(count: number, unit: CategoryUnit) {
  return `${count} ${unit === 'project' ? 'პროექტი' : unit === 'photo' ? 'ფოტო' : 'ნამუშევარი'}`;
}
