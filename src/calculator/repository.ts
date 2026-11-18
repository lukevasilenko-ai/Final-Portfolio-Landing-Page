import { supabase } from '../lib/supabase';
import { DEFAULT_CALCULATOR_CONFIG, validateCalculatorConfig, type CalculatorConfig } from './model';

export type CalculatorVersionStatus = 'draft' | 'published' | 'archived';

export interface CalculatorVersion {
  id: string;
  version: number;
  status: CalculatorVersionStatus;
  config: CalculatorConfig;
  created_at: string;
  published_at: string | null;
  restored_from: string | null;
}

export interface PublishedCalculator {
  config: CalculatorConfig;
  version: number | null;
  warning?: string;
}

export const calculatorRemoteEnabled = import.meta.env.MODE === 'staging' || import.meta.env.PROD;

function getClient() {
  if (!calculatorRemoteEnabled) throw new Error('ლოკალურ უსაფრთხო რეჟიმში კალკულატორის ბაზასთან კავშირი გამორთულია. გამოიყენეთ staging რეჟიმი.');
  if (!supabase) throw new Error('Supabase staging კლიენტი კონფიგურირებული არ არის.');
  return supabase;
}

export async function loadPublishedCalculator(): Promise<PublishedCalculator> {
  if (!calculatorRemoteEnabled) {
    return { config: DEFAULT_CALCULATOR_CONFIG, version: null };
  }
  if (!supabase) return {
    config: DEFAULT_CALCULATOR_CONFIG,
    version: null,
    warning: 'Supabase-ის კონფიგურაცია მიუწვდომელია. ნაჩვენებია საწყისი ფასები.',
  };
  const { data, error } = await supabase
    .from('calculator_config_versions')
    .select('config, version')
    .eq('status', 'published')
    .maybeSingle();

  if (error) {
    return {
      config: DEFAULT_CALCULATOR_CONFIG,
      version: null,
      warning: 'გამოქვეყნებული კალკულატორის კონფიგურაცია ვერ ჩაიტვირთა. ნაჩვენებია საწყისი ფასები.',
    };
  }
  if (!data) return { config: DEFAULT_CALCULATOR_CONFIG, version: null };
  if (!validateCalculatorConfig(data.config)) {
    return {
      config: DEFAULT_CALCULATOR_CONFIG,
      version: null,
      warning: 'გამოქვეყნებული კალკულატორის კონფიგურაცია არავალიდურია. ნაჩვენებია საწყისი ფასები.',
    };
  }
  return { config: data.config, version: Number(data.version) };
}

export async function listCalculatorVersions(): Promise<CalculatorVersion[]> {
  const client = getClient();
  const { data, error } = await client
    .from('calculator_config_versions')
    .select('id, version, status, config, created_at, published_at, restored_from')
    .order('version', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? [])
    .filter((item) => validateCalculatorConfig(item.config))
    .map((item) => ({ ...item, version: Number(item.version) })) as CalculatorVersion[];
}

export async function saveCalculatorDraft(config: CalculatorConfig): Promise<{ id: string; version: number }> {
  if (!validateCalculatorConfig(config)) throw new Error('კონფიგურაციაში შესასწორებელი ველებია.');
  const { data, error } = await getClient().rpc('save_calculator_draft', { p_config: config });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result.id !== 'string') throw new Error('მონახაზის შენახვაზე პასუხი არასწორია.');
  return { id: result.id, version: Number(result.version) };
}

export async function publishCalculatorDraft(versionId: string): Promise<void> {
  const { error } = await getClient().rpc('publish_calculator_config', { p_version_id: versionId });
  if (error) throw error;
}

export async function restoreCalculatorVersion(versionId: string): Promise<void> {
  const { error } = await getClient().rpc('restore_calculator_config', { p_version_id: versionId });
  if (error) throw error;
}
