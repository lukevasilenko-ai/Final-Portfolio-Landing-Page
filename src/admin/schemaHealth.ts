/**
 * Detects which admin database migrations are present on the connected Supabase project,
 * so the panel can keep working (read-only where needed) and explain exactly what to run.
 */

export type AdminSchemaFeature = 'trash' | 'calculator' | 'websiteSections';

export type AdminSchemaHealth = Record<AdminSchemaFeature, boolean> & { checked: boolean };

export const ADMIN_SCHEMA_UNCHECKED: AdminSchemaHealth = { checked: false, trash: true, calculator: true, websiteSections: true };

/** Migrations each feature needs, in the order they must be run. */
export const ADMIN_SCHEMA_MIGRATIONS: { feature: AdminSchemaFeature; label: string; effect: string; files: string[] }[] = [
  {
    feature: 'trash',
    label: 'ნაგავი და პროექტების რიგითობა',
    effect: 'პროექტების ნაგავში გადატანა, აღდგენა და პორტფოლიოს თანმიმდევრობის შენახვა.',
    files: ['20261021150000_project_trash_and_atomic_order.sql'],
  },
  {
    feature: 'calculator',
    label: 'კალკულატორის მართვა',
    effect: 'ფასების კალკულატორისა და პაკეტების რედაქტირება, მონახაზები და გამოქვეყნება.',
    files: ['20261022103000_calculator_config_versions.sql'],
  },
  {
    feature: 'websiteSections',
    label: 'საიტის სექციები',
    effect: 'საიტის სექციების ბილდერის შენახვა, გამოქვეყნება და ისტორია.',
    files: ['20261022150000_website_layout_versions.sql', '20261023110000_native_website_elements.sql'],
  },
];

type PostgrestIssue = { code?: string | null } | null | undefined;

/** Postgres "undefined column". */
export const isMissingColumn = (issue: PostgrestIssue) => issue?.code === '42703';

/** PostgREST "table not in schema cache" or Postgres "undefined table". */
export const isMissingTable = (issue: PostgrestIssue) => issue?.code === 'PGRST205' || issue?.code === '42P01';

type ProbeResult = { error: PostgrestIssue };
type ProbeQuery = PromiseLike<ProbeResult>;

/** The small slice of the Supabase client the probes use (kept narrow so tests can fake it). */
export interface SchemaProbeClient {
  from(table: string): {
    select(columns: string): {
      limit(count: number): ProbeQuery;
    };
  };
}

export async function checkAdminSchema(client: SchemaProbeClient): Promise<AdminSchemaHealth> {
  // Plain one-row selects: count/HEAD requests carry no error body, so a missing table
  // would come back without its PGRST205 code and look healthy.
  const [trash, calculator, website] = await Promise.all([
    client.from('portfolio_projects').select('deleted_at').limit(1),
    client.from('calculator_config_versions').select('id').limit(1),
    client.from('website_layout_versions').select('id').limit(1),
  ]);

  return {
    checked: true,
    trash: !isMissingColumn(trash.error),
    calculator: !isMissingTable(calculator.error),
    websiteSections: !isMissingTable(website.error),
  };
}

export const missingAdminMigrations = (health: AdminSchemaHealth) =>
  health.checked ? ADMIN_SCHEMA_MIGRATIONS.filter((migration) => !health[migration.feature]) : [];

/** Link to the SQL editor of the connected project, derived from its API URL. */
export function supabaseSqlEditorUrl(apiUrl: string | undefined) {
  const ref = apiUrl?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i)?.[1];
  return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : null;
}
