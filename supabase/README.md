# Supabase portfolio schema

## Status

The database schema migration was applied to Supabase in the previous phase, as confirmed by the administrator. This Phase 3 work has made no database or Storage writes and has not changed any existing row or object. The existing schema already includes `presentation_type`, `source_key`, and ordered gallery rows; no additional SQL migration is needed for the prepared catalog loader.

The current website has 29 portfolio cards: 27 Product Posters images, one Billboards & Print image, and the Focus branding project. Focus has one cover and 34 ordered gallery images. The schema supports a one-row-per-card import with `presentation_type = 'image'` for standalone image cards and `presentation_type = 'project'` for Focus. `source_key` retains existing stable item IDs; Focus uses `behance-246573009-cover`. Its 34 images map to 34 rows in `portfolio_gallery_images`, ordered by `display_order`. The migration does not import these records or move any assets.

## Original schema migration (already applied)

Do not rerun `supabase/migrations/20261021090000_portfolio_admin_schema.sql` as part of the content migration. It contains schema, grant, RLS, and Storage policy operations and was already applied. The safe read-only query for current categories, projects (including drafts), and gallery counts is `supabase/portfolio-migration-inventory.sql`.

## First administrator

1. In Supabase, create or invite your own account under **Authentication** > **Users**. Complete any email confirmation required by the project.
2. Copy that user's UUID from the Users list.
3. The migration is already applied; only use the following statement if an administrator explicitly provisions another authorized account. Replace the placeholder with that user's UUID:

```sql
insert into public.authorized_administrators (user_id)
values ('<AUTH_USER_UUID>'::uuid)
on conflict (user_id) do nothing;
```

The SQL Editor runs with privileged database access. The public website has no policy that permits self-registration as an administrator. Later administrator additions are restricted to an already-authorized administrator; table writes are also protected by RLS.

## Access and image handling

- Anonymous visitors can read active categories, published projects, their gallery images, and published `site_content` rows only. Put public-facing website copy and pricing in `site_content` and set `is_published = true` when ready to serve it. Keep private configuration in `site_settings`, which remains administrator-only.
- Draft projects and all their gallery rows are hidden from anonymous and authenticated non-admin users. Their Storage objects cannot be read or signed by those users unless the object is also referenced by a published cover/gallery row.
- The admin check is `private.is_authorized_admin()`, a `SECURITY DEFINER` function with an empty `search_path`. Only `authenticated` has schema usage and function execution; anonymous callers have neither. Keep the `private` schema out of **Project Settings > API > Exposed schemas** (expose `public`, not `private`). The function returns only whether the current Auth user is in the allow-list.
- Before granting table access, the migration revokes all privileges from `anon` and `authenticated` on exactly the six portfolio tables. It then grants public `SELECT` only on categories, projects, gallery images, and `site_content`; authenticated users receive the needed table operations, with RLS restricting mutations to authorized administrators. `site_settings` remains admin-only, and administrator membership has only authenticated `SELECT`/`INSERT`/`DELETE` grants. These revokes do not target `service_role` or unrelated application tables.
- The `portfolio-images` bucket is private, limits uploads to JPEG, PNG, WebP, or AVIF up to 50 MiB, and scopes image paths to a project UUID. Authorized administrators can list, upload, replace, and delete objects in this bucket.
- The migration first revokes direct table privileges on `storage.objects` from `anon` and `authenticated`, then grants only `SELECT` to both roles and `INSERT`/`UPDATE`/`DELETE` to `authenticated`. RLS restricts public reads to published image paths and admin operations to the `portfolio-images` bucket. It grants no privileges on `storage.buckets`. The public SELECT policy permits only authenticated-object download/info and signed-URL creation operations; it excludes `storage.object.list` and `storage.object.list_v2`. This operation-aware filter is important because Storage uses the same SQL `SELECT` privilege for reads and listing. See [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control) and [Storage helper functions](https://supabase.com/docs/guides/storage/schema/helper-functions).
- `storage.objects` privileges are table-wide, so revoking existing direct grants can affect other buckets that rely on `anon` or `authenticated` access. Audit other Storage use in the project before applying; the migration does not change other bucket rows or drop their policies.
- PostgreSQL combines permissive RLS policies with `OR`. Before applying this migration to a project that already has Storage policies, inspect existing `storage.objects` SELECT policies and remove or narrow any policy that independently permits anonymous listing or reads outside this portfolio bucket. This migration does not drop unrelated policies or alter other buckets.
- Since the bucket is private, the future website integration should request signed URLs for published images. Signed URLs already issued remain usable until they expire even if a project is unpublished; use short expirations where prompt revocation matters. Do not store API secrets in `site_settings`; publishable keys are public by design, and secret keys must remain server-side.

## RLS verification checklist

Run these checks against a test project after applying the migration and provisioning the first administrator. Use separate anonymous, authenticated non-admin, and authorized-admin sessions.

### Table privilege verification

Run this read-only query as a privileged operator after applying the migration. Each row should return `privileges_match = true`. It checks effective table privileges, including `TRUNCATE`, `REFERENCES`, and `TRIGGER`, which must all be false for both roles. The migration does not revoke or grant privileges to `service_role`.

```sql
with intended(table_name, role_name, can_select, can_insert, can_update, can_delete) as (
  values
    ('public.portfolio_categories', 'anon', true, false, false, false),
    ('public.portfolio_projects', 'anon', true, false, false, false),
    ('public.portfolio_gallery_images', 'anon', true, false, false, false),
    ('public.site_content', 'anon', true, false, false, false),
    ('public.site_settings', 'anon', false, false, false, false),
    ('public.authorized_administrators', 'anon', false, false, false, false),
    ('public.portfolio_categories', 'authenticated', true, true, true, true),
    ('public.portfolio_projects', 'authenticated', true, true, true, true),
    ('public.portfolio_gallery_images', 'authenticated', true, true, true, true),
    ('public.site_content', 'authenticated', true, true, true, true),
    ('public.site_settings', 'authenticated', true, true, true, true),
    ('public.authorized_administrators', 'authenticated', true, true, false, true)
)
select
  role_name,
  table_name,
  has_table_privilege(role_name, table_name, 'SELECT') as can_select,
  has_table_privilege(role_name, table_name, 'INSERT') as can_insert,
  has_table_privilege(role_name, table_name, 'UPDATE') as can_update,
  has_table_privilege(role_name, table_name, 'DELETE') as can_delete,
  has_table_privilege(role_name, table_name, 'TRUNCATE') as can_truncate,
  has_table_privilege(role_name, table_name, 'REFERENCES') as can_references,
  has_table_privilege(role_name, table_name, 'TRIGGER') as can_trigger,
  case
    when current_setting('server_version_num')::integer >= 180000
      then has_table_privilege(role_name, table_name, 'MAINTAIN')
    else false
  end as can_maintain,
  (
    has_table_privilege(role_name, table_name, 'SELECT') = can_select
    and has_table_privilege(role_name, table_name, 'INSERT') = can_insert
    and has_table_privilege(role_name, table_name, 'UPDATE') = can_update
    and has_table_privilege(role_name, table_name, 'DELETE') = can_delete
    and not has_table_privilege(role_name, table_name, 'TRUNCATE')
    and not has_table_privilege(role_name, table_name, 'REFERENCES')
    and not has_table_privilege(role_name, table_name, 'TRIGGER')
    and not (
      case
        when current_setting('server_version_num')::integer >= 180000
          then has_table_privilege(role_name, table_name, 'MAINTAIN')
        else false
      end
    )
  ) as privileges_match
from intended
order by table_name, role_name;
```

If any row has `privileges_match = false`, inspect inherited or `PUBLIC` grants and resolve the unexpected privilege before relying on the RLS boundary.

### Anonymous visitor

- Can select active categories, published projects, gallery rows belonging to published projects, and published `site_content` only.
- Cannot see drafts or unpublished `site_content`; cannot read `site_settings` or `authorized_administrators`.
- Cannot insert, update, or delete any application rows or upload, replace, or delete Storage objects.
- Can display/download a referenced published cover or gallery image and create a signed URL for it.
- Cannot read or sign an object belonging only to a draft project, nor list objects in the bucket (`storage.object.list` and `storage.object.list_v2`).
- Cannot call the admin-check function through the Data API or grant itself administrator access.

### Authenticated non-admin

- Has the same published-content visibility as an anonymous visitor; sees no draft rows or private settings. The allow-list query returns only that user's own row, which should be absent.
- Cannot create, edit, delete, publish, reorder, or feature projects; cannot change categories, gallery images, `site_content`, `site_settings`, or administrator membership.
- Can read/sign published images, but cannot list bucket objects or access draft-only images; upload, replacement, and deletion are denied.
- Cannot execute the admin-check function through the Data API because `private` is not exposed; direct database execution, if separately granted by an operator, returns only a boolean.

### Authorized administrator

- Can read published and draft rows and manage categories, projects, gallery images, `site_content`, `site_settings`, and administrator membership.
- Can list objects in `portfolio-images`, upload/replace/delete them under an existing project UUID path, and generate signed URLs for published or draft content.
- After publishing a project, anonymous access to its referenced images succeeds; after unpublishing it, new anonymous reads/signing fail. Previously issued signed URLs remain valid until their expiry.

## Phase 4 content migration

The public catalog source remains local. No Phase 4 database or Storage writes have been performed. Run the migration preflight from the repository root:

```powershell
node scripts/migrate-portfolio.mjs
```

The command is read-only by default. It verifies the expected 29 projects/63 image files and Focus's exact 34-image sequence locally, then prompts for an administrator email and password in the local terminal, signs in with `supabase.auth.signInWithPassword()`, and verifies the session user against `authorized_administrators`. Password input is hidden; access and refresh tokens are held in memory only (`persistSession: false`) and are never printed or written to disk. All Supabase database and Storage reads are then made with the verified authenticated session: every project (including drafts), every category, every gallery row, and a recursive inventory of the existing `portfolio-images` bucket. Existing matching candidate objects are downloaded read-only for byte-size and SHA-256 verification. The Supabase URL and publishable key come from `.env.local`; no migration token file is needed.

From Windows PowerShell, run the following from the repository root:

```powershell
Set-Location "C:\Users\admin\Documents\GitHub\Final-Portfolio-Landing-Page"
node .\scripts\migrate-portfolio.mjs
```

Enter the email for the already-authorized administrator account. At the password prompt, type the password and press Enter; the terminal shows no characters or asterisks while you type. Review the JSON summary. A complete read-only scan is identified by `fullAdminScan: "complete-authorized-read-only"`; `applyEligible` must be `true` and the conflict list empty before considering a later import. The report will state that no database or Storage writes were performed. If login, authorization, or any part of inventory fails, apply remains blocked. Do not paste passwords or tokens into chat or command arguments.

No import has been approved or run. The runner requires both the separate `--apply` argument and an additional exact terminal confirmation (`IMPORT 29 DRAFT PROJECTS`) before any write begins. Do not use `--apply` during preflight. The apply path inserts missing draft rows, uploads with `upsert: false`, hashes downloaded objects, and resumes only exact matches. A reserved integrity snapshot is added alongside original `source_metadata` to lock source hashes across interruptions; existing metadata fields remain intact. It never updates, deletes, overwrites, publishes, or switches the public catalog source. See `PORTFOLIO_MIGRATION_PLAN.md` for its conflict and verification rules.
