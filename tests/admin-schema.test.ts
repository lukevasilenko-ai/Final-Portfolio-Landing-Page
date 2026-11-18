import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkAdminSchema,
  isMissingColumn,
  isMissingTable,
  missingAdminMigrations,
  supabaseSqlEditorUrl,
  type SchemaProbeClient,
} from '../src/admin/schemaHealth';

function fakeClient(errors: Record<string, { code: string } | null>): SchemaProbeClient {
  return {
    from: (table: string) => ({
      select: () => ({
        limit: () => Promise.resolve({ error: errors[table] ?? null }),
      }),
    }),
  };
}

test('error code helpers recognise missing columns and tables', () => {
  assert.equal(isMissingColumn({ code: '42703' }), true);
  assert.equal(isMissingColumn({ code: '42501' }), false);
  assert.equal(isMissingTable({ code: 'PGRST205' }), true);
  assert.equal(isMissingTable({ code: '42P01' }), true);
  assert.equal(isMissingTable(null), false);
});

test('a database without the admin migrations reports every feature and lists files in run order', async () => {
  const health = await checkAdminSchema(fakeClient({
    portfolio_projects: { code: '42703' },
    calculator_config_versions: { code: 'PGRST205' },
    website_layout_versions: { code: 'PGRST205' },
  }));
  assert.deepEqual(health, { checked: true, trash: false, calculator: false, websiteSections: false });
  assert.deepEqual(
    missingAdminMigrations(health).flatMap((migration) => migration.files),
    [
      '20261021150000_project_trash_and_atomic_order.sql',
      '20261022103000_calculator_config_versions.sql',
      '20261022150000_website_layout_versions.sql',
      '20261023110000_native_website_elements.sql',
    ],
  );
});

test('a fully migrated database reports nothing missing; permission errors are not treated as missing schema', async () => {
  const health = await checkAdminSchema(fakeClient({ calculator_config_versions: { code: '42501' } }));
  assert.deepEqual(health, { checked: true, trash: true, calculator: true, websiteSections: true });
  assert.deepEqual(missingAdminMigrations(health), []);
});

test('the SQL editor link is derived from the project API URL', () => {
  assert.equal(supabaseSqlEditorUrl('https://abcdef123.supabase.co'), 'https://supabase.com/dashboard/project/abcdef123/sql/new');
  assert.equal(supabaseSqlEditorUrl('https://example.com'), null);
  assert.equal(supabaseSqlEditorUrl(undefined), null);
});
