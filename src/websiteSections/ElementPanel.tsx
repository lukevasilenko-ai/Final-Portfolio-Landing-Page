import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpLeft, ChevronDown, ChevronsDown,
  ChevronsUp, ChevronUp, Copy, Crop, Eye, EyeOff, ImagePlus, LoaderCircle, Monitor, Plus, RefreshCw, RotateCcw, Smartphone,
  Tablet, Trash2, Type, Upload, X,
} from 'lucide-react';
import { DEFAULT_WEBSITE_LAYOUT, isSafeWebsiteLink, type WebsiteLayoutConfig } from './model';
import type { CanvasRect } from './previewProtocol';
import {
  addFreeItem, findFreeItem, FREE_LIMIT, freeElementId, setElementHidden, setElementHref, setElementText, setFreeAlt,
  setFreeImage, STRIP_LIMIT, type SiteElements,
} from '../siteElements';
import { editorAssetMessage, uploadEditorImage } from './editorAssets';
import {
  clearElementStyle, effectiveStyle, FONT_FAMILIES, setStyleValue, SHADOWS,
  type Breakpoint, type ElementStyle, type FontFamilyKey, type ShadowKey,
} from '../siteElementStyles';
import { DEFAULT_STRIP_KEYS, STATIC_STRIP_POSTERS } from '../components/WorkStrip';
import { loadPickableWorks, uploadPosterWork, type PickableWork } from '../admin/works';
import { adminToast } from '../admin/feedback';

/** An element the user clicked in the editor's page (reported by the preview frame). */
export type EditorElement = {
  id: string;
  kind: string;
  label: string;
  props: string[];
  hidden: boolean;
  stripIndex?: number;
  /** Section the element sits in (new free text and pictures go there). */
  section?: string;
  rect: CanvasRect;
};

const IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/avif';

export type SectionAction = 'show' | 'hide' | 'up' | 'down';

const LINK_PRESETS: { value: string; label: string }[] = [
  { value: '', label: 'როგორც იყო' },
  { value: '#projects', label: 'ნამუშევრები (გვერდზე)' },
  { value: '#calculator', label: 'კალკულატორი (გვერდზე)' },
  { value: '#contact', label: 'კონტაქტი (გვერდზე)' },
  { value: '/portfolio', label: 'სრული კატალოგი' },
];

const copyValue = (layout: WebsiteLayoutConfig, sectionId: string, key: string) =>
  layout.sections.find((section) => section.id === sectionId)?.copy[key]
  ?? DEFAULT_WEBSITE_LAYOUT.sections.find((section) => section.id === sectionId)?.copy[key]
  ?? '';

const sectionIdOf = (element: EditorElement) => (element.id.startsWith('section.') ? element.id.slice(8) : '');

/** Small bar on the selected element: where it sits (parent) and the quickest actions. */
export function ElementToolbar({ element, style, hidden, onParent, onToggleHidden, onDuplicate, onDelete, onClose }: {
  element: EditorElement; style: { left: number; top: number }; hidden: boolean;
  onParent: () => void; onToggleHidden: () => void; onDuplicate?: () => void; onDelete?: () => void; onClose: () => void;
}) {
  return (
    <div className="ve-toolbar" style={style} role="toolbar" aria-label={`${element.label} — მოქმედებები`}>
      <strong title={element.label}>{element.label}</strong>
      {!element.id.startsWith('section.') && (
        <button type="button" title="მშობლის მონიშვნა (მთლიანი ბლოკი / სექცია)" aria-label="მშობლის მონიშვნა" onClick={onParent}><ArrowUpLeft /></button>
      )}
      {onDuplicate && <button type="button" title="დუბლირება (Ctrl+D)" aria-label="დუბლირება" onClick={onDuplicate}><Copy /></button>}
      {(element.props.includes('hide') || element.props.includes('section')) && (
        <button type="button" title={hidden ? 'ჩვენება' : onDelete ? 'დამალვა' : 'დამალვა (Delete)'} aria-label={hidden ? 'ჩვენება' : 'დამალვა'} onClick={onToggleHidden}>{hidden ? <Eye /> : <EyeOff />}</button>
      )}
      {onDelete && <button type="button" title="წაშლა (Delete)" aria-label="წაშლა" onClick={onDelete}><Trash2 /></button>}
      <button type="button" title="მონიშვნის მოხსნა (Esc)" aria-label="მონიშვნის მოხსნა" onClick={onClose}><X /></button>
    </div>
  );
}

/** Docked properties panel: what the element contains, and how it looks on each screen size. */
export type FreeActions = {
  onSelectId: (id: string) => void;
  onDuplicateFree: (id: string) => void;
  onRemoveFree: (id: string) => void;
};

export default function PropertiesPanel({
  element, layout, elements, breakpoint, onBreakpoint, onElements, onCopy, onHeroImage, onSection, sectionVisible, ...free
}: {
  element: EditorElement | null;
  layout: WebsiteLayoutConfig;
  elements: SiteElements;
  breakpoint: Breakpoint;
  onBreakpoint: (breakpoint: Breakpoint) => void;
  onElements: (next: SiteElements) => void;
  onCopy: (sectionId: string, key: string, value: string) => void;
  onHeroImage: (file: File | null) => Promise<void>;
  onSection: (sectionId: string, action: SectionAction) => void;
  sectionVisible: (sectionId: string) => boolean;
} & FreeActions) {
  const [tab, setTab] = useState<'content' | 'style'>('content');
  const isFreeElement = Boolean(element?.props.includes('free'));
  useEffect(() => {
    if (element?.kind === 'text') setTab('style');
    else if (isFreeElement) setTab('content');
  }, [element?.id, element?.kind, isFreeElement]);

  if (!element) {
    return (
      <aside className="ve-props is-empty" aria-label="თვისებები">
        <span className="ve-kicker">თვისებები</span>
        <p>მიიტანეთ მაუსი გვერდზე და დააჭირეთ ნებისმიერ ნაწილს — აქ გამოჩნდება მისი პარამეტრები: შინაარსი, ფერი, შრიფტი, ზომა, პოზიცია.</p>
        <ul className="ve-shortcuts">
          <li><kbd>Ctrl</kbd> <kbd>Z</kbd> უკან</li>
          <li><kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>Z</kbd> წინ</li>
          <li><kbd>Ctrl</kbd> <kbd>S</kbd> შენახვა</li>
          <li><kbd>Delete</kbd> დამალვა (თავისუფალი ელემენტი — წაშლა)</li>
          <li><kbd>Ctrl</kbd> <kbd>D</kbd> თავისუფალი ელემენტის დუბლირება</li>
          <li><kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> გადაადგილება (<kbd>Shift</kbd> — 10px)</li>
          <li><kbd>Esc</kbd> მონიშვნის მოხსნა</li>
        </ul>
        <p>ახალი ტექსტის ან სურათის დასამატებლად მონიშნეთ ნებისმიერი ელემენტი სასურველ სექციაში — „შინაარსის“ ბოლოს იქნება „დამატება ამ სექციაში“.</p>
      </aside>
    );
  }

  return (
    <aside className="ve-props" aria-label={`${element.label} — თვისებები`}>
      <span className="ve-kicker">მონიშნული</span>
      <h2>{element.label}</h2>
      <div className="ve-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'content'} onClick={() => setTab('content')}>შინაარსი</button>
        <button type="button" role="tab" aria-selected={tab === 'style'} onClick={() => setTab('style')}>სტილი</button>
      </div>
      {tab === 'content'
        ? <ContentTab element={element} layout={layout} elements={elements} breakpoint={breakpoint} onElements={onElements} onCopy={onCopy} onHeroImage={onHeroImage} onSection={onSection} sectionVisible={sectionVisible} free={free} />
        : <StyleTab element={element} elements={elements} breakpoint={breakpoint} onBreakpoint={onBreakpoint} onElements={onElements} />}
    </aside>
  );
}

function ContentTab({ element, layout, elements, breakpoint, onElements, onCopy, onHeroImage, onSection, sectionVisible, free }: {
  element: EditorElement; layout: WebsiteLayoutConfig; elements: SiteElements; breakpoint: Breakpoint;
  onElements: (next: SiteElements) => void; onCopy: (sectionId: string, key: string, value: string) => void;
  onHeroImage: (file: File | null) => Promise<void>; onSection: (sectionId: string, action: SectionAction) => void;
  sectionVisible: (sectionId: string) => boolean; free: FreeActions;
}) {
  const has = (prop: string) => element.props.includes(prop);
  const copyProps = element.props.filter((prop) => prop.startsWith('copy:')).map((prop) => {
    const [sectionId, key] = prop.slice(5).split('.');
    return { sectionId, key };
  });
  const [picker, setPicker] = useState<null | 'replace' | 'add'>(null);
  const [busy, setBusy] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const hidden = elements.hidden.includes(element.id);
  const strip = elements.strip ?? DEFAULT_STRIP_KEYS;
  const stripIndex = element.stripIndex ?? -1;
  const setStrip = (next: string[]) => onElements({ ...elements, strip: next.slice(0, STRIP_LIMIT) });
  const moveStrip = (direction: -1 | 1) => {
    const target = stripIndex + direction;
    if (stripIndex < 0 || target < 0 || target >= strip.length) return;
    const next = [...strip];
    [next[stripIndex], next[target]] = [next[target], next[stripIndex]];
    setStrip(next);
  };
  const sectionId = sectionIdOf(element);

  // Free text and pictures: add to this section, edit, crop, order, duplicate, delete.
  const latest = useRef({ elements, onElements });
  latest.current = { elements, onElements };
  const freeItem = findFreeItem(elements, element.id);
  const targetSection = sectionId || freeItem?.section || element.section || '';
  const freeFull = elements.free.length >= FREE_LIMIT;
  const [uploading, setUploading] = useState(false);
  const addImageInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const addText = () => {
    if (!targetSection || freeFull) return;
    const added = addFreeItem(elements, targetSection, 'text');
    onElements(added.elements);
    free.onSelectId(added.elementId);
  };
  const uploadThen = async (file: File | undefined, apply: (url: string) => void) => {
    if (!file) return;
    setUploading(true);
    try { apply(await uploadEditorImage(file)); } catch (error) { adminToast(editorAssetMessage(error), 'error'); } finally { setUploading(false); }
  };
  const addImage = (file?: File) => uploadThen(file, (url) => {
    const added = addFreeItem(latest.current.elements, targetSection, 'image', url);
    latest.current.onElements(added.elements);
    free.onSelectId(added.elementId);
    adminToast('სურათი დაემატა — გადაათრიეთ სასურველ ადგილას.', 'success');
  });
  const replaceImage = (file?: File) => uploadThen(file, (url) => latest.current.onElements(setFreeImage(latest.current.elements, element.id, url)));
  const current = effectiveStyle(elements.style, element.id, breakpoint);
  const setStyle = <K extends keyof ElementStyle>(key: K, value: ElementStyle[K] | undefined) =>
    onElements({ ...elements, style: setStyleValue(elements.style, element.id, breakpoint, key, value) });
  const cropped = current.heightPx !== undefined;
  const toggleCrop = () => {
    if (!cropped) { setStyle('heightPx', Math.max(8, Math.round(element.rect.height))); return; }
    let style = elements.style;
    for (const size of ['base', 'tablet', 'mobile'] as const) {
      for (const key of ['heightPx', 'objectX', 'objectY'] as const) style = setStyleValue(style, element.id, size, key, undefined);
    }
    onElements({ ...elements, style });
  };
  // Stacking order among the section's free items (all screen sizes).
  const layerOf = (id: string) => effectiveStyle(elements.style, id, 'base').zIndex ?? 10;
  const layer = layerOf(element.id);
  const otherLayers = freeItem
    ? elements.free.filter((item) => item.section === freeItem.section && freeElementId(item) !== element.id).map((item) => layerOf(freeElementId(item)))
    : [];
  const setLayer = (value: number) => onElements({ ...elements, style: setStyleValue(elements.style, element.id, 'base', 'zIndex', Math.min(200, Math.max(1, value))) });

  return (
    <div className="ve-group-list">
      {element.kind === 'text' && <p className="ve-hint">ტექსტი იცვლება პირდაპირ გვერდზე — დააჭირეთ და დაწერეთ. შრიფტი, ფერი და ზომა — „სტილში“.</p>}

      {freeItem && (
        <Group title={freeItem.type === 'text' ? 'თავისუფალი ტექსტი' : 'თავისუფალი სურათი'}>
          {freeItem.type === 'text' ? <>
            <TextBoxField label="ტექსტი" multiline value={elements.text[element.id] ?? ''} placeholder="ახალი ტექსტი" maxLength={500}
              onCommit={(value) => onElements(setElementText(elements, element.id, value.trim() ? value : null))} />
            <p className="ve-hint">ან პირდაპირ გვერდზე: მონიშნულ ტექსტს კიდევ ერთხელ დააჭირეთ და დაწერეთ. შრიფტი, ფერი, ზომა — „სტილში“.</p>
          </> : <>
            <img className="ve-free-preview" src={freeItem.src} alt="" />
            <input ref={replaceInput} type="file" hidden accept={IMAGE_TYPES} onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              void replaceImage(file);
            }} />
            <button type="button" className="ve-button is-primary" disabled={uploading} onClick={() => replaceInput.current?.click()}>
              {uploading ? <LoaderCircle className="admin-spin" /> : <Upload />} სურათის შეცვლა
            </button>
            <TextBoxField label="აღწერა (ვინც სურათს ვერ ხედავს)" value={freeItem.alt ?? ''} placeholder="მაგ.: ლოგოს ესკიზი" maxLength={200}
              onCommit={(value) => onElements(setFreeAlt(elements, element.id, value))} />
          </>}
          <p className="ve-hint">გვერდზე გადაათრიეთ; კუთხე — ზომა, ზედა წრე — ბრუნვა (Shift — 15°-ით).</p>
          <div className="ve-row">
            <button type="button" className="ve-button" disabled={freeFull} onClick={() => free.onDuplicateFree(element.id)}><Copy /> დუბლირება</button>
            <button type="button" className="ve-button is-danger" onClick={() => free.onRemoveFree(element.id)}><Trash2 /> წაშლა</button>
          </div>
        </Group>
      )}

      {freeItem && (
        <Group title={`ფენა — ${layer}`}>
          <div className="ve-row">
            <button type="button" className="ve-icon" title="ყველაზე წინ" aria-label="ყველაზე წინ" onClick={() => setLayer(Math.max(layer, (otherLayers.length ? Math.max(...otherLayers) : layer - 1) + 1))}><ChevronsUp /></button>
            <button type="button" className="ve-icon" title="ერთით წინ" aria-label="ერთით წინ" onClick={() => setLayer(layer + 1)}><ChevronUp /></button>
            <button type="button" className="ve-icon" title="ერთით უკან" aria-label="ერთით უკან" disabled={layer <= 1} onClick={() => setLayer(layer - 1)}><ChevronDown /></button>
            <button type="button" className="ve-icon" title="ყველაზე უკან" aria-label="ყველაზე უკან" disabled={layer <= 1} onClick={() => setLayer(Math.min(layer, (otherLayers.length ? Math.min(...otherLayers) : layer + 1) - 1))}><ChevronsDown /></button>
          </div>
          <p className="ve-hint">რომელი დაფაროს რომელი, როცა ერთმანეთზე დევს.</p>
        </Group>
      )}

      {freeItem?.type === 'image' && (
        <Group title="ჩამოჭრა">
          <button type="button" className={`ve-button${cropped ? ' is-primary' : ''}`} onClick={toggleCrop}><Crop /> {cropped ? 'ჩამოჭრის მოხსნა' : 'ჩამოჭრა'}</button>
          {cropped && <>
            <NumberField label="სიმაღლე (px)" value={current.heightPx} min={8} max={4000} onChange={(value) => setStyle('heightPx', value)} />
            <Field label={`ფოკუსი ← → — ${current.objectX ?? 50}%`}>
              <input type="range" min={0} max={100} value={current.objectX ?? 50} onChange={(event) => setStyle('objectX', Number(event.target.value))} />
            </Field>
            <Field label={`ფოკუსი ↑ ↓ — ${current.objectY ?? 50}%`}>
              <input type="range" min={0} max={100} value={current.objectY ?? 50} onChange={(event) => setStyle('objectY', Number(event.target.value))} />
            </Field>
          </>}
          <p className="ve-hint">გვერდზე ქვედა ზოლით შეცვლით სიმაღლეს. ფოკუსი ირჩევს, სურათის რომელი ნაწილი დარჩეს ჩანს.</p>
        </Group>
      )}

      {has('section') && sectionId && (
        <Group title="სექცია">
          <div className="ve-row">
            <button type="button" className="ve-button" onClick={() => onSection(sectionId, 'up')}><ArrowUp /> ზემოთ</button>
            <button type="button" className="ve-button" onClick={() => onSection(sectionId, 'down')}><ArrowDown /> ქვემოთ</button>
          </div>
          <button type="button" className={`ve-button${sectionVisible(sectionId) ? '' : ' is-primary'}`} onClick={() => onSection(sectionId, sectionVisible(sectionId) ? 'hide' : 'show')}>
            {sectionVisible(sectionId) ? <><EyeOff /> სექციის დამალვა</> : <><Eye /> სექციის ჩვენება</>}
          </button>
          <p className="ve-hint">ფონი, დაშორებები და სხვა — „სტილში“. ახალი სექციები და ისტორია — „სრულ რედაქტორში“.</p>
        </Group>
      )}

      {copyProps.map(({ sectionId: copySection, key }) => (
        <Fragment key={`${copySection}.${key}`}><Group title={key === 'copyright' ? 'ტექსტი' : 'მინიშნება ველში'}>
          <CopyField hint={key === 'copyright' ? '{year} ავტომატურად იცვლება მიმდინარე წლით.' : undefined}
            value={copyValue(layout, copySection, key)} onCommit={(value) => onCopy(copySection, key, value)} />
        </Group></Fragment>
      ))}

      {has('href') && <Group title="ბმული"><LinkField value={elements.href[element.id] ?? ''} onCommit={(value) => onElements(setElementHref(elements, element.id, value || null))} /></Group>}

      {has('image') && (
        <Group title="სურათი">
          <input ref={imageInput} type="file" hidden accept="image/png,image/jpeg,image/webp,image/avif" onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (!file) return;
            setBusy(true);
            try { await onHeroImage(file); } finally { setBusy(false); }
          }} />
          <button type="button" className="ve-button is-primary" disabled={busy} onClick={() => imageInput.current?.click()}>
            {busy ? <LoaderCircle className="admin-spin" /> : <Upload />} სურათის შეცვლა
          </button>
          {copyValue(layout, 'hero', 'heroImageSrc') && (
            <button type="button" className="ve-button" disabled={busy} onClick={() => { void onHeroImage(null); }}><RefreshCw /> თავდაპირველი</button>
          )}
          <p className="ve-hint">PNG (გამჭვირვალეც), JPG, WebP. ბრუნვა, ზომა, ჩრდილი — „სტილში“.</p>
        </Group>
      )}

      {has('strip') && stripIndex >= 0 && (
        <Group title="ნამუშევარი ზოლში">
          <div className="ve-row">
            <button type="button" className="ve-button is-primary" onClick={() => setPicker('replace')}><RefreshCw /> შეცვლა</button>
            <button type="button" className="ve-button" onClick={() => setPicker('add')} disabled={strip.length >= STRIP_LIMIT}><Plus /> დამატება</button>
          </div>
          <div className="ve-row">
            <button type="button" className="ve-icon" aria-label="მარცხნივ" title="მარცხნივ" disabled={stripIndex === 0} onClick={() => moveStrip(-1)}><ArrowLeft /></button>
            <button type="button" className="ve-icon" aria-label="მარჯვნივ" title="მარჯვნივ" disabled={stripIndex >= strip.length - 1} onClick={() => moveStrip(1)}><ArrowRight /></button>
            <button type="button" className="ve-button is-danger" disabled={strip.length <= 1} onClick={() => setStrip(strip.filter((_, index) => index !== stripIndex))}><Trash2 /> ამოღება</button>
          </div>
        </Group>
      )}

      {has('hide') && (
        <button type="button" className={`ve-button${hidden ? ' is-primary' : ''}`} onClick={() => onElements(setElementHidden(elements, element.id, !hidden))}>
          {hidden ? <><Eye /> საიტზე ჩვენება</> : <><EyeOff /> დამალვა ყველგან</>}
        </button>
      )}

      {targetSection && (
        <Group title="დამატება ამ სექციაში">
          <input ref={addImageInput} type="file" hidden accept={IMAGE_TYPES} onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            void addImage(file);
          }} />
          <div className="ve-row">
            <button type="button" className="ve-button" disabled={freeFull} onClick={addText}><Type /> ტექსტი</button>
            <button type="button" className="ve-button" disabled={freeFull || uploading} onClick={() => addImageInput.current?.click()}>
              {uploading ? <LoaderCircle className="admin-spin" /> : <ImagePlus />} სურათი
            </button>
          </div>
          <p className="ve-hint">{freeFull
            ? `მაქსიმუმ ${FREE_LIMIT} თავისუფალი ელემენტი.`
            : 'გაჩნდება სექციის ზედა ნაწილში — მერე გადაათრიეთ სასურველ ადგილას. სურათი: PNG (გამჭვირვალეც), JPG, WebP, AVIF.'}</p>
        </Group>
      )}

      {picker && (
        <StripPicker current={strip} onClose={() => setPicker(null)} onPick={(key) => {
          const next = [...strip];
          if (picker === 'replace') next[stripIndex] = key; else next.splice(stripIndex + 1, 0, key);
          setStrip(next);
          setPicker(null);
        }} />
      )}
    </div>
  );
}

function StyleTab({ element, elements, breakpoint, onBreakpoint, onElements }: {
  element: EditorElement; elements: SiteElements; breakpoint: Breakpoint;
  onBreakpoint: (breakpoint: Breakpoint) => void; onElements: (next: SiteElements) => void;
}) {
  const own = elements.style[element.id]?.[breakpoint] ?? {};
  const current = effectiveStyle(elements.style, element.id, breakpoint);
  const set = <K extends keyof ElementStyle>(key: K, value: ElementStyle[K] | undefined) =>
    onElements({ ...elements, style: setStyleValue(elements.style, element.id, breakpoint, key, value) });
  const isImage = element.kind === 'image' || element.kind === 'free-image';
  const isSection = element.kind === 'section';
  const isFree = element.props.includes('free');

  return (
    <div className="ve-group-list">
      <div className="ve-breakpoints" role="radiogroup" aria-label="ეკრანის ზომა">
        {([['base', Monitor, 'კომპიუტერი'], ['tablet', Tablet, 'ტაბლეტი'], ['mobile', Smartphone, 'მობილური']] as const).map(([value, Icon, label]) => (
          <button key={value} type="button" role="radio" aria-checked={breakpoint === value} onClick={() => onBreakpoint(value)} title={label} aria-label={label}><Icon />{breakpoint === value && <span>{label}</span>}</button>
        ))}
      </div>
      <p className="ve-hint">{breakpoint === 'base' ? 'მოქმედებს ყველა ეკრანზე, თუ ტაბლეტზე/მობილურზე სხვა არ მიუთითეთ.' : breakpoint === 'tablet' ? 'მხოლოდ ტაბლეტზე და მობილურზე (თუ მობილურზე სხვა არ არის).' : 'მხოლოდ მობილურზე.'}</p>

      {!isImage && !isSection && (
        <Group title="ტიპოგრაფია">
          <Field label="შრიფტი">
            <select value={own.fontFamily ?? ''} onChange={(event) => set('fontFamily', (event.target.value || undefined) as FontFamilyKey | undefined)}>
              <option value="">როგორც იყო</option>
              {Object.entries(FONT_FAMILIES).map(([key, font]) => <option key={key} value={key}>{font.label}</option>)}
            </select>
          </Field>
          <div className="ve-grid-2">
            <NumberField label="ზომა (px)" value={own.fontSize} placeholder={current.fontSize} min={6} max={240} onChange={(value) => set('fontSize', value)} />
            <Field label="სისქე">
              <select value={own.fontWeight ?? ''} onChange={(event) => set('fontWeight', event.target.value ? Number(event.target.value) : undefined)}>
                <option value="">როგორც იყო</option>
                {[300, 400, 500, 600, 700, 800].map((weight) => <option key={weight} value={weight}>{weight}</option>)}
              </select>
            </Field>
            <NumberField label="ხაზის სიმაღლე" value={own.lineHeight} step={0.05} min={0.6} max={4} onChange={(value) => set('lineHeight', value)} />
            <NumberField label="ასოებს შორის (em)" value={own.letterSpacing} step={0.01} min={-0.2} max={1} onChange={(value) => set('letterSpacing', value)} />
          </div>
          <ColorField label="ფერი" value={own.color} onChange={(value) => set('color', value)} />
          <div className="ve-row">
            <div className="ve-segment" role="radiogroup" aria-label="გასწორება">
              {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([value, Icon]) => (
                <button key={value} type="button" role="radio" aria-checked={own.textAlign === value} onClick={() => set('textAlign', own.textAlign === value ? undefined : value)}><Icon /></button>
              ))}
            </div>
            <button type="button" className={`ve-chip${own.fontStyle === 'italic' ? ' is-on' : ''}`} onClick={() => set('fontStyle', own.fontStyle === 'italic' ? undefined : 'italic')}><i>I</i></button>
            <button type="button" className={`ve-chip${own.textTransform === 'uppercase' ? ' is-on' : ''}`} onClick={() => set('textTransform', own.textTransform === 'uppercase' ? undefined : 'uppercase')}>AA</button>
          </div>
        </Group>
      )}

      <Group title={isSection ? 'ფონი' : 'ფონი და ჩარჩო'}>
        <ColorField label="ფონის ფერი" value={own.background} onChange={(value) => set('background', value)} />
        {!isSection && (
          <div className="ve-grid-2">
            <NumberField label="კუთხეები (px)" value={own.radius} min={0} max={400} onChange={(value) => set('radius', value)} />
            <NumberField label="ჩარჩო (px)" value={own.borderWidth} min={0} max={40} onChange={(value) => set('borderWidth', value)} />
          </div>
        )}
        {!isSection && own.borderWidth !== undefined && <ColorField label="ჩარჩოს ფერი" value={own.borderColor} onChange={(value) => set('borderColor', value)} />}
        {!isSection && (
          <Field label="ჩრდილი">
            <select value={own.shadow ?? ''} onChange={(event) => set('shadow', (event.target.value || undefined) as ShadowKey | undefined)}>
              <option value="">როგორც იყო</option>
              {(Object.keys(SHADOWS) as ShadowKey[]).map((key) => <option key={key} value={key}>{key === 'none' ? 'არა' : key === 'soft' ? 'რბილი' : 'ძლიერი'}</option>)}
            </select>
          </Field>
        )}
        <Field label={`გამჭვირვალობა — ${own.opacity ?? 100}%`}>
          <input type="range" min={0} max={100} value={own.opacity ?? 100} onChange={(event) => set('opacity', Number(event.target.value) === 100 ? undefined : Number(event.target.value))} />
        </Field>
      </Group>

      {isFree ? (
        <Group title="ადგილი და ზომა">
          <div className="ve-grid-2">
            <NumberField label="მარცხნიდან (%)" value={own.posX} placeholder={current.posX} step={0.5} min={-100} max={200} onChange={(value) => set('posX', value)} />
            <NumberField label="ზემოდან (px)" value={own.posY} placeholder={current.posY} min={-2000} max={8000} onChange={(value) => set('posY', value)} />
            <NumberField label="სიგანე (%)" value={own.widthPct} placeholder={current.widthPct} step={0.5} min={1} max={300} onChange={(value) => set('widthPct', value)} />
            {isImage
              ? <NumberField label="სიმაღლე (px)" value={own.heightPx} placeholder={current.heightPx} min={8} max={4000} onChange={(value) => set('heightPx', value)} />
              : <NumberField label="შიგნით (px)" value={own.paddingY} min={0} max={400} onChange={(value) => onElements({
                ...elements,
                style: setStyleValue(setStyleValue(elements.style, element.id, breakpoint, 'paddingY', value), element.id, breakpoint, 'paddingX', value),
              })} />}
            <NumberField label="ბრუნვა (°)" value={own.rotate} placeholder={current.rotate} min={-360} max={360} onChange={(value) => set('rotate', value)} />
            <NumberField label="ფენა" value={own.zIndex} placeholder={current.zIndex} min={-50} max={200} onChange={(value) => set('zIndex', value)} />
          </div>
          <p className="ve-hint">ან პირდაპირ გვერდზე: გადაათრიეთ, კუთხით შეცვალეთ ზომა, ზედა წრით შეატრიალეთ. ისრები — 1px, Shift+ისრები — 10px.</p>
        </Group>
      ) : (
        <Group title="ზომა და დაშორება">
          <div className="ve-grid-2">
            {!isSection && <NumberField label="სიგანე (px)" value={own.width} min={0} max={2400} onChange={(value) => set('width', value || undefined)} />}
            <NumberField label="შიგნით ↕ (px)" value={own.paddingY} min={0} max={400} onChange={(value) => set('paddingY', value)} />
            {!isSection && <NumberField label="შიგნით ↔ (px)" value={own.paddingX} min={0} max={400} onChange={(value) => set('paddingX', value)} />}
            <NumberField label="ზემოთ (px)" value={own.marginTop} min={-400} max={800} onChange={(value) => set('marginTop', value)} />
            <NumberField label="ქვემოთ (px)" value={own.marginBottom} min={-400} max={800} onChange={(value) => set('marginBottom', value)} />
          </div>
        </Group>
      )}

      {!isSection && !isFree && (
        <Group title="პოზიცია">
          <div className="ve-grid-2">
            <NumberField label="← → (px)" value={own.x} min={-2000} max={2000} onChange={(value) => set('x', value)} />
            <NumberField label="↑ ↓ (px)" value={own.y} min={-2000} max={2000} onChange={(value) => set('y', value)} />
            <NumberField label="ბრუნვა (°)" value={own.rotate} min={-360} max={360} onChange={(value) => set('rotate', value)} />
            <NumberField label="მასშტაბი (%)" value={own.scale} placeholder={100} min={5} max={500} onChange={(value) => set('scale', value)} />
            <NumberField label="ფენა (წინ/უკან)" value={own.zIndex} min={-50} max={200} onChange={(value) => set('zIndex', value)} />
          </div>
        </Group>
      )}

      <div className="ve-row">
        <button type="button" className={`ve-button${own.hidden ? ' is-primary' : ''}`} onClick={() => set('hidden', own.hidden ? undefined : true)}>
          {own.hidden ? <><Eye /> ამ ეკრანზე ჩვენება</> : <><EyeOff /> დამალვა ამ ეკრანზე</>}
        </button>
        <button type="button" className="ve-button" onClick={() => onElements({ ...elements, style: clearElementStyle(elements.style, element.id, breakpoint) })} disabled={!Object.keys(own).length}>
          <RotateCcw /> გასუფთავება
        </button>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <section className="ve-group"><span className="ve-kicker">{title}</span>{children}</section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="ve-field"><span>{label}</span>{children}</label>;
}

/** Number input that commits on Enter/blur and clears when emptied. */
function NumberField({ label, value, placeholder, min, max, step = 1, onChange }: {
  label: string; value: number | undefined; placeholder?: number; min: number; max: number; step?: number;
  onChange: (value: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));
  useEffect(() => setDraft(value === undefined ? '' : String(value)), [value]);
  const commit = () => {
    if (draft.trim() === '') { if (value !== undefined) onChange(undefined); return; }
    const number = Number(draft);
    if (!Number.isFinite(number)) { setDraft(value === undefined ? '' : String(value)); return; }
    const clamped = Math.min(max, Math.max(min, number));
    if (clamped !== value) onChange(clamped);
    setDraft(String(clamped));
  };
  return (
    <Field label={label}>
      <input type="number" inputMode="decimal" value={draft} step={step} min={min} max={max}
        placeholder={placeholder !== undefined ? String(placeholder) : 'ავტო'}
        onChange={(event) => setDraft(event.target.value)} onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') commit(); }} />
    </Field>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string | undefined; onChange: (value: string | undefined) => void }) {
  const hex = value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#2c5a4c';
  return (
    <div className="ve-field">
      <span>{label}</span>
      <div className="ve-color">
        <input type="color" value={hex} onChange={(event) => onChange(event.target.value)} aria-label={label} />
        <input type="text" value={value ?? ''} placeholder="როგორც იყო" maxLength={40}
          onChange={(event) => onChange(event.target.value.trim() || undefined)} />
        {value && <button type="button" className="ve-icon" aria-label="გასუფთავება" title="როგორც იყო" onClick={() => onChange(undefined)}><X /></button>}
      </div>
    </div>
  );
}

function TextBoxField({ label, value, placeholder, maxLength, multiline = false, onCommit }: {
  label: string; value: string; placeholder?: string; maxLength: number; multiline?: boolean; onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => { if (draft !== value) onCommit(draft); };
  return (
    <label className="ve-field">
      <span>{label}</span>
      {multiline
        ? <textarea rows={3} value={draft} placeholder={placeholder} maxLength={maxLength} onChange={(event) => setDraft(event.target.value)} onBlur={commit} />
        : <input value={draft} placeholder={placeholder} maxLength={maxLength} onChange={(event) => setDraft(event.target.value)} onBlur={commit}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />}
    </label>
  );
}

function CopyField({ value, hint, onCommit }: { value: string; hint?: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="ve-field">
      <input value={draft} maxLength={500} onChange={(event) => setDraft(event.target.value)}
        onBlur={() => { if (draft !== value) onCommit(draft); }}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

function LinkField({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const preset = LINK_PRESETS.some((item) => item.value === value) ? value : 'custom';
  const [custom, setCustom] = useState(preset === 'custom' ? value : '');
  const [mode, setMode] = useState(preset);
  const [error, setError] = useState('');
  useEffect(() => { const next = LINK_PRESETS.some((item) => item.value === value) ? value : 'custom'; setMode(next); if (next === 'custom') setCustom(value); }, [value]);
  const commitCustom = () => {
    const link = custom.trim();
    if (!link) return;
    const normalized = /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(link) ? `https://${link}` : link;
    if (!isSafeWebsiteLink(normalized)) { setError('ბმული უნდა იწყებოდეს https://-ით (ან mailto:, tel:).'); return; }
    setError('');
    onCommit(normalized);
  };
  return (
    <div className="ve-field">
      <span>სად გადადის</span>
      <select value={mode} onChange={(event) => {
        setMode(event.target.value);
        if (event.target.value !== 'custom') { setError(''); onCommit(event.target.value); }
      }}>
        {LINK_PRESETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        <option value="custom">სხვა ბმული…</option>
      </select>
      {mode === 'custom' && (
        <input value={custom} placeholder="https://…" onChange={(event) => setCustom(event.target.value)} onBlur={commitCustom}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
      )}
      {error && <small className="ve-error">{error}</small>}
    </div>
  );
}

/** Choose a bundled poster or any visible work, or upload a new work (added to Product Posters). */
function StripPicker({ current, onPick, onClose }: { current: string[]; onPick: (key: string) => void; onClose: () => void }) {
  const [works, setWorks] = useState<PickableWork[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    loadPickableWorks().then((list) => { if (active) setWorks(list); }).catch(() => { if (active) setWorks([]); });
    return () => { active = false; };
  }, []);

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const id = await uploadPosterWork(file);
      adminToast('ნამუშევარი დაემატა „პროექტებში“ და ზოლში.', 'success');
      onPick(`work:${id}`);
    } catch {
      adminToast('ატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const tile = (key: string, src: string, title: string) => (
    <button key={key} type="button" className={`strip-picker-tile${current.includes(key) ? ' is-used' : ''}`} onClick={() => onPick(key)} title={title}>
      <img src={src} alt="" loading="lazy" />
      {current.includes(key) && <span>უკვე ზოლშია</span>}
    </button>
  );

  return (
    <div className="strip-picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="strip-picker" role="dialog" aria-label="ნამუშევრის არჩევა">
        <header>
          <strong>აირჩიეთ ნამუშევარი</strong>
          <button type="button" className="ve-icon" aria-label="დახურვა" onClick={onClose}><X /></button>
        </header>
        <input ref={fileInput} type="file" hidden accept="image/png,image/jpeg,image/webp,image/avif" onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          void upload(file);
        }} />
        <button type="button" className="strip-picker-upload" disabled={uploading} onClick={() => fileInput.current?.click()}>
          {uploading ? <LoaderCircle className="admin-spin" /> : <ImagePlus />} ახალი სურათის ატვირთვა
        </button>
        <h3>თქვენი ნამუშევრები</h3>
        {works === null ? <p className="strip-picker-note"><LoaderCircle className="admin-spin" /> იტვირთება…</p>
          : works.length === 0 ? <p className="strip-picker-note">ჯერ არაფერია.</p>
            : <div className="strip-picker-grid">{works.map((work) => tile(`work:${work.id}`, work.url, work.title))}</div>}
        <h3>საიტის თავდაპირველი პოსტერები</h3>
        <div className="strip-picker-grid">{STATIC_STRIP_POSTERS.map((poster) => tile(poster.key, poster.src, poster.label))}</div>
      </section>
    </div>
  );
}
