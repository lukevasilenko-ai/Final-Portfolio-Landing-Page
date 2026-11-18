begin;

alter table public.portfolio_projects
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists trashed_display_order integer;

create index if not exists portfolio_projects_trash_idx
  on public.portfolio_projects (deleted_at, created_at desc)
  where deleted_at is not null;

drop policy if exists portfolio_projects_public_read on public.portfolio_projects;
create policy portfolio_projects_public_read
  on public.portfolio_projects for select to anon, authenticated
  using (is_published and deleted_at is null);

drop policy if exists portfolio_gallery_images_public_read on public.portfolio_gallery_images;
create policy portfolio_gallery_images_public_read
  on public.portfolio_gallery_images for select to anon, authenticated
  using (
    exists (
      select 1
      from public.portfolio_projects as project
      where project.id = portfolio_gallery_images.project_id
        and project.is_published
        and project.deleted_at is null
    )
  );

drop policy if exists portfolio_images_public_read_published on storage.objects;
create policy portfolio_images_public_read_published
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'portfolio-images'
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
          and project.cover_image_path = storage.objects.name
      )
      or exists (
        select 1
        from public.portfolio_gallery_images as image
        join public.portfolio_projects as project on project.id = image.project_id
        where project.is_published
          and project.deleted_at is null
          and image.image_path = storage.objects.name
      )
    )
  );

create or replace function public.restore_trashed_portfolio_project(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_category_id uuid;
  target_is_published boolean;
  prior_position integer;
  restore_position integer;
begin
  if not private.is_authorized_admin() then
    raise exception using errcode = '42501', message = 'Administrator authorization required.';
  end if;

  if p_project_id is null then
    raise exception using errcode = '22023', message = 'A project ID is required.';
  end if;

  lock table public.portfolio_projects in share row exclusive mode;

  select project.category_id,
         project.is_published,
         coalesce(project.trashed_display_order, project.display_order)
  into target_category_id, target_is_published, prior_position
  from public.portfolio_projects as project
  where project.id = p_project_id
    and project.deleted_at is not null
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'The project is not in Trash.';
  end if;

  if target_is_published then
    select least(
      greatest(prior_position, 0),
      pg_catalog.count(*)::integer
    )
    into restore_position
    from public.portfolio_projects as project
    where project.category_id = target_category_id
      and project.is_published
      and project.deleted_at is null;

    update public.portfolio_projects as project
    set display_order = project.display_order + 1
    where project.category_id = target_category_id
      and project.is_published
      and project.deleted_at is null
      and project.display_order >= restore_position;

    update public.portfolio_projects as project
    set deleted_at = null,
        deleted_by = null,
        trashed_display_order = null,
        display_order = restore_position
    where project.id = p_project_id;
  else
    update public.portfolio_projects as project
    set deleted_at = null,
        deleted_by = null,
        trashed_display_order = null
    where project.id = p_project_id;
  end if;

  return p_project_id;
end;
$function$;

create or replace function public.reorder_portfolio_projects(
  p_category_id uuid,
  p_project_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested_count integer;
  updated_count integer;
begin
  if not private.is_authorized_admin() then
    raise exception using errcode = '42501', message = 'Administrator authorization required.';
  end if;

  if p_category_id is null or p_project_ids is null then
    raise exception using errcode = '22023', message = 'A category and ordered project IDs are required.';
  end if;

  -- Serialize project edits briefly so the validated category set cannot change mid-reorder.
  lock table public.portfolio_projects in share row exclusive mode;

  perform category.id
  from public.portfolio_categories as category
  where category.id = p_category_id
    and category.is_active
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'The category is not active or does not exist.';
  end if;

  requested_count := pg_catalog.cardinality(p_project_ids);

  if exists (
    select requested.project_id
    from pg_catalog.unnest(p_project_ids) as requested(project_id)
    group by requested.project_id
    having pg_catalog.count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'Duplicate project IDs are not allowed.';
  end if;

  if requested_count <> (
    select pg_catalog.count(*)::integer
    from public.portfolio_projects as project
    where project.category_id = p_category_id
      and project.is_published
      and project.deleted_at is null
  ) or exists (
    select 1
    from pg_catalog.unnest(p_project_ids) as requested(project_id)
    left join public.portfolio_projects as project
      on project.id = requested.project_id
      and project.category_id = p_category_id
      and project.is_published
      and project.deleted_at is null
    where project.id is null
  ) then
    raise exception using errcode = '40001', message = 'The category project list changed; reload before reordering.';
  end if;

  update public.portfolio_projects as project
  set display_order = (requested.position - 1)::integer
  from pg_catalog.unnest(p_project_ids) with ordinality as requested(project_id, position)
  where project.id = requested.project_id
    and project.category_id = p_category_id
    and project.is_published
    and project.deleted_at is null;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$function$;

revoke all on function public.reorder_portfolio_projects(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_portfolio_projects(uuid, uuid[]) to authenticated;
revoke all on function public.restore_trashed_portfolio_project(uuid) from public, anon, authenticated;
grant execute on function public.restore_trashed_portfolio_project(uuid) to authenticated;

comment on column public.portfolio_projects.deleted_at is
  'Soft-delete timestamp for the administrator Trash. Storage objects are retained.';
comment on column public.portfolio_projects.deleted_by is
  'Administrator user who moved the project to Trash.';
comment on column public.portfolio_projects.trashed_display_order is
  'Saved published display position, used to restore a trashed project into its prior position.';
comment on function public.reorder_portfolio_projects(uuid, uuid[]) is
  'Atomically replaces the published, non-trashed order for one active category; authorized administrators only.';
comment on function public.restore_trashed_portfolio_project(uuid) is
  'Restores one trashed project atomically; published projects return to their prior position, authorized administrators only.';

commit;
