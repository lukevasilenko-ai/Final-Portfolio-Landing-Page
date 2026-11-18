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
