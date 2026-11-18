# Calculator Management: staging setup

The calculator editor and public runtime loader are implemented locally. The SQL migration has **not** been executed against any Supabase project.

## Apply the migration to staging

Use only the separate `luka-imagines-staging` Supabase project. Its earlier schema and Project Manager V2 migrations should already be applied. In the staging project's SQL Editor, open and run the complete contents of:

`supabase/migrations/20261022103000_calculator_config_versions.sql`

Do not run this file against Production. It adds the version table and authorization-checked RPC functions; it does not seed, publish, or alter portfolio projects, storage objects, or existing calculator content.

## Test locally

1. Keep the Production `.env.local` unchanged. Confirm `.env.staging.local` contains the staging URL and its publishable key.
2. From the project root, run `npm run dev:staging`.
3. Open `http://127.0.0.1:4175/admin` and sign in with the staging administrator.
4. Open **კალკულატორი**. When the migration is in place, the editor should load the current published config or the existing default values if no version has been created yet.
5. Change a price, check the live preview, and click **მონახაზის შენახვა**. Refresh the panel and confirm the draft is still available while the public calculator remains unchanged.
6. Publish from the admin panel, then refresh the public homepage served by the staging app and verify the new published version.
7. Restore an archived published version from **ვერსიების ისტორია** and confirm the runtime returns to that configuration.
8. As an anonymous visitor, confirm only the current published row is readable. As a signed-in non-admin, confirm the same and confirm all three RPC calls fail. As the authorized staging admin, confirm history read, draft save, publish, and restore work.
9. After testing, keep Production deployment and migration separate until the staging checks pass and a further release is approved.

## Safety model

Direct table grants allow `SELECT` only. RLS exposes the active published row publicly and all versions only to authorized admins. Draft writes, publication, and restoration run through PostgreSQL functions that check `private.is_authorized_admin()` and validate the structured configuration. No arbitrary formula code is stored or evaluated.
