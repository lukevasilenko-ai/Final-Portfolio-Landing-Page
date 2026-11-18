-- ============================================================================
-- Luka Imagines admin: database update (run ONCE in the Supabase SQL Editor)
--
-- Combines the four admin migrations below, in the required order. Each part is its
-- own transaction (begin ... commit). Everything here only ADDS columns, tables,
-- functions and access rules; no existing project, category or image is deleted.
--
-- How to run: Supabase dashboard -> SQL Editor -> New query -> paste this whole
-- file -> Run. The last statement returns one row; all three columns should be true.
-- Generated from supabase/migrations; edit those files, not this one.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 20261021150000_project_trash_and_atomic_order.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 20261022103000_calculator_config_versions.sql
-- ---------------------------------------------------------------------------
-- Versioned calculator settings. Apply to staging first; no data is seeded here.
begin;

create table if not exists public.calculator_config_versions (
  id uuid primary key default gen_random_uuid(),
  version bigint generated always as identity unique,
  status text not null check (status in ('draft', 'published', 'archived')),
  config jsonb not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  restored_from uuid references public.calculator_config_versions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint calculator_config_versions_config_object check (jsonb_typeof(config) = 'object'),
  constraint calculator_config_versions_status_publication check (
    (status = 'published' and published_at is not null)
    or (status <> 'published')
  )
);

create unique index if not exists calculator_config_versions_one_draft_idx
  on public.calculator_config_versions (status) where status = 'draft';
create unique index if not exists calculator_config_versions_one_published_idx
  on public.calculator_config_versions (status) where status = 'published';
create index if not exists calculator_config_versions_history_idx
  on public.calculator_config_versions (version desc);

alter table public.calculator_config_versions enable row level security;
revoke all privileges on table public.calculator_config_versions from anon, authenticated;
grant select on table public.calculator_config_versions to anon, authenticated;

drop policy if exists calculator_config_public_read on public.calculator_config_versions;
create policy calculator_config_public_read
  on public.calculator_config_versions for select to anon, authenticated
  using (status = 'published');

drop policy if exists calculator_config_admin_history_read on public.calculator_config_versions;
create policy calculator_config_admin_history_read
  on public.calculator_config_versions for select to authenticated
  using (private.is_authorized_admin());

create or replace function private.calculator_json_is_text(p_value jsonb, p_max_length integer)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select coalesce(jsonb_typeof(p_value) = 'string'
    and length(btrim(p_value #>> '{}')) > 0
    and length(p_value #>> '{}') <= p_max_length, false);
$function$;

create or replace function private.calculator_json_is_number(
  p_value jsonb,
  p_min numeric,
  p_max numeric
)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select coalesce(jsonb_typeof(p_value) = 'number'
    and (p_value #>> '{}')::numeric between p_min and p_max, false);
$function$;

create or replace function private.is_valid_calculator_config(p_config jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_item jsonb;
  v_value jsonb;
  v_key text;
  v_id text;
  v_ids text[];
  v_group_ids text[] := array[]::text[];
  v_extra_ids text[];
  v_control_ids text[];
  v_previous numeric;
  v_enabled_group_ids text[] := array[]::text[];
  v_has_visible_service boolean := false;
  v_popular_count integer := 0;
  v_price_type text;
  v_icon text;
  v_accent text;
begin
  if jsonb_typeof(p_config) is distinct from 'object' or p_config -> 'schemaVersion' is distinct from '1'::jsonb
    or jsonb_typeof(p_config -> 'enabled') is distinct from 'boolean'
    or jsonb_typeof(p_config -> 'copy') is distinct from 'object'
    or jsonb_typeof(p_config -> 'groups') is distinct from 'array'
    or jsonb_typeof(p_config -> 'services') is distinct from 'array'
    or jsonb_typeof(p_config -> 'packages') is distinct from 'array'
    or jsonb_typeof(p_config -> 'appearance') is distinct from 'object'
    or not private.calculator_json_is_number(p_config -> 'roundingIncrement', 1, 100) then
    return false;
  end if;

  foreach v_key in array array[
    'eyebrow', 'title', 'description', 'groupsLabel', 'estimateEyebrow', 'estimateLabel',
    'templateEstimateDescription', 'estimateDescription', 'categoryLabel', 'designCategory',
    'serviceLabel', 'quantityLabel', 'changesLabel', 'oneChangeLabel', 'rushLabel',
    'resultButton', 'templateInfo', 'extraSizesLabel', 'packagesEyebrow', 'packagesTitle',
    'packagesDescription', 'packageFeaturesLabel', 'popularLabel', 'packageButton', 'monthlyLabel'
  ] loop
    if not private.calculator_json_is_text(p_config -> 'copy' -> v_key, 1000) then return false; end if;
  end loop;

  if jsonb_array_length(p_config -> 'groups') < 1 or jsonb_array_length(p_config -> 'groups') > 20
    or jsonb_array_length(p_config -> 'services') < 1 or jsonb_array_length(p_config -> 'services') > 100
    or jsonb_array_length(p_config -> 'packages') > 30 then
    return false;
  end if;

  for v_item in select value from jsonb_array_elements(p_config -> 'groups') loop
    v_id := v_item ->> 'id';
    v_icon := v_item ->> 'icon';
    if jsonb_typeof(v_item) is distinct from 'object' or v_id is null or v_id !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$'
      or v_id = any(v_group_ids)
      or not private.calculator_json_is_text(v_item -> 'label', 120)
      or v_icon is null or v_icon not in ('calculator', 'printer', 'sparkles', 'layers')
      or jsonb_typeof(v_item -> 'enabled') is distinct from 'boolean'
      or not private.calculator_json_is_number(v_item -> 'order', 0, 10000)
      or trunc((v_item ->> 'order')::numeric) <> (v_item ->> 'order')::numeric then
      return false;
    end if;
    v_group_ids := array_append(v_group_ids, v_id);
    if (v_item ->> 'enabled')::boolean then
      v_enabled_group_ids := array_append(v_enabled_group_ids, v_id);
    end if;
  end loop;

  v_ids := array[]::text[];
  for v_item in select value from jsonb_array_elements(p_config -> 'services') loop
    v_id := v_item ->> 'id';
    v_price_type := v_item #>> '{pricing,type}';
    if jsonb_typeof(v_item) is distinct from 'object' or v_id is null or v_id !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$'
      or v_id = any(v_ids) or v_item ->> 'groupId' is null or not ((v_item ->> 'groupId') = any(v_group_ids))
      or not private.calculator_json_is_text(v_item -> 'label', 120)
      or jsonb_typeof(v_item -> 'note') is distinct from 'string' or length(v_item ->> 'note') > 1000
      or jsonb_typeof(v_item -> 'enabled') is distinct from 'boolean'
      or not private.calculator_json_is_number(v_item -> 'order', 0, 10000)
      or trunc((v_item ->> 'order')::numeric) <> (v_item ->> 'order')::numeric
      or jsonb_typeof(v_item -> 'controlsOrder') is distinct from 'array'
      or jsonb_array_length(v_item -> 'controlsOrder') <> 3
      or jsonb_typeof(v_item -> 'pricing') is distinct from 'object'
      or jsonb_typeof(v_item -> 'quantity') is distinct from 'object'
      or jsonb_typeof(v_item -> 'rush') is distinct from 'object'
      or jsonb_typeof(v_item -> 'discounts') is distinct from 'array'
      or jsonb_array_length(v_item -> 'discounts') > 20
      or jsonb_typeof(v_item -> 'extras') is distinct from 'array'
      or jsonb_array_length(v_item -> 'extras') > 50 then
      return false;
    end if;
    if (v_item ->> 'enabled')::boolean and (v_item ->> 'groupId') = any(v_enabled_group_ids) then
      v_has_visible_service := true;
    end if;

    v_control_ids := array[]::text[];
    for v_value in select value from jsonb_array_elements(v_item -> 'controlsOrder') loop
      v_id := v_value #>> '{}';
      if jsonb_typeof(v_value) is distinct from 'string'
        or v_id not in ('quantity', 'changes', 'options')
        or v_id = any(v_control_ids) then return false; end if;
      v_control_ids := array_append(v_control_ids, v_id);
    end loop;

    if v_price_type = 'range' then
      if not private.calculator_json_is_number(v_item #> '{pricing,min}', 0, 100000)
        or not private.calculator_json_is_number(v_item #> '{pricing,max}', 0, 100000)
        or (v_item #>> '{pricing,min}')::numeric > (v_item #>> '{pricing,max}')::numeric then return false; end if;
    elsif v_price_type in ('fixed', 'per_item') then
      if not private.calculator_json_is_number(v_item #> '{pricing,amount}', 0, 100000) then return false; end if;
    else
      return false;
    end if;

    if jsonb_typeof(v_item #> '{quantity,enabled}') is distinct from 'boolean'
      or not private.calculator_json_is_number(v_item #> '{quantity,min}', 1, 1000)
      or not private.calculator_json_is_number(v_item #> '{quantity,max}', 1, 1000)
      or (v_item #>> '{quantity,min}')::numeric > (v_item #>> '{quantity,max}')::numeric
      or trunc((v_item #>> '{quantity,min}')::numeric) <> (v_item #>> '{quantity,min}')::numeric
      or trunc((v_item #>> '{quantity,max}')::numeric) <> (v_item #>> '{quantity,max}')::numeric
      or not private.calculator_json_is_text(v_item #> '{quantity,label}', 120)
      or jsonb_typeof(v_item #> '{rush,enabled}') is distinct from 'boolean'
      or not private.calculator_json_is_number(v_item #> '{rush,percent}', 0, 500)
      or not private.calculator_json_is_text(v_item #> '{rush,label}', 120) then return false; end if;
    if v_price_type = 'fixed' and (v_item #>> '{quantity,enabled}')::boolean then return false; end if;

    if v_item ? 'changes' then
      if jsonb_typeof(v_item -> 'changes') is distinct from 'object'
        or jsonb_typeof(v_item #> '{changes,enabled}') is distinct from 'boolean'
        or not private.calculator_json_is_number(v_item #> '{changes,min}', 0, 1000)
        or not private.calculator_json_is_number(v_item #> '{changes,max}', 0, 1000)
        or trunc((v_item #>> '{changes,min}')::numeric) <> (v_item #>> '{changes,min}')::numeric
        or trunc((v_item #>> '{changes,max}')::numeric) <> (v_item #>> '{changes,max}')::numeric
        or (v_item #>> '{changes,min}')::numeric > (v_item #>> '{changes,max}')::numeric
        or not private.calculator_json_is_number(v_item #> '{changes,amountPerChange}', 0, 100000)
        or not private.calculator_json_is_text(v_item #> '{changes,label}', 120) then return false; end if;
    end if;

    v_previous := 0;
    for v_value in select value from jsonb_array_elements(v_item -> 'discounts') loop
      if jsonb_typeof(v_value) is distinct from 'object'
        or not private.calculator_json_is_number(v_value -> 'minimumQuantity', 1, 1000)
        or trunc((v_value ->> 'minimumQuantity')::numeric) <> (v_value ->> 'minimumQuantity')::numeric
        or (v_value ->> 'minimumQuantity')::numeric <= v_previous
        or not private.calculator_json_is_number(v_value -> 'percent', 0, 100) then return false; end if;
      v_previous := (v_value ->> 'minimumQuantity')::numeric;
    end loop;

    v_extra_ids := array[]::text[];
    for v_value in select value from jsonb_array_elements(v_item -> 'extras') loop
      v_id := v_value ->> 'id';
      if jsonb_typeof(v_value) is distinct from 'object' or v_id is null or v_id !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$'
        or v_id = any(v_extra_ids) or not private.calculator_json_is_text(v_value -> 'label', 120)
        or jsonb_typeof(v_value -> 'enabled') is distinct from 'boolean'
        or not private.calculator_json_is_number(v_value -> 'amount', 0, 100000)
        or v_value ->> 'billing' is null or v_value ->> 'billing' not in ('fixed', 'per_item')
        or jsonb_typeof(v_value -> 'includedInRush') is distinct from 'boolean' then return false; end if;
      v_extra_ids := array_append(v_extra_ids, v_id);
    end loop;
    v_ids := array_append(v_ids, v_item ->> 'id');
  end loop;

  v_ids := array[]::text[];
  for v_item in select value from jsonb_array_elements(p_config -> 'packages') loop
    v_id := v_item ->> 'id';
    v_accent := v_item ->> 'accent';
    if jsonb_typeof(v_item) is distinct from 'object' or v_id is null or v_id !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$'
      or v_id = any(v_ids) or not private.calculator_json_is_text(v_item -> 'name', 100)
      or not private.calculator_json_is_number(v_item -> 'price', 0, 100000)
      or not private.calculator_json_is_text(v_item -> 'summary', 500)
      or jsonb_typeof(v_item -> 'features') is distinct from 'array'
      or jsonb_array_length(v_item -> 'features') > 50
      or jsonb_typeof(v_item -> 'extraChange') is distinct from 'string' or length(v_item ->> 'extraChange') > 300
      or jsonb_typeof(v_item -> 'note') is distinct from 'string' or length(v_item ->> 'note') > 500
      or jsonb_typeof(v_item -> 'enabled') is distinct from 'boolean'
      or jsonb_typeof(v_item -> 'popular') is distinct from 'boolean'
      or v_accent is null or v_accent not in ('copper', 'accent', 'plum')
      or not private.calculator_json_is_number(v_item -> 'order', 0, 10000)
      or trunc((v_item ->> 'order')::numeric) <> (v_item ->> 'order')::numeric then return false; end if;
    for v_value in select value from jsonb_array_elements(v_item -> 'features') loop
      if jsonb_typeof(v_value) is distinct from 'string' or length(v_value #>> '{}') > 300 then return false; end if;
    end loop;
    v_ids := array_append(v_ids, v_id);
    if (v_item ->> 'popular')::boolean then v_popular_count := v_popular_count + 1; end if;
  end loop;

  if not v_has_visible_service or v_popular_count > 1 then return false; end if;
  if p_config #>> '{appearance,layout}' is null or p_config #>> '{appearance,layout}' not in ('split', 'stacked')
    or p_config #>> '{appearance,serviceColumns}' is null or p_config #>> '{appearance,serviceColumns}' not in ('responsive', 'two', 'three')
    or p_config #>> '{appearance,palette}' is null or p_config #>> '{appearance,palette}' not in ('brand', 'copper', 'plum')
    or p_config #>> '{appearance,typography}' is null or p_config #>> '{appearance,typography}' not in ('brand', 'compact') then return false; end if;
  return true;
exception when others then
  return false;
end;
$function$;

revoke all on function private.calculator_json_is_text(jsonb, integer) from public, anon, authenticated;
revoke all on function private.calculator_json_is_number(jsonb, numeric, numeric) from public, anon, authenticated;
revoke all on function private.is_valid_calculator_config(jsonb) from public, anon, authenticated;

alter table public.calculator_config_versions
  drop constraint if exists calculator_config_versions_valid_config;
alter table public.calculator_config_versions
  add constraint calculator_config_versions_valid_config
  check (private.is_valid_calculator_config(config));

create or replace function public.save_calculator_draft(p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result public.calculator_config_versions%rowtype;
begin
  if not private.is_authorized_admin() then
    raise exception 'Administrator authorization required' using errcode = '42501';
  end if;
  if not private.is_valid_calculator_config(p_config) then
    raise exception 'Invalid calculator configuration' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calculator_config_versions', 0));
  insert into public.calculator_config_versions (status, config, created_by, updated_by)
  values ('draft', p_config, auth.uid(), auth.uid())
  on conflict (status) where status = 'draft'
  do update set config = excluded.config, updated_by = auth.uid(), updated_at = pg_catalog.now()
  returning * into v_result;
  return pg_catalog.jsonb_build_object('id', v_result.id, 'version', v_result.version);
end;
$function$;

create or replace function public.publish_calculator_config(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_config jsonb;
  v_result public.calculator_config_versions%rowtype;
begin
  if not private.is_authorized_admin() then
    raise exception 'Administrator authorization required' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calculator_config_versions', 0));
  select config into v_config
  from public.calculator_config_versions
  where id = p_version_id and status = 'draft'
  for update;
  if not found then raise exception 'Calculator draft not found' using errcode = '22023'; end if;
  if not private.is_valid_calculator_config(v_config) then
    raise exception 'Invalid calculator configuration' using errcode = '22023';
  end if;
  update public.calculator_config_versions
  set status = 'archived', updated_at = pg_catalog.now()
  where status = 'published';
  update public.calculator_config_versions
  set status = 'published', published_at = pg_catalog.now(), updated_at = pg_catalog.now(), updated_by = auth.uid()
  where id = p_version_id
  returning * into v_result;
  return pg_catalog.jsonb_build_object('id', v_result.id, 'version', v_result.version);
end;
$function$;

create or replace function public.restore_calculator_config(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_config jsonb;
  v_result public.calculator_config_versions%rowtype;
begin
  if not private.is_authorized_admin() then
    raise exception 'Administrator authorization required' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calculator_config_versions', 0));
  select config into v_config
  from public.calculator_config_versions
  where id = p_version_id and status = 'archived' and published_at is not null
  for update;
  if not found then raise exception 'Published calculator version not found' using errcode = '22023'; end if;
  if not private.is_valid_calculator_config(v_config) then
    raise exception 'Invalid calculator configuration' using errcode = '22023';
  end if;
  update public.calculator_config_versions
  set status = 'archived', updated_at = pg_catalog.now()
  where status = 'published';
  insert into public.calculator_config_versions (status, config, created_by, updated_by, restored_from, published_at)
  values ('published', v_config, auth.uid(), auth.uid(), p_version_id, pg_catalog.now())
  returning * into v_result;
  return pg_catalog.jsonb_build_object('id', v_result.id, 'version', v_result.version, 'restoredFrom', p_version_id);
end;
$function$;

revoke all on function public.save_calculator_draft(jsonb) from public, anon, authenticated;
revoke all on function public.publish_calculator_config(uuid) from public, anon, authenticated;
revoke all on function public.restore_calculator_config(uuid) from public, anon, authenticated;
grant execute on function public.save_calculator_draft(jsonb) to authenticated;
grant execute on function public.publish_calculator_config(uuid) to authenticated;
grant execute on function public.restore_calculator_config(uuid) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- 20261022150000_website_layout_versions.sql
-- ---------------------------------------------------------------------------
begin;

create table if not exists public.website_layout_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  alt_text text not null default '',
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint website_layout_assets_path_check check (
    storage_path like (id::text || '/%')
    and storage_path ~ ('^' || id::text || '/[A-Za-z0-9._() -]{1,200}$')
    and position('..' in storage_path) = 0
    and position(chr(92) in storage_path) = 0
  ),
  constraint website_layout_assets_alt_text_length check (length(alt_text) <= 500)
);

create table if not exists public.website_layout_versions (
  id uuid primary key default gen_random_uuid(),
  version bigint generated always as identity unique,
  status text not null check (status in ('draft', 'published', 'archived')),
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  restored_from uuid references public.website_layout_versions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint website_layout_versions_publication_status check (
    (status = 'published' and published_at is not null)
    or status <> 'published'
  )
);

create unique index if not exists website_layout_versions_one_draft_idx
  on public.website_layout_versions (status) where status = 'draft';
create unique index if not exists website_layout_versions_one_published_idx
  on public.website_layout_versions (status) where status = 'published';
create index if not exists website_layout_versions_history_idx
  on public.website_layout_versions (version desc);
create index if not exists website_layout_assets_public_idx
  on public.website_layout_assets (id) where is_published;

create schema if not exists private;

create or replace function private.website_layout_elements_valid(p_elements jsonb, p_depth integer default 0)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_element jsonb;
  v_type text;
  v_key text;
  v_text text;
  v_max_length integer;
  v_item record;
begin
  if pg_catalog.jsonb_typeof(p_elements) is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_elements) > 30
    or p_depth > 3 then return false; end if;

  for v_item in select value from pg_catalog.jsonb_array_elements(p_elements) loop
    v_element := v_item.value;
    if pg_catalog.jsonb_typeof(v_element) is distinct from 'object'
      or exists (
        select 1 from pg_catalog.jsonb_object_keys(v_element) as item(key)
        where item.key not in ('id', 'type', 'visible', 'title', 'text', 'label', 'href', 'src', 'alt', 'value', 'icon', 'children')
      )
      or v_element ->> 'id' is null or v_element ->> 'id' !~ '^[A-Za-z0-9][A-Za-z0-9-]{2,100}$'
      or pg_catalog.jsonb_typeof(v_element -> 'visible') is distinct from 'boolean' then return false; end if;

    v_type := v_element ->> 'type';
    if v_type is null or v_type not in (
      'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider',
      'feature-list', 'statistic', 'gallery-item', 'card', 'content-group',
      'faq-item', 'testimonial', 'logo', 'call-to-action'
    ) then return false; end if;

    foreach v_key in array array['title', 'text', 'label', 'alt', 'value'] loop
      if v_element ? v_key then
        if pg_catalog.jsonb_typeof(v_element -> v_key) is distinct from 'string' then return false; end if;
        v_text := v_element ->> v_key;
        v_max_length := case when v_key = 'text' then 3000 else 500 end;
        if pg_catalog.length(v_text) > v_max_length then return false; end if;
      end if;
    end loop;

    if v_element ? 'href' and (
      pg_catalog.jsonb_typeof(v_element -> 'href') is distinct from 'string'
      or pg_catalog.length(v_element ->> 'href') > 2048
      or not (
        v_element ->> 'href' ~* '^https://[[:alnum:].-]+(:[0-9]+)?([/?#][^[:space:]]*)?$'
        or v_element ->> 'href' ~ '^#[A-Za-z0-9-]+$'
        or (
          v_element ->> 'href' like '/%'
          and v_element ->> 'href' not like '//%'
          and pg_catalog.strpos(v_element ->> 'href', '..') = 0
        )
        or v_element ->> 'href' ~* '^(mailto|tel):[^[:space:]]+$'
      )
    ) then return false; end if;

    if v_element ? 'src' and v_element ->> 'src' <> '' and (
      pg_catalog.jsonb_typeof(v_element -> 'src') is distinct from 'string'
      or pg_catalog.length(v_element ->> 'src') > 2048
      or not (
        v_element ->> 'src' ~* '^https://[[:alnum:].-]+(:[0-9]+)?([/?#][^[:space:]]*)?$'
        or v_element ->> 'src' ~* '^asset:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
    ) then return false; end if;

    if v_element ? 'icon' and (pg_catalog.jsonb_typeof(v_element -> 'icon') is distinct from 'string'
      or v_element ->> 'icon' not in ('sparkles', 'palette', 'layers', 'check', 'arrow', 'star', 'quote', 'clock')) then return false; end if;
    if v_element ? 'children' then
      if v_type not in ('card', 'content-group', 'feature-list')
        or not private.website_layout_elements_valid(v_element -> 'children', p_depth + 1) then return false; end if;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$function$;

create or replace function private.is_valid_website_layout(p_config jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_section jsonb;
  v_section_item record;
  v_item record;
  v_kind text;
  v_section_key text;
  v_expected_anchor text;
  v_id text;
  v_anchor text;
  v_order integer;
  v_seen_ids text[] := array[]::text[];
  v_seen_anchors text[] := array[]::text[];
  v_seen_orders integer[] := array[]::integer[];
  v_native_keys text[] := array[]::text[];
  v_visible boolean := false;
  v_allowed_copy text[];
  v_field text;
  v_value text;
begin
  if pg_catalog.jsonb_typeof(p_config) is distinct from 'object'
    or exists (
      select 1 from pg_catalog.jsonb_object_keys(p_config) as item(key)
      where item.key not in ('schemaVersion', 'sections')
    )
    or p_config -> 'schemaVersion' is distinct from '1'::jsonb
    or pg_catalog.jsonb_typeof(p_config -> 'sections') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_config -> 'sections') < 8
    or pg_catalog.jsonb_array_length(p_config -> 'sections') > 30 then return false; end if;

  for v_section_item in select value from pg_catalog.jsonb_array_elements(p_config -> 'sections') loop
    v_section := v_section_item.value;
    if pg_catalog.jsonb_typeof(v_section) is distinct from 'object'
      or exists (
        select 1 from pg_catalog.jsonb_object_keys(v_section) as item(key)
        where item.key not in ('id', 'kind', 'sectionKey', 'templateId', 'label', 'anchorId', 'visible', 'inNavigation', 'order', 'copy', 'elements', 'appearance')
      ) then return false; end if;

    v_id := v_section ->> 'id';
    v_anchor := v_section ->> 'anchorId';
    if v_id is null or v_id !~ '^[A-Za-z0-9][A-Za-z0-9-]{2,100}$' or v_id = any(v_seen_ids)
      or v_anchor is null or v_anchor !~ '^[A-Za-z][A-Za-z0-9-]{1,63}$' or v_anchor = any(v_seen_anchors)
      or pg_catalog.jsonb_typeof(v_section -> 'label') is distinct from 'string'
      or pg_catalog.length(pg_catalog.btrim(v_section ->> 'label')) not between 1 and 120
      or pg_catalog.jsonb_typeof(v_section -> 'visible') is distinct from 'boolean'
      or pg_catalog.jsonb_typeof(v_section -> 'inNavigation') is distinct from 'boolean'
      or pg_catalog.jsonb_typeof(v_section -> 'order') is distinct from 'number'
      or (v_section ->> 'order')::numeric < 0 or (v_section ->> 'order')::numeric > 1000
      or pg_catalog.trunc((v_section ->> 'order')::numeric) <> (v_section ->> 'order')::numeric then return false; end if;

    v_order := (v_section ->> 'order')::integer;
    if v_order = any(v_seen_orders) then return false; end if;
    v_seen_ids := pg_catalog.array_append(v_seen_ids, v_id);
    v_seen_anchors := pg_catalog.array_append(v_seen_anchors, v_anchor);
    v_seen_orders := pg_catalog.array_append(v_seen_orders, v_order);
    v_visible := v_visible or (v_section ->> 'visible')::boolean;

    if pg_catalog.jsonb_typeof(v_section -> 'copy') is distinct from 'object'
      or pg_catalog.jsonb_typeof(v_section -> 'elements') is distinct from 'array'
      or not private.website_layout_elements_valid(v_section -> 'elements', 0)
      or pg_catalog.jsonb_typeof(v_section -> 'appearance') is distinct from 'object'
      or v_section #>> '{appearance,layout}' is null
      or v_section #>> '{appearance,spacing}' is null
      or v_section #>> '{appearance,alignment}' is null
      or v_section #>> '{appearance,background}' is null
      or v_section #>> '{appearance,typography}' is null
      or v_section #>> '{appearance,accent}' is null
      or v_section #>> '{appearance,responsive}' is null
      or exists (
        select 1 from pg_catalog.jsonb_object_keys(v_section -> 'appearance') as item(key)
        where item.key not in ('layout', 'spacing', 'alignment', 'background', 'typography', 'accent', 'responsive')
      )
      or v_section #>> '{appearance,layout}' not in ('one-column', 'two-column', 'grid')
      or v_section #>> '{appearance,spacing}' not in ('compact', 'comfortable', 'spacious')
      or v_section #>> '{appearance,alignment}' not in ('start', 'center')
      or v_section #>> '{appearance,background}' not in ('default', 'soft', 'dark')
      or v_section #>> '{appearance,typography}' not in ('brand', 'editorial', 'compact')
      or v_section #>> '{appearance,accent}' not in ('forest', 'copper', 'neutral')
      or v_section #>> '{appearance,responsive}' not in ('all', 'desktop', 'mobile') then return false; end if;

    v_kind := v_section ->> 'kind';
    if v_kind = 'native' then
      v_section_key := v_section ->> 'sectionKey';
      v_expected_anchor := case when v_section_key = 'hero' then 'home' else v_section_key end;
      if v_section_key is null or v_id <> v_section_key or v_section ? 'templateId'
        or v_section_key not in ('hero', 'about', 'projects', 'brief-studio', 'calculator', 'contact', 'closing-scene', 'site-footer')
        or v_anchor <> v_expected_anchor
        or v_section_key = any(v_native_keys) then return false; end if;
      v_native_keys := pg_catalog.array_append(v_native_keys, v_section_key);
      v_allowed_copy := case v_section_key
        when 'hero' then array['eyebrow', 'titleLine1', 'titleLine2', 'titleLine3', 'description', 'primaryButtonLabel', 'imageAlt', 'featuredLabel', 'heroImageSrc']
        when 'about' then array['eyebrow', 'titleLine1', 'titleLine2', 'profileName', 'role', 'profileDescription', 'featureOneTitle', 'featureOneText', 'featureTwoTitle', 'featureTwoText', 'skillsTitle', 'skillsDescription', 'statsExperienceValue', 'statsExperienceLabel', 'statsProjectsValue', 'statsProjectsLabel', 'statsSuccessValue', 'statsSuccessLabel', 'skillCategoryLabel', 'skillOneName', 'skillOneLevel', 'skillTwoName', 'skillTwoLevel', 'skillsQuote']
        when 'projects' then array['eyebrow', 'title', 'description', 'buttonLabel', 'categoryLabel']
        when 'brief-studio' then array['eyebrow', 'title', 'description']
        when 'calculator' then array[]::text[]
        when 'contact' then array['eyebrow', 'title', 'description', 'channelsTitle', 'cardTitleLead', 'cardTitleAccentOne', 'cardTitleMiddle', 'cardTitleAccentTwo', 'cardTitleEnd', 'contactCardDescription', 'emailLabel', 'contactEmail', 'whatsappLabel', 'whatsappNumber', 'workingHoursLabel', 'workingHours', 'signature', 'formNameLabel', 'formNamePlaceholder', 'formEmailLabel', 'formEmailPlaceholder', 'formSubjectLabel', 'formSubjectPlaceholder', 'formMessageLabel', 'formMessagePlaceholder', 'formNote', 'formButtonLabel']
        when 'closing-scene' then array['titleLine1', 'titleAccent']
        when 'site-footer' then array['role', 'copyright']
      end;
      for v_item in select key, value from pg_catalog.jsonb_each(v_section -> 'copy') loop
        v_field := v_item.key;
        if not (v_field = any(v_allowed_copy)) or pg_catalog.jsonb_typeof(v_item.value) is distinct from 'string'
          or pg_catalog.length(v_item.value #>> '{}') > 3000 then return false; end if;
        v_value := v_item.value #>> '{}';
        if v_field = 'heroImageSrc' and v_value <> '' and not (
          v_value ~* '^https://[[:alnum:].-]+(:[0-9]+)?([/?#][^[:space:]]*)?$'
          or v_value ~* '^asset:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ) then return false; end if;
        if v_section_key = 'about' and v_field in ('skillOneLevel', 'skillTwoLevel')
          and (v_value !~ '^[0-9]{1,3}$' or v_value::integer not between 1 and 100) then return false; end if;
        if v_section_key = 'about' and v_field in ('statsExperienceValue', 'statsProjectsValue', 'statsSuccessValue')
          and v_value !~ '^[0-9]{1,4}([+]|%)?$' then return false; end if;
        if v_section_key = 'contact' and v_field = 'contactEmail'
          and v_value !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then return false; end if;
        if v_section_key = 'contact' and v_field = 'whatsappNumber'
          and v_value !~ '^[0-9]{7,15}$' then return false; end if;
      end loop;
    elsif v_kind = 'template' then
      if v_section ? 'sectionKey' or v_section ->> 'templateId' is null or v_section ->> 'templateId' not in (
        'text-heading', 'image-text', 'gallery', 'call-to-action', 'services-grid', 'feature-cards',
        'statistics', 'faq', 'testimonials', 'logo-grid', 'divider', 'custom-content'
      ) or pg_catalog.jsonb_object_length(v_section -> 'copy') <> 0 then return false; end if;
    else
      return false;
    end if;
  end loop;

  if not v_visible or not (v_native_keys @> array['hero', 'about', 'projects', 'brief-studio', 'calculator', 'contact', 'closing-scene', 'site-footer']) then return false; end if;
  return true;
exception when others then
  return false;
end;
$function$;

create or replace function private.website_layout_asset_ids(p_config jsonb)
returns table(asset_id uuid)
language sql
stable
set search_path = ''
as $function$
  with recursive blocks(value) as (
    select element.value
    from pg_catalog.jsonb_array_elements(p_config -> 'sections') as section(value)
    cross join lateral pg_catalog.jsonb_array_elements(section.value -> 'elements') as element(value)
    union all
    select child.value
    from blocks
    cross join lateral pg_catalog.jsonb_array_elements(coalesce(blocks.value -> 'children', '[]'::jsonb)) as child(value)
  ), refs(source) as (
    select blocks.value ->> 'src' from blocks where blocks.value ->> 'src' ~* '^asset:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    union all
    select section.value #>> '{copy,heroImageSrc}'
    from pg_catalog.jsonb_array_elements(p_config -> 'sections') as section(value)
    where section.value #>> '{copy,heroImageSrc}' ~* '^asset:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
  select distinct substring(refs.source from 7)::uuid from refs
$function$;

revoke all on function private.website_layout_elements_valid(jsonb, integer) from public, anon, authenticated;
revoke all on function private.is_valid_website_layout(jsonb) from public, anon, authenticated;
revoke all on function private.website_layout_asset_ids(jsonb) from public, anon, authenticated;

alter table public.website_layout_versions enable row level security;
alter table public.website_layout_assets enable row level security;
revoke all privileges on table public.website_layout_versions from anon, authenticated;
revoke all privileges on table public.website_layout_assets from anon, authenticated;
grant select on table public.website_layout_versions to anon, authenticated;
grant select on table public.website_layout_assets to anon, authenticated;
grant insert (id, storage_path, alt_text) on table public.website_layout_assets to authenticated;
grant update (alt_text) on table public.website_layout_assets to authenticated;

drop policy if exists website_layout_public_read on public.website_layout_versions;
create policy website_layout_public_read on public.website_layout_versions
  for select to anon, authenticated using (status = 'published');
drop policy if exists website_layout_admin_history_read on public.website_layout_versions;
create policy website_layout_admin_history_read on public.website_layout_versions
  for select to authenticated using (private.is_authorized_admin());

drop policy if exists website_layout_assets_public_read on public.website_layout_assets;
create policy website_layout_assets_public_read on public.website_layout_assets
  for select to anon, authenticated using (is_published);
drop policy if exists website_layout_assets_admin_read on public.website_layout_assets;
create policy website_layout_assets_admin_read on public.website_layout_assets
  for select to authenticated using (private.is_authorized_admin());
drop policy if exists website_layout_assets_admin_insert on public.website_layout_assets;
create policy website_layout_assets_admin_insert on public.website_layout_assets
  for insert to authenticated with check (private.is_authorized_admin() and created_by = (select auth.uid()) and not is_published);
drop policy if exists website_layout_assets_admin_update_alt_text on public.website_layout_assets;
create policy website_layout_assets_admin_update_alt_text on public.website_layout_assets
  for update to authenticated using (private.is_authorized_admin()) with check (private.is_authorized_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('website-layout-assets', 'website-layout-assets', false, 20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[])
on conflict (id) do nothing;

do $bucket_check$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'website-layout-assets'
      and name = 'website-layout-assets'
      and not public
      and file_size_limit = 20971520
      and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
      and allowed_mime_types <@ array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
      and not exists (
        select 1 from storage.objects where bucket_id = 'website-layout-assets'
      )
  ) then
    raise exception 'The website-layout-assets bucket is not empty or has incompatible settings; no existing files or bucket settings were changed.';
  end if;
end;
$bucket_check$;

drop policy if exists website_layout_assets_public_storage_read on storage.objects;
create policy website_layout_assets_public_storage_read on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'website-layout-assets'
    and storage.allow_any_operation(array[
      'storage.object.get_authenticated', 'object.get_authenticated_info',
      'storage.object.sign', 'storage.object.sign_many'
    ])
    and exists (
      select 1 from public.website_layout_assets as asset
      where asset.is_published and asset.storage_path = storage.objects.name
    )
  );
drop policy if exists website_layout_assets_admin_storage_read on storage.objects;
create policy website_layout_assets_admin_storage_read on storage.objects
  for select to authenticated using (bucket_id = 'website-layout-assets' and private.is_authorized_admin());
drop policy if exists website_layout_assets_admin_storage_insert on storage.objects;
create policy website_layout_assets_admin_storage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'website-layout-assets'
    and private.is_authorized_admin()
    and exists (select 1 from public.website_layout_assets as asset where asset.storage_path = storage.objects.name)
  );
drop policy if exists website_layout_assets_admin_storage_update on storage.objects;
create policy website_layout_assets_admin_storage_update on storage.objects
  for update to authenticated using (bucket_id = 'website-layout-assets' and private.is_authorized_admin())
  with check (
    bucket_id = 'website-layout-assets' and private.is_authorized_admin()
    and exists (select 1 from public.website_layout_assets as asset where asset.storage_path = storage.objects.name)
  );

create or replace function public.save_website_layout_draft(p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result public.website_layout_versions%rowtype;
begin
  if not private.is_authorized_admin() then raise exception 'Administrator authorization required' using errcode = '42501'; end if;
  if not private.is_valid_website_layout(p_config) then raise exception 'Invalid website layout configuration' using errcode = '22023'; end if;
  if exists (
    select 1 from private.website_layout_asset_ids(p_config) as ref
    left join public.website_layout_assets as asset on asset.id = ref.asset_id
    where asset.id is null or not exists (
      select 1 from storage.objects as object
      where object.bucket_id = 'website-layout-assets' and object.name = asset.storage_path
    )
  ) then raise exception 'A selected website image does not exist' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('website_layout_versions', 0));
  insert into public.website_layout_versions (status, config, created_by, updated_by)
  values ('draft', p_config, auth.uid(), auth.uid())
  on conflict (status) where status = 'draft'
  do update set config = excluded.config, updated_by = auth.uid(), updated_at = pg_catalog.now()
  returning * into v_result;
  return pg_catalog.jsonb_build_object('id', v_result.id, 'version', v_result.version);
end;
$function$;

create or replace function public.publish_website_layout(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_config jsonb;
  v_result public.website_layout_versions%rowtype;
begin
  if not private.is_authorized_admin() then raise exception 'Administrator authorization required' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('website_layout_versions', 0));
  select config into v_config from public.website_layout_versions where id = p_version_id and status = 'draft' for update;
  if not found then raise exception 'Website layout draft not found' using errcode = '22023'; end if;
  if not private.is_valid_website_layout(v_config) then raise exception 'Invalid website layout configuration' using errcode = '22023'; end if;
  if exists (
    select 1 from private.website_layout_asset_ids(v_config) as ref
    left join public.website_layout_assets as asset on asset.id = ref.asset_id
    where asset.id is null or not exists (
      select 1 from storage.objects as object
      where object.bucket_id = 'website-layout-assets' and object.name = asset.storage_path
    )
  ) then raise exception 'A selected website image does not exist' using errcode = '22023'; end if;
  update public.website_layout_versions set status = 'archived', updated_at = pg_catalog.now() where status = 'published';
  update public.website_layout_assets set is_published = false where is_published;
  update public.website_layout_assets as asset set is_published = true
  where asset.id in (select ref.asset_id from private.website_layout_asset_ids(v_config) as ref);
  update public.website_layout_versions
  set status = 'published', published_at = pg_catalog.now(), updated_at = pg_catalog.now(), updated_by = auth.uid()
  where id = p_version_id returning * into v_result;
  return pg_catalog.jsonb_build_object('id', v_result.id, 'version', v_result.version);
end;
$function$;

create or replace function public.restore_website_layout(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_config jsonb;
  v_result public.website_layout_versions%rowtype;
begin
  if not private.is_authorized_admin() then raise exception 'Administrator authorization required' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('website_layout_versions', 0));
  select config into v_config from public.website_layout_versions
  where id = p_version_id and status = 'archived' and published_at is not null for update;
  if not found then raise exception 'Published website layout version not found' using errcode = '22023'; end if;
  if not private.is_valid_website_layout(v_config) then raise exception 'Invalid website layout configuration' using errcode = '22023'; end if;
  if exists (
    select 1 from private.website_layout_asset_ids(v_config) as ref
    left join public.website_layout_assets as asset on asset.id = ref.asset_id
    where asset.id is null or not exists (
      select 1 from storage.objects as object
      where object.bucket_id = 'website-layout-assets' and object.name = asset.storage_path
    )
  ) then raise exception 'A selected website image does not exist' using errcode = '22023'; end if;
  update public.website_layout_versions set status = 'archived', updated_at = pg_catalog.now() where status = 'published';
  update public.website_layout_assets set is_published = false where is_published;
  update public.website_layout_assets as asset set is_published = true
  where asset.id in (select ref.asset_id from private.website_layout_asset_ids(v_config) as ref);
  insert into public.website_layout_versions (status, config, created_by, updated_by, restored_from, published_at)
  values ('published', v_config, auth.uid(), auth.uid(), p_version_id, pg_catalog.now())
  returning * into v_result;
  return pg_catalog.jsonb_build_object('id', v_result.id, 'version', v_result.version, 'restoredFrom', p_version_id);
end;
$function$;

create or replace function public.discard_unuploaded_website_layout_asset(p_asset_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_path text;
begin
  if not private.is_authorized_admin() then raise exception 'Administrator authorization required' using errcode = '42501'; end if;
  select storage_path into v_path from public.website_layout_assets where id = p_asset_id and not is_published for update;
  if not found then return false; end if;
  if exists (select 1 from storage.objects where bucket_id = 'website-layout-assets' and name = v_path)
    or exists (select 1 from public.website_layout_versions as version
      cross join lateral private.website_layout_asset_ids(version.config) as ref
      where ref.asset_id = p_asset_id) then
    raise exception 'Website image is already uploaded or referenced and cannot be discarded' using errcode = '22023';
  end if;
  delete from public.website_layout_assets where id = p_asset_id;
  return true;
end;
$function$;

revoke all on function public.save_website_layout_draft(jsonb) from public, anon, authenticated;
revoke all on function public.publish_website_layout(uuid) from public, anon, authenticated;
revoke all on function public.restore_website_layout(uuid) from public, anon, authenticated;
revoke all on function public.discard_unuploaded_website_layout_asset(uuid) from public, anon, authenticated;
grant execute on function public.save_website_layout_draft(jsonb) to authenticated;
grant execute on function public.publish_website_layout(uuid) to authenticated;
grant execute on function public.restore_website_layout(uuid) to authenticated;
grant execute on function public.discard_unuploaded_website_layout_asset(uuid) to authenticated;

comment on table public.website_layout_versions is
  'Validated, versioned homepage composition. Only published configuration is public; draft/history access is admin-only.';
comment on table public.website_layout_assets is
  'Private image files for homepage templates; publication toggles access atomically with the published layout.';

commit;

-- ---------------------------------------------------------------------------
-- 20261023110000_native_website_elements.sql
-- ---------------------------------------------------------------------------
begin;

-- Extend only the existing structured layout validator. No application data,
-- RLS policy, Storage object, or authorization grant is changed here.
create or replace function private.website_layout_elements_valid(p_elements jsonb, p_depth integer default 0)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_element jsonb;
  v_type text;
  v_key text;
  v_text text;
  v_max_length integer;
  v_item record;
  v_target text;
  v_position text;
  v_allowed_types text[];
begin
  if pg_catalog.jsonb_typeof(p_elements) is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_elements) > 30
    or p_depth > 3 then return false; end if;

  for v_item in select value from pg_catalog.jsonb_array_elements(p_elements) loop
    v_element := v_item.value;
    if pg_catalog.jsonb_typeof(v_element) is distinct from 'object'
      or exists (
        select 1 from pg_catalog.jsonb_object_keys(v_element) as item(key)
        where item.key not in ('id', 'type', 'visible', 'title', 'text', 'label', 'href', 'src', 'alt', 'value', 'icon', 'children', 'target', 'position')
      )
      or v_element ->> 'id' is null or v_element ->> 'id' !~ '^[A-Za-z0-9][A-Za-z0-9-]{2,100}$'
      or pg_catalog.jsonb_typeof(v_element -> 'visible') is distinct from 'boolean' then return false; end if;

    v_type := v_element ->> 'type';
    if v_type is null or v_type not in (
      'eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider',
      'feature-list', 'statistic', 'gallery-item', 'card', 'content-group',
      'faq-item', 'testimonial', 'logo', 'call-to-action', 'native-visibility'
    ) then return false; end if;

    if v_type = 'native-visibility' then
      if p_depth <> 0 or not (v_element ? 'target') or v_element ? 'position'
        or v_element ->> 'visible' <> 'false'
        or pg_catalog.jsonb_typeof(v_element -> 'target') is distinct from 'string'
        or exists (
          select 1 from pg_catalog.jsonb_object_keys(v_element) as item(key)
          where item.key not in ('id', 'type', 'visible', 'target')
        ) then return false; end if;
      v_target := v_element ->> 'target';
      if v_target not in (
        'hero.eyebrow', 'hero.title', 'hero.description', 'hero.primary-action', 'hero.featured-label',
        'about.eyebrow', 'about.title', 'about.profile', 'about.feature-one', 'about.feature-two', 'about.statistics',
        'projects.eyebrow', 'projects.title', 'projects.description', 'projects.catalog-button', 'projects.category-label',
        'brief-studio.eyebrow', 'brief-studio.title', 'brief-studio.description',
        'calculator.eyebrow', 'calculator.title', 'calculator.description',
        'contact.eyebrow', 'contact.title', 'contact.description',
        'closing-scene.title', 'site-footer.copyright'
      ) then return false; end if;
    elsif v_element ? 'target' then
      if p_depth <> 0
        or pg_catalog.jsonb_typeof(v_element -> 'target') is distinct from 'string'
        or pg_catalog.jsonb_typeof(v_element -> 'position') is distinct from 'string' then return false; end if;
      v_target := v_element ->> 'target';
      v_position := v_element ->> 'position';
      if v_target not in (
        'hero.eyebrow', 'hero.title', 'hero.description', 'hero.primary-action', 'hero.artwork', 'hero.featured-label', 'hero.social-links',
        'about.eyebrow', 'about.title', 'about.profile', 'about.feature-one', 'about.feature-two', 'about.statistics', 'about.skills',
        'projects.eyebrow', 'projects.title', 'projects.description', 'projects.catalog-button', 'projects.category-label', 'projects.featured-work', 'projects.category-cards',
        'brief-studio.eyebrow', 'brief-studio.title', 'brief-studio.description', 'brief-studio.interactive-builder',
        'calculator.eyebrow', 'calculator.title', 'calculator.description', 'calculator.widget',
        'contact.eyebrow', 'contact.title', 'contact.description', 'contact.channels', 'contact.form',
        'closing-scene.title', 'closing-scene.animation', 'site-footer.brand', 'site-footer.copyright'
      ) or v_position not in ('before', 'after', 'replace') then return false; end if;

      v_allowed_types := case v_target
        when 'hero.eyebrow' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'hero.title' then array['eyebrow', 'heading', 'subheading', 'paragraph']
        when 'hero.description' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'hero.primary-action' then array['button', 'eyebrow', 'paragraph']
        when 'hero.artwork' then array['image', 'gallery-item', 'eyebrow', 'paragraph']
        when 'hero.featured-label' then array['eyebrow', 'paragraph', 'button']
        when 'hero.social-links' then array[]::text[]
        when 'about.eyebrow' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'about.title' then array['eyebrow', 'heading', 'subheading', 'paragraph']
        when 'about.profile' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'about.feature-one' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'about.feature-two' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'about.statistics' then array['statistic', 'feature-list', 'card']
        when 'about.skills' then array[]::text[]
        when 'projects.eyebrow' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'projects.title' then array['eyebrow', 'heading', 'subheading', 'paragraph']
        when 'projects.description' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'projects.catalog-button' then array['button', 'eyebrow', 'paragraph']
        when 'projects.category-label' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'projects.featured-work' then array[]::text[]
        when 'projects.category-cards' then array[]::text[]
        when 'brief-studio.eyebrow' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'brief-studio.title' then array['eyebrow', 'heading', 'subheading', 'paragraph']
        when 'brief-studio.description' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'brief-studio.interactive-builder' then array[]::text[]
        when 'calculator.eyebrow' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'calculator.title' then array['eyebrow', 'heading', 'subheading', 'paragraph']
        when 'calculator.description' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'calculator.widget' then array[]::text[]
        when 'contact.eyebrow' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'contact.title' then array['eyebrow', 'heading', 'subheading', 'paragraph']
        when 'contact.description' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'contact.channels' then array[]::text[]
        when 'contact.form' then array[]::text[]
        when 'closing-scene.title' then array['eyebrow', 'heading', 'subheading', 'paragraph']
        when 'closing-scene.animation' then array[]::text[]
        when 'site-footer.brand' then array[]::text[]
        when 'site-footer.copyright' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        else array[]::text[]
      end;
      if not (v_type = any(v_allowed_types)) then return false; end if;
    elsif v_element ? 'position' then
      return false;
    end if;

    foreach v_key in array array['title', 'text', 'label', 'alt', 'value'] loop
      if v_element ? v_key then
        if pg_catalog.jsonb_typeof(v_element -> v_key) is distinct from 'string' then return false; end if;
        v_text := v_element ->> v_key;
        v_max_length := case when v_key = 'text' then 3000 else 500 end;
        if pg_catalog.length(v_text) > v_max_length then return false; end if;
      end if;
    end loop;

    if v_element ? 'href' and (
      pg_catalog.jsonb_typeof(v_element -> 'href') is distinct from 'string'
      or pg_catalog.length(v_element ->> 'href') > 2048
      or not (
        v_element ->> 'href' ~* '^https://[[:alnum:].-]+(:[0-9]+)?([/?#][^[:space:]]*)?$'
        or v_element ->> 'href' ~ '^#[A-Za-z0-9-]+$'
        or (v_element ->> 'href' like '/%' and v_element ->> 'href' not like '//%' and pg_catalog.strpos(v_element ->> 'href', '..') = 0)
        or v_element ->> 'href' ~* '^(mailto|tel):[^[:space:]]+$'
      )
    ) then return false; end if;

    if v_element ? 'src' and v_element ->> 'src' <> '' and (
      pg_catalog.jsonb_typeof(v_element -> 'src') is distinct from 'string'
      or pg_catalog.length(v_element ->> 'src') > 2048
      or not (
        v_element ->> 'src' ~* '^https://[[:alnum:].-]+(:[0-9]+)?([/?#][^[:space:]]*)?$'
        or v_element ->> 'src' ~* '^asset:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
    ) then return false; end if;

    if v_element ? 'icon' and (pg_catalog.jsonb_typeof(v_element -> 'icon') is distinct from 'string'
      or v_element ->> 'icon' not in ('sparkles', 'palette', 'layers', 'check', 'arrow', 'star', 'quote', 'clock')) then return false; end if;
    if v_element ? 'children' then
      if v_type not in ('card', 'content-group', 'feature-list')
        or not private.website_layout_elements_valid(v_element -> 'children', p_depth + 1) then return false; end if;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$function$;

create or replace function private.is_valid_website_layout(p_config jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_section jsonb;
  v_section_item record;
  v_item record;
  v_kind text;
  v_section_key text;
  v_expected_anchor text;
  v_id text;
  v_anchor text;
  v_order integer;
  v_seen_ids text[] := array[]::text[];
  v_seen_anchors text[] := array[]::text[];
  v_seen_orders integer[] := array[]::integer[];
  v_native_keys text[] := array[]::text[];
  v_visible boolean := false;
  v_allowed_copy text[];
  v_field text;
  v_value text;
begin
  if pg_catalog.jsonb_typeof(p_config) is distinct from 'object'
    or exists (
      select 1 from pg_catalog.jsonb_object_keys(p_config) as item(key)
      where item.key not in ('schemaVersion', 'sections')
    )
    or p_config -> 'schemaVersion' is distinct from '1'::jsonb
    or pg_catalog.jsonb_typeof(p_config -> 'sections') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_config -> 'sections') < 8
    or pg_catalog.jsonb_array_length(p_config -> 'sections') > 30 then return false; end if;

  for v_section_item in select value from pg_catalog.jsonb_array_elements(p_config -> 'sections') loop
    v_section := v_section_item.value;
    if pg_catalog.jsonb_typeof(v_section) is distinct from 'object'
      or exists (
        select 1 from pg_catalog.jsonb_object_keys(v_section) as item(key)
        where item.key not in ('id', 'kind', 'sectionKey', 'templateId', 'label', 'anchorId', 'visible', 'inNavigation', 'order', 'copy', 'elements', 'appearance')
      ) then return false; end if;

    v_id := v_section ->> 'id';
    v_anchor := v_section ->> 'anchorId';
    if v_id is null or v_id !~ '^[A-Za-z0-9][A-Za-z0-9-]{2,100}$' or v_id = any(v_seen_ids)
      or v_anchor is null or v_anchor !~ '^[A-Za-z][A-Za-z0-9-]{1,63}$' or v_anchor = any(v_seen_anchors)
      or pg_catalog.jsonb_typeof(v_section -> 'label') is distinct from 'string'
      or pg_catalog.length(pg_catalog.btrim(v_section ->> 'label')) not between 1 and 120
      or pg_catalog.jsonb_typeof(v_section -> 'visible') is distinct from 'boolean'
      or pg_catalog.jsonb_typeof(v_section -> 'inNavigation') is distinct from 'boolean'
      or pg_catalog.jsonb_typeof(v_section -> 'order') is distinct from 'number'
      or (v_section ->> 'order')::numeric < 0 or (v_section ->> 'order')::numeric > 1000
      or pg_catalog.trunc((v_section ->> 'order')::numeric) <> (v_section ->> 'order')::numeric then return false; end if;

    v_order := (v_section ->> 'order')::integer;
    if v_order = any(v_seen_orders) then return false; end if;
    v_seen_ids := pg_catalog.array_append(v_seen_ids, v_id);
    v_seen_anchors := pg_catalog.array_append(v_seen_anchors, v_anchor);
    v_seen_orders := pg_catalog.array_append(v_seen_orders, v_order);
    v_visible := v_visible or (v_section ->> 'visible')::boolean;

    if pg_catalog.jsonb_typeof(v_section -> 'copy') is distinct from 'object'
      or pg_catalog.jsonb_typeof(v_section -> 'elements') is distinct from 'array'
      or not private.website_layout_elements_valid(v_section -> 'elements', 0)
      or pg_catalog.jsonb_typeof(v_section -> 'appearance') is distinct from 'object'
      or v_section #>> '{appearance,layout}' is null
      or v_section #>> '{appearance,spacing}' is null
      or v_section #>> '{appearance,alignment}' is null
      or v_section #>> '{appearance,background}' is null
      or v_section #>> '{appearance,typography}' is null
      or v_section #>> '{appearance,accent}' is null
      or v_section #>> '{appearance,responsive}' is null
      or exists (
        select 1 from pg_catalog.jsonb_object_keys(v_section -> 'appearance') as item(key)
        where item.key not in ('layout', 'spacing', 'alignment', 'background', 'typography', 'accent', 'responsive')
      )
      or v_section #>> '{appearance,layout}' not in ('one-column', 'two-column', 'grid')
      or v_section #>> '{appearance,spacing}' not in ('compact', 'comfortable', 'spacious')
      or v_section #>> '{appearance,alignment}' not in ('start', 'center')
      or v_section #>> '{appearance,background}' not in ('default', 'soft', 'dark')
      or v_section #>> '{appearance,typography}' not in ('brand', 'editorial', 'compact')
      or v_section #>> '{appearance,accent}' not in ('forest', 'copper', 'neutral')
      or v_section #>> '{appearance,responsive}' not in ('all', 'desktop', 'mobile') then return false; end if;

    v_kind := v_section ->> 'kind';
    if v_kind = 'native' then
      v_section_key := v_section ->> 'sectionKey';
      v_expected_anchor := case when v_section_key = 'hero' then 'home' else v_section_key end;
      if v_section_key is null or v_id <> v_section_key or v_section ? 'templateId'
        or v_section_key not in ('hero', 'about', 'projects', 'brief-studio', 'calculator', 'contact', 'closing-scene', 'site-footer')
        or v_anchor <> v_expected_anchor
        or v_section_key = any(v_native_keys)
        or exists (
          select 1 from pg_catalog.jsonb_array_elements(v_section -> 'elements') as element(value)
          where element.value ? 'target'
            and pg_catalog.split_part(element.value ->> 'target', '.', 1) <> v_section_key
        ) then return false; end if;
      v_native_keys := pg_catalog.array_append(v_native_keys, v_section_key);
      v_allowed_copy := case v_section_key
        when 'hero' then array['eyebrow', 'titleLine1', 'titleLine2', 'titleLine3', 'description', 'primaryButtonLabel', 'imageAlt', 'featuredLabel', 'heroImageSrc']
        when 'about' then array['eyebrow', 'titleLine1', 'titleLine2', 'profileName', 'role', 'profileDescription', 'featureOneTitle', 'featureOneText', 'featureTwoTitle', 'featureTwoText', 'skillsTitle', 'skillsDescription', 'statsExperienceValue', 'statsExperienceLabel', 'statsProjectsValue', 'statsProjectsLabel', 'statsSuccessValue', 'statsSuccessLabel', 'skillCategoryLabel', 'skillOneName', 'skillOneLevel', 'skillTwoName', 'skillTwoLevel', 'skillsQuote']
        when 'projects' then array['eyebrow', 'title', 'description', 'buttonLabel', 'categoryLabel']
        when 'brief-studio' then array['eyebrow', 'title', 'description']
        when 'calculator' then array[]::text[]
        when 'contact' then array['eyebrow', 'title', 'description', 'channelsTitle', 'cardTitleLead', 'cardTitleAccentOne', 'cardTitleMiddle', 'cardTitleAccentTwo', 'cardTitleEnd', 'contactCardDescription', 'emailLabel', 'contactEmail', 'whatsappLabel', 'whatsappNumber', 'workingHoursLabel', 'workingHours', 'signature', 'formNameLabel', 'formNamePlaceholder', 'formEmailLabel', 'formEmailPlaceholder', 'formSubjectLabel', 'formSubjectPlaceholder', 'formMessageLabel', 'formMessagePlaceholder', 'formNote', 'formButtonLabel']
        when 'closing-scene' then array['titleLine1', 'titleAccent']
        when 'site-footer' then array['role', 'copyright']
      end;
      for v_item in select key, value from pg_catalog.jsonb_each(v_section -> 'copy') loop
        v_field := v_item.key;
        if not (v_field = any(v_allowed_copy)) or pg_catalog.jsonb_typeof(v_item.value) is distinct from 'string'
          or pg_catalog.length(v_item.value #>> '{}') > 3000 then return false; end if;
        v_value := v_item.value #>> '{}';
        if v_field = 'heroImageSrc' and v_value <> '' and not (
          v_value ~* '^https://[[:alnum:].-]+(:[0-9]+)?([/?#][^[:space:]]*)?$'
          or v_value ~* '^asset:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ) then return false; end if;
        if v_section_key = 'about' and v_field in ('skillOneLevel', 'skillTwoLevel')
          and (v_value !~ '^[0-9]{1,3}$' or v_value::integer not between 1 and 100) then return false; end if;
        if v_section_key = 'about' and v_field in ('statsExperienceValue', 'statsProjectsValue', 'statsSuccessValue')
          and v_value !~ '^[0-9]{1,4}([+]|%)?$' then return false; end if;
        if v_section_key = 'contact' and v_field = 'contactEmail'
          and v_value !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then return false; end if;
        if v_section_key = 'contact' and v_field = 'whatsappNumber'
          and v_value !~ '^[0-9]{7,15}$' then return false; end if;
      end loop;
    elsif v_kind = 'template' then
      if v_section ? 'sectionKey' or v_section ->> 'templateId' is null or v_section ->> 'templateId' not in (
        'text-heading', 'image-text', 'gallery', 'call-to-action', 'services-grid', 'feature-cards',
        'statistics', 'faq', 'testimonials', 'logo-grid', 'divider', 'custom-content'
      ) or pg_catalog.jsonb_object_length(v_section -> 'copy') <> 0
        or exists (
          select 1 from pg_catalog.jsonb_array_elements(v_section -> 'elements') as element(value)
          where element.value ? 'target' or element.value ->> 'type' = 'native-visibility'
        ) then return false; end if;
    else
      return false;
    end if;
  end loop;

  if not v_visible or not (v_native_keys @> array['hero', 'about', 'projects', 'brief-studio', 'calculator', 'contact', 'closing-scene', 'site-footer']) then return false; end if;
  return true;
exception when others then
  return false;
end;
$function$;

revoke all on function private.website_layout_elements_valid(jsonb, integer) from public, anon, authenticated;
revoke all on function private.is_valid_website_layout(jsonb) from public, anon, authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Check: all three should be true.
-- ---------------------------------------------------------------------------
select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'portfolio_projects' and column_name = 'deleted_at'
  ) as trash_ready,
  to_regclass('public.calculator_config_versions') is not null as calculator_ready,
  to_regclass('public.website_layout_versions') is not null as website_sections_ready;