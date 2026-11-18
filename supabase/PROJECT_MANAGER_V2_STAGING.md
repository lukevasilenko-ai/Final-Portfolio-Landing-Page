# Project Manager V2 staging guide

## Status and scope

The three checked-in migrations have been applied to the separate `luka-imagines-staging` project. Production has not been changed by this staging setup. The final migration adds nullable Trash metadata, narrows anonymous project/gallery/image reads for trashed projects, and adds admin-authorized atomic restore/reorder RPCs.

The browser implementation expects these migrations before it can load the new `deleted_at` fields or call the V2 RPCs. Keep Production untouched during testing.

## Create an isolated staging project

1. Create a separate Supabase project intended only for staging. Do not point the V2 local app at the Production URL or key.
2. In that staging project's SQL Editor, apply the checked-in migrations in order: `20261021090000_portfolio_admin_schema.sql`, `20261021120000_atomic_publish_migrated_portfolio.sql`, then `20261021150000_project_trash_and_atomic_order.sql`.
3. Create a staging Auth user, then add only that user's UUID to `public.authorized_administrators` in the staging project. Do not reuse Production credentials if a separate staging account is available.
4. Create test-only projects and images in staging. Do not import or copy the 29 Production projects for this smoke test.

The authorization check can be verified in the staging SQL Editor:

```sql
select
  to_regprocedure('public.reorder_portfolio_projects(uuid,uuid[])') is not null as reorder_rpc_exists,
  to_regprocedure('public.restore_trashed_portfolio_project(uuid)') is not null as restore_rpc_exists,
  exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.portfolio_projects'::regclass
      and attname = 'deleted_at'
      and not attisdropped
  ) as trash_column_exists,
  has_function_privilege('anon', 'public.reorder_portfolio_projects(uuid,uuid[])', 'EXECUTE') as anon_can_reorder,
  has_function_privilege('authenticated', 'public.reorder_portfolio_projects(uuid,uuid[])', 'EXECUTE') as authenticated_can_call_guarded_rpc,
  has_function_privilege('anon', 'public.restore_trashed_portfolio_project(uuid)', 'EXECUTE') as anon_can_restore;
```

Expected: both RPCs and the Trash column exist; `anon_can_reorder` and `anon_can_restore` are false. `authenticated_can_call_guarded_rpc` is true because the function performs its own `private.is_authorized_admin()` check and rejects non-admin users.

## Configure and run the app against staging

The repository contains an ignored `.env.staging.local` file. Add the staging publishable key to `VITE_SUPABASE_PUBLISHABLE_KEY` in that file; never use a secret or `service_role` key. Do not edit `.env.local`. The `dev:staging` command loads Vite's `staging` mode, clears inherited PowerShell overrides for the Supabase URL, key, and catalog source, then validates the staging values before starting. It refuses startup unless the URL is the approved staging URL and the key is a publishable key. The staging server is fixed to `127.0.0.1:4175`.

```powershell
npm run dev:staging
```

Open `http://127.0.0.1:4175/admin` and sign in with the staging administrator. Confirm the staging URL in the Supabase dashboard before making any test changes. Do not use the existing `4174` tab if it is connected to Production.

## Staging test checklist

Use disposable projects only:

1. Create two published image projects in one category and one unpublished draft. Confirm the public category count includes only the two published projects; the draft is hidden.
2. In the organizer, drag a published project. Confirm adjacent cards animate into the proposed order. Use Undo and confirm the previous local order returns. Drag again, use Cancel, reload, and verify the database/public order did not change.
3. Drag to a different order and click **განლაგების შენახვა** once. Reload the organizer and public category page; confirm the saved order remains exact.
4. Try an invalid/stale project ID in the staging RPC request as an authorized staging session. It must return an error and leave every order unchanged. An anonymous or authenticated non-admin session must not be able to reorder or restore.
5. Unpublish a disposable project and confirm it disappears publicly and the category count decreases. Publish it again and confirm it returns.
6. Move a published project to Trash. Confirm it disappears publicly, counts decrease, and its referenced Storage file remains in the bucket. Restore it and confirm it returns to its saved position. Repeat with a draft and confirm restoring it does not publish it.
7. Only in staging, permanently delete a disposable trashed project after the second Georgian confirmation. Confirm the project and its gallery rows are removed, while Storage objects remain untouched. Do not use a real portfolio project for this test.
8. Compare organizer and public pages at the same viewport width. They share the public `PortfolioCard` and grid classes; confirm the column count, gaps, card ratio, and wide-card spans line up.

## Production boundary

This repository change does not contact Supabase or execute migrations. After staging checks pass, review the migration and test report, then separately approve any Production migration. The new code must not be deployed against Production until its migration has been reviewed and applied there with explicit approval.
