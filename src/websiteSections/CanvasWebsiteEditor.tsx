import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Copy, Eye, EyeOff, GripVertical, Monitor, MousePointer2, PanelsTopLeft, Pencil, Plus, Scan, Smartphone, Tablet, Trash2, X } from 'lucide-react';
import type { WebsiteEditorSelection } from './EditorRuntime';
import { getNativeElementDefinition } from './nativeSchema';
import { WEBSITE_INSERTABLE_BLOCK_TYPES, isRetiredNativeSection, sortWebsiteSections, type WebsiteBlockType, type WebsiteLayoutConfig } from './model';
import type { CanvasRect, SelectionScope } from './previewProtocol';
import {
  deleteCanvasBlock as deleteCanvasBlockModel,
  duplicateCanvasBlock as duplicateCanvasBlockModel,
  insertCanvasBlockAfter as insertCanvasBlockAfterModel,
  insertCanvasNativeBlock as insertCanvasNativeBlockModel,
  reorderCanvasBlocks as reorderCanvasBlockModel,
  setCanvasBlockVisibility as setCanvasBlockVisibilityModel,
  setCanvasNativeVisibility as setCanvasNativeVisibilityModel,
  setCanvasSectionVisibility as setCanvasSectionVisibilityModel,
  removeCanvasTemplateSection as removeCanvasTemplateSectionModel,
  moveCanvasSection as moveCanvasSectionModel,
  updateWebsiteElementText as updateWebsiteElementTextModel,
} from './canvasEditor';
import { duplicateFreeItem, EMPTY_SITE_ELEMENTS, removeFreeItem, setElementHidden, setElementText, type SiteElements } from '../siteElements';
import { setStyleValue, type Breakpoint, type ElementStyle } from '../siteElementStyles';
import { adminToast } from '../admin/feedback';
import PropertiesPanel, { ElementToolbar, type EditorElement, type SectionAction } from './ElementPanel';
import LayersPanel, { type LayerNode } from './LayersPanel';
import './canvas-editor.css';

type CanvasSelection = WebsiteEditorSelection & { rect: CanvasRect };
type CanvasMode = 'edit' | 'preview';
type Device = 'desktop' | 'tablet' | 'mobile';

type Props = {
  /** full: the original builder. inline: click any part of the page and change it there. */
  variant?: 'full' | 'inline';
  /** Variant A: element changes (hide, labels, links, poster strip) and how to apply them. */
  elements?: SiteElements;
  onElementsChange?: (next: SiteElements, options?: { live?: boolean; before?: SiteElements }) => void;
  onCopyChange?: (sectionId: string, key: string, value: string) => void;
  onHeroImage?: (file: File | null) => Promise<void>;
  /** Keyboard shortcuts handled by the page that owns the history and saving. */
  onCommand?: (command: 'undo' | 'redo' | 'save') => void;
  layout: WebsiteLayoutConfig;
  imageUrls: Record<string, string>;
  selectedSectionId: string;
  dirty: boolean;
  onChange: (layout: WebsiteLayoutConfig) => void;
  onInlineStart: () => void;
  onInlineChange: (layout: WebsiteLayoutConfig) => void;
  onInlineFinish: () => void;
  onInlineCancel: () => void;
  onSelectSection: (sectionId: string) => void;
  onAddSection: (sectionId?: string, placement?: 'before' | 'after') => void;
  onEditSection: (sectionId: string) => void;
  onDuplicateSection: (sectionId: string) => void;
};

const blockNames: Record<Exclude<WebsiteBlockType, 'native-visibility'>, string> = {
  eyebrow: 'მცირე ტექსტი', heading: 'სათაური', subheading: 'ქვესათაური', paragraph: 'ტექსტი', button: 'ღილაკი',
  image: 'ფოტო', icon: 'აიქონი', divider: 'გამყოფი', 'feature-list': 'ბარათების ჯგუფი', statistic: 'სტატისტიკა',
  'gallery-item': 'გალერეის ფოტო', card: 'ბარათი', 'content-group': 'კონტენტის ჯგუფი', 'faq-item': 'კითხვა და პასუხი',
  testimonial: 'შეფასება', logo: 'ლოგო', 'call-to-action': 'მოქმედებისკენ მოწოდება',
};

const FREE_GESTURE_KEYS = ['posX', 'posY', 'widthPct', 'heightPx', 'rotate'] as const satisfies readonly (keyof ElementStyle)[];
/** Built-in pieces that can be dragged, sized and turned on the page like free items. */
const MOVABLE_ELEMENT_IDS = new Set(['hero.lettering']);

const insertable = WEBSITE_INSERTABLE_BLOCK_TYPES.filter((type) => type !== 'feature-list' && type !== 'content-group' && type !== 'call-to-action');
const deviceWidths: Record<Device, number> = { desktop: 1360, tablet: 820, mobile: 390 };

function validSelection(value: unknown): value is CanvasSelection {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CanvasSelection>;
  return (item.kind === 'native' || item.kind === 'block' || item.kind === 'section')
    && typeof item.sectionId === 'string' && typeof item.label === 'string'
    && Array.isArray(item.fields) && item.fields.every((field) => typeof field === 'string')
    && Boolean(item.rect && Number.isFinite(item.rect.top) && Number.isFinite(item.rect.left)
      && Number.isFinite(item.rect.width) && Number.isFinite(item.rect.height));
}

export default function CanvasWebsiteEditor({ variant = 'full', elements = EMPTY_SITE_ELEMENTS, onElementsChange, onCopyChange, onHeroImage, onCommand, layout, imageUrls, selectedSectionId, dirty, onChange, onInlineStart, onInlineChange, onInlineFinish, onInlineCancel, onSelectSection, onAddSection, onEditSection, onDuplicateSection }: Props) {
  const isFull = variant === 'full';
  const [modeState, setMode] = useState<CanvasMode>('edit');
  const mode: CanvasMode = isFull ? modeState : 'edit';
  const [device, setDevice] = useState<Device>('desktop');
  const [layersOpen, setLayersOpen] = useState(isFull);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selection, setSelection] = useState<CanvasSelection | null>(null);
  const [multiSelection, setMultiSelection] = useState<CanvasSelection[]>([]);
  const [selectionScope, setSelectionScope] = useState<SelectionScope>('element');
  const [frameReady, setFrameReady] = useState(false);
  const [inlineEditing, setInlineEditing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [scrollTick, setScrollTick] = useState(0);
  const revision = useRef(0);
  const acknowledgedRevision = useRef(0);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const inlineStartSent = useRef(false);
  const pendingSelection = useRef<WebsiteEditorSelection | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const devicePicked = useRef(false);
  const [elementSel, setElementSel] = useState<EditorElement | null>(null);
  const [tree, setTree] = useState<LayerNode[]>([]);
  const labelStart = useRef<SiteElements | null>(null);
  const latestElements = useRef(elements);
  latestElements.current = elements;
  // The properties panel edits the screen size that is being previewed.
  const breakpoint: Breakpoint = device === 'desktop' ? 'base' : device === 'tablet' ? 'tablet' : 'mobile';
  const latestBreakpoint = useRef(breakpoint);
  latestBreakpoint.current = breakpoint;
  const selectInFrame = useCallback((id: string) => {
    frameRef.current?.contentWindow?.postMessage({ type: 'luka-website-editor-select-id', id }, window.location.origin);
  }, []);

  const isElementHidden = (element: { id: string; kind: string }) => element.kind === 'section'
    ? !(layout.sections.find((section) => `section.${section.id}` === element.id)?.visible ?? true)
    : elements.hidden.includes(element.id);

  const runSectionAction = (sectionId: string, action: SectionAction) => {
    if (action === 'show' || action === 'hide') onChange(setCanvasSectionVisibilityModel(layout, sectionId, action === 'show'));
    else onChange(moveCanvasSectionModel(layout, sectionId, action === 'up' ? -1 : 1));
  };

  const toggleElementHidden = (element: { id: string; kind: string; props: string[] }) => {
    if (element.kind === 'section') {
      const sectionId = element.id.slice('section.'.length);
      runSectionAction(sectionId, isElementHidden(element) ? 'show' : 'hide');
      return;
    }
    if (!element.props.includes('hide')) return;
    onElementsChange?.(setElementHidden(elements, element.id, !elements.hidden.includes(element.id)), { before: elements });
  };
  // Free items are removed for real (undo brings them back); everything else is hidden.
  const removeFree = (id: string) => {
    onElementsChange?.(removeFreeItem(elements, id), { before: elements });
    setElementSel(null);
  };
  const duplicateFree = (id: string) => {
    const copy = duplicateFreeItem(elements, id);
    if (!copy) { adminToast('ერთ გვერდზე მაქსიმუმ 60 თავისუფალი ელემენტია.', 'error'); return; }
    onElementsChange?.(copy.elements, { before: elements });
    selectInFrame(copy.elementId);
  };
  const deleteOrHide = (element: { id: string; kind: string; props: string[] }) => {
    if (element.props.includes('free')) removeFree(element.id); else toggleElementHidden(element);
  };
  const latestToggle = useRef(deleteOrHide);
  latestToggle.current = deleteOrHide;
  const latestDuplicate = useRef(duplicateFree);
  latestDuplicate.current = duplicateFree;
  const latestSelection = useRef(elementSel);
  latestSelection.current = elementSel;

  // Shortcuts while the admin page (not the site canvas) has focus; typing in fields is left alone.
  useEffect(() => {
    if (variant !== 'inline') return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.closest('input, textarea, select, [contenteditable]') || document.querySelector('.admin-dialog, .strip-picker'))) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === 'z') { event.preventDefault(); onCommand?.(event.shiftKey ? 'redo' : 'undo'); return; }
      if (mod && key === 'y') { event.preventDefault(); onCommand?.('redo'); return; }
      if (mod && key === 's') { event.preventDefault(); onCommand?.('save'); return; }
      if (mod && key === 'd' && latestSelection.current?.props.includes('free')) { event.preventDefault(); latestDuplicate.current(latestSelection.current.id); return; }
      if ((key === 'delete' || key === 'backspace') && latestSelection.current) { event.preventDefault(); latestToggle.current(latestSelection.current); return; }
      if (key === 'escape') setElementSel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCommand, variant]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || isFull) return;
    const observer = new ResizeObserver(([entry]) => {
      setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      // On a narrow panel start with the phone view so the text is readable; the user can switch.
      if (!devicePicked.current && entry.contentRect.width > 0) {
        devicePicked.current = true;
        if (entry.contentRect.width < 640) setDevice('mobile');
        else if (entry.contentRect.width < 960) setDevice('tablet');
      }
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [isFull]);
  const sections = useMemo(() => sortWebsiteSections(layout).filter((section) => !isRetiredNativeSection(section)), [layout]);
  const currentSection = sections.find((section) => section.id === selectedSectionId);
  const selectionSection = sections.find((section) => section.id === selection?.sectionId) ?? currentSection;
  const selectedDefinition = selection && selectionSection?.sectionKey && selection.targetId
    ? getNativeElementDefinition(selectionSection.sectionKey, selection.targetId)
    : undefined;

  const sendDraft = useCallback(() => {
    const frame = frameRef.current?.contentWindow;
    if (!frame || !frameReady || inlineEditing) return;
    const nextRevision = revision.current + 1;
    revision.current = nextRevision;
    frame.postMessage({
      type: 'luka-website-preview-update', revision: nextRevision, config: layout, imageUrls,
      targetId: currentSection?.visible ? currentSection.anchorId : undefined,
      mode, selectionScope: isFull ? selectionScope : 'element',
      clickToEdit: variant === 'inline', allowInline: true,
      elements: variant === 'inline' ? elements : undefined,
    }, window.location.origin);
    const expected = nextRevision;
    const timeout = window.setTimeout(() => {
      if (acknowledgedRevision.current < expected) setSyncError('საიტის მონახაზი ჯერ არ პასუხობს. შეამოწმეთ კავშირი და სცადეთ ხელახლა.');
    }, 5000);
    window.setTimeout(() => window.clearTimeout(timeout), 5200);
  }, [currentSection, elements, frameReady, imageUrls, inlineEditing, isFull, layout, mode, selectionScope, variant]);

  useEffect(() => {
    if (!frameReady || inlineEditing) return;
    sendDraft();
  }, [device, elements, frameReady, imageUrls, inlineEditing, layout, mode, selectedSectionId, sendDraft]);

  useEffect(() => {
    if (!frameReady || !pendingSelection.current || !frameRef.current?.contentWindow) return;
    frameRef.current.contentWindow.postMessage({ type: 'luka-website-editor-set-selection', selection: pendingSelection.current }, window.location.origin);
    pendingSelection.current = null;
  }, [frameReady, selection]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      const data = event.data;
      if (data?.type === 'luka-website-preview-ready') { setFrameReady(true); return; }
      if (data?.type === 'luka-website-preview-applied') {
        if (typeof data.revision === 'number') acknowledgedRevision.current = Math.max(acknowledgedRevision.current, data.revision);
        setSyncError(''); return;
      }
      if (data?.type === 'luka-website-preview-rejected') { setSyncError('მონახაზის წინასწარი ნახვა ვერ განახლდა. შეცდომა არ შეინახება.'); return; }
      if (data?.type === 'luka-website-editor-tree' && Array.isArray(data.nodes)) {
        setTree(data.nodes.filter((node: unknown): node is LayerNode => Boolean(node && typeof (node as LayerNode).id === 'string')).slice(0, 400));
        return;
      }
      if (data?.type === 'luka-website-editor-key' && typeof data.command === 'string') {
        if (data.command === 'delete') { if (latestSelection.current) latestToggle.current(latestSelection.current); }
        else if (data.command === 'duplicate') { if (latestSelection.current?.props.includes('free')) latestDuplicate.current(latestSelection.current.id); }
        else if (data.command === 'undo' || data.command === 'redo' || data.command === 'save') onCommand?.(data.command);
        return;
      }
      // A free item was dragged, sized, cropped or rotated on the page: store it for this screen size.
      if (data?.type === 'luka-website-editor-free-change' && typeof data.id === 'string'
        && (data.id.startsWith('free.') || MOVABLE_ELEMENT_IDS.has(data.id))
        && data.values && typeof data.values === 'object') {
        const current = latestElements.current;
        if (data.id.startsWith('free.') && !current.free.some((item) => `free.${item.id}` === data.id)) return;
        let style = current.style;
        for (const key of FREE_GESTURE_KEYS) {
          const value = (data.values as Record<string, unknown>)[key];
          if (typeof value === 'number' && Number.isFinite(value)) style = setStyleValue(style, data.id, latestBreakpoint.current, key, value);
        }
        if (style !== current.style) onElementsChange?.({ ...current, style }, { before: current });
        return;
      }
      // Variant A: a specific element was clicked (or the selection was cleared).
      if (data?.type === 'luka-website-editor-element') {
        const element = data.element;
        setElementSel(element && typeof element.id === 'string' && Array.isArray(element.props) && element.rect ? element as EditorElement : null);
        return;
      }
      if (data?.type === 'luka-website-editor-label-start' && typeof data.id === 'string') {
        labelStart.current = latestElements.current;
        setInlineEditing(true);
        return;
      }
      if (data?.type === 'luka-website-editor-label-change' && typeof data.id === 'string' && typeof data.text === 'string') {
        onElementsChange?.(setElementText(latestElements.current, data.id, data.text), { live: true });
        return;
      }
      if (data?.type === 'luka-website-editor-label-finish' && typeof data.id === 'string' && typeof data.text === 'string') {
        const before = labelStart.current ?? latestElements.current;
        labelStart.current = null;
        setInlineEditing(false);
        if (data.canceled) onElementsChange?.(before, { live: true });
        else onElementsChange?.(setElementText(before, data.id, data.text.trim() || null), { before });
        return;
      }
      if (data?.type === 'luka-website-editor-selection' && validSelection(data.selection)) {
        // Variant A works with element panels; the section/element toolbar belongs to the full builder.
        if (variant === 'inline') return;
        onSelectSection(data.selection.sectionId);
        setSelection(data.selection);
        setMultiSelection([]);
        setPickerOpen(false);
        return;
      }
      if (data?.type === 'luka-website-editor-multi-selection' && Array.isArray(data.selections)) {
        const selections = data.selections.filter(validSelection).slice(0, 30);
        setSelection(null);
        setMultiSelection(selections);
        setPickerOpen(false);
        if (selections[0]) onSelectSection(selections[0].sectionId);
        return;
      }
      if (data?.type === 'luka-website-editor-deselect') { setSelection(null); setMultiSelection([]); return; }
      if (data?.type === 'luka-website-editor-add-section' && typeof data.sectionId === 'string'
        && (data.placement === 'before' || data.placement === 'after')) {
        onAddSection(data.sectionId, data.placement);
        return;
      }
      if (data?.type === 'luka-website-editor-restore-section' && typeof data.sectionId === 'string') {
        onChange(setCanvasSectionVisibilityModel(layout, data.sectionId, true));
        return;
      }
      if (data?.type === 'luka-website-editor-inline-start') {
        if (!inlineStartSent.current) { inlineStartSent.current = true; onInlineStart(); }
        setInlineEditing(true);
        return;
      }
      if (data?.type === 'luka-website-editor-inline-change' && typeof data.text === 'string'
        && typeof data.field === 'string' && validSelection({ ...data.selection, rect: { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 } })) {
        onInlineChange(updateWebsiteElementTextModel(layout, data.selection as WebsiteEditorSelection, data.field, data.text.slice(0, 3000)));
        return;
      }
      if (data?.type === 'luka-website-editor-inline-finish') {
        inlineStartSent.current = false;
        setInlineEditing(false);
        onInlineFinish();
        return;
      }
      if (data?.type === 'luka-website-editor-inline-cancel') {
        inlineStartSent.current = false;
        setInlineEditing(false);
        onInlineCancel();
        return;
      }
      if (data?.type === 'luka-website-editor-reorder' && typeof data.sectionId === 'string'
        && typeof data.sourceId === 'string' && typeof data.targetId === 'string') {
        const next = reorderCanvasBlockModel(layout, data.sectionId, data.sourceId, data.targetId);
        if (next !== layout) onChange(next);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [layout, onAddSection, onChange, onCommand, onElementsChange, onInlineCancel, onInlineChange, onInlineFinish, onInlineStart, onSelectSection, variant]);

  const frameWidth = deviceWidths[device];
  const frameLeft = stageRef.current && frameRef.current
    ? frameRef.current.getBoundingClientRect().left - stageRef.current.getBoundingClientRect().left + stageRef.current.scrollLeft
    : 0;
  const frameTop = stageRef.current && frameRef.current
    ? frameRef.current.getBoundingClientRect().top - stageRef.current.getBoundingClientRect().top + stageRef.current.scrollTop
    : 0;
  // A and B scale the page down to the panel's width instead of scrolling sideways.
  const scale = !isFull && stageSize.width > 0 ? Math.min(1, stageSize.width / frameWidth) : 1;
  const frameHeight = !isFull && stageSize.height > 0 ? Math.round(stageSize.height / scale) : undefined;
  const toStageRect = (item: CanvasSelection) => ({
    left: frameLeft + item.rect.left * scale, top: frameTop + item.rect.top * scale,
    width: item.rect.width * scale, height: item.rect.height * scale,
  });
  const multiRects = multiSelection.map(toStageRect);
  const selectionRect = selection ? toStageRect(selection) : multiRects.length ? {
    left: Math.min(...multiRects.map((rect) => rect.left)),
    top: Math.min(...multiRects.map((rect) => rect.top)),
    width: Math.max(...multiRects.map((rect) => rect.left + rect.width)) - Math.min(...multiRects.map((rect) => rect.left)),
    height: Math.max(...multiRects.map((rect) => rect.top + rect.height)) - Math.min(...multiRects.map((rect) => rect.top)),
  } : null;

  const selectSection = (id: string) => {
    setSelection(null);
    setMultiSelection([]);
    frameRef.current?.contentWindow?.postMessage({ type: 'luka-website-editor-set-selection', selection: null }, window.location.origin);
    frameRef.current?.contentWindow?.postMessage({ type: 'luka-website-editor-select-section', sectionId: id, label: sections.find((item) => item.id === id)?.label }, window.location.origin);
    onSelectSection(id);
  };

  const startEditing = () => {
    if (!selection || !frameRef.current?.contentWindow) return;
    frameRef.current.contentWindow.postMessage({ type: 'luka-website-editor-focus-field', selection, field: selection.fields[0] }, window.location.origin);
  };

  const updateConfig = (next: WebsiteLayoutConfig) => { onChange(next); setPickerOpen(false); };

  const hideSelection = () => {
    if (!selection) return;
    if (selection.kind === 'section') {
      updateConfig(setCanvasSectionVisibilityModel(layout, selection.sectionId, false));
    } else if (selection.kind === 'native' && selection.targetId) {
      updateConfig(setCanvasNativeVisibilityModel(layout, selection.sectionId, selection.targetId, false));
    } else if (selection.blockId) {
      updateConfig(setCanvasBlockVisibilityModel(layout, selection.sectionId, selection.blockId, false));
    }
  };

  const deleteSelection = () => {
    if (!selection) return;
    if (selection.kind === 'section') {
      const section = layout.sections.find((item) => item.id === selection.sectionId);
      if (!section) return;
      const warning = section.kind === 'native'
        ? `„${section.label}“ მთავარი გვერდიდან მოიხსნება. მისი შიგთავსი და React კომპონენტი უცვლელი დარჩება და სექციის აღდგენა ყოველთვის შესაძლებელი იქნება. გაგრძელდეს?`
        : `„${section.label}“ შაბლონის ასლი წაიშლება მიმდინარე მონახაზიდან. მოქმედების გაუქმება Undo-თი შეგიძლიათ. გაგრძელდეს?`;
      if (!window.confirm(warning)) return;
      if (section.kind === 'native') {
        updateConfig(setCanvasSectionVisibilityModel(layout, section.id, false));
      } else {
        updateConfig(removeCanvasTemplateSectionModel(layout, section.id));
        setSelection(null);
        frameRef.current?.contentWindow?.postMessage({ type: 'luka-website-editor-set-selection', selection: null }, window.location.origin);
        onSelectSection(sortWebsiteSections({ ...layout, sections: layout.sections.filter((item) => item.id !== section.id) })[0]?.id ?? 'hero');
      }
      return;
    }
    if (selection.kind === 'native' && selection.targetId) {
      hideSelection();
      return;
    }
    if (selection.blockId) updateConfig(deleteCanvasBlockModel(layout, selection.sectionId, selection.blockId));
  };

  const duplicateSelection = () => {
    if (selection?.kind === 'section') {
      const section = layout.sections.find((item) => item.id === selection.sectionId);
      if (section?.kind === 'template') onDuplicateSection(section.id);
      return;
    }
    if (selection?.kind === 'block' && selection.blockId) updateConfig(duplicateCanvasBlockModel(layout, selection.sectionId, selection.blockId));
  };

  const restoreSection = (sectionId: string) => updateConfig(setCanvasSectionVisibilityModel(layout, sectionId, true));
  const moveSelectedSection = (direction: -1 | 1) => {
    if (selection?.kind === 'section') updateConfig(moveCanvasSectionModel(layout, selection.sectionId, direction));
  };
  const hideMultiSelection = () => {
    if (!multiSelection.length) return;
    const next = multiSelection.reduce((config, item) => {
      if (item.kind === 'native' && item.targetId) return setCanvasNativeVisibilityModel(config, item.sectionId, item.targetId, false);
      if (item.kind === 'block' && item.blockId) return setCanvasBlockVisibilityModel(config, item.sectionId, item.blockId, false);
      return config;
    }, layout);
    updateConfig(next);
    setMultiSelection([]);
  };

  const addAtSelection = (type: Exclude<WebsiteBlockType, 'native-visibility'>) => {
    if (!selection) return;
    if (selection.kind === 'section') { onAddSection(selection.sectionId, 'after'); return; }
    let next = layout;
    let insertedId = '';
    if (selection.targetId && selectedDefinition?.allowedInsertions.length) {
      const inserted = insertCanvasNativeBlockModel(layout, selection.sectionId, selection.targetId, type);
      next = inserted.config;
      insertedId = inserted.blockId;
    } else if (selection.blockId) {
      const inserted = insertCanvasBlockAfterModel(layout, selection.sectionId, selection.blockId, type);
      next = inserted.config;
      insertedId = inserted.blockId;
    }
    updateConfig(next);
    if (insertedId) {
      const nextSelection: WebsiteEditorSelection = { kind: 'block', sectionId: selection.sectionId, blockId: insertedId, targetId: selection.targetId, label: blockNames[type], fields: editableFields(type) };
      pendingSelection.current = nextSelection;
      setSelection({ ...nextSelection, rect: selection.rect });
    }
  };

  const moveSection = (id: string, direction: -1 | 1) => {
    updateConfig(moveCanvasSectionModel(layout, id, direction));
  };

  const selectedCanvasSection = selection?.kind === 'section'
    ? sections.find((section) => section.id === selection.sectionId)
    : undefined;
  const selectedSectionIndex = selectedCanvasSection ? sections.findIndex((section) => section.id === selectedCanvasSection.id) : -1;
  const canHideMultiple = multiSelection.length > 0 && multiSelection.every((item) => {
    if (item.kind === 'block') return true;
    if (item.kind !== 'native' || !item.targetId) return false;
    const section = sections.find((candidate) => candidate.id === item.sectionId);
    return Boolean(section?.sectionKey && getNativeElementDefinition(section.sectionKey, item.targetId)?.canHide);
  });

  return <section className={`canvas-editor is-${variant}`} aria-label="საიტის ვიზუალური რედაქტორი">
    {!isFull ? <header className="canvas-editor-toolbar is-compact">
      <span className="canvas-editor-hint">
<MousePointer2 aria-hidden="true" /> მიიტანეთ მაუსი და დააჭირეთ ნებისმიერ ნაწილს. ტექსტი — იქვე დაწერეთ (Enter — დასრულება, Esc — გაუქმება); სხვა ელემენტი — გვერდით გაიხსნება პარამეტრები.
      </span>
      <div className="canvas-editor-device" role="group" aria-label="ეკრანის ზომა">
        <button type="button" className={device === 'desktop' ? 'is-active' : ''} aria-label="დესკტოპი" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor /></button>
        <button type="button" className={device === 'tablet' ? 'is-active' : ''} aria-label="ტაბლეტი" aria-pressed={device === 'tablet'} onClick={() => setDevice('tablet')}><Tablet /></button>
        <button type="button" className={device === 'mobile' ? 'is-active' : ''} aria-label="მობილური" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone /></button>
      </div>
      {syncError && <span className="canvas-editor-sync has-error" role="alert"><i />{syncError}</span>}
    </header> : <header className="canvas-editor-toolbar">
      <div className="canvas-editor-mode" role="group" aria-label="რედაქტირების რეჟიმი">
        <button type="button" className={mode === 'edit' ? 'is-active' : ''} aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}><Pencil aria-hidden="true" /> რედაქტირება</button>
        <button type="button" className={mode === 'preview' ? 'is-active' : ''} aria-pressed={mode === 'preview'} onClick={() => { setMode('preview'); setSelection(null); setMultiSelection([]); frameRef.current?.contentWindow?.postMessage({ type: 'luka-website-editor-set-selection', selection: null }, window.location.origin); }}><Eye aria-hidden="true" /> წინასწარი ნახვა</button>
      </div>
      {mode === 'edit' && <div className="canvas-editor-scope" role="group" aria-label="მონიშვნის რეჟიმი">
        <button type="button" className={selectionScope === 'element' ? 'is-active' : ''} aria-pressed={selectionScope === 'element'} onClick={() => { setSelectionScope('element'); setMultiSelection([]); }}><MousePointer2 aria-hidden="true" /> ელემენტი</button>
        <button type="button" className={selectionScope === 'section' ? 'is-active' : ''} aria-pressed={selectionScope === 'section'} onClick={() => { setSelectionScope('section'); setMultiSelection([]); }}><PanelsTopLeft aria-hidden="true" /> სექცია</button>
        <button type="button" className={selectionScope === 'multiple' ? 'is-active' : ''} aria-pressed={selectionScope === 'multiple'} onClick={() => { setSelectionScope('multiple'); setSelection(null); }}><Scan aria-hidden="true" /> არე</button>
      </div>}
      <div className="canvas-editor-device" role="group" aria-label="ეკრანის ზომა">
        <button type="button" className={device === 'desktop' ? 'is-active' : ''} aria-label="დესკტოპი" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor /></button>
        <button type="button" className={device === 'tablet' ? 'is-active' : ''} aria-label="ტაბლეტი" aria-pressed={device === 'tablet'} onClick={() => setDevice('tablet')}><Tablet /></button>
        <button type="button" className={device === 'mobile' ? 'is-active' : ''} aria-label="მობილური" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone /></button>
      </div>
      <span className={`canvas-editor-sync${syncError ? ' has-error' : ''}`} role={syncError ? 'alert' : 'status'}><i />{syncError || (dirty ? 'მონახაზის ცვლილებები' : 'საიტის მიმდინარე ვერსია')}</span>
    </header>}

    <div className={`canvas-editor-layout${layersOpen ? '' : ' is-collapsed'}${isFull ? '' : ' is-bare'}${variant === 'inline' ? ' is-studio' : ''}`}>
      {variant === 'inline' && (
        <LayersPanel
          nodes={tree}
          selectedId={elementSel?.id ?? null}
          onSelect={(id) => frameRef.current?.contentWindow?.postMessage({ type: 'luka-website-editor-select-id', id }, window.location.origin)}
          onToggleHidden={(node) => toggleElementHidden({ id: node.id, kind: node.kind, props: node.kind === 'section' ? ['section'] : ['hide'] })}
          isHidden={(node) => isElementHidden({ id: node.id, kind: node.kind })}
        />
      )}
      {isFull && <aside className="canvas-editor-layers" aria-label="სექციების ფენები">
        <div className="canvas-editor-layers-head"><div><strong>გვერდის ფენები</strong><small>{sections.length} სექცია</small></div><button type="button" aria-label={layersOpen ? 'ფენების დამალვა' : 'ფენების ჩვენება'} onClick={() => setLayersOpen(false)}><ChevronLeft /></button></div>
        {layersOpen && <>
        <div className="canvas-editor-layer-list">{sections.map((section, index) => <div className={`canvas-editor-layer${selectedSectionId === section.id ? ' is-active' : ''}${!section.visible ? ' is-hidden' : ''}`} key={section.id}>
            <button type="button" className="canvas-editor-layer-select" onClick={() => selectSection(section.id)} aria-current={selectedSectionId === section.id ? 'true' : undefined}><GripVertical aria-hidden="true" /><span><strong>{section.label}</strong><small>{section.kind === 'native' ? 'საიტის სექცია' : 'შაბლონი'}</small></span></button>
            <button type="button" aria-label={`${section.label} ${section.visible ? 'დამალვა' : 'აღდგენა'}`} title={section.visible ? 'დამალვა' : 'აღდგენა'} onClick={() => updateConfig(setCanvasSectionVisibilityModel(layout, section.id, !section.visible))}>{section.visible ? <EyeOff /> : <Eye />}</button>
            <div className="canvas-editor-layer-order"><button type="button" aria-label="ზემოთ გადატანა" disabled={index === 0} onClick={() => moveSection(section.id, -1)}><ArrowUp /></button><button type="button" aria-label="ქვემოთ გადატანა" disabled={index === sections.length - 1} onClick={() => moveSection(section.id, 1)}><ArrowDown /></button></div>
          </div>)}</div>
          <button type="button" className="canvas-editor-add-section" onClick={() => onAddSection()}><Plus /> ახალი სექცია</button>
        </>}
      </aside>}

      <div className="canvas-editor-main">
        {isFull && !layersOpen && <button type="button" className="canvas-editor-expand-layers" onClick={() => setLayersOpen(true)}><ChevronRight /> ფენები</button>}
        <div className="canvas-editor-stage" ref={stageRef} data-scroll-tick={scrollTick} onScroll={() => setScrollTick((value) => value + 1)}>
          <div className="canvas-editor-frame-fit" style={isFull ? undefined : { width: frameWidth * scale, height: frameHeight ? frameHeight * scale : undefined }}>
          <div className={`canvas-editor-frame-shell is-${device}`} style={isFull ? { width: frameWidth } : { width: frameWidth, height: frameHeight, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <iframe ref={frameRef} title="საიტის მონახაზის რედაქტირების ტილო" src="/?website-builder-preview=1" onLoad={() => { setFrameReady(false); frameRef.current?.contentWindow?.postMessage({ type: 'luka-website-preview-ping' }, window.location.origin); }} style={isFull ? { width: frameWidth } : { width: frameWidth, height: frameHeight, minHeight: 0 }} />
          </div>
          </div>
          {variant === 'inline' && elementSel && (() => {
            const box = {
              left: frameLeft + elementSel.rect.left * scale, top: frameTop + elementSel.rect.top * scale,
              width: elementSel.rect.width * scale, height: elementSel.rect.height * scale,
            };
            const stageWidth = stageRef.current?.clientWidth ?? 800;
            const toolbarTop = box.top > 44 ? box.top - 40 : box.top + box.height + 8;
            return <>
              <div className={`canvas-editor-selection-outline is-element${elementSel.kind === 'section' ? ' is-section' : ''}`} style={box} aria-hidden="true" />
              <ElementToolbar
                element={elementSel}
                style={{ left: Math.max(8, Math.min(box.left, stageWidth - 260)), top: Math.max(6, toolbarTop) }}
                hidden={isElementHidden(elementSel)}
                onParent={() => frameRef.current?.contentWindow?.postMessage({ type: 'luka-website-editor-select-parent', id: elementSel.id }, window.location.origin)}
                onToggleHidden={() => toggleElementHidden(elementSel)}
                onDuplicate={elementSel.props.includes('free') ? () => duplicateFree(elementSel.id) : undefined}
                onDelete={elementSel.props.includes('free') ? () => removeFree(elementSel.id) : undefined}
                onClose={() => setElementSel(null)}
              />
            </>;
          })()}
          {isFull && mode === 'edit' && selectionRect && <>
            {multiRects.length > 0
              ? multiRects.map((rect, index) => <div key={`${multiSelection[index]?.blockId ?? multiSelection[index]?.targetId}-${index}`} className="canvas-editor-selection-outline is-multi" style={rect} aria-hidden="true" />)
              : <div className="canvas-editor-selection-outline" style={selectionRect} aria-hidden="true" />}
            <div className={`canvas-editor-context${selection?.kind === 'section' ? ' is-section' : ''}`} style={{ left: Math.max(8, Math.min(selectionRect.left, (stageRef.current?.clientWidth ?? 600) - 420)), top: Math.max(8, selectionRect.top - 48) }} role="toolbar" aria-label={`${multiSelection.length ? `${multiSelection.length} ელემენტი` : selection?.label ?? 'ელემენტი'} — მოქმედებები`}>
              {multiSelection.length > 0 ? <>
                <strong>{multiSelection.length} ელემენტი</strong>
                {canHideMultiple && <button type="button" title="მონიშნული ელემენტების დამალვა" aria-label="მონიშნული ელემენტების დამალვა" onClick={hideMultiSelection}><EyeOff /><span>დამალვა</span></button>}
                <button type="button" title="მონიშვნის გაუქმება" aria-label="მონიშვნის გაუქმება" onClick={() => { setMultiSelection([]); frameRef.current?.contentWindow?.postMessage({ type: 'luka-website-editor-set-selection', selection: null }, window.location.origin); }}><X /></button>
              </> : selection?.kind === 'section' && selectedCanvasSection ? <>
                <strong title={selectedCanvasSection.label}>{selectedCanvasSection.label} · სექცია</strong>
                {isFull && <button type="button" title="სექციის რედაქტირება" aria-label="რედაქტირება" onClick={() => onEditSection(selectedCanvasSection.id)}><Pencil /><span>რედაქტირება</span></button>}
                {selectedCanvasSection.visible
                  ? <button type="button" title="სექციის დამალვა" aria-label="დამალვა" onClick={hideSelection}><EyeOff /><span>დამალვა</span></button>
                  : <button type="button" title="დამალული სექციის აღდგენა" aria-label="აღდგენა" onClick={() => restoreSection(selectedCanvasSection.id)}><Eye /><span>აღდგენა</span></button>}
                {isFull && <button type="button" title={selectedCanvasSection.kind === 'native' ? 'მოცილება შექცევადია' : 'შაბლონის წაშლა მონახაზიდან'} aria-label="სექციის წაშლა" onClick={deleteSelection}><Trash2 /><span>წაშლა</span></button>}
                {isFull && selectedCanvasSection.kind === 'template' && <button type="button" title="სექციის დუბლირება" aria-label="დუბლირება" onClick={duplicateSelection}><Copy /><span>დუბლირება</span></button>}
                {isFull && <button type="button" title="სექციის დამატება წინ" aria-label="სექციის დამატება წინ" onClick={() => onAddSection(selectedCanvasSection.id, 'before')}><Plus /><span>წინ დამატება</span></button>}
                {isFull && <button type="button" title="სექციის დამატება შემდეგ" aria-label="სექციის დამატება შემდეგ" onClick={() => onAddSection(selectedCanvasSection.id, 'after')}><Plus /><span>შემდეგ დამატება</span></button>}
                <button type="button" title="ზემოთ გადაადგილება" aria-label="ზემოთ გადაადგილება" disabled={selectedSectionIndex <= 0} onClick={() => moveSelectedSection(-1)}><ArrowUp /></button>
                <button type="button" title="ქვემოთ გადაადგილება" aria-label="ქვემოთ გადაადგილება" disabled={selectedSectionIndex < 0 || selectedSectionIndex >= sections.length - 1} onClick={() => moveSelectedSection(1)}><ArrowDown /></button>
                <button type="button" title="მონიშვნის მოხსნა" aria-label="მონიშვნის მოხსნა" onClick={() => { setSelection(null); frameRef.current?.contentWindow?.postMessage({ type: 'luka-website-editor-set-selection', selection: null }, window.location.origin); }}><X /></button>
              </> : <>
                <strong title={selection?.label}>{selection?.label}</strong>
                {isFull && selection && selection.fields.length > 0 && <button type="button" title="ტექსტის რედაქტირება" aria-label="რედაქტირება" onClick={startEditing}><Pencil /></button>}
                {selection && ((selection.kind === 'native' && selectedDefinition?.canHide) || selection.kind === 'block') && <button type="button" title="ელემენტის დამალვა" aria-label="დამალვა" onClick={hideSelection}><EyeOff />{!isFull && <span>დამალვა</span>}</button>}
                {isFull && selection?.kind === 'block' && <button type="button" title="დუბლირება" aria-label="დუბლირება" onClick={duplicateSelection}><Copy /></button>}
                {isFull && selection && ((selection.kind === 'native' && selectedDefinition?.canHide) || selection.kind === 'block') && <button type="button" title="მონახაზიდან მოცილება" aria-label="წაშლა" onClick={deleteSelection}><Trash2 /></button>}
                {isFull && selection && <button type="button" title="ელემენტის დამატება" aria-label="დამატება" onClick={() => setPickerOpen((open) => !open)}><Plus /></button>}
                <button type="button" title="მონიშვნის მოხსნა" aria-label="მონიშვნის მოხსნა" onClick={() => { setSelection(null); frameRef.current?.contentWindow?.postMessage({ type: 'luka-website-editor-set-selection', selection: null }, window.location.origin); }}><X /></button>
                {pickerOpen && selection && <div className="canvas-editor-picker" role="menu" aria-label="ელემენტის არჩევა">
                  <strong>დაამატეთ აქ</strong>
                  {(selection.targetId && selectedDefinition ? selectedDefinition.allowedInsertions : insertable).filter((type): type is Exclude<WebsiteBlockType, 'native-visibility'> => type !== 'native-visibility').map((type) => <button type="button" role="menuitem" key={type} onClick={() => addAtSelection(type)}>{blockNames[type]}</button>)}
                </div>}
              </>}
            </div>
          </>}
          {mode === 'preview' && <div className="canvas-editor-preview-shield" aria-hidden="true" />}
        </div>
        <footer className="canvas-editor-caption"><span>{variant === 'inline' ? 'ღილაკები და ბმულები აქ არ მუშაობს — ეს მხოლოდ რედაქტირებისთვისაა.' : mode === 'edit' ? 'ელემენტზე ერთი დაჭერა მონიშნავს, ორჯერ დაჭერა ტექსტს შეცვლის.' : 'საიტი მუშაობს ჩვეულებრივ რეჟიმში.'}</span><span>{device === 'desktop' ? 'დესკტოპი' : device === 'tablet' ? 'ტაბლეტი' : 'მობილური'} · {frameWidth}px</span></footer>
      </div>
      {variant === 'inline' && (
        <PropertiesPanel
          element={elementSel}
          layout={layout}
          elements={elements}
          breakpoint={breakpoint}
          onBreakpoint={(next) => setDevice(next === 'base' ? 'desktop' : next === 'tablet' ? 'tablet' : 'mobile')}
          onElements={(next) => onElementsChange?.(next, { before: elements })}
          onCopy={(sectionId, key, value) => onCopyChange?.(sectionId, key, value)}
          onHeroImage={(file) => onHeroImage?.(file) ?? Promise.resolve()}
          onSection={(sectionId, action) => runSectionAction(sectionId, action)}
          sectionVisible={(sectionId) => layout.sections.find((section) => section.id === sectionId)?.visible ?? true}
          onSelectId={selectInFrame}
          onDuplicateFree={duplicateFree}
          onRemoveFree={removeFree}
        />
      )}
    </div>
  </section>;
}

function editableFields(type: WebsiteBlockType) {
  if (type === 'eyebrow' || type === 'heading' || type === 'subheading' || type === 'paragraph') return ['text'];
  if (type === 'button') return ['label'];
  return [];
}

