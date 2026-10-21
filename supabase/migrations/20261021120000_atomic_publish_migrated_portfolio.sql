create or replace function public.publish_migrated_portfolio_projects(p_source_keys text[])
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public, private, pg_temp
as $function$
declare
  requested_count integer;
  distinct_key_count integer;
  product_poster_count integer;
  focus_count integer;
  billboard_count integer;
  eligible_project_count integer;
  expected_object_count integer;
  present_object_count integer;
  focus_gallery_count integer;
  total_project_count integer;
  preserved_test_draft_count integer;
  other_published_count integer;
  total_gallery_count integer;
  active_category_count integer;
  updated_count integer;
begin
  if not private.is_authorized_admin() then
    raise exception using errcode = '42501', message = 'Authorized administrator required.';
  end if;

  if p_source_keys is null then
    raise exception using errcode = '22023', message = 'Exactly 29 migrated project source keys are required.';
  end if;

  select
    count(*),
    count(distinct supplied.source_key),
    count(*) filter (where supplied.source_key like 'product-posters-%'),
    count(*) filter (where supplied.source_key = 'behance-246573009-cover'),
    count(*) filter (where supplied.source_key like 'billboards-print-%')
  into requested_count, distinct_key_count, product_poster_count, focus_count, billboard_count
  from unnest(p_source_keys) as supplied(source_key);

  if requested_count <> 29
     or distinct_key_count <> 29
     or product_poster_count <> 27
     or focus_count <> 1
     or billboard_count <> 1 then
    raise exception using errcode = '22023', message = 'Source keys must identify 27 posters, Focus, and one billboard project.';
  end if;

  select count(*)
  into eligible_project_count
  from public.portfolio_projects as project
  join public.portfolio_categories as category on category.id = project.category_id
  where project.source_key = any (p_source_keys)
    and not project.is_published
    and project.cover_image_path is not null
    and category.is_active
    and (
      (project.source_key like 'product-posters-%' and category.slug = 'product-posters')
      or (project.source_key = 'behance-246573009-cover' and category.slug = 'branding')
      or (project.source_key like 'billboards-print-%' and category.slug = 'billboards-print')
    );

  if eligible_project_count <> 29 then
    raise exception using errcode = 'P0001', message = 'All 29 target projects must exist as unpublished drafts in their active categories.';
  end if;

  select count(*) into total_project_count
  from public.portfolio_projects;
  select count(*) into preserved_test_draft_count
  from public.portfolio_projects
  where source_key is null and not is_published;
  select count(*) into other_published_count
  from public.portfolio_projects
  where is_published
    and (source_key is null or not (source_key = any (p_source_keys)));
  select count(*) into total_gallery_count
  from public.portfolio_gallery_images;
  select count(*) into active_category_count
  from public.portfolio_categories
  where is_active;

  if total_project_count <> 30
     or preserved_test_draft_count <> 1
     or other_published_count <> 0
     or total_gallery_count <> 35
     or active_category_count <> 3 then
    raise exception using errcode = 'P0001', message = 'The existing test draft or expected portfolio inventory changed after preflight.';
  end if;

  select count(*)
  into focus_gallery_count
  from public.portfolio_gallery_images as image
  join public.portfolio_projects as project on project.id = image.project_id
  where project.source_key = 'behance-246573009-cover';

  if focus_gallery_count <> 34 then
    raise exception using errcode = 'P0001', message = 'Focus must have exactly 34 gallery images before publishing.';
  end if;

  select count(*)
  into expected_object_count
  from (
    select project.cover_image_path as object_path
    from public.portfolio_projects as project
    where project.source_key = any (p_source_keys)
    union all
    select image.image_path as object_path
    from public.portfolio_gallery_images as image
    join public.portfolio_projects as project on project.id = image.project_id
    where project.source_key = any (p_source_keys)
  ) as referenced_objects;

  select count(*)
  into present_object_count
  from (
    select project.cover_image_path as object_path
    from public.portfolio_projects as project
    where project.source_key = any (p_source_keys)
    union all
    select image.image_path as object_path
    from public.portfolio_gallery_images as image
    join public.portfolio_projects as project on project.id = image.project_id
    where project.source_key = any (p_source_keys)
  ) as referenced_objects
  join storage.objects as object on object.bucket_id = 'portfolio-images'
    and object.name = referenced_objects.object_path;

  if expected_object_count <> 63 or present_object_count <> 63 then
    raise exception using errcode = 'P0001', message = 'All 63 referenced portfolio image objects must exist before publishing.';
  end if;

  update public.portfolio_projects as project
  set is_published = true
  where project.source_key = any (p_source_keys)
    and not project.is_published;

  get diagnostics updated_count = row_count;
  if updated_count <> 29 then
    raise exception using errcode = 'P0001', message = 'The publish operation did not match exactly 29 drafts; all changes were rolled back.';
  end if;

  return updated_count;
end;
$function$;

revoke all on function public.publish_migrated_portfolio_projects(text[]) from public, anon, authenticated;
grant execute on function public.publish_migrated_portfolio_projects(text[]) to authenticated;

comment on function public.publish_migrated_portfolio_projects(text[]) is
  'Atomically publishes exactly 29 authorized migrated projects (27 posters, Focus, and one billboard) under existing RLS policies.';
