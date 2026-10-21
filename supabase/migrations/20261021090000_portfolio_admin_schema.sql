begin;

create table if not exists public.portfolio_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text not null default '',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.portfolio_categories (slug, name, description, display_order)
values
  ('product-posters', 'Product Posters', 'Product poster portfolio work.', 0),
  ('branding', 'Branding & Identity', 'Brand identity and branding projects.', 1),
  ('billboards-print', 'Billboards & Print', 'Billboards and other print work.', 2)
on conflict (slug) do nothing;

create table if not exists public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  source_key text unique
    check (source_key is null or length(btrim(source_key)) > 0),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) > 0),
  description text not null default '',
  category_id uuid not null references public.portfolio_categories(id) on delete restrict,
  presentation_type text not null default 'project'
    check (presentation_type in ('image', 'project')),
  cover_image_path text,
  display_order integer not null default 0,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  tags text[] not null default '{}'::text[],
  tools text[] not null default '{}'::text[],
  year smallint check (year is null or year between 1900 and 9999),
  published_date date,
  client text,
  service_type text,
  industry text,
  author text,
  location text,
  source_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolio_projects_cover_path_check check (
    cover_image_path is null or (
      cover_image_path like (id::text || '/%')
      and cover_image_path !~ '(^/|(^|/)\.\.?(/|$))'
    )
  ),
  constraint portfolio_projects_published_cover_check check (
    not is_published or cover_image_path is not null
  )
);

create table if not exists public.portfolio_gallery_images (
  id uuid primary key default gen_random_uuid(),
  source_key text unique
    check (source_key is null or length(btrim(source_key)) > 0),
  project_id uuid not null references public.portfolio_projects(id) on delete cascade,
  image_path text not null,
  alt_text text not null default '',
  caption text not null default '',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint portfolio_gallery_images_path_check check (
    image_path like (project_id::text || '/%')
    and image_path !~ '(^/|(^|/)\.\.?(/|$))'
  ),
  constraint portfolio_gallery_images_project_path_unique unique (project_id, image_path)
);

create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  content_key text not null,
  locale text not null default 'ka',
  content jsonb not null,
  is_published boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_content_key_locale_unique unique (content_key, locale),
  constraint site_content_key_check check (length(btrim(content_key)) > 0),
  constraint site_content_locale_check check (length(btrim(locale)) > 0)
);

create table if not exists public.site_settings (
  setting_key text primary key check (length(btrim(setting_key)) > 0),
  setting_value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.authorized_administrators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists portfolio_projects_public_order_idx
  on public.portfolio_projects (category_id, display_order, created_at)
  where is_published;

create index if not exists portfolio_projects_featured_idx
  on public.portfolio_projects (display_order, created_at)
  where is_published and is_featured;

create index if not exists portfolio_gallery_images_project_order_idx
  on public.portfolio_gallery_images (project_id, display_order, created_at);

create index if not exists site_content_public_order_idx
  on public.site_content (content_key, locale, display_order)
  where is_published;

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_authorized_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.authorized_administrators as administrator
    where administrator.user_id = (select auth.uid())
  );
$function$;

revoke all on function private.is_authorized_admin() from public, anon, authenticated;
grant execute on function private.is_authorized_admin() to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$function$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

drop trigger if exists portfolio_categories_set_updated_at on public.portfolio_categories;
create trigger portfolio_categories_set_updated_at
  before update on public.portfolio_categories
  for each row execute function public.set_updated_at();

drop trigger if exists portfolio_projects_set_updated_at on public.portfolio_projects;
create trigger portfolio_projects_set_updated_at
  before update on public.portfolio_projects
  for each row execute function public.set_updated_at();

drop trigger if exists site_content_set_updated_at on public.site_content;
create trigger site_content_set_updated_at
  before update on public.site_content
  for each row execute function public.set_updated_at();

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

alter table public.portfolio_categories enable row level security;
alter table public.portfolio_projects enable row level security;
alter table public.portfolio_gallery_images enable row level security;
alter table public.site_content enable row level security;
alter table public.site_settings enable row level security;
alter table public.authorized_administrators enable row level security;

-- Reset only direct grants for the API roles on these six tables.
revoke all privileges on table public.portfolio_categories from anon, authenticated;
revoke all privileges on table public.portfolio_projects from anon, authenticated;
revoke all privileges on table public.portfolio_gallery_images from anon, authenticated;
revoke all privileges on table public.site_content from anon, authenticated;
revoke all privileges on table public.site_settings from anon, authenticated;
revoke all privileges on table public.authorized_administrators from anon, authenticated;

grant select on public.portfolio_categories to anon, authenticated;
grant insert, update, delete on public.portfolio_categories to authenticated;

grant select on public.portfolio_projects to anon, authenticated;
grant insert, update, delete on public.portfolio_projects to authenticated;

grant select on public.portfolio_gallery_images to anon, authenticated;
grant insert, update, delete on public.portfolio_gallery_images to authenticated;

grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;

grant select, insert, update, delete on public.site_settings to authenticated;

grant select, insert, delete on public.authorized_administrators to authenticated;

grant usage on schema public to anon, authenticated;
grant usage on schema storage to anon, authenticated;
revoke all privileges on table storage.objects from anon, authenticated;
grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

drop policy if exists portfolio_categories_public_read on public.portfolio_categories;
create policy portfolio_categories_public_read
  on public.portfolio_categories for select to anon, authenticated
  using (is_active);

drop policy if exists portfolio_categories_admin_all on public.portfolio_categories;
create policy portfolio_categories_admin_all
  on public.portfolio_categories for all to authenticated
  using (private.is_authorized_admin())
  with check (private.is_authorized_admin());

drop policy if exists portfolio_projects_public_read on public.portfolio_projects;
create policy portfolio_projects_public_read
  on public.portfolio_projects for select to anon, authenticated
  using (is_published);

drop policy if exists portfolio_projects_admin_all on public.portfolio_projects;
create policy portfolio_projects_admin_all
  on public.portfolio_projects for all to authenticated
  using (private.is_authorized_admin())
  with check (private.is_authorized_admin());

drop policy if exists portfolio_gallery_images_public_read on public.portfolio_gallery_images;
create policy portfolio_gallery_images_public_read
  on public.portfolio_gallery_images for select to anon, authenticated
  using (
    exists (
      select 1
      from public.portfolio_projects as project
      where project.id = portfolio_gallery_images.project_id
        and project.is_published
    )
  );

drop policy if exists portfolio_gallery_images_admin_all on public.portfolio_gallery_images;
create policy portfolio_gallery_images_admin_all
  on public.portfolio_gallery_images for all to authenticated
  using (private.is_authorized_admin())
  with check (private.is_authorized_admin());

drop policy if exists site_content_public_read on public.site_content;
create policy site_content_public_read
  on public.site_content for select to anon, authenticated
  using (is_published);

drop policy if exists site_content_admin_all on public.site_content;
create policy site_content_admin_all
  on public.site_content for all to authenticated
  using (private.is_authorized_admin())
  with check (private.is_authorized_admin());

drop policy if exists site_settings_admin_all on public.site_settings;
create policy site_settings_admin_all
  on public.site_settings for all to authenticated
  using (private.is_authorized_admin())
  with check (private.is_authorized_admin());

drop policy if exists authorized_administrators_read_own_or_admin on public.authorized_administrators;
create policy authorized_administrators_read_own_or_admin
  on public.authorized_administrators for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_authorized_admin()
  );

drop policy if exists authorized_administrators_admin_insert on public.authorized_administrators;
create policy authorized_administrators_admin_insert
  on public.authorized_administrators for insert to authenticated
  with check (
    private.is_authorized_admin()
    and added_by = (select auth.uid())
  );

drop policy if exists authorized_administrators_admin_delete on public.authorized_administrators;
create policy authorized_administrators_admin_delete
  on public.authorized_administrators for delete to authenticated
  using (private.is_authorized_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio-images',
  'portfolio-images',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

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
          and project.cover_image_path = storage.objects.name
      )
      or exists (
        select 1
        from public.portfolio_gallery_images as image
        join public.portfolio_projects as project on project.id = image.project_id
        where project.is_published
          and image.image_path = storage.objects.name
      )
    )
  );

drop policy if exists portfolio_images_admin_read_all on storage.objects;
create policy portfolio_images_admin_read_all
  on storage.objects for select to authenticated
  using (
    bucket_id = 'portfolio-images'
    and private.is_authorized_admin()
  );

drop policy if exists portfolio_images_admin_insert on storage.objects;
create policy portfolio_images_admin_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'portfolio-images'
    and private.is_authorized_admin()
    and exists (
      select 1
      from public.portfolio_projects as project
      where project.id::text = split_part(storage.objects.name, '/', 1)
    )
  );

drop policy if exists portfolio_images_admin_update on storage.objects;
create policy portfolio_images_admin_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'portfolio-images'
    and private.is_authorized_admin()
  )
  with check (
    bucket_id = 'portfolio-images'
    and private.is_authorized_admin()
    and exists (
      select 1
      from public.portfolio_projects as project
      where project.id::text = split_part(storage.objects.name, '/', 1)
    )
  );

drop policy if exists portfolio_images_admin_delete on storage.objects;
create policy portfolio_images_admin_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'portfolio-images'
    and private.is_authorized_admin()
  );

comment on table public.portfolio_projects is
  'One row per portfolio card; source_key preserves existing catalog IDs during a later import.';
comment on column public.portfolio_projects.source_metadata is
  'Optional legacy manifest data, including fields not represented as first-class columns.';
comment on table public.portfolio_gallery_images is
  'Ordered project gallery assets; Focus maps to one project row and 34 image rows.';
comment on table public.site_settings is
  'Administrator-only settings; never store secrets in client-readable content.';
comment on table public.authorized_administrators is
  'Administrator allow-list; provision the first account using the privileged SQL Editor.';

commit;
