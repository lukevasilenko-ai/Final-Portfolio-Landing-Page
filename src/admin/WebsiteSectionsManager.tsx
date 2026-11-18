import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Reorder } from 'motion/react';
import {
  ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, CircleAlert, Clock3,
  Copy, Eye, EyeOff, FileImage, GripVertical, LayoutTemplate, LoaderCircle,
  ExternalLink, Monitor, Plus, Redo2, RotateCcw, Save, Smartphone, Tablet, Trash2, Undo2, X,
} from 'lucide-react';
import {
  DEFAULT_WEBSITE_LAYOUT, createStableId, createTemplateSection, createWebsiteBlock, duplicateNestedBlock,
  isRetiredNativeSection, moveNestedBlock, normalizeWebsiteSectionOrder, removeNestedBlock, sortWebsiteSections,
  resolveWebsiteLayoutManagerConfig, updateNestedBlock, validateWebsiteLayout, WEBSITE_INSERTABLE_BLOCK_TYPES, WEBSITE_TEMPLATES,
  type WebsiteBlock, type WebsiteBlockType, type WebsiteLayoutConfig,
  type WebsiteSection, type WebsiteTemplateId,
} from '../websiteSections/model';
import { getNativeElementDefinitions, insertNativeElement, isNativeElementVisible, setNativeElementVisibility } from '../websiteSections/nativeSchema';
import { nativeSectionBlockIds } from '../websiteSections/NativeElements';
import CanvasWebsiteEditor from '../websiteSections/CanvasWebsiteEditor';
import { insertCanvasSection, popWebsiteLayoutUndo, pushWebsiteLayoutUndo } from '../websiteSections/canvasEditor';
import {
  loadWebsiteLayoutManager, publishWebsiteLayoutDraft, restoreWebsiteLayout,
  saveWebsiteLayoutDraft, uploadWebsiteLayoutAsset, type WebsiteLayoutAsset, type WebsiteLayoutVersion,
} from '../websiteSections/repository';
import { adminConfirm, adminToast } from './feedback';
import { supabase } from '../lib/supabase';
import {
  EMPTY_SITE_ELEMENTS, normalizeSiteElements, siteElementsEqual, SITE_ELEMENTS_DRAFT_KEY, SITE_ELEMENTS_KEY, SITE_ELEMENTS_LOCALE,
  type SiteElements,
} from '../siteElements';
import './section-builder.css';

type Props = { onDirtyChange: (dirty: boolean) => void };
type View = 'sections' | 'history';

const blockLabels: Record<WebsiteBlockType, string> = {
  eyebrow: 'მცირე წარწერა', 'native-visibility': 'სექციის ელემენტის ხილვადობა',
  heading: 'სათაური', subheading: 'ქვესათაური', paragraph: 'აბზაცი', button: 'ღილაკი',
  image: 'სურათი', icon: 'ხატულა', divider: 'გამყოფი', 'feature-list': 'უპირატესობების სია',
  statistic: 'სტატისტიკა', 'gallery-item': 'გალერეის სურათი', card: 'ბარათი',
  'content-group': 'კონტენტის ჯგუფი', 'faq-item': 'კითხვა და პასუხი', testimonial: 'შეფასება',
  logo: 'ლოგო', 'call-to-action': 'მოქმედებისკენ მოწოდება',
};

const iconLabels: Record<NonNullable<WebsiteBlock['icon']>, string> = {
  sparkles: 'ნაპერწკლები', palette: 'პალიტრა', layers: 'ფენები', check: 'მონიშვნა',
  arrow: 'ისარი', star: 'ვარსკვლავი', quote: 'ციტატა', clock: 'საათი',
};

const copyLabels: Record<string, string> = {
  eyebrow: 'ზედა წარწერა', title: 'სათაური', titleLine1: 'სათაურის პირველი ხაზი',
  titleLine2: 'სათაურის მეორე ხაზი', titleLine3: 'აქცენტირებული ხაზი', description: 'აღწერა',
  primaryButtonLabel: 'მთავარი ღილაკი', imageAlt: 'სურათის აღწერა', featuredLabel: 'სურათის წარწერა',
  profileName: 'სახელი', role: 'პროფესია', profileDescription: 'პროფილის აღწერა',
  featureOneTitle: 'პირველი ბარათის სათაური', featureOneText: 'პირველი ბარათის აღწერა',
  featureTwoTitle: 'მეორე ბარათის სათაური', featureTwoText: 'მეორე ბარათის აღწერა',
  skillsTitle: 'უნარების სათაური', skillsDescription: 'უნარების აღწერა', buttonLabel: 'ღილაკის წარწერა',
  statsExperienceValue: 'გამოცდილების მაჩვენებელი', statsExperienceLabel: 'გამოცდილების წარწერა',
  statsProjectsValue: 'პროექტების მაჩვენებელი', statsProjectsLabel: 'პროექტების წარწერა',
  statsSuccessValue: 'შედეგის მაჩვენებელი', statsSuccessLabel: 'შედეგის წარწერა',
  skillCategoryLabel: 'უნარების კატეგორია', skillOneName: 'პირველი პროგრამა', skillOneLevel: 'პირველი პროგრამის დონე (%)',
  skillTwoName: 'მეორე პროგრამა', skillTwoLevel: 'მეორე პროგრამის დონე (%)', skillsQuote: 'ციტატა',
  categoryLabel: 'კატეგორიის წარწერა', cardTitleLead: 'საკონტაქტო სათაური — ნაწილი 1',
  cardTitleAccentOne: 'საკონტაქტო სათაური — აქცენტი 1', cardTitleMiddle: 'საკონტაქტო სათაური — ნაწილი 2',
  cardTitleAccentTwo: 'საკონტაქტო სათაური — აქცენტი 2', cardTitleEnd: 'საკონტაქტო სათაური — ბოლო ნაწილი',
  channelsTitle: 'საკონტაქტო არხების სათაური', contactCardDescription: 'საკონტაქტო ბარათის აღწერა',
  emailLabel: 'ელფოსტის წარწერა', contactEmail: 'ელფოსტის მისამართი', whatsappLabel: 'WhatsApp-ის წარწერა',
  whatsappNumber: 'WhatsApp-ის ნომერი (ქვეყნის კოდით, მხოლოდ ციფრები)', workingHoursLabel: 'სამუშაო საათების წარწერა',
  workingHours: 'სამუშაო საათები', signature: 'ხელმოწერა', formNameLabel: 'სახელის ველის წარწერა',
  formNamePlaceholder: 'სახელის ველის მინიშნება', formEmailLabel: 'ელფოსტის ველის წარწერა',
  formEmailPlaceholder: 'ელფოსტის ველის მინიშნება', formSubjectLabel: 'თემის ველის წარწერა',
  formSubjectPlaceholder: 'თემის ველის მინიშნება', formMessageLabel: 'შეტყობინების ველის წარწერა',
  formMessagePlaceholder: 'შეტყობინების ველის მინიშნება', formNote: 'ფორმის განმარტება',
  formButtonLabel: 'ფორმის ღილაკი', titleAccent: 'აქცენტირებული სიტყვა', copyright: 'საავტორო წარწერა',
};

const errorLabels: Record<string, string> = {
  website_schema_missing: 'საიტის სექციების მონაცემთა ბაზის მიგრაცია ჯერ არ არის გამოყენებული. რედაქტირება და წინასწარი ნახვა ხელმისაწვდომია; შენახვა მიგრაციის შემდეგ ჩაირთვება.',
  website_admin_forbidden: 'ამ მოქმედებისთვის ადმინისტრატორის უფლება ვერ დადასტურდა.',
  website_layout_invalid: 'კონფიგურაციაში დაუშვებელი ან არასრული მონაცემებია. ცვლილება არ შენახულა.',
  website_asset_invalid: 'აირჩიეთ JPEG, PNG, WEBP ან AVIF სურათი, მაქსიმუმ 20 მბ.',
  website_asset_record_failed: 'სურათის ჩანაწერის შექმნა ვერ მოხერხდა.',
  website_asset_upload_failed: 'სურათის ატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.',
  website_asset_preview_failed: 'სურათის წინასწარი ნახვის ბმულის შექმნა ვერ მოხერხდა.',
};

function errorText(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  return errorLabels[code] ?? 'მოქმედება ვერ შესრულდა. გადაამოწმეთ კავშირი და სცადეთ ხელახლა.';
}

function hasDirtyChanges(first: WebsiteLayoutConfig, second: WebsiteLayoutConfig) {
  return JSON.stringify(first) !== JSON.stringify(second);
}

function TemplatePreview({ templateId }: { templateId: WebsiteTemplateId }) {
  const variant = templateId === 'image-text' ? 'split'
    : templateId === 'gallery' || templateId === 'logo-grid' ? 'tiles'
      : templateId === 'services-grid' || templateId === 'feature-cards' ? 'cards'
        : templateId === 'statistics' ? 'stats'
          : templateId === 'call-to-action' ? 'cta'
            : templateId === 'divider' ? 'divider'
              : templateId === 'faq' || templateId === 'testimonials' ? 'list'
                : 'text';

  return <span className={`section-builder-template-preview is-${variant}`} aria-hidden="true">
    <i /><i /><i /><i /><i />
  </span>;
}

function ImageField({ value, assets, onChange, onUpload }: {
  value: string; assets: WebsiteLayoutAsset[]; onChange: (value: string) => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedAssetId = value.startsWith('asset:') ? value.slice(6) : '';
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);
  const previewUrl = selectedAsset?.previewUrl ?? (value.startsWith('https://') ? value : '');

  const handleFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try { await onUpload(file); }
    catch (error) { setUploadError(errorText(error)); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <div className="section-builder-image-field">
      {previewUrl ? <img src={previewUrl} alt="არჩეული სურათის წინასწარი ნახვა" /> : <div className="section-builder-image-empty"><FileImage aria-hidden="true" /><span>სურათი არჩეული არ არის</span></div>}
      <div className="section-builder-image-controls">
        <label>ბიბლიოთეკა
          <select value={selectedAssetId} onChange={(event) => onChange(event.target.value ? `asset:${event.target.value}` : '')}>
            <option value="">სურათის არჩევა</option>
            {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.alt_text || asset.storage_path.split('/').at(-1)}</option>)}
          </select>
        </label>
        <button type="button" className="section-builder-secondary-button" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />} ატვირთვა
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(event) => { void handleFile(event.currentTarget.files?.[0]); }} />
        <label>HTTPS ბმული
          <input value={value.startsWith('https://') ? value : ''} placeholder="https://..." onChange={(event) => onChange(event.target.value)} />
        </label>
        {uploadError && <p className="section-builder-inline-error" role="alert">{uploadError}</p>}
      </div>
    </div>
  );
}

function BlockEditor({ blocks, assets, onChange, onUpload, onDelete, onDuplicate, allowPlacement = false, hideAddControl = false }: {
  blocks: WebsiteBlock[]; assets: WebsiteLayoutAsset[]; onChange: (blocks: WebsiteBlock[]) => void;
  onUpload: (file: File) => Promise<WebsiteLayoutAsset>;
  onDelete: (id: string) => void; onDuplicate: (id: string) => void;
  allowPlacement?: boolean;
  hideAddControl?: boolean;
}) {
  const [addType, setAddType] = useState<WebsiteBlockType>('heading');
  const update = (id: string, patch: Partial<WebsiteBlock>) => onChange(updateNestedBlock(blocks, id, (block) => ({ ...block, ...patch })));
  const move = (id: string, direction: -1 | 1) => onChange(moveNestedBlock(blocks, id, direction));
  const add = (childrenOf?: string) => {
    const block = createWebsiteBlock(addType);
    if (!childrenOf) { onChange([...blocks, block]); return; }
    onChange(updateNestedBlock(blocks, childrenOf, (parent) => ({ ...parent, children: [...(parent.children ?? []), block] })));
  };

  return <div>
    <Reorder.Group axis="y" values={blocks} onReorder={onChange} className="section-builder-block-list">
    {blocks.map((block, index) => (
      <Reorder.Item as="article" value={block} whileDrag={{ zIndex: 5, scale: 1.01, boxShadow: '0 12px 28px rgba(22, 49, 41, .14)' }} transition={{ type: 'spring', stiffness: 460, damping: 34 }} className={`section-builder-block${block.visible ? '' : ' is-hidden'}`} key={block.id}>
        <div className="section-builder-block-heading">
          <span className="section-builder-block-number">{String(index + 1).padStart(2, '0')}</span>
          <strong>{blockLabels[block.type]}</strong>
          <div className="section-builder-block-actions">
            <button type="button" aria-label="ზემოთ გადატანა" disabled={index === 0} onClick={() => move(block.id, -1)}><ArrowUp aria-hidden="true" /></button>
            <button type="button" aria-label="ქვემოთ გადატანა" disabled={index === blocks.length - 1} onClick={() => move(block.id, 1)}><ArrowDown aria-hidden="true" /></button>
            <button type="button" aria-label={block.visible ? 'ელემენტის დამალვა' : 'ელემენტის ჩვენება'} onClick={() => update(block.id, { visible: !block.visible })}>{block.visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}</button>
            <button type="button" aria-label="დუბლირება" onClick={() => onDuplicate(block.id)}><Copy aria-hidden="true" /></button>
            <button type="button" aria-label="წაშლა" onClick={() => onDelete(block.id)}><Trash2 aria-hidden="true" /></button>
          </div>
        </div>
        <details className="section-builder-block-inspector">
          <summary>ელემენტის შიგთავსი <ChevronDown aria-hidden="true" /></summary>
          <div className="section-builder-block-fields">
          {['title', 'text', 'label', 'value', 'alt'].map((key) => {
            if (key === 'title' && !['card', 'content-group', 'faq-item', 'call-to-action'].includes(block.type)) return null;
            if (key === 'text' && !['heading', 'subheading', 'paragraph', 'card', 'faq-item', 'testimonial', 'call-to-action'].includes(block.type)) return null;
            if (key === 'label' && !['button', 'statistic', 'logo', 'testimonial', 'call-to-action', 'gallery-item'].includes(block.type)) return null;
            if (key === 'value' && block.type !== 'statistic') return null;
            if (key === 'alt' && !['image', 'gallery-item'].includes(block.type)) return null;
            const label = key === 'text' && ['heading', 'subheading', 'paragraph'].includes(block.type) ? 'ტექსტი' : ({ title: 'სათაური', text: 'აღწერა', label: 'წარწერა', value: 'მნიშვნელობა', alt: 'სურათის აღწერა' } as Record<string, string>)[key];
            return <label key={key}>{label}<textarea rows={key === 'text' ? 3 : 1} value={block[key as keyof WebsiteBlock] as string ?? ''} onChange={(event) => update(block.id, { [key]: event.target.value })} /></label>;
          })}
          {['button', 'call-to-action'].includes(block.type) && <label>ბმული
            <input value={block.href ?? ''} placeholder="#contact ან https://..." onChange={(event) => update(block.id, { href: event.target.value })} />
          </label>}
          {allowPlacement && block.target && <label>განლაგება
            <select value={block.position ?? 'after'} onChange={(event) => update(block.id, { position: event.target.value as WebsiteBlock['position'] })}>
              <option value="before">მიზნობრივ ელემენტამდე</option><option value="after">მიზნობრივი ელემენტის შემდეგ</option><option value="replace">ჩაანაცვლოს native ელემენტი</option>
            </select>
          </label>}
          {['image', 'gallery-item', 'logo'].includes(block.type) && <ImageField value={block.src ?? ''} assets={assets} onChange={(src) => update(block.id, { src })} onUpload={async (file) => { const asset = await onUpload(file); update(block.id, { src: `asset:${asset.id}` }); }} />}
          {block.type === 'icon' && <label>ხატულა
            <select value={block.icon ?? 'sparkles'} onChange={(event) => update(block.id, { icon: event.target.value as WebsiteBlock['icon'] })}>
              {(['sparkles', 'palette', 'layers', 'check', 'arrow', 'star', 'quote', 'clock'] as const).map((icon) => <option key={icon} value={icon}>{iconLabels[icon]}</option>)}
            </select>
          </label>}
          {block.children && <div className="section-builder-nested">
          <div className="section-builder-nested-heading"><strong>შიდა ელემენტები</strong><label>ტიპი<select value={addType} onChange={(event) => setAddType(event.target.value as WebsiteBlockType)}>{WEBSITE_INSERTABLE_BLOCK_TYPES.map((type) => <option key={type} value={type}>{blockLabels[type]}</option>)}</select></label><button type="button" onClick={() => add(block.id)}><Plus aria-hidden="true" /> დამატება</button></div>
          <BlockEditor blocks={block.children} assets={assets} onChange={(children) => update(block.id, { children })} onUpload={onUpload} onDelete={onDelete} onDuplicate={onDuplicate} />
          </div>}
          </div>
        </details>
      </Reorder.Item>
    ))}
    </Reorder.Group>
    {blocks.length === 0 && <p className="section-builder-empty-blocks">ჯერ ელემენტები არ არის დამატებული.</p>}
    {!hideAddControl && <div className="section-builder-add-block-row"><label>ახალი ელემენტი<select value={addType} onChange={(event) => setAddType(event.target.value as WebsiteBlockType)}>{WEBSITE_INSERTABLE_BLOCK_TYPES.map((type) => <option key={type} value={type}>{blockLabels[type]}</option>)}</select></label><button type="button" className="section-builder-add-block" onClick={() => add()}><Plus aria-hidden="true" /> ელემენტის დამატება</button></div>}
  </div>;
}

export default function WebsiteSectionsManager({ onDirtyChange }: Props) {
  const [layout, setLayout] = useState<WebsiteLayoutConfig>();
  const [savedLayout, setSavedLayout] = useState<WebsiteLayoutConfig>();
  const [versions, setVersions] = useState<WebsiteLayoutVersion[]>([]);
  const [assets, setAssets] = useState<WebsiteLayoutAsset[]>([]);
  const [selectedId, setSelectedId] = useState('hero');
  const [view, setView] = useState<View>('sections');
  // A: edit texts directly on the page. B: form on the left, live page on the right.
  // "full" is the original builder (section order, extra blocks, history).
  const [mode, setMode] = useState<'a' | 'full'>('a');
  // Element changes (hidden items, labels, links, poster strip); saved with "გამოქვეყნება".
  const [elements, setElements] = useState<SiteElements>(EMPTY_SITE_ELEMENTS);
  const [savedElements, setSavedElements] = useState<SiteElements>(EMPTY_SITE_ELEMENTS);
  const [elementsUndo, setElementsUndo] = useState<SiteElements[]>([]);
  const [publishedElements, setPublishedElements] = useState<SiteElements>(EMPTY_SITE_ELEMENTS);
  const [elementsLive, setElementsLive] = useState(false);
  const [elementsRedo, setElementsRedo] = useState<SiteElements[]>([]);
  const [layoutRedo, setLayoutRedo] = useState<WebsiteLayoutConfig[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  // Which kind of change each undo/redo step reverts, newest last.
  const undoOrder = useRef<('layout' | 'elements')[]>([]);
  const redoOrder = useRef<('layout' | 'elements')[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [schemaReady, setSchemaReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [undoStack, setUndoStack] = useState<WebsiteLayoutConfig[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [pendingTemplateIndex, setPendingTemplateIndex] = useState<number | null>(null);
  const [nativeAddTypes, setNativeAddTypes] = useState<Record<string, WebsiteBlockType>>({});
  const [nativeAddPositions, setNativeAddPositions] = useState<Record<string, WebsiteBlock['position']>>({});
  const inlineUndoStart = useRef<WebsiteLayoutConfig | null>(null);
  const inlineLatestLayout = useRef<WebsiteLayoutConfig | null>(null);
  const templateDialogRef = useRef<HTMLElement>(null);
  const templateTriggerRef = useRef<HTMLButtonElement>(null);
  const advancedSettingsRef = useRef<HTMLDetailsElement>(null);

  // "Unsaved" = not yet in the saved draft. "Unpublished" = the saved draft differs from the live site.
  const layoutDirty = Boolean(layout && savedLayout && hasDirtyChanges(layout, savedLayout));
  const elementsDirty = !siteElementsEqual(elements, savedElements);
  const dirty = layoutDirty || elementsDirty;
  const publishedLayout = useMemo(() => versions.find((version) => version.status === 'published')?.config ?? DEFAULT_WEBSITE_LAYOUT, [versions]);
  const layoutUnpublished = Boolean(savedLayout && hasDirtyChanges(savedLayout, publishedLayout));
  const elementsUnpublished = !siteElementsEqual(savedElements, elementsLive ? publishedElements : EMPTY_SITE_ELEMENTS);
  const unpublished = layoutUnpublished || elementsUnpublished;

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    // The working copy is the saved draft if there is one, otherwise what's published.
    void supabase.from('site_content').select('content_key, content, is_published')
      .in('content_key', [SITE_ELEMENTS_KEY, SITE_ELEMENTS_DRAFT_KEY]).eq('locale', SITE_ELEMENTS_LOCALE)
      .then(({ data }) => {
        if (!active) return;
        const rows = (data ?? []) as { content_key: string; content: unknown; is_published: boolean }[];
        const live = rows.find((row) => row.content_key === SITE_ELEMENTS_KEY);
        const draft = rows.find((row) => row.content_key === SITE_ELEMENTS_DRAFT_KEY);
        const published = live ? normalizeSiteElements(live.content) : EMPTY_SITE_ELEMENTS;
        const working = draft ? normalizeSiteElements(draft.content) : published;
        setPublishedElements(published);
        setElementsLive(Boolean(live?.is_published));
        setElements(working);
        setSavedElements(working);
      });
    return () => { active = false; };
  }, []);

  const changeElements = (next: SiteElements, options: { live?: boolean; before?: SiteElements } = {}) => {
    if (!options.live) {
      const before = options.before ?? elements;
      setElementsUndo((stack) => [...stack.slice(-49), before]);
      undoOrder.current = [...undoOrder.current.slice(-99), 'elements'];
      setElementsRedo([]); setLayoutRedo([]); redoOrder.current = [];
    }
    setElements(next);
  };

  /** Writes the working copy as the draft (layout draft + element draft). Not visible on the site. */
  const saveWorkingDraft = useCallback(async (quiet: boolean) => {
    if (!supabase || !layout) return false;
    if (layoutDirty && !validateWebsiteLayout(layout)) { if (!quiet) setError('შენახვამდე გადაამოწმეთ სავალდებულო ველები და ბმულები.'); return false; }
    setSaveState('saving');
    try {
      if (layoutDirty && schemaReady) { await saveWebsiteLayoutDraft(layout); setSavedLayout(layout); }
      if (elementsDirty) {
        const { error: saveError } = await supabase.from('site_content').upsert(
          { content_key: SITE_ELEMENTS_DRAFT_KEY, locale: SITE_ELEMENTS_LOCALE, content: elements, is_published: false, display_order: 0 },
          { onConflict: 'content_key,locale' },
        );
        if (saveError) throw saveError;
        setSavedElements(elements);
      }
      setSaveState('saved');
      if (!quiet) adminToast('მონახაზი შენახულია. საიტზე ჯერ არ ჩანს.', 'success');
      return true;
    } catch (failure) {
      setSaveState('error');
      if (!quiet) setError(errorText(failure));
      return false;
    }
  }, [elements, elementsDirty, layout, layoutDirty, schemaReady]);

  // Autosave: every change is kept as a draft a moment after you stop, so a refresh loses nothing.
  useEffect(() => {
    if (!dirty || busy || mode !== 'a') return;
    const timer = window.setTimeout(() => { void saveWorkingDraft(true); }, 2500);
    return () => window.clearTimeout(timer);
  }, [busy, dirty, mode, saveWorkingDraft]);
  const orderedSections = useMemo(() => layout ? sortWebsiteSections(layout).filter((section) => !isRetiredNativeSection(section)) : [], [layout]);
  const selected = orderedSections.find((section) => section.id === selectedId) ?? orderedSections[0];
  const nativeDefinitions = selected?.kind === 'native' && selected.sectionKey
    ? getNativeElementDefinitions(selected.sectionKey)
    : [];
  const imageUrls = useMemo(() => Object.fromEntries(assets.flatMap((asset) => asset.previewUrl ? [[asset.id, asset.previewUrl]] : [])), [assets]);

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!showTemplates) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = templateDialogRef.current;
    const focusable = (): HTMLElement[] => {
      if (!dialog) return [];
      return Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
    };
    focusable()[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setShowTemplates(false); return; }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [showTemplates]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const refresh = useCallback(async () => {
    const result = await loadWebsiteLayoutManager();
    setVersions(result.versions);
    setAssets(result.assets);
    setSchemaReady(true);
    const config = resolveWebsiteLayoutManagerConfig(result.versions);
    setLayout(config);
    setSavedLayout(config);
    setSelectedId((current) => config.sections.some((item) => item.id === current) ? current : config.sections[0].id);
    setError('');
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadWebsiteLayoutManager().then((result) => {
      if (!active) return;
      setVersions(result.versions);
      setAssets(result.assets);
      setSchemaReady(true);
      const initial = resolveWebsiteLayoutManagerConfig(result.versions);
      setLayout(initial);
      setSavedLayout(initial);
      setSelectedId(initial.sections[0]?.id ?? 'hero');
    }).catch((failure: unknown) => {
      if (!active) return;
      const missingSchema = failure instanceof Error && failure.message === 'website_schema_missing';
      setSchemaReady(false);
      setError(missingSchema ? '' : errorText(failure));
      setLayout(DEFAULT_WEBSITE_LAYOUT);
      setSavedLayout(DEFAULT_WEBSITE_LAYOUT);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!schemaReady) return;
    let active = true;
    const refreshAssetLinks = () => {
      if (document.visibilityState !== 'visible') return;
      void loadWebsiteLayoutManager().then((result) => { if (active) setAssets(result.assets); }).catch(() => undefined);
    };
    const timer = window.setInterval(refreshAssetLinks, 8 * 60 * 1000);
    document.addEventListener('visibilitychange', refreshAssetLinks);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', refreshAssetLinks); };
  }, [schemaReady]);

  const changeLayout = (next: WebsiteLayoutConfig) => {
    setUndoStack((stack) => pushWebsiteLayoutUndo(stack, layout ?? next));
    undoOrder.current = [...undoOrder.current.slice(-99), 'layout'];
    setElementsRedo([]); setLayoutRedo([]); redoOrder.current = [];
    setLayout(next);
    setError('');
  };

  const updateSection = (id: string, update: (section: WebsiteSection) => WebsiteSection) => {
    if (!layout) return;
    changeLayout({ ...layout, sections: layout.sections.map((section) => section.id === id ? update(section) : section) });
  };

  const setNativeVisibility = (sectionId: string, slotId: string, visible: boolean) => updateSection(sectionId, (section) =>
    setNativeElementVisibility(section, slotId, visible, createStableId('native-hidden')));

  const updateNativeSlotBlocks = (sectionId: string, slotId: string, blocks: WebsiteBlock[]) => updateSection(sectionId, (section) => ({
    ...section,
    elements: [
      ...section.elements.filter((item) => item.target !== slotId || item.type === 'native-visibility'),
      ...blocks.map((block) => ({ ...block, target: slotId, position: block.position ?? 'after' })),
    ],
  }));

  const addNativeSlotBlock = (sectionId: string, slotId: string, type: WebsiteBlockType, position: WebsiteBlock['position']) => {
    const block = createWebsiteBlock(type);
    updateSection(sectionId, (section) => insertNativeElement(section, slotId, block, position ?? 'after'));
  };

  const updateSectionsOrder = (sections: WebsiteSection[]) => {
    if (!layout) return;
    const byId = new Map(sections.map((section) => [section.id, section]));
    // The builder lists only editable sections; retired placeholders stay at the end.
    const editable = sections.filter((section) => !isRetiredNativeSection(section));
    const retired = sortWebsiteSections(layout).filter(isRetiredNativeSection);
    const reordered = editable.length + retired.length === layout.sections.length
      ? [...editable, ...retired]
      : sortWebsiteSections(layout).map((section) => byId.get(section.id) ?? section);
    changeLayout({ ...layout, sections: normalizeWebsiteSectionOrder(reordered) });
  };

  const saveDraft = async () => {
    if (!layout || !validateWebsiteLayout(layout)) { setError('შენახვამდე შეავსეთ სავალდებულო ველები და გაასწორეთ ბმულები.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await saveWebsiteLayoutDraft(layout);
      setSavedLayout(layout);
      setUndoStack([]);
      setNotice('მონახაზი წარმატებით შეინახა. საჯარო საიტი უცვლელია.');
      await refresh();
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  };

  /** Publishes the working copy: section texts/order (as a new layout version) and element changes. */
  const publish = async () => {
    if (!layout || !validateWebsiteLayout(layout)) { setError('გამოქვეყნებამდე გადაამოწმეთ სავალდებულო ველები და ბმულები.'); return; }
    if (!await adminConfirm({ title: 'საიტზე გამოქვეყნება', message: 'ცვლილებები მაშინვე გამოჩნდება საჯარო საიტზე. წინა ვერსია ისტორიაში შეინახება.', confirmLabel: 'გამოქვეყნება' })) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (!supabase) throw new Error('not_configured');
      if (schemaReady && hasDirtyChanges(layout, publishedLayout)) {
        const draft = await saveWebsiteLayoutDraft(layout);
        await publishWebsiteLayoutDraft(draft.id);
        setSavedLayout(layout);
      }
      for (const [key, live] of [[SITE_ELEMENTS_KEY, true], [SITE_ELEMENTS_DRAFT_KEY, false]] as const) {
        const { error: saveError } = await supabase.from('site_content').upsert(
          { content_key: key, locale: SITE_ELEMENTS_LOCALE, content: elements, is_published: live, display_order: 0 },
          { onConflict: 'content_key,locale' },
        );
        if (saveError) throw saveError;
      }
      setSavedElements(elements);
      setPublishedElements(elements);
      setElementsLive(true);
      setSaveState('saved');
      setNotice('ცვლილებები გამოქვეყნდა ვებსაიტზე.');
      if (schemaReady) await refresh();
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  };

  /** Takes element/style changes off the live site (it shows the original design); the draft stays. */
  const unpublish = async () => {
    if (!supabase || !elementsLive) return;
    if (!await adminConfirm({
      title: 'გამოქვეყნების მოხსნა',
      message: 'საიტზე დამალვები, სტილები, ბმულები და ზოლის ცვლილებები მოიხსნება — საიტი თავდაპირველ დიზაინს აჩვენებს. თქვენი მონახაზი შენარჩუნდება და შეგიძლიათ ხელახლა გამოაქვეყნოთ.',
      confirmLabel: 'მოხსნა', tone: 'danger',
    })) return;
    setBusy(true);
    const { error: saveError } = await supabase.from('site_content').update({ is_published: false })
      .eq('content_key', SITE_ELEMENTS_KEY).eq('locale', SITE_ELEMENTS_LOCALE);
    setBusy(false);
    if (saveError) { setError(errorText(saveError)); return; }
    setElementsLive(false);
    adminToast('ელემენტების ცვლილებები საიტიდან მოიხსნა.', 'success');
  };

  /** Back to what is live now (undoable); the draft is then overwritten by autosave. */
  const cancel = async () => {
    if (!unpublished && !dirty) return;
    if (!await adminConfirm({ title: 'გამოუქვეყნებელი ცვლილებების გაუქმება', message: 'რედაქტორი დაბრუნდება იმ მდგომარეობაზე, რაც ახლა საიტზე ჩანს. „უკან“ ღილაკით შეგიძლიათ დაბრუნება.', confirmLabel: 'გაუქმება', cancelLabel: 'დატოვება', tone: 'danger' })) return;
    changeLayout(publishedLayout);
    changeElements(elementsLive ? publishedElements : EMPTY_SITE_ELEMENTS);
    setError(''); setNotice('');
  };

  /** Opens the draft in a new tab, exactly as visitors would see it after publishing. */
  const openPreview = async () => {
    if (dirty && !await saveWorkingDraft(true)) { setError('მონახაზი ვერ შეინახა, ამიტომ ნახვა ვერ გაიხსნა.'); return; }
    window.open('/?preview=draft', '_blank', 'noopener');
  };

  /** Main artwork: upload replaces it (as a website asset); null goes back to the original. */
  const changeHeroImage = async (file: File | null) => {
    if (!layout) return;
    if (!file) { updateSection('hero', (section) => ({ ...section, copy: { ...section.copy, heroImageSrc: '' } })); return; }
    try {
      const asset = await uploadAsset(file);
      updateSection('hero', (section) => ({ ...section, copy: { ...section.copy, heroImageSrc: `asset:${asset.id}` } }));
    } catch (failure) {
      adminToast(errorText(failure), 'error');
    }
  };

  const undo = () => {
    // Revert the newest change, whether it was to section copy/layout or to an element.
    const kind = undoOrder.current.at(-1) ?? (elementsUndo.length && !undoStack.length ? 'elements' : 'layout');
    undoOrder.current = undoOrder.current.slice(0, -1);
    if (kind === 'elements') {
      const previousElements = elementsUndo.at(-1);
      if (!previousElements) return;
      setElementsRedo((stack) => [...stack, elements]);
      redoOrder.current = [...redoOrder.current, 'elements'];
      setElements(previousElements);
      setElementsUndo(elementsUndo.slice(0, -1));
      return;
    }
    const previous = popWebsiteLayoutUndo(undoStack);
    if (!previous || !layout) return;
    setLayoutRedo((stack) => [...stack, layout]);
    redoOrder.current = [...redoOrder.current, 'layout'];
    setUndoStack(previous.history);
    setLayout(previous.layout);
  };

  const redo = () => {
    const kind = redoOrder.current.at(-1);
    if (!kind) return;
    redoOrder.current = redoOrder.current.slice(0, -1);
    if (kind === 'elements') {
      const next = elementsRedo.at(-1);
      if (!next) return;
      setElementsUndo((stack) => [...stack.slice(-49), elements]);
      undoOrder.current = [...undoOrder.current, 'elements'];
      setElements(next);
      setElementsRedo(elementsRedo.slice(0, -1));
      return;
    }
    const next = layoutRedo.at(-1);
    if (!next || !layout) return;
    setUndoStack((stack) => pushWebsiteLayoutUndo(stack, layout));
    undoOrder.current = [...undoOrder.current, 'layout'];
    setLayout(next);
    setLayoutRedo(layoutRedo.slice(0, -1));
  };

  const restore = async (version: WebsiteLayoutVersion) => {
    if (!version.published_at || version.status !== 'archived') return;
    if (!window.confirm(`ვერსია v${version.version} პირდაპირ გამოქვეყნდეს? მიმდინარე ვერსია ისტორიაში დარჩება.`)) return;
    setBusy(true); setError('');
    try {
      await restoreWebsiteLayout(version.id); await refresh(); setUndoStack([]);
      setNotice(`v${version.version} ვერსია აღდგა და გამოქვეყნდა.`);
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  };

  const addTemplate = (templateId: WebsiteTemplateId) => {
    if (!layout || layout.sections.length >= 30) { setError('მაქსიმუმ 30 სექციის დამატებაა შესაძლებელი.'); return; }
    const index = pendingTemplateIndex ?? sortWebsiteSections(layout).length;
    const template = createTemplateSection(templateId, index);
    changeLayout(insertCanvasSection(layout, template, index));
    setSelectedId(template.id); setShowTemplates(false); setPendingTemplateIndex(null); setView('sections');
  };

  const openTemplatePicker = (sectionId?: string, placement?: 'before' | 'after') => {
    if (!layout || !sectionId || !placement) {
      setPendingTemplateIndex(null);
    } else {
      const index = sortWebsiteSections(layout).findIndex((section) => section.id === sectionId);
      setPendingTemplateIndex(index < 0 ? null : index + (placement === 'after' ? 1 : 0));
    }
    setShowTemplates(true);
  };

  const duplicateCanvasSection = (sectionId: string) => {
    if (!layout) return;
    const section = layout.sections.find((item) => item.id === sectionId);
    if (!section || section.kind !== 'template') return;
    const ordered = sortWebsiteSections(layout);
    const clone = cloneSection(section, ordered.findIndex((item) => item.id === sectionId) + 1);
    changeLayout(insertCanvasSection(layout, clone, clone.order));
    setSelectedId(clone.id);
    setNotice(`სექცია „${section.label}“ დუბლირდა მონახაზში.`);
  };

  const editCanvasSection = (sectionId: string) => {
    setSelectedId(sectionId);
    setView('sections');
    if (advancedSettingsRef.current) advancedSettingsRef.current.open = true;
  };

  const uploadAsset = async (file: File) => {
    const asset = await uploadWebsiteLayoutAsset(file, file.name);
    setAssets((current) => [asset, ...current]);
    return asset;
  };

  const removeSection = (section: WebsiteSection) => {
    if (!layout || section.kind !== 'template') return;
    if (!window.confirm(`სექცია „${section.label}“ მონახაზიდან წაიშლება. ატვირთული მედია ავტომატურად არ წაიშლება. გაგრძელდეს?`)) return;
    const nextSections = normalizeWebsiteSectionOrder(layout.sections.filter((item) => item.id !== section.id));
    changeLayout({ ...layout, sections: nextSections });
    setSelectedId(nextSections[0]?.id ?? 'hero');
  };

  const beginInlineEdit = () => {
    inlineUndoStart.current = layout ?? null;
    inlineLatestLayout.current = layout ?? null;
  };

  const applyInlineEdit = (next: WebsiteLayoutConfig) => {
    inlineLatestLayout.current = next;
    setLayout(next);
    setError('');
  };

  const finishInlineEdit = () => {
    const before = inlineUndoStart.current;
    const after = inlineLatestLayout.current;
    if (before && after && hasDirtyChanges(before, after)) {
      setUndoStack((stack) => pushWebsiteLayoutUndo(stack, before));
      undoOrder.current = [...undoOrder.current.slice(-99), 'layout'];
    }
    inlineUndoStart.current = null;
    inlineLatestLayout.current = null;
  };

  const cancelInlineEdit = () => {
    if (inlineUndoStart.current) setLayout(inlineUndoStart.current);
    inlineUndoStart.current = null;
    inlineLatestLayout.current = null;
  };

  if (loading || !layout) return <section className="section-builder-page"><div className="section-builder-loading"><LoaderCircle className="admin-spin" aria-hidden="true" />საიტის სექციები იტვირთება...</div></section>;

  const updateCopy = (sectionId: string, key: string, value: string) =>
    updateSection(sectionId, (section) => ({ ...section, copy: { ...section.copy, [key]: value } }));

  const isVisual = mode === 'full';
  const canvasProps = {
    layout, imageUrls, selectedSectionId: selectedId, dirty,
    onChange: changeLayout,
    onInlineStart: beginInlineEdit, onInlineChange: applyInlineEdit, onInlineFinish: finishInlineEdit, onInlineCancel: cancelInlineEdit,
    onSelectSection: setSelectedId, onAddSection: openTemplatePicker, onEditSection: editCanvasSection, onDuplicateSection: duplicateCanvasSection,
  };

  return <section className={`section-builder-page is-mode-${mode}`} aria-labelledby="section-builder-title">
    <div className="section-builder-header ve-header">
      <div>
        <span className="ve-kicker">ვიზუალური რედაქტორი</span>
        <h1 id="section-builder-title">საიტის რედაქტორი</h1>
        <p>{mode === 'a'
          ? 'მიიტანეთ მაუსი და დააჭირეთ ნებისმიერ ნაწილს — ტექსტს, სურათს, ღილაკს, სექციას. ცვლილებები ავტომატურად ინახება მონახაზად; საიტზე ჩანს „გამოქვეყნების“ შემდეგ.'
          : 'სრული რედაქტორი: სექციების რიგი, დამატებითი ბლოკები და ვერსიების ისტორია.'}</p>
      </div>
      <div className="section-builder-actions ve-actions">
        <div className="ve-history" role="group" aria-label="ისტორია">
          <button type="button" onClick={undo} disabled={!undoStack.length && !elementsUndo.length} title="უკან (Ctrl+Z)" aria-label="უკან"><Undo2 aria-hidden="true" /></button>
          <button type="button" onClick={redo} disabled={!layoutRedo.length && !elementsRedo.length} title="წინ (Ctrl+Shift+Z)" aria-label="წინ"><Redo2 aria-hidden="true" /></button>
        </div>
        <span className={`ve-status is-${dirty ? (saveState === 'saving' ? 'saving' : 'dirty') : unpublished ? 'draft' : 'live'}`} role="status">
          <i />{dirty ? (saveState === 'saving' ? 'ინახება…' : 'შეუნახავი') : unpublished ? 'მონახაზი შენახულია · გამოუქვეყნებელი' : 'საიტზე გამოქვეყნებულია'}
        </span>
        {isVisual && <button className="section-builder-secondary-button" type="button" onClick={() => { void saveDraft(); }} disabled={!schemaReady || !dirty || busy}><Save aria-hidden="true" /> მონახაზად შენახვა</button>}
        {!isVisual && <button className="section-builder-quiet-button" type="button" onClick={() => { void openPreview(); }}><ExternalLink aria-hidden="true" /> ნახვა</button>}
        <button className="section-builder-publish-button" type="button" onClick={() => { void publish(); }} disabled={busy || (!dirty && !unpublished)}>{busy ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : <Check aria-hidden="true" />} გამოქვეყნება</button>
      </div>
    </div>
    {!isVisual && (unpublished || elementsLive) && (
      <div className="ve-secondary-actions">
        {unpublished && <button type="button" onClick={() => { void cancel(); }}>გამოუქვეყნებელი ცვლილებების გაუქმება</button>}
        {elementsLive && <button type="button" onClick={() => { void unpublish(); }}>ელემენტების ცვლილებების მოხსნა საიტიდან</button>}
      </div>
    )}

    {!schemaReady && <div className="section-builder-migration-note" role="status"><CircleAlert aria-hidden="true" /><span>{errorLabels.website_schema_missing}</span></div>}
    {error && <div className="section-builder-error" role="alert"><CircleAlert aria-hidden="true" />{error}</div>}
    {notice && <div className="section-builder-notice" role="status"><Check aria-hidden="true" />{notice}<button type="button" aria-label="შეტყობინების დახურვა" onClick={() => setNotice('')}><X aria-hidden="true" /></button></div>}

    <div className="section-builder-toolbar">
      <button type="button" className={`editor-full-link${isVisual ? ' is-active' : ''}`} onClick={() => { setMode(isVisual ? 'a' : 'full'); setView('sections'); }}>
        {isVisual ? '← მარტივ რედაქტორზე დაბრუნება' : 'სრული რედაქტორი'}
      </button>
      {isVisual && <div className="section-builder-tabs" role="tablist" aria-label="სექციების მართვა">
        <button type="button" role="tab" aria-selected={view === 'sections'} className={view === 'sections' ? 'is-active' : ''} onClick={() => setView('sections')}>სტრუქტურა</button>
        <button type="button" role="tab" aria-selected={view === 'history'} className={view === 'history' ? 'is-active' : ''} onClick={() => setView('history')}><Clock3 aria-hidden="true" /> ისტორია</button>
      </div>}
    </div>

    {mode === 'a' ? <CanvasWebsiteEditor
        variant="inline"
        {...canvasProps}
        elements={elements}
        onElementsChange={changeElements}
        onCopyChange={updateCopy}
        onHeroImage={changeHeroImage}
        onCommand={(command) => {
          if (command === 'undo') undo();
          else if (command === 'redo') redo();
          else void saveWorkingDraft(false);
        }}
      />
      : view === 'history' ? <div className="section-builder-history">
      <div className="section-builder-history-heading"><div><h2>ვერსიების ისტორია</h2><p>წინა გამოქვეყნებული განლაგების აღდგენა შესაძლებელია ახალი გამოქვეყნებული ვერსიის შექმნით.</p></div></div>
      {versions.length === 0 ? <div className="section-builder-empty"><Clock3 aria-hidden="true" /><strong>ისტორია ჯერ ცარიელია</strong><span>შენახული და გამოქვეყნებული ვერსიები აქ გამოჩნდება.</span></div> : versions.map((version) => (
        <article className="section-builder-version" key={version.id}>
          <span className={`section-builder-version-dot is-${version.status}`} />
          <div><strong>ვერსია {new Intl.NumberFormat('ka-GE').format(version.version)}</strong><small>{version.status === 'published' ? 'გამოქვეყნებული' : version.status === 'draft' ? 'მონახაზი' : 'ისტორიული ვერსია'} · {new Intl.DateTimeFormat('ka-GE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(version.updated_at))}</small></div>
          {version.status === 'archived' && version.published_at && <button type="button" className="section-builder-secondary-button" disabled={busy} onClick={() => { void restore(version); }}><RotateCcw aria-hidden="true" /> აღდგენა</button>}
          {version.status === 'published' && <span className="section-builder-current-version">მიმდინარე</span>}
        </article>
      ))}
    </div> : <>
    <CanvasWebsiteEditor {...canvasProps} />
    <details ref={advancedSettingsRef} className="canvas-editor-advanced">
      <summary>გაფართოებული სტრუქტურის პარამეტრები</summary>
      <div className="section-builder-workspace">
      <aside className="section-builder-structure">
        <div className="section-builder-panel-heading"><div><h2>მთავარი გვერდი</h2><span>{layout.sections.length} სექცია</span></div><button ref={templateTriggerRef} type="button" aria-label="ახალი სექციის დამატება" title="ახალი სექციის დამატება" onClick={() => setShowTemplates(true)}><Plus aria-hidden="true" /></button></div>
        <Reorder.Group axis="y" values={orderedSections} onReorder={updateSectionsOrder} className="section-builder-reorder-list">
          {orderedSections.map((section) => <Reorder.Item key={section.id} value={section} className={`section-builder-row${selected?.id === section.id ? ' is-selected' : ''}`}>
            <span className="section-builder-grip" aria-hidden="true"><GripVertical /></span>
            <button className="section-builder-row-main" type="button" onClick={() => setSelectedId(section.id)} aria-current={selected?.id === section.id ? 'true' : undefined}>
              <span className="section-builder-row-icon"><LayoutTemplate aria-hidden="true" /></span>
              <span className="section-builder-row-copy"><strong>{section.label}</strong><small>{section.kind === 'native' ? 'საიტის სექცია' : WEBSITE_TEMPLATES.find((item) => item.id === section.templateId)?.label}</small></span>
            </button>
            <button className="section-builder-visibility" type="button" onClick={() => updateSection(section.id, (item) => ({ ...item, visible: !item.visible }))} aria-label={section.visible ? 'სექციის დამალვა' : 'სექციის ჩვენება'} title={section.visible ? 'დამალვა' : 'ჩვენება'}>
              {section.visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
            </button>
          </Reorder.Item>)}
        </Reorder.Group>
        <button type="button" className="section-builder-add-section" onClick={() => setShowTemplates(true)}><Plus aria-hidden="true" /> ახალი სექციის დამატება</button>
        <p className="section-builder-hint">გადაადგილებისთვის გამოიყენეთ მარცხენა სახელური. კლავიატურით რიგის შესაცვლელად გახსენით სექციის პარამეტრები.</p>
      </aside>

      <div className="section-builder-editor">
        {selected && <>
          <div className="section-builder-editor-heading"><div><span>{selected.kind === 'native' ? 'საიტის სექცია' : 'შაბლონი'}</span><h2>{selected.label}</h2></div><div className="section-builder-editor-actions">
            <button type="button" aria-label="ზემოთ გადატანა" title="ზემოთ" disabled={selected.order === 0} onClick={() => updateSectionsOrder(normalizeWebsiteSectionOrder(moveItemById(orderedSections, selected.id, -1)))}><ArrowUp aria-hidden="true" /></button>
            <button type="button" aria-label="ქვემოთ გადატანა" title="ქვემოთ" disabled={selected.order === orderedSections.length - 1} onClick={() => updateSectionsOrder(normalizeWebsiteSectionOrder(moveItemById(orderedSections, selected.id, 1)))}><ArrowDown aria-hidden="true" /></button>
            {selected.kind === 'template' && <><button type="button" aria-label="სექციის დუბლირება" title="დუბლირება" onClick={() => { if (!layout) return; const clone = cloneSection(selected, layout.sections.length); changeLayout({ ...layout, sections: normalizeWebsiteSectionOrder([...layout.sections, clone]) }); setSelectedId(clone.id); }}><Copy aria-hidden="true" /></button><button type="button" aria-label="სექციის წაშლა" title="წაშლა" onClick={() => removeSection(selected)}><Trash2 aria-hidden="true" /></button></>}
          </div></div>
          <label className="section-builder-field">სექციის სახელი<input value={selected.label} maxLength={120} onChange={(event) => updateSection(selected.id, (section) => ({ ...section, label: event.target.value }))} /></label>
          <div className="section-builder-toggle-row"><div><strong>საჯარო გვერდზე გამოჩენა</strong><span>გამორთვისას სექცია და მისთვის გამოყოფილი სივრცე ქრება.</span></div><button type="button" className={`section-builder-toggle${selected.visible ? ' is-on' : ''}`} role="switch" aria-checked={selected.visible} onClick={() => updateSection(selected.id, (section) => ({ ...section, visible: !section.visible }))}><i /></button></div>
          <div className="section-builder-toggle-row"><div><strong>ნავიგაციაში გამოჩენა</strong><span>{selected.kind === 'template' && selected.appearance.responsive !== 'all' ? 'მოწყობილობაზე დამალული სექცია ნავიგაციაში ვერ გამოჩნდება.' : 'გამორთვისას სექციაზე ბმული მენიუში აღარ გამოჩნდება.'}</span></div><button type="button" className={`section-builder-toggle${selected.inNavigation ? ' is-on' : ''}`} role="switch" aria-checked={selected.inNavigation} disabled={selected.kind === 'template' && selected.appearance.responsive !== 'all'} onClick={() => updateSection(selected.id, (section) => ({ ...section, inNavigation: !section.inNavigation }))}><i /></button></div>
          {selected.kind === 'template' && <label className="section-builder-field">ნავიგაციის ID<input value={selected.anchorId} pattern="[A-Za-z][A-Za-z0-9-]+" onChange={(event) => updateSection(selected.id, (section) => ({ ...section, anchorId: event.target.value }))} /></label>}

          <details className="section-builder-accordion" open><summary><span><ChevronDown aria-hidden="true" /> ტექსტი და ელემენტები</span><small>{selected.kind === 'native' ? 'არსებული კომპონენტის რედაქტირება' : 'შაბლონის შიდა კონტენტი'}</small></summary>
            {selected.kind === 'native' && <div className="section-builder-native-elements">
              <div className="section-builder-native-elements-heading"><div><strong>სექციის შიდა ელემენტები</strong><span>ხილვადობა და ჩასმის ადგილი ცალკე იმართება.</span></div><span>{nativeDefinitions.length} ელემენტი</span></div>
              {nativeDefinitions.map((definition) => {
                const visible = isNativeElementVisible(selected, definition.id);
                const slotBlocks = nativeSectionBlockIds(selected, definition.id);
                const addType = nativeAddTypes[definition.id] ?? definition.allowedInsertions[0];
                const addPosition = nativeAddPositions[definition.id] ?? 'after';
                return <details className="section-builder-native-element" key={definition.id}>
                  <summary><span className="section-builder-native-element-name"><strong>{definition.label}</strong><small>{definition.description}</small></span><ChevronDown aria-hidden="true" /></summary>
                  <div className="section-builder-native-element-body">
                    <div className="section-builder-toggle-row"><div><strong>{visible ? 'ნატიური ელემენტი ჩანს' : 'ნატიური ელემენტი დამალულია'}</strong><span>{definition.canHide ? 'დამალვა შინაარსს ინარჩუნებს და ნებისმიერ დროს შეიძლება აღდგეს.' : 'ეს ფუნქციური ნაწილი დაცულია შემთხვევითი წაშლისგან.'}</span></div><button type="button" className={`section-builder-toggle${visible ? ' is-on' : ''}`} role="switch" aria-checked={visible} disabled={!definition.canHide} onClick={() => setNativeVisibility(selected.id, definition.id, !visible)}><i /></button></div>
                    {definition.copyKeys.length > 0 && <p className="section-builder-native-copy-hint">ტექსტი ქვემოთ მოცემული ველებიდან იცვლება.</p>}
                    {definition.allowedInsertions.length > 0 && <>
                      <div className="section-builder-native-insert-row"><label>ელემენტის ტიპი<select value={addType} onChange={(event) => setNativeAddTypes((current) => ({ ...current, [definition.id]: event.target.value as WebsiteBlockType }))}>{definition.allowedInsertions.map((type) => <option key={type} value={type}>{blockLabels[type]}</option>)}</select></label><label>ჩასმის ადგილი<select value={addPosition} onChange={(event) => setNativeAddPositions((current) => ({ ...current, [definition.id]: event.target.value as WebsiteBlock['position'] }))}><option value="before">არსებულამდე</option><option value="after">არსებულის შემდეგ</option><option value="replace">ჩანაცვლება</option></select></label><button type="button" className="section-builder-add-block" onClick={() => addNativeSlotBlock(selected.id, definition.id, addType, addPosition)}><Plus aria-hidden="true" /> ელემენტის დამატება</button></div>
                      <BlockEditor blocks={slotBlocks} assets={assets} allowPlacement hideAddControl onChange={(blocks) => updateNativeSlotBlocks(selected.id, definition.id, blocks)} onUpload={uploadAsset} onDelete={(id) => { if (!window.confirm('ჩასმული ელემენტი მოიხსნება მონახაზიდან. გაგრძელდეს?')) return; updateNativeSlotBlocks(selected.id, definition.id, removeNestedBlock(slotBlocks, id)); }} onDuplicate={(id) => updateNativeSlotBlocks(selected.id, definition.id, duplicateNestedBlock(slotBlocks, id))} />
                    </>}
                  </div>
                </details>;
              })}
            </div>}
            {selected.kind === 'native' && <div className="section-builder-copy-fields">{(Object.entries(selected.copy) as Array<[string, string]>).map(([key, value]) => <details className="section-builder-copy-item" key={key}>
              <summary><strong>{copyLabels[key] ?? key}</strong><small>{value || 'ცარიელი ველი'}</small><ChevronDown aria-hidden="true" /></summary>
              <div className="section-builder-copy-editor">
                {key === 'heroImageSrc' ? <ImageField value={value} assets={assets} onChange={(heroImageSrc) => updateSection(selected.id, (section) => ({ ...section, copy: { ...section.copy, heroImageSrc } }))} onUpload={async (file) => { const asset = await uploadAsset(file); updateSection(selected.id, (section) => ({ ...section, copy: { ...section.copy, heroImageSrc: `asset:${asset.id}` } })); }} /> : ['skillOneLevel', 'skillTwoLevel'].includes(key) ? <input type="number" min="1" max="100" step="1" value={value} aria-label={copyLabels[key] ?? key} onChange={(event) => updateSection(selected.id, (section) => ({ ...section, copy: { ...section.copy, [key]: event.target.value } }))} /> : ['statsExperienceValue', 'statsProjectsValue', 'statsSuccessValue'].includes(key) ? <input type="text" inputMode="numeric" pattern="[0-9]{1,4}([+%])?" maxLength={5} value={value} aria-label={copyLabels[key] ?? key} onChange={(event) => updateSection(selected.id, (section) => ({ ...section, copy: { ...section.copy, [key]: event.target.value } }))} /> : ['contactEmail', 'whatsappNumber'].includes(key) ? <input type={key === 'contactEmail' ? 'email' : 'tel'} inputMode={key === 'contactEmail' ? 'email' : 'numeric'} maxLength={key === 'contactEmail' ? 254 : 15} value={value} aria-label={copyLabels[key] ?? key} onChange={(event) => updateSection(selected.id, (section) => ({ ...section, copy: { ...section.copy, [key]: key === 'whatsappNumber' ? event.target.value.split('').filter((character) => character >= '0' && character <= '9').join('') : event.target.value } }))} /> : <textarea rows={value.length > 100 ? 4 : 2} value={value} maxLength={3000} aria-label={copyLabels[key] ?? key} onChange={(event) => updateSection(selected.id, (section) => ({ ...section, copy: { ...section.copy, [key]: event.target.value } }))} />}
              </div>
            </details>)}</div>}
            <BlockEditor blocks={selected.elements.filter((block) => !block.target && block.type !== 'native-visibility')} assets={assets} onChange={(elements) => updateSection(selected.id, (section) => ({ ...section, elements: [...section.elements.filter((block) => Boolean(block.target) || block.type === 'native-visibility'), ...elements] }))} onUpload={uploadAsset} onDelete={(id) => { if (!window.confirm('ელემენტი წაიშლება მონახაზიდან. გაგრძელდეს?')) return; updateSection(selected.id, (section) => ({ ...section, elements: removeNestedBlock(section.elements, id) })); }} onDuplicate={(id) => updateSection(selected.id, (section) => ({ ...section, elements: duplicateNestedBlock(section.elements, id) }))} />
          </details>

          {selected.kind === 'template' ? <details className="section-builder-accordion"><summary><span><ChevronRight aria-hidden="true" /> განლაგება და იერსახე</span><small>მხოლოდ მხარდაჭერილი პრესეტები</small></summary>
            <div className="section-builder-appearance-grid">
              <label>კომპოზიცია<select value={selected.appearance.layout} onChange={(event) => updateSection(selected.id, (section) => ({ ...section, appearance: { ...section.appearance, layout: event.target.value as WebsiteSection['appearance']['layout'] } }))}><option value="one-column">ერთი სვეტი</option><option value="two-column">ორი სვეტი</option><option value="grid">ბადე</option></select></label>
              <label>სივრცე<select value={selected.appearance.spacing} onChange={(event) => updateSection(selected.id, (section) => ({ ...section, appearance: { ...section.appearance, spacing: event.target.value as WebsiteSection['appearance']['spacing'] } }))}><option value="compact">კომპაქტური</option><option value="comfortable">კომფორტული</option><option value="spacious">ფართო</option></select></label>
              <label>გასწორება<select value={selected.appearance.alignment} onChange={(event) => updateSection(selected.id, (section) => ({ ...section, appearance: { ...section.appearance, alignment: event.target.value as WebsiteSection['appearance']['alignment'] } }))}><option value="start">მარცხნივ</option><option value="center">ცენტრში</option></select></label>
              <label>ფონი<select value={selected.appearance.background} onChange={(event) => updateSection(selected.id, (section) => ({ ...section, appearance: { ...section.appearance, background: event.target.value as WebsiteSection['appearance']['background'] } }))}><option value="default">სტანდარტული</option><option value="soft">რბილი</option><option value="dark">მუქი</option></select></label>
              <label>ტიპოგრაფია<select value={selected.appearance.typography} onChange={(event) => updateSection(selected.id, (section) => ({ ...section, appearance: { ...section.appearance, typography: event.target.value as WebsiteSection['appearance']['typography'] } }))}><option value="brand">ბრენდის</option><option value="editorial">სარედაქციო</option><option value="compact">კომპაქტური</option></select></label>
              <label>აქცენტის ფერი<select value={selected.appearance.accent} onChange={(event) => updateSection(selected.id, (section) => ({ ...section, appearance: { ...section.appearance, accent: event.target.value as WebsiteSection['appearance']['accent'] } }))}><option value="forest">ტყისფერი</option><option value="copper">სპილენძისფერი</option><option value="neutral">ნეიტრალური</option></select></label>
              <label>ეკრანზე გამოჩენა<select value={selected.appearance.responsive} onChange={(event) => updateSection(selected.id, (section) => { const responsive = event.target.value as WebsiteSection['appearance']['responsive']; return { ...section, inNavigation: responsive === 'all' ? section.inNavigation : false, appearance: { ...section.appearance, responsive } }; })}><option value="all">ყველა მოწყობილობაზე</option><option value="desktop">მხოლოდ დესკტოპზე</option><option value="mobile">მხოლოდ მობილურზე</option></select></label>
            </div>
          </details> : <p className="section-builder-native-note">არსებული სექციის კომპოზიცია და დიზაინი უცვლელია. ტექსტის, გამოსახულებისა და დამატებითი კონტენტის რედაქტირება ხელმისაწვდომია.</p>}

        </>}
      </div>
      </div>
    </details>
    </>}

    {showTemplates && <div className="section-builder-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowTemplates(false); setPendingTemplateIndex(null); } }}>
      <section ref={templateDialogRef} className="section-builder-template-modal" role="dialog" aria-modal="true" aria-labelledby="section-template-title">
        <header><div><p className="admin-eyebrow">კომპონენტების ბიბლიოთეკა</p><h2 id="section-template-title">ახალი სექციის დამატება</h2><p>აირჩიეთ მზა, უსაფრთხო შაბლონი. ახალ შაბლონებს რედაქტორში დაუყოვნებლივ შეცვლით.</p></div><button type="button" aria-label="დახურვა" onClick={() => { setShowTemplates(false); setPendingTemplateIndex(null); }}><X aria-hidden="true" /></button></header>
        <div className="section-builder-template-grid">{WEBSITE_TEMPLATES.map((template) => <article className="section-builder-template-card" key={template.id}><TemplatePreview templateId={template.id} /><small>{template.category}</small><h3>{template.label}</h3><p>{template.description}</p><button type="button" onClick={() => addTemplate(template.id)}>დამატება <Plus aria-hidden="true" /></button></article>)}</div>
      </section>
    </div>}
  </section>;
}

function moveItemById(sections: WebsiteSection[], id: string, direction: -1 | 1) {
  const index = sections.findIndex((section) => section.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sections.length) return sections;
  const next = [...sections]; const [item] = next.splice(index, 1); next.splice(target, 0, item); return next;
}

function cloneSection(section: WebsiteSection, order: number): WebsiteSection {
  const copyBlocks = (items: WebsiteBlock[]) => items.map((item) => ({ ...item, id: createStableId('block'), ...(item.children ? { children: copyBlocks(item.children) } : {}) }));
  const id = createStableId('section');
  return { ...section, id, anchorId: id, label: `${section.label} — ასლი`, order, inNavigation: false, elements: copyBlocks(section.elements), copy: { ...section.copy } };
}
