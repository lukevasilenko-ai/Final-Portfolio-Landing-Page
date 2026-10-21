# Portfolio verification and publishing

## Safety state

- No project has been published by this work, and no database or Storage write was performed.
- `scripts/migrate-portfolio.mjs --publish` is a read-only verification and publishing-plan command. It verifies all 29 local project rows and their metadata, 63 image objects by byte size and SHA-256, Focus's exact 34-image order, the existing unpublished test draft, category assignments, and the expected current counts (30 projects, 3 active categories, 35 gallery rows).
- The report is ready only when the imported category totals are Product Posters 27, Branding & Identity 1, and Billboards & Print 1; all target projects are still unpublished; no unrelated projects are published; and every integrity check passes.
- `supabase/migrations/20261021120000_atomic_publish_migrated_portfolio.sql` prepares an invoker-security RPC. It checks the authorized admin, exactly 27 poster keys plus the Focus key and one billboard key, category/status/count constraints, 34 Focus gallery rows, and existence of all 63 referenced Storage objects. It updates all 29 rows in one transaction; a count mismatch raises an exception and rolls the statement back. The function is not installed in Supabase by this task.

## Read-only verification

Run in Windows PowerShell from the project root. Enter the authorized administrator email and hidden password when prompted:

```powershell
Set-Location "C:\Users\admin\Documents\GitHub\Final-Portfolio-Landing-Page"
node .\scripts\migrate-portfolio.mjs --publish
```

Review `publishPlan.ready`, `publishPlan.blockers`, the 29 `targetSourceKeys`, the image integrity summary, Focus gallery order, preserved test draft, and planned category counts. If the scan is incomplete or any blocker is listed, do not proceed.

## Local draft preview

Start a local-only Vite process with the preview flags set only in that PowerShell session:

```powershell
$env:VITE_PUBLIC_CATALOG_SOURCE = "supabase"
$env:VITE_CATALOG_PREVIEW_DRAFTS = "true"
$env:PORT = "4175"
npm run dev
```

Open `http://127.0.0.1:4175/admin`, sign in as an authorized administrator, then inspect `/portfolio`, `/portfolio/product-posters`, `/portfolio/branding/focus`, and `/portfolio/billboards-print`. Local preview includes published projects and source-keyed migration drafts, but excludes the manually created `source_key = NULL` test draft. Draft inclusion is guarded by `import.meta.env.DEV` and an explicit administrator allow-list check; production builds always filter to published projects. This does not change `.env.local`, deployment configuration, or the production site. Stop the process with Ctrl+C when finished.

## Publishing gate

Publishing requires explicit approval, applying the prepared SQL migration in the Supabase SQL Editor, a fresh clean read-only report, and then the following command:

```powershell
node .\scripts\migrate-portfolio.mjs --publish --apply
```

The command additionally requires typing `PUBLISH EXACTLY 29 MIGRATED PROJECTS`. The RPC update is scoped to the 29 source keys generated from the local inventory and is protected by the existing administrator RLS policy. Do not run this command before approval. This workflow does not publish the manually created `source_key = NULL` test draft or change the public catalog source configuration.
