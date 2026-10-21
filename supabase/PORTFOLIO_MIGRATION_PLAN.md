# Portfolio migration and public-catalog cutover

## Safety state

- The public catalog remains on its existing Vite-local source until migration verification is complete.
- `scripts/migrate-portfolio.mjs` defaults to read-only preflight mode. It inventories local bytes/hashes, prompts for terminal-only Supabase Auth login, verifies the account against `authorized_administrators`, then scans all database rows and all objects in the `portfolio-images` bucket. It never writes rows or uploads/deletes Storage objects unless invoked with `--apply` and the separate exact confirmation phrase.
- The public publishable key cannot see drafts under RLS. Run `portfolio-migration-inventory.sql` in Supabase SQL Editor as an authorized operator to inventory all projects, including the existing draft. Do not update or delete that draft.
- Keep the original local assets. Migration uses stable source keys and deterministic UUIDv5 project/image IDs. It stops on any source-key, slug, UUID, gallery-path, or Storage-object conflict; it never overwrites a row/object based only on title.
- The existing test draft (`source_key = NULL`, unpublished) is never a migration target. The authorized full scan must check its slug and preserve its row and any related objects unchanged.

## Source mapping

- Each of the 27 Product Posters and the one Billboards & Print asset becomes one `portfolio_projects` row with `presentation_type = 'image'`, a local-compatible `source_key`, and its original category-relative display order.
- Focus becomes one `portfolio_projects` row with `presentation_type = 'project'`, `source_key = 'behance-246573009-cover'`, local title/slug/description/tags/tools/date/author/location, and the local cover.
- Focus gallery files `01.webp` through `34.webp` become 34 `portfolio_gallery_images` rows with zero-based orders 0 through 33. The cover is not duplicated in the gallery.
- Local file bytes are not re-encoded. The dry-run records byte sizes and SHA-256 hashes, and the inserted row retains a reserved integrity snapshot alongside (not instead of) source metadata. This locks the expected asset inventory across interrupted runs so changed local files cannot be silently substituted on resume.
- Storage paths must be `<new-project-uuid>/<filename>`. Do not move, rewrite, or remove local files.
- Existing project rows (especially drafts) are not migration targets. Check `source_key` and slug conflicts before any later import; resolve conflicts manually with the administrator before proceeding.

## Baseline dry-run (2026-10-21)

- Local source: 29 cards and 63 image files total. Product Posters: 27 cards / 27 images; Branding & Identity: 1 Focus card / 1 cover + 34 gallery images; Billboards & Print: 1 card / 1 image.
- Focus gallery order was verified as `01.webp` through `34.webp`. The inventory records each file's exact byte length and SHA-256 hash; no source image was rewritten.
- Publishable-key read-only API: 3 visible categories, 0 published project rows, and 0 visible gallery rows. This does not establish that there are no drafts: RLS hides drafts from this client. The existing draft was not read, changed, or deleted.
- Local duplicate source keys/slugs and collisions against public-visible remote source keys/slugs: none. The publishable-key API cannot establish whether the unpublished test draft's slug collides; full conflict status remains pending the authorized-user scan.
- The full JSON report was written outside the repository at `%TEMP%\portfolio-migration-dry-run-20261021.json`.

## Dry run

From the repository root:

```powershell
node scripts/migrate-portfolio.mjs
```

The migration runner launches `portfolio-migration-dry-run.mjs --json --local-only`, validates the expected 29-card/63-file baseline and exact Focus sequence, and checks local duplicate IDs/slugs without making an anonymous Supabase request. It then signs in interactively and uses only the verified administrator session for database and Storage reads. It performs no database or Storage writes by default. The lower-level inventory is also available with `node scripts/portfolio-migration-dry-run.mjs` (or `--local-only` to skip its optional public-scope read).

The Supabase URL and publishable key are read from the existing `.env.local`; no extra token file is required. Run the command directly in an interactive Windows PowerShell terminal:

```powershell
Set-Location "C:\Users\admin\Documents\GitHub\Final-Portfolio-Landing-Page"
node .\scripts\migrate-portfolio.mjs
```

Enter the authorized administrator email, then enter the password at the hidden terminal prompt (no characters or asterisks appear). The runner calls `supabase.auth.signInWithPassword()`, disables session persistence and automatic refresh, and keeps the returned session only in memory. It never prints credentials, tokens, or Authorization headers. The runner verifies the Auth user in `authorized_administrators` before using that session for full read-only reads of all categories, projects (including drafts), gallery rows, and the private bucket inventory. It downloads pre-existing objects at expected migration paths for exact size/SHA-256 comparison. A missing login, failed allow-list check, incomplete scan, or any conflict blocks apply mode.

## Apply and resume gate

This phase runs only the default preflight. No `--apply` command has been run. After reviewing the complete admin preflight and explicitly approving the import, the operator may run:

```powershell
node scripts/migrate-portfolio.mjs --apply
```

Before any mutation, the apply path repeats the interactive login and full RLS-authorized scan, verifies all three active category slugs, every project `source_key`/slug/UUID, gallery source key/path, and every pre-existing object in the bucket. It refuses to proceed when the administrator login/authorization fails, inventory is incomplete, local files differ from the recorded hashes, or any conflict exists. It then requires the exact terminal phrase `IMPORT 29 DRAFT PROJECTS` as a second confirmation.

The apply path inserts only missing project rows (always `is_published = false`), uploads with `upsert: false`, verifies object bytes and SHA-256 by downloading them, and inserts only missing gallery rows. Matching rows/objects created by a prior interrupted run are verified and skipped. A mismatch stops the run; there is no update, overwrite, delete, rollback, or publish path. A failure may leave completed draft rows/objects in place; rerun after review to resume safely. The script preserves all existing rows, including the test draft, and never changes local assets.

After an approved import, independently verify all 29 source keys, 63 Storage objects, 29 imported drafts, unchanged pre-existing rows, Focus's cover and gallery orders 0-33, and each file's byte size/SHA-256. Do not publish or switch the public source as part of this migration run. Public catalog cutover remains a separately approved step; keep the website on local source until verification is complete.

## Runtime cutover

The public loader will remain opt-in through `VITE_PUBLIC_CATALOG_SOURCE=supabase`; the default is `local`. The current local catalog therefore stays unchanged. After migration verification and explicit approval, set this environment variable in the hosting environment and perform one deployment for the code/config cutover. Thereafter project edits, category assignments, publishing, and unpublishing are fetched at runtime and need no additional build or deploy. If the enabled Supabase source fails, the catalog displays an error state instead of silently falling back to stale local content.
