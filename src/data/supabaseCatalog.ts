import { supabase } from '../lib/supabase';
import { ALL_PORTFOLIO_CATEGORY, PORTFOLIO_CATEGORIES } from './portfolioItems';
import type { PortfolioCategory, PortfolioItem, PortfolioItemCategory, PortfolioProject } from '../types';

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  display_order: number;
};

type ProjectRow = {
  id: string;
  source_key: string | null;
  slug: string;
  title: string;
  description: string;
  category_id: string;
  presentation_type: 'image' | 'project';
  cover_image_path: string | null;
  display_order: number;
  is_published: boolean;
  is_featured: boolean;
  tags: string[];
  tools: string[];
  year: number | null;
  published_date: string | null;
  client: string | null;
  service_type: string | null;
  industry: string | null;
  author: string | null;
  location: string | null;
  created_at: string;
};

type GalleryRow = {
  id: string;
  project_id: string;
  image_path: string;
  alt_text: string;
  caption: string;
  display_order: number;
};

export type SupabaseCatalog = {
  categories: PortfolioCategory[];
  items: PortfolioItem[];
  projects: PortfolioProject[];
};

const signedUrlLifetimeSeconds = 3600;

function getCategoryDescription(slug: string, fallback: string) {
  return PORTFOLIO_CATEGORIES.find((category) => category.slug === slug)?.description ?? fallback;
}

function getSignedUrlMap(paths: string[], rows: Array<{ path: string | null; signedUrl: string | null }> | null) {
  const urlByPath = new Map<string, string>();
  (rows ?? []).forEach((row, index) => {
    const path = row.path ?? paths[index];
    if (path && row.signedUrl) urlByPath.set(path, row.signedUrl);
  });
  return urlByPath;
}

async function createSignedUrlMap(paths: string[]) {
  const client = supabase;
  if (!client) throw new Error('Supabase-ის კავშირი გამართული არ არის.');
  const urlByPath = new Map<string, string>();

  for (let start = 0; start < paths.length; start += 100) {
    const batch = paths.slice(start, start + 100);
    const { data, error } = await client.storage.from('portfolio-images')
      .createSignedUrls(batch, signedUrlLifetimeSeconds);
    if (error) throw new Error('კატალოგის სურათების უსაფრთხო ბმულების შექმნა ვერ მოხერხდა.');
    for (const [path, url] of getSignedUrlMap(batch, data)) urlByPath.set(path, url);
  }

  return urlByPath;
}

export async function loadSupabaseCatalog(): Promise<SupabaseCatalog> {
  const client = supabase;
  if (!client) throw new Error('Supabase-ის კავშირი გამართული არ არის.');
  const includeDraftsInLocalPreview = import.meta.env.DEV
    && import.meta.env.VITE_CATALOG_PREVIEW_DRAFTS === 'true';

  if (includeDraftsInLocalPreview) {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData.session) {
      throw new Error('მონახაზების ადგილობრივი გადახედვისთვის ადმინისტრატორის ანგარიშით შედით.');
    }
    const { data: administrator, error: administratorError } = await client.from('authorized_administrators')
      .select('user_id')
      .eq('user_id', sessionData.session.user.id)
      .maybeSingle();
    if (administratorError || !administrator) {
      throw new Error('მონახაზების გადახედვა მხოლოდ ავტორიზებულ ადმინისტრატორს შეუძლია.');
    }
  }

  const projectQuery = client.from('portfolio_projects')
    .select('id, source_key, slug, title, description, category_id, presentation_type, cover_image_path, display_order, is_published, is_featured, tags, tools, year, published_date, client, service_type, industry, author, location, created_at');
  if (includeDraftsInLocalPreview) projectQuery.or('is_published.eq.true,source_key.not.is.null');
  else projectQuery.eq('is_published', true);
  const [categoryResult, projectResult, galleryResult] = await Promise.all([
    client.from('portfolio_categories')
      .select('id, slug, name, description, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('slug', { ascending: true }),
    projectQuery
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }),
    client.from('portfolio_gallery_images')
      .select('id, project_id, image_path, alt_text, caption, display_order')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);

  const queryError = categoryResult.error ?? projectResult.error ?? galleryResult.error;
  if (queryError) throw new Error('კატალოგის მონაცემების ჩატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.');

  const categoriesFromDatabase = (categoryResult.data ?? []) as CategoryRow[];
  const allProjectsFromDatabase = (projectResult.data ?? []) as ProjectRow[];
  const categoryByDatabaseId = new Map(categoriesFromDatabase.map((category) => [category.id, category]));
  const projectsFromDatabase = allProjectsFromDatabase.filter((project) => categoryByDatabaseId.has(project.category_id));
  const projectIds = new Set(projectsFromDatabase.map((project) => project.id));
  const galleryRows = ((galleryResult.data ?? []) as GalleryRow[])
    .filter((image) => projectIds.has(image.project_id));
  const imagePaths = [...new Set([
    ...projectsFromDatabase.flatMap((project) => project.cover_image_path ? [project.cover_image_path] : []),
    ...galleryRows.map((image) => image.image_path),
  ])];

  const signedUrlByPath = await createSignedUrlMap(imagePaths);
  const missingPath = imagePaths.find((path) => !signedUrlByPath.has(path));
  if (missingPath) throw new Error('კატალოგის ზოგი სურათისთვის დროებითი ბმული ვერ შეიქმნა. მონაცემები სრულად არ ჩაიტვირთა.');

  const categories: PortfolioCategory[] = [
    { ...ALL_PORTFOLIO_CATEGORY, count: projectsFromDatabase.length },
    ...categoriesFromDatabase.map((category) => ({
      id: category.slug,
      slug: category.slug,
      label: category.name,
      description: getCategoryDescription(category.slug, category.description),
      count: projectsFromDatabase.filter((project) => project.category_id === category.id).length,
    })),
  ];

  const galleriesByProject = new Map<string, GalleryRow[]>();
  for (const image of galleryRows) {
    const images = galleriesByProject.get(image.project_id) ?? [];
    images.push(image);
    galleriesByProject.set(image.project_id, images);
  }

  const mapped = projectsFromDatabase.flatMap((row) => {
    const category = categoryByDatabaseId.get(row.category_id);
    const image = row.cover_image_path ? signedUrlByPath.get(row.cover_image_path) : undefined;
    if (!category || !image) return [];

    const categoryId = category.slug as PortfolioItemCategory;
    const gallery = galleriesByProject.get(row.id) ?? [];
    const publicId = row.source_key || row.id;
    const year = row.year ? String(row.year) : row.published_date?.slice(0, 4);
    const images: PortfolioItem[] = gallery.map((galleryImage) => ({
      id: galleryImage.id,
      title: galleryImage.alt_text || `${row.title} · ${galleryImage.display_order + 1}`,
      category: categoryId,
      categoryLabel: category.name,
      kind: 'image',
      serviceType: row.service_type || category.name,
      industry: row.industry || category.name,
      image: signedUrlByPath.get(galleryImage.image_path) ?? '',
      imagePath: galleryImage.image_path,
      description: galleryImage.caption || row.description,
      tags: row.tags ?? [],
      featured: row.is_featured,
      year,
      filename: galleryImage.image_path.split('/').at(-1),
    }));

    const project: PortfolioProject = {
      id: publicId,
      slug: row.slug,
      title: row.title,
      description: row.description,
      category: categoryId,
      categoryLabel: category.name,
      cover: image,
      coverPath: row.cover_image_path ?? undefined,
      tags: row.tags ?? [],
      tools: row.tools ?? [],
      year,
      publishedDate: row.published_date ?? undefined,
      author: row.author ?? undefined,
      location: row.location ?? undefined,
      folderName: '',
      images,
    };

    const item: PortfolioItem = {
      id: row.source_key || row.id,
      title: row.title,
      category: categoryId,
      categoryLabel: category.name,
      kind: row.presentation_type,
      serviceType: row.service_type || category.name,
      industry: row.industry || category.name,
      image,
      imagePath: row.cover_image_path ?? undefined,
      description: row.description,
      tags: row.tags ?? [],
      featured: row.is_featured,
      year,
      filename: row.cover_image_path?.split('/').at(-1),
      projectSlug: row.presentation_type === 'project' ? row.slug : undefined,
      imageCount: row.presentation_type === 'project' ? gallery.length : undefined,
    };

    return [{ row, project, item }];
  });

  const categoryOrder = new Map(categoriesFromDatabase.map((category, index) => [category.slug, index]));
  mapped.sort((first, second) => {
    const categoryDifference = (categoryOrder.get(first.project.category) ?? 0) - (categoryOrder.get(second.project.category) ?? 0);
    if (categoryDifference !== 0) return categoryDifference;
    const orderDifference = first.row.display_order - second.row.display_order;
    if (orderDifference !== 0) return orderDifference;
    return first.row.created_at.localeCompare(second.row.created_at);
  });

  return {
    categories,
    items: mapped.map(({ item }) => item),
    projects: mapped.map(({ project }) => project),
  };
}

export async function refreshSupabaseImageUrl(path: string) {
  const client = supabase;
  if (!client) throw new Error('Supabase-ის კავშირი გამართული არ არის.');
  const { data, error } = await client.storage.from('portfolio-images')
    .createSignedUrl(path, signedUrlLifetimeSeconds);
  if (error || !data?.signedUrl) throw new Error('სურათის ბმულის განახლება ვერ მოხერხდა.');
  return data.signedUrl;
}
