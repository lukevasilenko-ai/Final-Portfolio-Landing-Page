-- READ ONLY. Run as an authorized operator in Supabase SQL Editor to see all
-- projects, including drafts that are hidden from the publishable-key API.
with gallery_counts as (
  select project_id, count(*)::integer as gallery_count
  from public.portfolio_gallery_images
  group by project_id
)
select
  'project'::text as record_type,
  project.id::text as record_id,
  project.source_key,
  project.slug,
  category.slug as category_slug,
  project.presentation_type,
  project.display_order,
  project.is_published,
  project.is_featured,
  project.cover_image_path,
  coalesce(gallery_counts.gallery_count, 0) as gallery_count,
  project.created_at
from public.portfolio_projects as project
join public.portfolio_categories as category on category.id = project.category_id
left join gallery_counts on gallery_counts.project_id = project.id

union all

select
  'category'::text as record_type,
  category.id::text as record_id,
  null::text as source_key,
  category.slug,
  category.slug as category_slug,
  null::text as presentation_type,
  category.display_order,
  category.is_active as is_published,
  false as is_featured,
  null::text as cover_image_path,
  0 as gallery_count,
  category.created_at
from public.portfolio_categories as category
order by record_type, display_order, slug;
