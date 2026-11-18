export type AdminCategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  display_order: number;
  is_active: boolean;
};

export type AdminProjectRow = {
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
  deleted_at: string | null;
  deleted_by: string | null;
  tags: string[];
  tools: string[];
  year: number | null;
  created_at: string;
};

export type ProjectAction = 'publish' | 'unpublish' | 'trash' | 'restore' | 'delete';
export type BulkProjectAction = 'publish' | 'unpublish' | 'trash';
