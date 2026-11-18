-- Light copies ("thumbnails") of portfolio images.
--
-- The admin stores a small WebP copy next to each uploaded image, named
--   <folder>/thumb-<file name without extension>.webp
-- (see src/lib/imageThumbnail.ts, which builds the same name). The site shows it in the catalogue
-- grid and the hero strip; the original stays untouched and is still used for large views.
--
-- Visitors may read a light copy exactly when they may read its original: the main image or a
-- gallery image of a published, not deleted work. Admins can already read and write everything in
-- the bucket (portfolio_images_admin_* policies), so nothing changes for them.
-- Safe to run more than once.

create or replace function public.portfolio_thumbnail_path(image_path text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(regexp_replace(image_path, '([^/]*)$', 'thumb-\1'), '\.[^./]*$', '') || '.webp'
$$;

comment on function public.portfolio_thumbnail_path(text) is
  'Name of the light copy of a portfolio image: <folder>/thumb-<name without extension>.webp.';

grant execute on function public.portfolio_thumbnail_path(text) to anon, authenticated;

drop policy if exists portfolio_thumbnails_public_read_published on storage.objects;
create policy portfolio_thumbnails_public_read_published
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'portfolio-images'
    and storage.objects.name like '%thumb-%.webp'
    and storage.allow_any_operation(array[
      'storage.object.get_authenticated',
      'object.get_authenticated_info',
      'storage.object.sign',
      'storage.object.sign_many'
    ])
    and (
      exists (
        select 1
        from public.portfolio_projects as project
        where project.is_published
          and project.deleted_at is null
          and project.cover_image_path is not null
          and public.portfolio_thumbnail_path(project.cover_image_path) = storage.objects.name
      )
      or exists (
        select 1
        from public.portfolio_gallery_images as image
        join public.portfolio_projects as project on project.id = image.project_id
        where project.is_published
          and project.deleted_at is null
          and public.portfolio_thumbnail_path(image.image_path) = storage.objects.name
      )
    )
  );
