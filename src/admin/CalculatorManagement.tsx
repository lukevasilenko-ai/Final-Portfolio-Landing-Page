import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Eye,
  LoaderCircle,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import PriceCalculator from '../components/PriceCalculator';
import {
  cloneCalculatorConfig,
  DEFAULT_CALCULATOR_CONFIG,
  validateCalculatorConfig,
  type CalculatorConfig,
  type CalculatorControlGroup,
  type CalculatorDiscount,
  type CalculatorExtra,
  type CalculatorGroup,
  type CalculatorPackage,
  type CalculatorService,
  type Pricing,
} from '../calculator/model';
import {
  calculatorRemoteEnabled,
  listCalculatorVersions,
  publishCalculatorDraft,
  restoreCalculatorVersion,
  saveCalculatorDraft,
  type CalculatorVersion,
} from '../calculator/repository';
import { adminConfirm } from './feedback';
import './calculator-admin.css';

type EditorTab = 'services' | 'pricing' | 'packages' | 'appearance' | 'history';
type ActionState = '' | 'saving' | 'publishing' | 'restoring';
const controlGroupLabels: Record<CalculatorControlGroup, string> = {
  quantity: 'რაოდენობის ველი',
  changes: 'ცვლილებების ველი',
  options: 'სასწრაფო ვადა და დამატებითი ოფციები',
};

// "pricing" duplicated the per-service editor, so it is no longer a tab; its one global rule
// (rounding) lives under the texts tab's extra settings.
const editorTabs: { id: EditorTab; label: string }[] = [
  { id: 'services', label: 'სერვისები და ფასები' },
  { id: 'packages', label: 'პაკეტები' },
  { id: 'appearance', label: 'ტექსტები' },
  { id: 'history', label: 'ისტორია' },
];

const copyFields: { key: keyof CalculatorConfig['copy']; label: string; multiline?: boolean }[] = [
  { key: 'eyebrow', label: 'სექციის მცირე სათაური' },
  { key: 'title', label: 'მთავარი სათაური' },
  { key: 'description', label: 'აღწერა', multiline: true },
  { key: 'groupsLabel', label: 'კატეგორიების ხელმისაწვდომობის სათაური' },
  { key: 'estimateEyebrow', label: 'შეფასების მცირე სათაური' },
  { key: 'estimateLabel', label: 'შეფასების სათაური' },
  { key: 'templateEstimateDescription', label: 'შაბლონური პოსტერის შეფასების აღწერა', multiline: true },
  { key: 'estimateDescription', label: 'სხვა სერვისების შეფასების აღწერა', multiline: true },
  { key: 'categoryLabel', label: 'კატეგორიის ველის დასახელება' },
  { key: 'designCategory', label: 'სარეზერვო კატეგორიის დასახელება' },
  { key: 'serviceLabel', label: 'სერვისის ველის დასახელება' },
  { key: 'quantityLabel', label: 'რაოდენობის ველის დასახელება' },
  { key: 'changesLabel', label: 'ცვლილებების ველის დასახელება' },
  { key: 'oneChangeLabel', label: 'ერთი ცვლილების დასახელება' },
  { key: 'rushLabel', label: 'სასწრაფო ვადის დასახელება' },
  { key: 'extraSizesLabel', label: 'დამატებითი ზომების დასახელება' },
  { key: 'templateInfo', label: 'შაბლონური პოსტერის განმარტება', multiline: true },
  { key: 'resultButton', label: 'შედეგის ღილაკის ტექსტი' },
  { key: 'packagesEyebrow', label: 'პაკეტების მცირე სათაური' },
  { key: 'packagesTitle', label: 'პაკეტების სათაური' },
  { key: 'packagesDescription', label: 'პაკეტების აღწერა', multiline: true },
  { key: 'packageFeaturesLabel', label: 'პაკეტის შემადგენლობის სათაური' },
  { key: 'popularLabel', label: 'მოთხოვნადი პაკეტის ნიშანი' },
  { key: 'packageButton', label: 'პაკეტის ღილაკის ტექსტი' },
  { key: 'monthlyLabel', label: 'პაკეტის პერიოდის ტექსტი' },
];

function makeId(prefix: string) {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${suffix}`;
}

function formatKaDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('ka-GE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'თარიღი უცნობია';
}

function errorMessage(error: unknown) {
  const issue = error as { code?: string; message?: string };
  if (issue?.code === '42501') return 'წვდომა არ გაქვთ. გადაამოწმეთ ადმინისტრატორის ავტორიზაცია.';
  if (issue?.code === '42P01' || issue?.code === 'PGRST205') return 'კალკულატორის SQL migration ჯერ არ არის გამოყენებული ამ Supabase პროექტზე.';
  if (issue?.code === '22023') return 'კონფიგურაცია ვერ გაიარა სერვერის ვალიდაციას. გადაამოწმეთ ფასები, წესები და სავალდებულო ველები.';
  if (issue instanceof Error && issue.message.startsWith('ლოკალურ უსაფრთხო რეჟიმში')) return issue.message;
  if (issue instanceof Error && issue.message.startsWith('Supabase staging')) return issue.message;
  if (issue?.message?.toLowerCase().includes('fetch')) return 'სერვერთან კავშირი ვერ მოხერხდა. შეამოწმეთ ინტერნეტი და სცადეთ თავიდან.';
  return 'მოქმედება ვერ შესრულდა. გადაამოწმეთ staging-ის წვდომა და სცადეთ თავიდან.';
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`calc-admin-field ${className}`}><span>{label}</span>{children}</label>;
}

function TextInput({ label, value, onChange, multiline = false, maxLength = 1000, className = '' }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  maxLength?: number;
  className?: string;
}) {
  return (
    <Field label={label} className={className}>
      {multiline
        ? <textarea value={value} maxLength={maxLength} rows={3} onChange={(event) => onChange(event.target.value)} />
        : <input value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />}
    </Field>
  );
}

function NumberInput({ label, value, onChange, min = 0, max = 100000, step = 1, className = '' }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  return (
    <Field label={label} className={className}>
      <input type="number" min={min} max={max} step={step} value={Number.isFinite(value) ? value : ''}
        onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))} />
    </Field>
  );
}

function SelectInput({ label, value, options, onChange, className = '' }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Field label={label} className={className}>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </Field>
  );
}

function Toggle({ label, checked, onChange, description }: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  description?: string;
}) {
  return (
    <label className="calc-admin-toggle">
      <span><strong>{label}</strong>{description && <small>{description}</small>}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="calc-admin-toggle-track" aria-hidden="true" />
    </label>
  );
}

function Panel({ title, description, children, actions }: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="calc-admin-panel">
      <div className="calc-admin-panel-heading">
        <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function ServicePricingEditor({
  service,
  copy,
  onUpdate,
  onUpdateExtra,
  onUpsertDiscount,
  onMoveControl,
}: {
  service: CalculatorService;
  copy: CalculatorConfig['copy'];
  onUpdate: (patch: Partial<CalculatorService>) => void;
  onUpdateExtra: (extraId: string, patch: Partial<CalculatorExtra>) => void;
  onUpsertDiscount: (index: number, patch: Partial<CalculatorDiscount>) => void;
  onMoveControl: (index: number, direction: -1 | 1) => void;
}) {
  const quantityEnabled = service.quantity.enabled;
  return (
    <div className="calculator-admin-pricing-editor">
      <section className="calculator-admin-pricing-basics">
        <div className="calculator-admin-price-type">
          <SelectInput label="ფასის ტიპი" value={service.pricing.type} options={[
            { value: 'range', label: 'ფასის დიაპაზონი' },
            { value: 'fixed', label: 'ფიქსირებული ფასი' },
            { value: 'per_item', label: 'ფასი თითო ერთეულზე' },
          ]} onChange={(type) => {
            const pricing: Pricing = type === 'range' ? { type, min: 0, max: 0 } : { type: type as 'fixed' | 'per_item', amount: 0 };
            onUpdate({
              pricing,
              ...(type === 'fixed' ? { quantity: { ...service.quantity, enabled: false, min: 1, max: 1 } } : {}),
            });
          }} />
          {service.pricing.type === 'range' ? <>
            <NumberInput label="მინიმალური ფასი (₾)" value={service.pricing.min} step={0.5}
              onChange={(min) => onUpdate({ pricing: { type: 'range', min, max: service.pricing.type === 'range' ? service.pricing.max : min } })} />
            <NumberInput label="მაქსიმალური ფასი (₾)" value={service.pricing.max} step={0.5}
              onChange={(max) => onUpdate({ pricing: { type: 'range', min: service.pricing.type === 'range' ? service.pricing.min : 0, max } })} />
          </> : <NumberInput label={service.pricing.type === 'fixed' ? 'ფიქსირებული ფასი (₾)' : 'ფასი თითო ერთეულზე (₾)'}
            value={service.pricing.amount} step={0.5} onChange={(amount) => onUpdate({ pricing: { type: service.pricing.type as 'fixed' | 'per_item', amount } })} />}
        </div>
        <div className="calculator-admin-quantity-settings">
          <Toggle label="რაოდენობის არჩევა" checked={quantityEnabled} onChange={(enabled) => onUpdate({
            quantity: { ...service.quantity, enabled, min: enabled ? Math.max(1, service.quantity.min) : 1, max: enabled ? Math.max(service.quantity.max, service.quantity.min) : 1 },
            ...(enabled && service.pricing.type === 'fixed' ? { pricing: { type: 'per_item' as const, amount: service.pricing.amount } } : {}),
          })} />
          {quantityEnabled && <div className="calculator-admin-fields">
            <TextInput label="რაოდენობის ველის დასახელება" value={service.quantity.label}
              onChange={(label) => onUpdate({ quantity: { ...service.quantity, label } })} />
            <NumberInput label="მინიმალური რაოდენობა" min={1} max={1000} value={service.quantity.min}
              onChange={(min) => onUpdate({ quantity: { ...service.quantity, min } })} />
            <NumberInput label="მაქსიმალური რაოდენობა" min={1} max={1000} value={service.quantity.max}
              onChange={(max) => onUpdate({ quantity: { ...service.quantity, max } })} />
          </div>}
        </div>
      </section>

      <details className="calc-admin-advanced">
        <summary>დამატებითი წესები და პარამეტრები</summary>
        <div className="calculator-admin-advanced-content">
          <section className="calculator-admin-advanced-section">
            <h3>ცვლილებები</h3>
            <Toggle label="ცვლილებების რაოდენობის არჩევა" checked={Boolean(service.changes?.enabled)} onChange={(enabled) => onUpdate({
              changes: { enabled, min: service.changes?.min ?? 0, max: service.changes?.max ?? 20, amountPerChange: service.changes?.amountPerChange ?? 20, label: service.changes?.label ?? copy.changesLabel },
            })} />
            {service.changes?.enabled && <div className="calculator-admin-fields">
              <TextInput label="ველის დასახელება" value={service.changes.label} onChange={(label) => onUpdate({ changes: { ...service.changes!, label } })} />
              <NumberInput label="მინიმუმი" min={0} max={1000} value={service.changes.min} onChange={(min) => onUpdate({ changes: { ...service.changes!, min } })} />
              <NumberInput label="მაქსიმუმი" min={0} max={1000} value={service.changes.max} onChange={(max) => onUpdate({ changes: { ...service.changes!, max } })} />
              <NumberInput label="ფასი თითო ცვლილებაზე (₾)" value={service.changes.amountPerChange} step={0.5} onChange={(amountPerChange) => onUpdate({ changes: { ...service.changes!, amountPerChange } })} />
            </div>}
          </section>

          <section className="calculator-admin-advanced-section">
            <h3>ველების რიგი</h3>
            <ol className="calculator-admin-order-list">
              {service.controlsOrder.map((control, index) => <li key={control}>
                <span>{controlGroupLabels[control]}</span>
                <div>
                  <button className="admin-icon-button" type="button" aria-label={`${controlGroupLabels[control]} ზემოთ აწევა`} title="ზემოთ აწევა"
                    disabled={index === 0} onClick={() => onMoveControl(index, -1)}><ChevronUp /></button>
                  <button className="admin-icon-button" type="button" aria-label={`${controlGroupLabels[control]} ქვემოთ ჩამოწევა`} title="ქვემოთ ჩამოწევა"
                    disabled={index === service.controlsOrder.length - 1} onClick={() => onMoveControl(index, 1)}><ChevronDown /></button>
                </div>
              </li>)}
            </ol>
          </section>

          <section className="calculator-admin-advanced-section">
            <div className="calculator-admin-inline-heading"><h3>სასწრაფო ვადა</h3>
              <Toggle label="ჩართულია" checked={service.rush.enabled} onChange={(enabled) => onUpdate({ rush: { ...service.rush, enabled } })} />
            </div>
            {service.rush.enabled && <div className="calculator-admin-fields">
              <TextInput label="ღილაკის ტექსტი" value={service.rush.label} onChange={(label) => onUpdate({ rush: { ...service.rush, label } })} />
              <NumberInput label="ფასის ზრდა (%)" min={0} max={500} step={0.5} value={service.rush.percent}
                onChange={(percent) => onUpdate({ rush: { ...service.rush, percent } })} />
            </div>}
          </section>

          <section className="calculator-admin-advanced-section">
            <div className="calculator-admin-inline-heading"><h3>რაოდენობის ფასდაკლებები</h3>
              <button className="admin-button" type="button" disabled={service.discounts.length >= 20}
                onClick={() => onUpdate({ discounts: [...service.discounts, { minimumQuantity: (service.discounts.at(-1)?.minimumQuantity ?? 0) + 1, percent: 0 }] })}>
                <Plus />ზღვრის დამატება
              </button>
            </div>
            {service.discounts.map((discount, index) => <div className="calculator-admin-rule-row" key={`${discount.minimumQuantity}-${index}`}>
              <NumberInput label="მინ. რაოდენობა" min={1} max={1000} value={discount.minimumQuantity} onChange={(minimumQuantity) => onUpsertDiscount(index, { minimumQuantity })} />
              <NumberInput label="ფასდაკლება (%)" min={0} max={100} step={0.5} value={discount.percent} onChange={(percent) => onUpsertDiscount(index, { percent })} />
              <button className="admin-icon-button is-danger" type="button" aria-label="ფასდაკლების წესის წაშლა"
                onClick={() => onUpdate({ discounts: service.discounts.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 /></button>
            </div>)}
            {service.discounts.length === 0 && <p className="calculator-admin-helper">ამ სერვისზე რაოდენობრივი ფასდაკლება არ გამოიყენება.</p>}
          </section>

          <section className="calculator-admin-advanced-section">
            <div className="calculator-admin-inline-heading"><h3>დამატებითი ოფციები</h3>
              <button className="admin-button" type="button" disabled={service.extras.length >= 50}
                onClick={() => onUpdate({ extras: [...service.extras, { id: makeId('extra'), label: 'ახალი დამატებითი ოფცია', enabled: true, amount: 0, billing: 'fixed', includedInRush: false }] })}>
                <Plus />ოფციის დამატება
              </button>
            </div>
            {service.extras.map((extra) => <article className="calculator-admin-extra" key={extra.id}>
              <div className="calculator-admin-fields">
                <TextInput label="ოფციის დასახელება" value={extra.label} onChange={(label) => onUpdateExtra(extra.id, { label })} />
                <NumberInput label="დამატებითი ფასი (₾)" value={extra.amount} step={0.5} onChange={(amount) => onUpdateExtra(extra.id, { amount })} />
                <SelectInput label="ფასის დათვლა" value={extra.billing} options={[{ value: 'fixed', label: 'ფიქსირებული' }, { value: 'per_item', label: 'თითოეულზე' }]}
                  onChange={(billing) => onUpdateExtra(extra.id, { billing: billing as CalculatorExtra['billing'] })} />
                <Toggle label="ჩართულია" checked={extra.enabled} onChange={(enabled) => onUpdateExtra(extra.id, { enabled })} />
                <Toggle label="სასწრაფო ფასში შედის" checked={extra.includedInRush} onChange={(includedInRush) => onUpdateExtra(extra.id, { includedInRush })} />
              </div>
              <button className="admin-icon-button is-danger" type="button" aria-label="დამატებითი ოფციის წაშლა"
                onClick={() => onUpdate({ extras: service.extras.filter((item) => item.id !== extra.id) })}><Trash2 /></button>
            </article>)}
            {service.extras.length === 0 && <p className="calculator-admin-helper">დამატებითი ოფციები არ არის.</p>}
          </section>
        </div>
      </details>
    </div>
  );
}

export default function CalculatorManagement({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [config, setConfig] = useState<CalculatorConfig>(() => cloneCalculatorConfig(DEFAULT_CALCULATOR_CONFIG));
  const [baseline, setBaseline] = useState<CalculatorConfig>(() => cloneCalculatorConfig(DEFAULT_CALCULATOR_CONFIG));
  const [versions, setVersions] = useState<CalculatorVersion[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [action, setAction] = useState<ActionState>('');
  const [tab, setTab] = useState<EditorTab>('services');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [serviceCreateOpen, setServiceCreateOpen] = useState(false);
  const [newService, setNewService] = useState({ label: '', groupId: 'design', type: 'range' as Pricing['type'], min: 0, max: 0, amount: 0 });
  const [selectedGroupId, setSelectedGroupId] = useState('design');
  const [selectedServiceId, setSelectedServiceId] = useState('poster');
  const [selectedPackageId, setSelectedPackageId] = useState('starter');
  const undoStack = useRef<CalculatorConfig[]>([]);
  const dirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(baseline), [baseline, config]);

  const refreshVersions = useCallback(async (loadEditor = false) => {
    const nextVersions = await listCalculatorVersions();
    setVersions(nextVersions);
    const savedDraft = nextVersions.find((item) => item.status === 'draft');
    setDraftId(savedDraft?.id ?? null);
    if (loadEditor) {
      const currentPublished = nextVersions.find((item) => item.status === 'published');
      const nextConfig = cloneCalculatorConfig(savedDraft?.config ?? currentPublished?.config ?? DEFAULT_CALCULATOR_CONFIG);
      setConfig(nextConfig);
      setBaseline(cloneCalculatorConfig(nextConfig));
      setSelectedGroupId(nextConfig.groups.find((item) => item.enabled)?.id ?? nextConfig.groups[0]?.id ?? '');
      setSelectedServiceId(nextConfig.services.find((item) => item.enabled)?.id ?? nextConfig.services[0]?.id ?? '');
      setSelectedPackageId(nextConfig.packages[0]?.id ?? '');
      undoStack.current = [];
    }
  }, []);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    if (!previewOpen && !serviceCreateOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewOpen(false);
        setServiceCreateOpen(false);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [previewOpen, serviceCreateOpen]);

  useEffect(() => {
    let active = true;
    if (!calculatorRemoteEnabled) {
      setLoading(false);
      setLoadingError('ლოკალურ რეჟიმში კალკულატორის მართვა გამორთულია, რომ ტესტირებისას ლაივ ფასები შემთხვევით არ შეიცვალოს. კალკულატორი მართეთ გამოქვეყნებული საიტის ადმინიდან (/admin).');
      return () => { active = false; };
    }
    setLoading(true);
    void refreshVersions(true).catch((issue: unknown) => {
      if (active) setLoadingError(errorMessage(issue));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [refreshVersions]);

  const updateConfig = (mutate: (current: CalculatorConfig) => CalculatorConfig) => {
    setConfig((current) => {
      undoStack.current = [...undoStack.current.slice(-39), cloneCalculatorConfig(current)];
      return mutate(cloneCalculatorConfig(current));
    });
    setError('');
    setNotice('');
  };

  const updateGroup = (id: string, patch: Partial<CalculatorGroup>) => updateConfig((current) => ({
    ...current,
    groups: current.groups.map((group) => group.id === id ? { ...group, ...patch } : group),
  }));

  const updateService = (id: string, patch: Partial<CalculatorService>) => updateConfig((current) => ({
    ...current,
    services: current.services.map((service) => service.id === id ? { ...service, ...patch } : service),
  }));

  const updatePackage = (id: string, patch: Partial<CalculatorPackage>) => updateConfig((current) => ({
    ...current,
    packages: current.packages.map((item) => item.id === id ? { ...item, ...patch } : item),
  }));

  const moveControlGroup = (service: CalculatorService, index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= service.controlsOrder.length) return;
    const controlsOrder = [...service.controlsOrder];
    [controlsOrder[index], controlsOrder[nextIndex]] = [controlsOrder[nextIndex], controlsOrder[index]];
    updateService(service.id, { controlsOrder });
  };

  const activeGroups = config.groups.slice().sort((a, b) => a.order - b.order);
  const activeServices = config.services.filter((item) => item.groupId === selectedGroupId).sort((a, b) => a.order - b.order);
  const selectedService = config.services.find((item) => item.id === selectedServiceId);
  const selectedPackage = config.packages.find((item) => item.id === selectedPackageId);
  const sortedPackages = config.packages.slice().sort((a, b) => a.order - b.order);

  const saveDraft = async () => {
    if (!validateCalculatorConfig(config)) {
      setError('კონფიგურაცია ვერ ინახება. შეავსეთ სავალდებულო ველები და გადაამოწმეთ ფასები, დიაპაზონები და კატეგორიები.');
      return null;
    }
    setAction('saving');
    setError('');
    setNotice('');
    try {
      const saved = await saveCalculatorDraft(config);
      setDraftId(saved.id);
      setBaseline(cloneCalculatorConfig(config));
      await refreshVersions(false);
      setNotice(`მონახაზი შენახულია · ვერსია ${new Intl.NumberFormat('ka-GE').format(saved.version)}`);
      return saved.id;
    } catch (issue) {
      setError(errorMessage(issue));
      return null;
    } finally {
      setAction('');
    }
  };

  const publish = async () => {
    if (!validateCalculatorConfig(config)) {
      setError('გამოქვეყნებამდე შეასწორეთ სავალდებულო ველები, ფასები და წესები.');
      return;
    }
    if (!await adminConfirm({ title: 'საიტზე გამოქვეყნება', message: 'ახალი ფასები და ტექსტები მაშინვე გამოჩნდება საჯარო საიტზე. წინა ვერსია ისტორიაში შეინახება.', confirmLabel: 'გამოქვეყნება' })) return;
    setAction('publishing');
    setError('');
    setNotice('');
    try {
      let id = draftId;
      if (dirty || !id) {
        const saved = await saveCalculatorDraft(config);
        id = saved.id;
      }
      if (!id) throw new Error('მონახაზის იდენტიფიკატორი ვერ მოიძებნა.');
      await publishCalculatorDraft(id);
      setDraftId(null);
      setBaseline(cloneCalculatorConfig(config));
      await refreshVersions(false);
      setNotice('კალკულატორის ახალი ვერსია წარმატებით გამოქვეყნდა.');
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setAction('');
    }
  };

  const cancelChanges = async () => {
    if (!dirty) return;
    if (!await adminConfirm({ title: 'ცვლილებების გაუქმება', message: 'ყველა შეუნახავი ცვლილება გაუქმდება.', confirmLabel: 'გაუქმება', cancelLabel: 'დატოვება', tone: 'danger' })) return;
    setConfig(cloneCalculatorConfig(baseline));
    undoStack.current = [];
    setError('');
    setNotice('შეუნახავი ცვლილებები გაუქმდა.');
  };

  const undo = () => {
    const previous = undoStack.current.pop();
    if (!previous) {
      setNotice('გასაუქმებელი ცვლილება აღარ არის.');
      return;
    }
    setConfig(previous);
    setError('');
    setNotice('ბოლო ცვლილება გაუქმდა.');
  };

  const restore = async (version: CalculatorVersion) => {
    if (dirty && !window.confirm('არსებობს შეუნახავი ცვლილებები. გააგრძელოთ და ისინი გააუქმოთ?')) return;
    if (!window.confirm(`აღდგეს გამოქვეყნებული ვერსია ${new Intl.NumberFormat('ka-GE').format(version.version)}? ეს შექმნის ახალ გამოქვეყნებულ ვერსიას.`)) return;
    setAction('restoring');
    setError('');
    setNotice('');
    try {
      await restoreCalculatorVersion(version.id);
      await refreshVersions(true);
      setTab('history');
      setNotice('წინა გამოქვეყნებული ვერსია აღდგენილია.');
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setAction('');
    }
  };

  const addGroup = () => {
    const id = makeId('group');
    updateConfig((current) => ({ ...current, groups: [...current.groups, {
      id, label: 'ახალი კატეგორია', icon: 'layers', enabled: true, order: current.groups.length,
    }] }));
    setSelectedGroupId(id);
  };

  const removeGroup = (group: CalculatorGroup) => {
    if (config.services.some((item) => item.groupId === group.id)) {
      setError('კატეგორია ვერ წაიშლება, სანამ მასში სერვისებია. ჯერ გადაიტანეთ ან წაშალეთ სერვისები.');
      return;
    }
    if (!window.confirm(`წაიშალოს კატეგორია „${group.label}“ მონახაზიდან? საჯარო ცვლილება მხოლოდ გამოქვეყნების შემდეგ აისახება.`)) return;
    updateConfig((current) => ({ ...current, groups: current.groups.filter((item) => item.id !== group.id) }));
    setSelectedGroupId(config.groups.find((item) => item.id !== group.id)?.id ?? '');
  };

  const openServiceCreation = () => {
    const groupId = config.groups.find((item) => item.id === selectedGroupId)?.id ?? config.groups[0]?.id;
    if (!groupId) {
      setError('სერვისის დამატებამდე შექმენით მინიმუმ ერთი კატეგორია.');
      return;
    }
    setNewService({ label: '', groupId, type: 'range', min: 0, max: 0, amount: 0 });
    setServiceCreateOpen(true);
  };

  const addService = () => {
    if (!newService.label.trim()) {
      setError('შეიყვანეთ სერვისის დასახელება.');
      return;
    }
    const id = makeId('service');
    const next: CalculatorService = {
      id, groupId: newService.groupId, label: newService.label.trim(), note: '', enabled: true,
      order: config.services.filter((item) => item.groupId === newService.groupId).length,
      controlsOrder: ['quantity', 'changes', 'options'],
      pricing: newService.type === 'range'
        ? { type: 'range', min: newService.min, max: Math.max(newService.max, newService.min) }
        : { type: newService.type, amount: newService.amount },
      quantity: { enabled: newService.type !== 'fixed', min: 1, max: newService.type === 'fixed' ? 1 : 10, label: config.copy.quantityLabel },
      rush: { enabled: false, percent: 20, label: config.copy.rushLabel },
      discounts: [], extras: [],
    };
    updateConfig((current) => ({ ...current, services: [...current.services, next] }));
    setSelectedServiceId(id);
    setSelectedGroupId(newService.groupId);
    setTab('services');
    setServiceCreateOpen(false);
  };

  const removeService = (service: CalculatorService) => {
    if (!window.confirm(`წაიშალოს „${service.label}“ მონახაზიდან? გამოქვეყნებული საიტი უცვლელი დარჩება, სანამ ცვლილებებს არ გამოაქვეყნებთ.`)) return;
    updateConfig((current) => ({ ...current, services: current.services.filter((item) => item.id !== service.id) }));
    setSelectedServiceId(activeServices.find((item) => item.id !== service.id)?.id ?? '');
  };

  const addPackage = () => {
    const id = makeId('package');
    const next: CalculatorPackage = {
      id, name: 'ახალი პაკეტი', price: 0, summary: 'პაკეტის მოკლე აღწერა', features: [],
      extraChange: '', note: '', enabled: true, popular: false, accent: 'accent', order: config.packages.length,
    };
    updateConfig((current) => ({ ...current, packages: [...current.packages, next] }));
    setSelectedPackageId(id);
  };

  const removePackage = (item: CalculatorPackage) => {
    if (!window.confirm(`წაიშალოს „${item.name}“ პაკეტი მონახაზიდან?`)) return;
    updateConfig((current) => ({ ...current, packages: current.packages.filter((candidate) => candidate.id !== item.id) }));
    setSelectedPackageId(config.packages.find((candidate) => candidate.id !== item.id)?.id ?? '');
  };

  const copyVersion = (key: keyof CalculatorConfig['copy'], value: string) => updateConfig((current) => ({
    ...current,
    copy: { ...current.copy, [key]: value },
    services: current.services.map((service) => ({
      ...service,
      quantity: key === 'quantityLabel' ? { ...service.quantity, label: value } : service.quantity,
      changes: key === 'changesLabel' && service.changes ? { ...service.changes, label: value } : service.changes,
      rush: key === 'rushLabel' ? { ...service.rush, label: value } : service.rush,
      extras: key === 'extraSizesLabel' ? service.extras.map((extra) => extra.id === 'extra-sizes' ? { ...extra, label: value } : extra) : service.extras,
    })),
  }));

  const upsertDiscount = (index: number, patch: Partial<CalculatorDiscount>) => {
    if (!selectedService) return;
    const discounts = selectedService.discounts.map((item, currentIndex) => currentIndex === index ? { ...item, ...patch } : item)
      .sort((a, b) => a.minimumQuantity - b.minimumQuantity);
    updateService(selectedService.id, { discounts });
  };

  const updateExtra = (id: string, extraId: string, patch: Partial<CalculatorExtra>) => {
    const service = config.services.find((item) => item.id === id);
    if (!service) return;
    updateService(id, { extras: service.extras.map((extra) => extra.id === extraId ? { ...extra, ...patch } : extra) });
  };

  const disabledActions = Boolean(action) || !calculatorRemoteEnabled || loading || Boolean(loadingError);
  const publishedVersion = versions.find((item) => item.status === 'published');
  const draftVersion = versions.find((item) => item.status === 'draft');

  return (
    <section className="admin-page-section calculator-admin" aria-labelledby="calculator-admin-heading" lang="ka-GE">
      <div className="admin-page-heading calculator-admin-heading">
        <div>
          <h1 id="calculator-admin-heading">ფასები</h1>
          <p>კალკულატორის სერვისები, ფასები და ყოველთვიური პაკეტები. საიტზე გამოჩნდება „გამოქვეყნების“ შემდეგ.</p>
        </div>
        <div className="calculator-admin-version-badges">
          <span><Eye aria-hidden="true" />{publishedVersion ? `გამოქვეყნებული v${publishedVersion.version}` : 'საწყისი კონფიგურაცია'}</span>
          {draftVersion && <span className="is-draft"><Clock3 aria-hidden="true" />მონახაზი v{draftVersion.version}</span>}
          {dirty && <span className="is-unsaved"><AlertCircle aria-hidden="true" />შეუნახავი ცვლილებები</span>}
        </div>
      </div>

      <div className="calculator-admin-toolbar">
        <div className="calculator-admin-tabs" role="tablist" aria-label="კალკულატორის რედაქტირების სექციები">
          {editorTabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}>{item.label}</button>)}
        </div>
        <div className="calculator-admin-actions">
          <button className="admin-icon-button" type="button" onClick={undo} disabled={!undoStack.current.length || Boolean(action)} aria-label="ბოლო ცვლილების გაუქმება" title="გაუქმება"><Undo2 /></button>
          <button className="admin-icon-button" type="button" onClick={() => { void cancelChanges(); }} disabled={!dirty || Boolean(action)} aria-label="შეუნახავი ცვლილებების გაუქმება" title="ცვლილებების გაუქმება"><X /></button>
          <button className="admin-button" type="button" onClick={() => setPreviewOpen(true)} disabled={loading}><Eye />როგორ გამოჩნდება</button>
          <button className="admin-button admin-button-primary" type="button" onClick={() => { void publish(); }} disabled={disabledActions || !validateCalculatorConfig(config)}><Send />{action === 'publishing' ? 'ქვეყნდება...' : 'გამოქვეყნება'}</button>
        </div>
      </div>

      {loadingError && <div className="admin-alert calculator-admin-alert" role="alert"><AlertCircle aria-hidden="true" />{loadingError}</div>}
      {error && <div className="admin-alert calculator-admin-alert" role="alert"><AlertCircle aria-hidden="true" />{error}</div>}
      {notice && <div className="calculator-admin-notice" role="status"><Check aria-hidden="true" />{notice}</div>}

      {loading ? <div className="admin-loading-state" role="status"><LoaderCircle className="admin-spin" />კალკულატორის კონფიგურაცია იტვირთება...</div> : (
        <div className={`calculator-admin-workspace calculator-admin-mode-${tab}`}>
          <div className="calculator-admin-editor">
            {tab === 'appearance' && <Panel title="კალკულატორის ტექსტები" description="სათაურები და წარწერები, რომლებიც კალკულატორში ჩანს.">
              <Toggle label="კალკულატორი საიტზე ჩანს" checked={config.enabled} onChange={(enabled) => updateConfig((current) => ({ ...current, enabled }))}
                description="გამორთვისას კალკულატორის სექცია საიტიდან დაიმალება." />
              <div className="calculator-admin-fields">
                {copyFields.map((field) => <div key={field.key}><TextInput label={field.label} multiline={field.multiline}
                  value={config.copy[field.key]} onChange={(value) => copyVersion(field.key, value)} /></div>)}
              </div>
              <details className="calc-admin-advanced">
                <summary>დიზაინი და დამრგვალება</summary>
                <div className="calculator-admin-fields">
                  <NumberInput label="ფასის დამრგვალება (₾)" min={1} max={100} value={config.roundingIncrement} onChange={(roundingIncrement) => updateConfig((current) => ({ ...current, roundingIncrement }))} />
                  <SelectInput label="განლაგება" value={config.appearance.layout} options={[{ value: 'split', label: 'ორი სვეტი' }, { value: 'stacked', label: 'ერთ სვეტად' }]} onChange={(layout) => updateConfig((current) => ({ ...current, appearance: { ...current.appearance, layout: layout as CalculatorConfig['appearance']['layout'] } }))} />
                  <SelectInput label="სერვისების სვეტები" value={config.appearance.serviceColumns} options={[{ value: 'responsive', label: 'ადაპტიური' }, { value: 'two', label: 'ორი სვეტი' }, { value: 'three', label: 'სამი სვეტი' }]} onChange={(serviceColumns) => updateConfig((current) => ({ ...current, appearance: { ...current.appearance, serviceColumns: serviceColumns as CalculatorConfig['appearance']['serviceColumns'] } }))} />
                  <SelectInput label="ფერების სქემა" value={config.appearance.palette} options={[{ value: 'brand', label: 'საიტის ძირითადი' }, { value: 'copper', label: 'სპილენძისფერი' }, { value: 'plum', label: 'ქლიავისფერი' }]} onChange={(palette) => updateConfig((current) => ({ ...current, appearance: { ...current.appearance, palette: palette as CalculatorConfig['appearance']['palette'] } }))} />
                  <SelectInput label="ტიპოგრაფია" value={config.appearance.typography} options={[{ value: 'brand', label: 'საიტის ძირითადი' }, { value: 'compact', label: 'კომპაქტური' }]} onChange={(typography) => updateConfig((current) => ({ ...current, appearance: { ...current.appearance, typography: typography as CalculatorConfig['appearance']['typography'] } }))} />
                </div>
              </details>
            </Panel>}

            {tab === 'services' && <>
              <Panel title="სერვისის კატეგორიები" description="კატეგორიის რიგი განსაზღვრავს საჯარო ღილაკების თანმიმდევრობას."
                actions={<button className="admin-button" type="button" onClick={addGroup}><Plus />კატეგორიის დამატება</button>}>
                <div className="calculator-admin-group-list">
                  {activeGroups.map((group) => <article className={`calculator-admin-group ${selectedGroupId === group.id ? 'is-selected' : ''}`} key={group.id}>
                    <button className="calculator-admin-group-select" type="button" onClick={() => {
                      setSelectedGroupId(group.id);
                      setSelectedServiceId(config.services.find((service) => service.groupId === group.id)?.id ?? '');
                    }}>{group.label || 'უსახელო კატეგორია'}</button>
                    <input aria-label="კატეგორიის დასახელება" value={group.label} maxLength={120} onChange={(event) => updateGroup(group.id, { label: event.target.value })} />
                    <SelectInput label="ხატულა" value={group.icon} options={[
                      { value: 'calculator', label: 'კალკულატორი' }, { value: 'printer', label: 'პრინტერი' },
                      { value: 'sparkles', label: 'ბრჭყვიალა' }, { value: 'layers', label: 'ფენები' },
                    ]} onChange={(value) => updateGroup(group.id, { icon: value as CalculatorGroup['icon'] })} />
                    <NumberInput label="რიგი" min={0} max={10000} value={group.order} onChange={(order) => updateGroup(group.id, { order })} />
                    <Toggle label="ჩართულია" checked={group.enabled} onChange={(enabled) => updateGroup(group.id, { enabled })} />
                    <button className="admin-icon-button is-danger" type="button" title="კატეგორიის წაშლა" aria-label="კატეგორიის წაშლა" onClick={() => removeGroup(group)}><Trash2 /></button>
                  </article>)}
                </div>
              </Panel>

              <Panel title="სერვისები" description="აირჩიეთ სერვისი მისი ფასის, რაოდენობის და წესების სამართავად."
                actions={<button className="admin-button" type="button" onClick={openServiceCreation}><Plus />სერვისის დამატება</button>}>
                <div className="calculator-admin-service-browser">
                  <div className="calculator-admin-service-list" role="listbox" aria-label="სერვისები">
                    {activeServices.map((item) => <button key={item.id} type="button" role="option" aria-selected={selectedServiceId === item.id}
                      className={selectedServiceId === item.id ? 'is-selected' : ''} onClick={() => setSelectedServiceId(item.id)}>
                      <span><strong>{item.label || 'ახალი სერვისი'}</strong><small>{item.enabled ? 'ჩართულია' : 'გამორთულია'} · რიგი {item.order + 1}</small></span>
                      <span className="calculator-admin-service-price">{item.pricing.type === 'range' ? `${item.pricing.min}–${item.pricing.max}` : item.pricing.amount} ₾</span>
                    </button>)}
                    {activeServices.length === 0 && <p className="calculator-admin-empty">ამ კატეგორიაში სერვისები ჯერ არ არის.</p>}
                  </div>

                  {selectedService ? <div className="calculator-admin-service-editor">
                    <div className="calculator-admin-inline-heading">
                      <h3>{selectedService.label || 'სერვისის რედაქტირება'}</h3>
                      <button className="admin-button is-danger" type="button" onClick={() => removeService(selectedService)}><Trash2 />წაშლა</button>
                    </div>
                    <div className="calculator-admin-fields">
                      <TextInput label="სერვისის დასახელება" value={selectedService.label} onChange={(label) => updateService(selectedService.id, { label })} />
                      <TextInput label="სერვისის მოკლე აღწერა" value={selectedService.note} multiline onChange={(note) => updateService(selectedService.id, { note })} />
                      <SelectInput label="კატეგორია" value={selectedService.groupId} options={config.groups.map((group) => ({ value: group.id, label: group.label || 'უსახელო კატეგორია' }))}
                        onChange={(groupId) => { updateService(selectedService.id, { groupId }); setSelectedGroupId(groupId); }} />
                      <NumberInput label="სერვისის რიგი" value={selectedService.order} min={0} max={10000} onChange={(order) => updateService(selectedService.id, { order })} />
                      <Toggle label="საჯაროდ ჩართულია" checked={selectedService.enabled} onChange={(enabled) => updateService(selectedService.id, { enabled })} />
                    </div>

                    <div className="calculator-admin-subpanel">
                      <h4>ფასის ტიპი</h4>
                      <div className="calculator-admin-fields">
                        <SelectInput label="გამოთვლის ტიპი" value={selectedService.pricing.type} options={[
                          { value: 'range', label: 'ფასის დიაპაზონი' }, { value: 'fixed', label: 'ფიქსირებული ფასი' }, { value: 'per_item', label: 'ფასი თითო ერთეულზე' },
                        ]} onChange={(type) => {
                          const pricing: Pricing = type === 'range' ? { type, min: 0, max: 0 } : { type: type as 'fixed' | 'per_item', amount: 0 };
                          updateService(selectedService.id, {
                            pricing,
                            ...(type === 'fixed' ? { quantity: { ...selectedService.quantity, enabled: false, min: 1, max: 1 } } : {}),
                          });
                        }} />
                        {selectedService.pricing.type === 'range' ? <>
                          <NumberInput label="მინიმალური ფასი (₾)" value={selectedService.pricing.min} step={0.5} onChange={(min) => updateService(selectedService.id, { pricing: { ...selectedService.pricing, min } })} />
                          <NumberInput label="მაქსიმალური ფასი (₾)" value={selectedService.pricing.max} step={0.5} onChange={(max) => updateService(selectedService.id, { pricing: { ...selectedService.pricing, max } })} />
                        </> : <NumberInput label={selectedService.pricing.type === 'fixed' ? 'ფიქსირებული ფასი (₾)' : 'ფასი თითო ერთეულზე (₾)'} value={selectedService.pricing.amount} step={0.5}
                          onChange={(amount) => updateService(selectedService.id, { pricing: { ...selectedService.pricing, amount } })} />}
                      </div>
                    </div>

                    <div className="calculator-admin-subpanel">
                      <h4>ველების ჩვენების რიგი</h4>
                      <p className="calculator-admin-helper">აირჩიეთ, რა თანმიმდევრობით გამოჩნდეს მომხმარებლისთვის რაოდენობა და დამატებითი პარამეტრები.</p>
                      <ol className="calculator-admin-order-list">
                        {selectedService.controlsOrder.map((control, index) => <li key={control}>
                          <span>{controlGroupLabels[control]}</span>
                          <div>
                            <button className="admin-icon-button" type="button" aria-label={`${controlGroupLabels[control]} ზემოთ აწევა`}
                              title="ზემოთ აწევა" disabled={index === 0} onClick={() => moveControlGroup(selectedService, index, -1)}><ChevronUp /></button>
                            <button className="admin-icon-button" type="button" aria-label={`${controlGroupLabels[control]} ქვემოთ ჩამოწევა`}
                              title="ქვემოთ ჩამოწევა" disabled={index === selectedService.controlsOrder.length - 1} onClick={() => moveControlGroup(selectedService, index, 1)}><ChevronDown /></button>
                          </div>
                        </li>)}
                      </ol>
                    </div>

                    <div className="calculator-admin-subpanel">
                      <h4>რაოდენობა და ცვლილებები</h4>
                      <Toggle label="რაოდენობის არჩევა" checked={selectedService.quantity.enabled} onChange={(enabled) => updateService(selectedService.id, {
                        quantity: { ...selectedService.quantity, enabled, min: enabled ? Math.max(1, selectedService.quantity.min) : 1, max: enabled ? Math.max(selectedService.quantity.max, selectedService.quantity.min) : 1 },
                        ...(enabled && selectedService.pricing.type === 'fixed' ? { pricing: { type: 'per_item' as const, amount: selectedService.pricing.amount } } : {}),
                      })} description="გამორთვის შემთხვევაში მომსახურება ერთ რაოდენობად ითვლება." />
                      {selectedService.quantity.enabled && <div className="calculator-admin-fields">
                        <TextInput label="რაოდენობის ველის დასახელება" value={selectedService.quantity.label} onChange={(label) => updateService(selectedService.id, { quantity: { ...selectedService.quantity, label } })} />
                        <NumberInput label="მინიმალური რაოდენობა" min={1} max={1000} value={selectedService.quantity.min} onChange={(min) => updateService(selectedService.id, { quantity: { ...selectedService.quantity, min } })} />
                        <NumberInput label="მაქსიმალური რაოდენობა" min={1} max={1000} value={selectedService.quantity.max} onChange={(max) => updateService(selectedService.id, { quantity: { ...selectedService.quantity, max } })} />
                      </div>}
                      <Toggle label="ცვლილებების რაოდენობა" checked={Boolean(selectedService.changes?.enabled)} onChange={(enabled) => updateService(selectedService.id, {
                        changes: { enabled, min: selectedService.changes?.min ?? 0, max: selectedService.changes?.max ?? 20, amountPerChange: selectedService.changes?.amountPerChange ?? 20, label: selectedService.changes?.label ?? config.copy.changesLabel },
                      })} />
                      {selectedService.changes?.enabled && <div className="calculator-admin-fields">
                        <TextInput label="ველის დასახელება" value={selectedService.changes.label} onChange={(label) => updateService(selectedService.id, { changes: { ...selectedService.changes!, label } })} />
                        <NumberInput label="მინიმუმი" min={0} max={1000} value={selectedService.changes.min} onChange={(min) => updateService(selectedService.id, { changes: { ...selectedService.changes!, min } })} />
                        <NumberInput label="მაქსიმუმი" min={0} max={1000} value={selectedService.changes.max} onChange={(max) => updateService(selectedService.id, { changes: { ...selectedService.changes!, max } })} />
                        <NumberInput label="ფასი თითო ცვლილებაზე (₾)" value={selectedService.changes.amountPerChange} step={0.5} onChange={(amountPerChange) => updateService(selectedService.id, { changes: { ...selectedService.changes!, amountPerChange } })} />
                      </div>}
                    </div>

                    <div className="calculator-admin-subpanel">
                      <div className="calculator-admin-inline-heading"><h4>სასწრაფო ვადა</h4>
                        <Toggle label="ჩართულია" checked={selectedService.rush.enabled} onChange={(enabled) => updateService(selectedService.id, { rush: { ...selectedService.rush, enabled } })} />
                      </div>
                      {selectedService.rush.enabled && <div className="calculator-admin-fields">
                        <TextInput label="ღილაკის ტექსტი" value={selectedService.rush.label} onChange={(label) => updateService(selectedService.id, { rush: { ...selectedService.rush, label } })} />
                        <NumberInput label="ფასის ზრდა (%)" min={0} max={500} step={0.5} value={selectedService.rush.percent} onChange={(percent) => updateService(selectedService.id, { rush: { ...selectedService.rush, percent } })} />
                      </div>}
                    </div>

                    <div className="calculator-admin-subpanel">
                      <div className="calculator-admin-inline-heading"><h4>რაოდენობის ფასდაკლებები</h4>
                        <button className="admin-button" type="button" onClick={() => updateService(selectedService.id, { discounts: [...selectedService.discounts, { minimumQuantity: (selectedService.discounts.at(-1)?.minimumQuantity ?? 0) + 1, percent: 0 }] })}><Plus />ზღვრის დამატება</button>
                      </div>
                      {selectedService.discounts.map((discount, index) => <div className="calculator-admin-rule-row" key={`${discount.minimumQuantity}-${index}`}>
                        <NumberInput label="მინ. რაოდენობა" min={1} max={1000} value={discount.minimumQuantity} onChange={(minimumQuantity) => upsertDiscount(index, { minimumQuantity })} />
                        <NumberInput label="ფასდაკლება (%)" min={0} max={100} step={0.5} value={discount.percent} onChange={(percent) => upsertDiscount(index, { percent })} />
                        <button className="admin-icon-button is-danger" type="button" aria-label="ფასდაკლების წესის წაშლა" onClick={() => updateService(selectedService.id, { discounts: selectedService.discounts.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 /></button>
                      </div>)}
                      {selectedService.discounts.length === 0 && <p className="calculator-admin-helper">ამ სერვისზე რაოდენობრივი ფასდაკლება არ გამოიყენება.</p>}
                    </div>

                    <div className="calculator-admin-subpanel">
                      <div className="calculator-admin-inline-heading"><h4>დამატებითი ოფციები</h4>
                        <button className="admin-button" type="button" onClick={() => updateService(selectedService.id, { extras: [...selectedService.extras, {
                          id: makeId('extra'), label: 'ახალი დამატებითი ოფცია', enabled: true, amount: 0, billing: 'fixed', includedInRush: false,
                        }] })}><Plus />ოფციის დამატება</button>
                      </div>
                      {selectedService.extras.map((extra) => <article className="calculator-admin-extra" key={extra.id}>
                        <div className="calculator-admin-fields">
                          <TextInput label="ოფციის დასახელება" value={extra.label} onChange={(label) => updateExtra(selectedService.id, extra.id, { label })} />
                          <NumberInput label="დამატებითი ფასი (₾)" value={extra.amount} step={0.5} onChange={(amount) => updateExtra(selectedService.id, extra.id, { amount })} />
                          <SelectInput label="ფასის დათვლა" value={extra.billing} options={[{ value: 'fixed', label: 'ფიქსირებული' }, { value: 'per_item', label: 'თითოეულზე' }]} onChange={(billing) => updateExtra(selectedService.id, extra.id, { billing: billing as CalculatorExtra['billing'] })} />
                          <Toggle label="ჩართულია" checked={extra.enabled} onChange={(enabled) => updateExtra(selectedService.id, extra.id, { enabled })} />
                          <Toggle label="სასწრაფო ფასში შედის" checked={extra.includedInRush} onChange={(includedInRush) => updateExtra(selectedService.id, extra.id, { includedInRush })} />
                        </div>
                        <button className="admin-icon-button is-danger" type="button" aria-label="დამატებითი ოფციის წაშლა" onClick={() => updateService(selectedService.id, { extras: selectedService.extras.filter((item) => item.id !== extra.id) })}><Trash2 /></button>
                      </article>)}
                      {selectedService.extras.length === 0 && <p className="calculator-admin-helper">დამატებითი ოფციები არ არის.</p>}
                    </div>
                  </div> : <p className="calculator-admin-empty">სერვისის რედაქტირებისთვის აირჩიეთ კატეგორია ან დაამატეთ ახალი სერვისი.</p>}
                </div>
              </Panel>
            </>}

            {tab === 'packages' && <Panel title="ყოველთვიური პაკეტები" description="შეცვალეთ Starter, Business და Premium პაკეტები ან შექმენით ახალი."
              actions={<button className="admin-button" type="button" onClick={addPackage}><Plus />პაკეტის დამატება</button>}>
              <div className="calculator-admin-package-browser">
                <div className="calculator-admin-package-list">
                  {sortedPackages.map((item) => <button key={item.id} type="button" className={selectedPackageId === item.id ? 'is-selected' : ''}
                    onClick={() => setSelectedPackageId(item.id)}><strong>{item.name}</strong><span>{new Intl.NumberFormat('ka-GE').format(item.price)} ₾ · {item.enabled ? 'ჩართულია' : 'გამორთულია'}</span></button>)}
                </div>
                {selectedPackage ? <div className="calculator-admin-package-editor">
                  <div className="calculator-admin-inline-heading"><h3>{selectedPackage.name}</h3><button className="admin-button is-danger" type="button" onClick={() => removePackage(selectedPackage)}><Trash2 />წაშლა</button></div>
                  <div className="calculator-admin-fields">
                    <TextInput label="პაკეტის სახელი" value={selectedPackage.name} onChange={(name) => updatePackage(selectedPackage.id, { name })} />
                    <NumberInput label="ფასი (₾ / თვე)" value={selectedPackage.price} step={10} onChange={(price) => updatePackage(selectedPackage.id, { price })} />
                    <TextInput label="მოკლე აღწერა" value={selectedPackage.summary} onChange={(summary) => updatePackage(selectedPackage.id, { summary })} />
                  </div>
                  <details className="calc-admin-advanced">
                    <summary>დამატებითი პარამეტრები</summary>
                    <div className="calculator-admin-fields">
                    <TextInput label="დამატებითი ცვლილების ტექსტი" value={selectedPackage.extraChange} onChange={(extraChange) => updatePackage(selectedPackage.id, { extraChange })} />
                    <TextInput label="დამატებითი შენიშვნა" value={selectedPackage.note} multiline onChange={(note) => updatePackage(selectedPackage.id, { note })} />
                    <TextInput label="შემადგენლობა · თითო ხაზი თითო ფუნქცია" value={selectedPackage.features.join('\n')} multiline
                      onChange={(value) => updatePackage(selectedPackage.id, { features: value.split('\n').slice(0, 50) })} />
                    <SelectInput label="ხაზგასმის ფერი" value={selectedPackage.accent} options={[{ value: 'copper', label: 'სპილენძისფერი' }, { value: 'accent', label: 'საიტის ძირითადი' }, { value: 'plum', label: 'ქლიავისფერი' }]} onChange={(accent) => updatePackage(selectedPackage.id, { accent: accent as CalculatorPackage['accent'] })} />
                    <NumberInput label="გამოტანის რიგი" value={selectedPackage.order} min={0} max={10000} onChange={(order) => updatePackage(selectedPackage.id, { order })} />
                    <Toggle label="საჯაროდ ჩართულია" checked={selectedPackage.enabled} onChange={(enabled) => updatePackage(selectedPackage.id, { enabled })} />
                    <Toggle label="პოპულარული პაკეტი" checked={selectedPackage.popular} onChange={(popular) => updateConfig((current) => ({ ...current, packages: current.packages.map((item) => ({ ...item, popular: item.id === selectedPackage.id && popular })) }))} description="ერთდროულად მხოლოდ ერთი პაკეტი შეიძლება იყოს ხაზგასმული." />
                    </div>
                  </details>
                </div> : <p className="calculator-admin-empty">პაკეტის რედაქტირებისთვის აირჩიეთ პაკეტი ან დაამატეთ ახალი.</p>}
              </div>
            </Panel>}

            {tab === 'pricing' && <>
              <Panel title="სერვისის ფასი და პირობები" description="საბაზისო ფასი მარტივად შეცვალეთ; დამატებითი წესები ქვემოთაა გაერთიანებული.">
                {selectedService ? <>
                  <div className="calculator-admin-pricing-selection">
                    <SelectInput label="სერვისი" value={selectedService.id} options={config.services.map((service) => ({
                      value: service.id,
                      label: `${config.groups.find((group) => group.id === service.groupId)?.label ?? 'კატეგორიის გარეშე'} · ${service.label || 'უსახელო სერვისი'}`,
                    }))} onChange={setSelectedServiceId} />
                    <span className="calculator-admin-price-summary">
                      {selectedService.pricing.type === 'range'
                        ? `${new Intl.NumberFormat('ka-GE').format(selectedService.pricing.min)}–${new Intl.NumberFormat('ka-GE').format(selectedService.pricing.max)} ₾`
                        : `${new Intl.NumberFormat('ka-GE').format(selectedService.pricing.amount)} ₾${selectedService.pricing.type === 'per_item' ? ' / ერთეული' : ''}`}
                    </span>
                  </div>
                  <ServicePricingEditor service={selectedService} copy={config.copy}
                    onUpdate={(patch) => updateService(selectedService.id, patch)}
                    onUpdateExtra={(extraId, patch) => updateExtra(selectedService.id, extraId, patch)}
                    onUpsertDiscount={upsertDiscount}
                    onMoveControl={(index, direction) => moveControlGroup(selectedService, index, direction)} />
                </> : <p className="calculator-admin-empty">ფასების სამართავად ჯერ დაამატეთ სერვისი.</p>}
              </Panel>

              <Panel title="საერთო გამოთვლის წესი" description="გამოიყენება უსაფრთხო, წინასწარ განსაზღვრული რიცხვითი წესები; მომხმარებლის კოდი არ სრულდება.">
                <div className="calculator-admin-fields">
                  <NumberInput label="დამრგვალების ნაბიჯი (₾)" min={1} max={100} value={config.roundingIncrement} onChange={(roundingIncrement) => updateConfig((current) => ({ ...current, roundingIncrement }))} />
                </div>
                <div className="calculator-admin-rule-guide">
                  <strong>წესების თანმიმდევრობა</strong>
                  <p>საბაზისო ფასი × რაოდენობა → ყველაზე მაღალი შესაბამისი ფასდაკლება → ცვლილებებისა და დამატებითი ოფციების ფასი → სასწრაფო დანამატი → მითითებულ ნაბიჯამდე დამრგვალება.</p>
                  <p>თითოეულ სერვისზე მინიმალური რაოდენობის ზღვარი და პროცენტი შეცვალეთ „კატეგორიები და სერვისები“ სექციაში.</p>
                </div>
              </Panel>
            </>}

            {tab === 'history' && <Panel title="ვერსიების ისტორია" description="გამოქვეყნებული ვერსიები და მონახაზები. წინა ვერსიის აღდგენა შექმნის ახალ გამოქვეყნებულ ვერსიას.">
              {loading ? <p className="calculator-admin-empty">ისტორია იტვირთება...</p> : versions.length === 0 ? (
                <p className="calculator-admin-empty">ვერსიები ჯერ არ არის შენახული.</p>
              ) : <div className="calculator-admin-history-list">
                {versions.map((item) => (
                  <article className="calculator-admin-history-row" key={item.id}>
                    <div>
                      <strong>ვერსია {new Intl.NumberFormat('ka-GE').format(item.version)}</strong>
                      <span className={`calculator-admin-status is-${item.status}`}>{item.status === 'published' ? 'გამოქვეყნებული' : item.status === 'draft' ? 'მონახაზი' : 'წინა ვერსია'}</span>
                      <time>{formatKaDate(item.published_at ?? item.created_at)}</time>
                    </div>
                    {item.status === 'archived' && item.published_at && <button className="admin-button" type="button" disabled={Boolean(action)} onClick={() => { void restore(item); }}>
                      {action === 'restoring' ? <LoaderCircle className="admin-spin" /> : <RotateCcw />}აღდგენა
                    </button>}
                  </article>
                ))}
              </div>}
            </Panel>}
          </div>

        </div>
      )}

      {serviceCreateOpen && <div className="calculator-admin-modal-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setServiceCreateOpen(false);
      }}>
        <section className="calculator-admin-modal" role="dialog" aria-modal="true" aria-labelledby="calculator-new-service-title">
          <div className="calculator-admin-modal-heading">
            <div><p className="admin-eyebrow">ახალი ჩანაწერი</p><h2 id="calculator-new-service-title">სერვისის დამატება</h2></div>
            <button className="admin-icon-button" type="button" aria-label="ფანჯრის დახურვა" onClick={() => setServiceCreateOpen(false)}><X /></button>
          </div>
          <div className="calculator-admin-modal-fields">
            <TextInput label="სერვისის დასახელება" value={newService.label} onChange={(label) => setNewService((current) => ({ ...current, label }))} />
            <SelectInput label="კატეგორია" value={newService.groupId} options={config.groups.map((group) => ({ value: group.id, label: group.label || 'უსახელო კატეგორია' }))}
              onChange={(groupId) => setNewService((current) => ({ ...current, groupId }))} />
            <SelectInput label="ფასის ტიპი" value={newService.type} options={[
              { value: 'range', label: 'ფასის დიაპაზონი' }, { value: 'fixed', label: 'ფიქსირებული ფასი' }, { value: 'per_item', label: 'ფასი თითო ერთეულზე' },
            ]} onChange={(type) => setNewService((current) => ({ ...current, type: type as Pricing['type'] }))} />
            {newService.type === 'range' ? <>
              <NumberInput label="მინიმალური ფასი (₾)" value={newService.min} step={0.5} onChange={(min) => setNewService((current) => ({ ...current, min }))} />
              <NumberInput label="მაქსიმალური ფასი (₾)" value={newService.max} step={0.5} onChange={(max) => setNewService((current) => ({ ...current, max }))} />
            </> : <NumberInput label={newService.type === 'fixed' ? 'ფიქსირებული ფასი (₾)' : 'ფასი თითო ერთეულზე (₾)'} value={newService.amount} step={0.5}
              onChange={(amount) => setNewService((current) => ({ ...current, amount }))} />}
          </div>
          {error && <div className="admin-alert calculator-admin-alert" role="alert"><AlertCircle aria-hidden="true" />{error}</div>}
          <div className="calculator-admin-modal-actions">
            <button className="admin-button" type="button" onClick={() => setServiceCreateOpen(false)}>გაუქმება</button>
            <button className="admin-button admin-button-primary" type="button" onClick={addService} disabled={!newService.label.trim()}><Plus />სერვისის შექმნა</button>
          </div>
        </section>
      </div>}

      {previewOpen && <div className="calculator-admin-preview-overlay" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setPreviewOpen(false);
      }}>
        <section className="calculator-admin-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="calculator-preview-title">
          <header className="calculator-admin-preview-header">
            <div><p className="admin-eyebrow">ცოცხალი გადახედვა</p><h2 id="calculator-preview-title">საჯარო კალკულატორი</h2>
              <p>მონახაზის ცვლილებები აქვე ჩანს; საჯარო გვერდზე ისინი მხოლოდ გამოქვეყნების შემდეგ აისახება.</p></div>
            <button className="admin-icon-button" type="button" aria-label="გადახედვის დახურვა" title="დახურვა" onClick={() => setPreviewOpen(false)}><X /></button>
          </header>
          <div className="calculator-admin-preview-content">
            {config.enabled ? <PriceCalculator config={config} /> : <div className="calculator-admin-preview-disabled"><Eye aria-hidden="true" /><strong>კალკულატორი გამორთულია</strong><span>ჩართეთ სექცია „იერსახე“ განყოფილებაში, რომ საჯარო გვერდზე გამოჩნდეს.</span></div>}
          </div>
        </section>
      </div>}
    </section>
  );
}
