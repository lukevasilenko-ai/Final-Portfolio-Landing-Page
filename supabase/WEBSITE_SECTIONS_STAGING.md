# Website Sections Manager: staging guide

## Status

The Website Sections Manager code and migration are prepared, but this work has not executed SQL, uploaded assets, saved a layout, or changed Supabase data. The migration is only for a disposable/staging project. Production is out of scope.

It creates two versioned configuration tables, a private `website-layout-assets` bucket, administrator-guarded draft/publish/restore RPCs, and read policies that expose only the current published layout and its referenced images. It does not alter portfolio projects, categories, calculator records, or administrator membership. The application has a validated built-in homepage fallback when no layout has been published.

## Migration order

For a completely empty Supabase project, apply these files in this exact order:

1. `migrations/20261021090000_portfolio_admin_schema.sql`
2. `migrations/20261021120000_atomic_publish_migrated_portfolio.sql`
3. `migrations/20261021150000_project_trash_and_atomic_order.sql`
4. `migrations/20261022103000_calculator_config_versions.sql`
5. `migrations/20261022150000_website_layout_versions.sql`
6. `migrations/20261023110000_native_website_elements.sql`

The separate staging project was reported to have migrations 1–5 applied. Migration 6 extends the existing structured validator for native-element visibility and slot insertions; it does not create tables or alter rows. Apply it only after confirming migration 5 is present. The earlier calculator/layout check below is only useful before migration 4/5; it is not a prerequisite for migration 6.

To confirm migration 5's objects exist, run this read-only query in the **staging** SQL Editor:

```sql
select
  to_regclass('public.website_layout_versions') is not null as website_layout_table_present,
  to_regprocedure('private.website_layout_elements_valid(jsonb,integer)') is not null as layout_validator_present,
  to_regprocedure('private.is_valid_website_layout(jsonb)') is not null as layout_config_validator_present;
```

If any result is false, stop and reconcile staging migration history before applying migration 6. Do not re-run migrations 1–5. The native-element migration should be applied once only.

## Apply in Supabase SQL Editor

1. Open the `luka-imagines-staging` project in Supabase. Verify the project name and reference `xkdmtkckxwcsrxnokcah` in the dashboard before opening SQL Editor. Do not use the Production project.
2. In the repository, open the exact migration file identified above and copy its entire contents.
3. In the staging project's **SQL Editor**, create a new query, paste the file contents, and review the project selector once more.
4. Click **Run** once. Wait for the success result. Do not run it again if the editor reports an error; keep the error and inspect it before retrying.
5. Re-run the read-only check above. `website_sections_migration_present` should now be true.

Migrations have not been executed by Codex. Migration 5 must be present before migration 6; both are staging-only until separately approved. Without migration 5, the editor uses local fallback content and disables database writes. Without migration 6, the native element controls can preview locally but the database validator rejects their saved structure.

## Local staging preview

Start the already isolated staging server from the repository root:

```powershell
npm run dev:staging
```

Open only `http://127.0.0.1:4175/admin`. The server is configured to bind to loopback and has a fail-closed URL guard for the staging Supabase project. Never use the 4174 session for this work. Do not paste keys into commands, chat, logs, or screenshots.

After signing in with the staging administrator, open **საიტის სექციები**. The editor's iframe uses the actual public React components and local draft state; edits in the editor remain local until an explicit action. The editor can load read-only public/catalog data for preview, but do not use real Production credentials or test against Production.

## Staging verification checklist

Use only disposable content and images in staging.

1. Confirm the default homepage renders with all eight native sections and no text/layout change before saving anything.
2. Change the Hero heading, one About statistic, a skill label/level, and a Contact email/WhatsApp number. Confirm the real-component preview reflects them; confirm malformed email, non-digit phone, out-of-range skill percentage, and invalid statistic value block draft save/publish.
3. Hide Hero. Confirm it and its space disappear, the brand link points to the first visible section, and no visible header link targets a hidden section. Restore Hero and verify it returns.
4. Add a disposable template; edit and reorder its heading, paragraph, image, button and nested card/group blocks. Exercise hide, duplicate, move, delete, Undo, Cancel, and unsaved-change warnings. Verify only supported blocks are available; arbitrary HTML, CSS, or script is not accepted.
5. Choose a desktop-only or mobile-only template and confirm its navigation toggle is disabled/off. Switch the preview between desktop, tablet, and mobile and check for overflow.
6. Save a draft, reload the editor, and confirm the draft returns while the public staging page remains unchanged.
7. Publish only after reviewing the draft. Confirm the staging homepage updates without a build/redeploy. Hide/reorder a disposable template and verify anchors/navigation and mobile layout.
8. Upload a disposable image. Confirm its signed preview works, that an unpublished image is not anonymously readable, and that publishing exposes only the referenced published image. Do not delete Storage objects during testing.
9. Restore an archived published version and confirm it becomes a new published version; confirm prior history remains available.
10. Sign out and verify drafts/history are inaccessible to anonymous users. Use a separate authenticated non-admin staging account if one exists and verify it cannot call draft/publish/restore operations.
11. Repeat checks at desktop, tablet and mobile widths; use keyboard-only navigation for the template dialog, editor controls and section order buttons; enable `prefers-reduced-motion` and confirm builder animation is reduced.

12. In **პორტფოლიო**, expand **SELECTED WORK წარწერა**. Hide it and confirm only the eyebrow disappears; the main heading, description, featured project and category cards stay visible. Add a replacement eyebrow with placement **ჩანაცვლება**, edit its text and check the live preview. Undo, cancel, save a draft, refresh, and confirm the draft returns. Publish only after reviewing staging, then restore the prior published layout if needed.

Do not publish any production layout or run this migration against Production until staging verification and a separate explicit approval are complete.
