/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useCallback, useState, useEffect, useLayoutEffect, useRef } from 'react';
import Header from './components/Header';
import LoadingScreen from './components/LoadingScreen';
import { ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import WebsiteSectionRenderer from './websiteSections/WebsiteSectionRenderer';
import { DEFAULT_WEBSITE_LAYOUT, getWebsiteNavigationSections, resolveWebsiteLayoutManagerConfig, sortWebsiteSections, validateWebsiteLayout } from './websiteSections/model';
import type { WebsiteLayoutConfig } from './websiteSections/model';
import { loadPublishedWebsiteLayout, loadWebsiteLayoutManager } from './websiteSections/repository';
import { SiteProfileProvider } from './SiteProfileContext';
import { normalizeSiteElements, type SiteElements } from './siteElements';
import { WebsiteEditorRuntimeProvider, type WebsiteEditorSelection } from './websiteSections/EditorRuntime';
import { getBlockEditableField, isTrustedPreviewMessage, rectsIntersect, shouldApplyPreviewRevision, type SelectionScope } from './websiteSections/previewProtocol';

const PortfolioCatalogPage = lazy(() => import('./components/PortfolioCatalogPage'));
const AdminPanel = lazy(() => import('./admin/AdminPanel'));

function CatalogPageFallback() {
  return (
    <main id="main-content" tabIndex={-1} className="content-layer min-h-screen px-5 pt-36 outline-none sm:px-8">
      <div className="container-xl" role="status" aria-live="polite">
        <div className="flex items-center gap-3 border-b border-[var(--brand-line)] pb-8 text-sm font-semibold text-[var(--brand-muted)]">
          <span className="button-spinner h-4 w-4 animate-spin rounded-full border-2" />
          კატალოგი იტვირთება...
        </div>
      </div>
    </main>
  );
}

export default function App() {
  const isWebsiteBuilderPreview = new URLSearchParams(window.location.search).has('website-builder-preview');
  const isDraftPreview = new URLSearchParams(window.location.search).get('preview') === 'draft';
  const [activeSection, setActiveSection] = useState('home');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(() => !isWebsiteBuilderPreview);
  const [websiteLayout, setWebsiteLayout] = useState(DEFAULT_WEBSITE_LAYOUT);
  const [websiteImageUrls, setWebsiteImageUrls] = useState<Record<string, string>>({});
  const [previewTarget, setPreviewTarget] = useState('');
  const [previewEditorMode, setPreviewEditorMode] = useState(false);
  const [previewSelection, setPreviewSelection] = useState<WebsiteEditorSelection | null>(null);
  const [previewSelectionScope, setPreviewSelectionScope] = useState<SelectionScope>('element');
  // Editor variants: A edits text on a single click; B only reports which text was clicked.
  const [previewClickToEdit, setPreviewClickToEdit] = useState(false);
  const [previewAllowInline, setPreviewAllowInline] = useState(true);
  // Unsaved element changes (hidden items, labels, links, poster strip) sent by the editor.
  const [previewElements, setPreviewElements] = useState<SiteElements | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const lastAcceptedPreviewRevision = useRef(0);
  const acknowledgedPreviewRevision = useRef(0);
  const lastPreviewSelection = useRef<WebsiteEditorSelection | null>(null);
  // Element selected in the editor (variant A); kept across re-renders so its panel follows scrolling.
  const lastEditElement = useRef<string | null>(null);
  const [routePath, setRoutePath] = useState(() => window.location.pathname);
  const isAdminPage = routePath.replace(/\/+$/, '') === '/admin';
  const isPortfolioPage = routePath.startsWith('/portfolio');

  // The public site's editorial styles are scoped to data-surface="site"; the admin keeps its own look.
  useLayoutEffect(() => {
    document.documentElement.dataset.surface = isAdminPage ? 'admin' : 'site';
  }, [isAdminPage]);

  useEffect(() => {
    const syncRoute = () => setRoutePath(window.location.pathname);

    window.addEventListener('popstate', syncRoute);
    window.addEventListener('app:navigate', syncRoute);

    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('app:navigate', syncRoute);
    };
  }, []);

  // Draft preview opened from the editor: the working layout (only an admin session can read it).
  useEffect(() => {
    if (!isDraftPreview || isAdminPage || isPortfolioPage) return;
    let active = true;
    void loadWebsiteLayoutManager().then((result) => {
      if (!active) return;
      setWebsiteLayout(resolveWebsiteLayoutManagerConfig(result.versions));
      setWebsiteImageUrls(Object.fromEntries(result.assets.flatMap((asset) => asset.previewUrl ? [[asset.id, asset.previewUrl]] : [])));
    }).catch(() => { /* not an admin or offline: the published site is shown */ });
    return () => { active = false; };
  }, [isAdminPage, isDraftPreview, isPortfolioPage]);

  useEffect(() => {
    if (isAdminPage || isPortfolioPage || isWebsiteBuilderPreview || isDraftPreview) return;
    const isDynamicSiteEnabled = import.meta.env.VITE_PUBLIC_CATALOG_SOURCE === 'supabase'
      && (import.meta.env.MODE === 'staging' || import.meta.env.PROD);
    if (!isDynamicSiteEnabled) return;
    let active = true;
    const refreshPublishedLayout = () => {
      void loadPublishedWebsiteLayout().then((result) => {
        if (!active) return;
        setWebsiteLayout(result.config);
        setWebsiteImageUrls(result.imageUrls);
        if (result.warning) console.warn(result.warning);
      });
    };
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') refreshPublishedLayout(); };
    refreshPublishedLayout();
    const timer = window.setInterval(refreshPublishedLayout, 8 * 60 * 1000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [isAdminPage, isDraftPreview, isPortfolioPage, isWebsiteBuilderPreview]);

  useEffect(() => {
    if (!isWebsiteBuilderPreview || window.parent === window) return;
    let acceptedUpdate = false;
    const sendReady = () => window.parent.postMessage({ type: 'luka-website-preview-ready' }, window.location.origin);
    const receiveDraft = (event: MessageEvent) => {
      if (!isTrustedPreviewMessage(event.origin, event.source, window.location.origin, window.parent)) return;
      if (event.data?.type === 'luka-website-preview-ping') { sendReady(); return; }
      if (event.data?.type === 'luka-website-editor-set-selection') {
        const selection = event.data.selection;
        if (selection === null) { lastPreviewSelection.current = null; setPreviewSelection(null); return; }
        if (selection && (selection.kind === 'native' || selection.kind === 'block')
          && typeof selection.sectionId === 'string' && typeof selection.label === 'string'
          && Array.isArray(selection.fields) && selection.fields.every((field: unknown) => typeof field === 'string')) {
          setPreviewSelection(selection as WebsiteEditorSelection);
        }
        return;
      }
      if (event.data?.type === 'luka-website-editor-select-section' && typeof event.data.sectionId === 'string') {
        const sectionId = event.data.sectionId;
        const label = typeof event.data.label === 'string' ? event.data.label.slice(0, 120) : 'სექცია';
        if (/^[a-z0-9-]{1,100}$/i.test(sectionId)) {
          const selection: WebsiteEditorSelection = { kind: 'section', sectionId, label, fields: [] };
          lastPreviewSelection.current = selection;
          setPreviewSelection(selection);
        }
        return;
      }
      if (event.data?.type === 'luka-website-editor-focus-field') {
        window.dispatchEvent(new CustomEvent('luka-website-editor-focus-field', { detail: event.data }));
        return;
      }
      if (event.data?.type !== 'luka-website-preview-update') return;
      const revision = Number.isSafeInteger(event.data.revision) && event.data.revision > 0
        ? event.data.revision
        : lastAcceptedPreviewRevision.current + 1;
      if (!validateWebsiteLayout(event.data.config)) {
        window.parent.postMessage({ type: 'luka-website-preview-rejected', revision, reason: 'invalid-layout' }, window.location.origin);
        return;
      }
      const imageUrls = event.data.imageUrls;
      if (imageUrls !== undefined && (!imageUrls || typeof imageUrls !== 'object' || Array.isArray(imageUrls)
        || Object.values(imageUrls).some((url) => typeof url !== 'string' || !url.startsWith('https://')))) {
        window.parent.postMessage({ type: 'luka-website-preview-rejected', revision, reason: 'invalid-assets' }, window.location.origin);
        return;
      }
      if (!shouldApplyPreviewRevision(lastAcceptedPreviewRevision.current, revision)) {
        window.parent.postMessage({ type: 'luka-website-preview-applied', revision: lastAcceptedPreviewRevision.current }, window.location.origin);
        return;
      }
      lastAcceptedPreviewRevision.current = revision;
      acceptedUpdate = true;
      setWebsiteLayout(event.data.config as WebsiteLayoutConfig);
      setWebsiteImageUrls((imageUrls ?? {}) as Record<string, string>);
      setPreviewTarget(typeof event.data.targetId === 'string' && /^[a-z0-9-]{1,100}$/i.test(event.data.targetId) ? event.data.targetId : '');
      setPreviewEditorMode(event.data.mode === 'edit');
      setPreviewSelectionScope(event.data.selectionScope === 'section' || event.data.selectionScope === 'multiple' ? event.data.selectionScope : 'element');
      setPreviewClickToEdit(event.data.clickToEdit === true);
      setPreviewAllowInline(event.data.allowInline !== false);
      setPreviewElements(event.data.elements ? normalizeSiteElements(event.data.elements) : null);
      setPreviewRevision(revision);
    };
    window.addEventListener('message', receiveDraft);
    sendReady();
    const readyRetry = window.setInterval(() => { if (!acceptedUpdate) sendReady(); }, 400);
    return () => { window.clearInterval(readyRetry); window.removeEventListener('message', receiveDraft); };
  }, [isWebsiteBuilderPreview]);

  useEffect(() => {
    if (!isWebsiteBuilderPreview || !previewEditorMode) return;
    const original = new Map<HTMLElement, { root?: string; label?: string }>();
    const roots = Array.from(document.querySelectorAll<HTMLElement>('section[id], footer[id]'));
    for (const section of websiteLayout.sections) {
      if (!section.visible || section.kind !== 'native') continue;
      for (const root of roots.filter((element) => element.id === section.anchorId)) {
        original.set(root, { root: root.dataset.websiteEditorSectionRoot, label: root.dataset.websiteEditorSectionLabel });
        root.dataset.websiteEditorSectionRoot = section.id;
        root.dataset.websiteEditorSectionLabel = section.label;
      }
    }
    return () => {
      for (const [root, values] of original) {
        if (values.root === undefined) delete root.dataset.websiteEditorSectionRoot;
        else root.dataset.websiteEditorSectionRoot = values.root;
        if (values.label === undefined) delete root.dataset.websiteEditorSectionLabel;
        else root.dataset.websiteEditorSectionLabel = values.label;
      }
    };
  }, [isWebsiteBuilderPreview, previewEditorMode, websiteLayout]);

  // Layers panel: after each render, report every editable element with its parent, in page order.
  useEffect(() => {
    if (!isWebsiteBuilderPreview || !previewEditorMode || !previewClickToEdit || window.parent === window) return;
    const frame = requestAnimationFrame(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-edit-id]')).slice(0, 400).map((element) => ({
        id: element.dataset.editId as string,
        label: element.dataset.editLabel ?? 'ელემენტი',
        kind: element.dataset.editKind ?? 'item',
        hidden: element.dataset.editHidden === 'true',
        parent: element.parentElement?.closest<HTMLElement>('[data-edit-id]')?.dataset.editId ?? null,
        text: (element.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      }));
      window.parent.postMessage({ type: 'luka-website-editor-tree', nodes }, window.location.origin);
    });
    return () => cancelAnimationFrame(frame);
  }, [isWebsiteBuilderPreview, previewClickToEdit, previewEditorMode, previewElements, previewRevision, websiteLayout]);

  // After each change from the editor is on the page (the element stylesheet renders in the same
  // commit): drop temporary drag styles before paint and keep the selected element's box (and
  // free-item handles) where the element now is.
  useLayoutEffect(() => {
    if (!isWebsiteBuilderPreview || !previewClickToEdit || window.parent === window) return;
    document.querySelectorAll<HTMLElement>('[data-free-inline]').forEach(clearFreeInline);
    const id = lastEditElement.current;
    if (!id) return;
    markSelectedFreeItem(id);
    const element = document.querySelector<HTMLElement>(`[data-edit-id="${CSS.escape(id)}"]`);
    const described = element ? describeEditElement(element) : null;
    if (described) window.parent.postMessage({ type: 'luka-website-editor-element', element: described }, window.location.origin);
  }, [isWebsiteBuilderPreview, previewClickToEdit, previewElements, websiteLayout]);

  // Lets CSS switch off hover effects and pointer cursors while the page is being edited.
  useLayoutEffect(() => {
    if (!isWebsiteBuilderPreview) return;
    const root = document.documentElement;
    if (previewEditorMode) root.dataset.websiteEditor = previewClickToEdit ? 'inline' : 'on';
    else delete root.dataset.websiteEditor;
  }, [isWebsiteBuilderPreview, previewClickToEdit, previewEditorMode]);

  useEffect(() => {
    if (!isWebsiteBuilderPreview || window.parent === window || previewRevision <= acknowledgedPreviewRevision.current) return;
    acknowledgedPreviewRevision.current = previewRevision;
    window.parent.postMessage({ type: 'luka-website-preview-applied', revision: previewRevision }, window.location.origin);

  }, [isWebsiteBuilderPreview, previewRevision]);

  useEffect(() => {
    if (!isWebsiteBuilderPreview || !previewEditorMode || !previewSelection) return;
    const selection = previewSelection;
    const frame = requestAnimationFrame(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-website-editor-section-root], [data-website-editor-target], [data-website-editor-block]'));
    const rect = selection.kind === 'section'
      ? elementBoundsUnion(elements.filter((element) => element.dataset.websiteEditorSectionRoot === selection.sectionId))
      : selection.kind === 'native'
        ? (() => { const element = elements.find((item) => item.dataset.websiteEditorTarget === selection.targetId); return element ? elementBounds(element) : null; })()
        : (() => { const element = elements.find((item) => item.dataset.websiteEditorBlock === selection.blockId); return element ? elementBounds(element) : null; })();
    if (!rect) return;
    window.parent.postMessage({ type: 'luka-website-editor-selection', selection: { ...selection, rect } }, window.location.origin);
    });
    return () => cancelAnimationFrame(frame);
  }, [isWebsiteBuilderPreview, previewEditorMode, previewSelection, websiteLayout]);

  useEffect(() => {
    if (!isWebsiteBuilderPreview || !previewEditorMode) return;
    const sendSelection = (eventTarget: EventTarget | null) => {
      if (!(eventTarget instanceof Element)) return null;
      const sectionRoot = eventTarget.closest<HTMLElement>('[data-website-editor-section-root]')
        ?? eventTarget.closest<HTMLElement>('section[id], footer[id]');
      const sectionId = sectionRoot?.dataset.websiteEditorSectionRoot
        ?? websiteLayout.sections.find((section) => section.anchorId === sectionRoot?.id)?.id
        ?? sectionRoot?.dataset.websiteSection;
      const section = websiteLayout.sections.find((item) => item.id === sectionId);
      const selectSection = () => {
        if (!section || !sectionRoot) return null;
        const selection: WebsiteEditorSelection = { kind: 'section', sectionId: section.id, label: section.label, fields: [] };
        const roots = Array.from(document.querySelectorAll<HTMLElement>('[data-website-editor-section-root]'))
          .filter((element) => element.dataset.websiteEditorSectionRoot === section.id);
        const rect = elementBoundsUnion(roots.length ? roots : [sectionRoot]);
        if (rect) window.parent.postMessage({ type: 'luka-website-editor-selection', selection: { ...selection, rect } }, window.location.origin);
        lastPreviewSelection.current = selection;
        setPreviewSelection(selection);
        return { owner: sectionRoot, inline: null, selection };
      };
      if (previewSelectionScope === 'section') return selectSection();
      const block = eventTarget.closest<HTMLElement>('[data-website-editor-block]');
      const native = eventTarget.closest<HTMLElement>('[data-website-editor-target]');
      const owner = block ?? native;
      if (!owner) return selectSection();
      const inline = eventTarget.closest<HTMLElement>('[data-website-editor-inline-field]');
      const ownerSectionId = owner.dataset.websiteEditorSection;
      const blockId = block?.dataset.websiteEditorBlock;
      const targetId = native?.dataset.websiteEditorTarget;
      if (!ownerSectionId || (block && !blockId) || (!block && !targetId)) return selectSection();
      const fields = inline
        ? [inline.dataset.websiteEditorInlineField ?? '']
        : Array.from(owner.querySelectorAll<HTMLElement>('[data-website-editor-inline-field]'))
          .map((field) => field.dataset.websiteEditorInlineField ?? '').filter(Boolean);
      const selection: WebsiteEditorSelection = {
        kind: block ? 'block' : 'native', sectionId: ownerSectionId,
        ...(blockId ? { blockId } : {}), ...(targetId ? { targetId } : {}),
        label: owner.dataset.websiteEditorLabel ?? (block ? 'ელემენტი' : targetId ?? 'სექციის ელემენტი'),
        fields,
      };
      const rect = elementBounds(owner);
      if (rect) window.parent.postMessage({ type: 'luka-website-editor-selection', selection: { ...selection, rect } }, window.location.origin);
      lastPreviewSelection.current = selection;
      setPreviewSelection(selection);
      return { owner, inline, selection };
    };

    const preventNavigation = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      if (suppressClickAfterMarquee) { suppressClickAfterMarquee = false; event.preventDefault(); event.stopPropagation(); return; }
      // Text being typed into: let the click place the caret, but never follow a link or press a button.
      if (event.target.closest('[contenteditable]')) {
        if (event.target.closest('a,button,label')) { event.preventDefault(); event.stopPropagation(); }
        return;
      }
      // Variant A: a click edits exactly what is under the pointer — a text in place, any other
      // element (image, link, button, icon, row) opens its panel in the admin. Nothing else happens.
      if (previewClickToEdit) {
        event.preventDefault();
        event.stopPropagation();
        const point = event instanceof MouseEvent ? { x: event.clientX, y: event.clientY } : undefined;
        const copyText = event.target.closest<HTMLElement>('[data-website-editor-inline-field]');
        if (copyText && copyText.closest('[data-website-editor-block], [data-website-editor-target]')) {
          startInlineEdit(copyText, point);
          postElement(elementOwner(copyText));
          return;
        }
        // A free item is selected by the first click (so it can be dragged); clicking the
        // selected free text again starts typing.
        const freeItem = event.target.closest<HTMLElement>(MOVABLE_SELECTOR);
        if (freeItem) {
          const freeText = freeItem.querySelector<HTMLElement>(':scope > [data-edit-text]');
          if (freeText && lastEditElement.current === freeItem.dataset.editId && !event.target.closest('[data-free-handle]')) startLabelEdit(freeText, point);
          postElement(freeItem);
          return;
        }
        const label = event.target.closest<HTMLElement>('[data-edit-text]');
        if (label) {
          startLabelEdit(label, point);
          postElement(elementOwner(label));
          return;
        }
        const element = event.target.closest<HTMLElement>('[data-edit-id]');
        postElement(element);
        return;
      }
      const addBefore = event.target.closest<HTMLElement>('[data-website-editor-add-section-before]');
      const addAfter = event.target.closest<HTMLElement>('[data-website-editor-add-section-after]');
      const restoreSection = event.target.closest<HTMLElement>('[data-website-editor-restore-section]');
      if (addBefore || addAfter) {
        const element = addBefore ?? addAfter!;
        window.parent.postMessage({ type: 'luka-website-editor-add-section', sectionId: element.dataset.websiteEditorAddSectionBefore ?? element.dataset.websiteEditorAddSectionAfter, placement: addBefore ? 'before' : 'after' }, window.location.origin);
        event.preventDefault(); event.stopPropagation(); return;
      }
      if (restoreSection) {
        window.parent.postMessage({ type: 'luka-website-editor-restore-section', sectionId: restoreSection.dataset.websiteEditorRestoreSection }, window.location.origin);
        event.preventDefault(); event.stopPropagation(); return;
      }
      const selected = sendSelection(event.target);
      event.preventDefault();
      event.stopPropagation();
      if (!selected && event.target.closest('a,button,input,textarea,select,form')) event.stopImmediatePropagation();
    };

    // A text inside a link or button belongs to that link/button (its panel offers the link and
    // hiding); a free-standing text is its own element.
    const elementOwner = (node: HTMLElement) => {
      const own = node.closest<HTMLElement>('[data-edit-id]');
      if (!own || own.dataset.editKind !== 'text') return own;
      return own.parentElement?.closest<HTMLElement>('[data-edit-id]:not([data-edit-kind="text"])') ?? own;
    };
    const postElement = (element: HTMLElement | null) => {
      const described = element ? describeEditElement(element) : null;
      lastEditElement.current = described?.id ?? null;
      markSelectedFreeItem(lastEditElement.current);
      window.parent.postMessage({ type: 'luka-website-editor-element', element: described }, window.location.origin);
    };

    // Short labels stored as element changes (not section copy), typed in place like copy text.
    const startLabelEdit = (label: HTMLElement, point?: { x: number; y: number }) => {
      if (label.isContentEditable || !label.dataset.editText) return;
      label.dataset.websiteEditorOriginalText = label.innerText;
      label.setAttribute('contenteditable', 'plaintext-only');
      label.setAttribute('spellcheck', 'true');
      label.focus();
      const caret = point && document.caretRangeFromPoint?.(point.x, point.y);
      const range = caret && label.contains(caret.startContainer) ? caret : document.createRange();
      if (range !== caret) range.selectNodeContents(label);
      const selection = window.getSelection();
      selection?.removeAllRanges(); selection?.addRange(range);
      window.parent.postMessage({ type: 'luka-website-editor-label-start', id: label.dataset.editText }, window.location.origin);
    };

    const startInlineEdit = (target: EventTarget | null, point?: { x: number; y: number }) => {
      if (!(target instanceof Element) || !previewAllowInline) return;
      const inline = target.closest<HTMLElement>('[data-website-editor-inline-field]');
      if (!inline || inline.isContentEditable) return;
      const owner = inline.closest<HTMLElement>('[data-website-editor-block], [data-website-editor-target]');
      if (!owner) return;
      const info = sendSelection(inline);
      if (!info) return;
      inline.dataset.websiteEditorOriginalText = inline.innerText;
      inline.setAttribute('contenteditable', 'plaintext-only');
      inline.setAttribute('spellcheck', 'true');
      inline.focus();
      // A click puts the caret where it landed; a double-click or the edit button selects all.
      const caret = point && document.caretRangeFromPoint?.(point.x, point.y);
      const range = caret && inline.contains(caret.startContainer) ? caret : document.createRange();
      if (range !== caret) range.selectNodeContents(inline);
      const selection = window.getSelection();
      selection?.removeAllRanges(); selection?.addRange(range);
      window.parent.postMessage({ type: 'luka-website-editor-inline-start', selection: info.selection }, window.location.origin);
    };

    const handleParentInlineEdit = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail?.selection || typeof detail.field !== 'string') return;
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('[data-website-editor-block], [data-website-editor-target]'));
      const owner = candidates.find((element) => detail.selection.kind === 'block'
        ? element.dataset.websiteEditorBlock === detail.selection.blockId
        : element.dataset.websiteEditorTarget === detail.selection.targetId);
      const inline = owner && Array.from(owner.querySelectorAll<HTMLElement>('[data-website-editor-inline-field]'))
        .find((field) => field.dataset.websiteEditorInlineField === detail.field);
      if (inline) startInlineEdit(inline);
    };

    let drag: { id: string; sectionId: string; groupId: string; startX: number; startY: number; visual: HTMLElement; moved: boolean; targetId?: string } | null = null;
    let marquee: { startX: number; startY: number; box: HTMLDivElement; moved: boolean } | null = null;
    let suppressClickAfterMarquee = false;
    const clearDrag = () => {
      if (!drag) return;
      drag.visual.style.transform = '';
      drag.visual.style.zIndex = '';
      drag.visual.style.pointerEvents = '';
      drag.visual.removeAttribute('data-website-editor-dragging');
      document.querySelectorAll('[data-website-editor-drop-target]').forEach((element) => element.removeAttribute('data-website-editor-drop-target'));
      drag = null;
    };
    const clearMarquee = () => { marquee?.box.remove(); marquee = null; };

    // Free items: drag to move; the corner handle sizes, the bottom bar crops (images), the top
    // circle rotates. The page shows the change at once; on release the editor stores it for the
    // screen size being edited.
    type FreeMode = 'move' | 'resize' | 'crop' | 'rotate';
    let free: {
      item: HTMLElement; id: string; mode: FreeMode; pointerId: number; startX: number; startY: number;
      left: number; top: number; width: number; height: number; boxWidth: number; cropped: boolean;
      rotate0: number; angle0: number; centerX: number; centerY: number; moved: boolean; values: Record<string, number>;
    } | null = null;
    const startFreeGesture = (item: HTMLElement, event: PointerEvent) => {
      const layer = item.offsetParent instanceof HTMLElement ? item.offsetParent : null;
      if (!layer || !item.dataset.editId || !(event.target instanceof Element)) return;
      const handle = event.target.closest<HTMLElement>('[data-free-handle]')?.dataset.freeHandle;
      const mode: FreeMode = handle === 'resize' || handle === 'crop' || handle === 'rotate' ? handle : 'move';
      const bounds = item.getBoundingClientRect();
      const transform = getComputedStyle(item).transform;
      const matrix = transform && transform !== 'none' ? new DOMMatrixReadOnly(transform) : null;
      const image = item.querySelector(':scope > img');
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      free = {
        item, id: item.dataset.editId, mode, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
        left: item.offsetLeft, top: item.offsetTop, width: item.offsetWidth, height: item.offsetHeight,
        boxWidth: Math.max(1, layer.clientWidth),
        cropped: Boolean(image && getComputedStyle(image).objectFit === 'cover'),
        rotate0: matrix ? Math.atan2(matrix.b, matrix.a) * 180 / Math.PI : 0,
        angle0: Math.atan2(event.clientY - centerY, event.clientX - centerX),
        centerX, centerY, moved: false, values: {},
      };
      if (mode !== 'move') event.preventDefault();
      try { item.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
    };
    const moveFreeGesture = (event: PointerEvent) => {
      if (!free) return;
      const gesture = free;
      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;
      if (!gesture.moved && Math.hypot(dx, dy) < 3) return;
      gesture.moved = true;
      event.preventDefault();
      hoverTag.hidden = true;
      gesture.item.dataset.freeDragging = 'true';
      const set = (property: string, value: string) => gesture.item.style.setProperty(property, value, 'important');
      const percent = (px: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(px / gesture.boxWidth * 10000) / 100));
      const pixels = (px: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(px)));
      const layerBox = gesture.item.offsetParent instanceof HTMLElement ? gesture.item.offsetParent : null;
      if (gesture.mode === 'move') {
        const bounded = layerBox ? keepInBounds(gesture.item, layerBox, gesture.left + dx, gesture.top + dy, gesture.width) : { left: gesture.left + dx, top: gesture.top + dy };
        gesture.values = { posX: percent(bounded.left, -100, 200), posY: pixels(bounded.top, -2000, 8000) };
        set('left', `${gesture.values.posX}%`);
        set('top', `${gesture.values.posY}px`);
      } else if (gesture.mode === 'resize') {
        const bounded = layerBox ? keepInBounds(gesture.item, layerBox, gesture.left, gesture.top, Math.max(12, gesture.width + dx)) : { width: Math.max(12, gesture.width + dx) };
        gesture.values = { widthPct: percent(bounded.width, 1, 300) };
        set('width', `${gesture.values.widthPct}%`);
        if (gesture.cropped) {
          gesture.values.heightPx = pixels(gesture.height + dy, 8, 4000);
          set('height', `${gesture.values.heightPx}px`);
        }
      } else if (gesture.mode === 'crop') {
        gesture.values = { heightPx: pixels(gesture.height + dy, 8, 4000) };
        set('height', `${gesture.values.heightPx}px`);
        const image = gesture.item.querySelector<HTMLElement>(':scope > img');
        image?.style.setProperty('height', '100%', 'important');
        image?.style.setProperty('object-fit', 'cover', 'important');
      } else {
        const angle = Math.atan2(event.clientY - gesture.centerY, event.clientX - gesture.centerX);
        let degrees = gesture.rotate0 + (angle - gesture.angle0) * 180 / Math.PI;
        degrees = ((degrees % 360) + 540) % 360 - 180;
        if (event.shiftKey) degrees = Math.round(degrees / 15) * 15;
        else {
          degrees = Math.round(degrees);
          const straight = Math.round(degrees / 45) * 45;
          if (Math.abs(degrees - straight) <= 3) degrees = straight;
        }
        gesture.values = { rotate: degrees };
        set('rotate', `${degrees - gesture.rotate0}deg`);
      }
    };
    const finishFreeGesture = () => {
      if (!free) return;
      const gesture = free;
      free = null;
      delete gesture.item.dataset.freeDragging;
      try { gesture.item.releasePointerCapture(gesture.pointerId); } catch { /* already released */ }
      if (!gesture.moved) return;
      suppressClickAfterMarquee = true;
      window.setTimeout(() => { suppressClickAfterMarquee = false; }, 120);
      gesture.item.dataset.freeInline = 'true';
      window.setTimeout(() => { if (gesture.item.dataset.freeInline) clearFreeInline(gesture.item); }, 2000);
      postElement(gesture.item);
      window.parent.postMessage({ type: 'luka-website-editor-free-change', id: gesture.id, values: gesture.values }, window.location.origin);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.target instanceof Element && event.target.closest('[contenteditable],a,button,input,textarea,select')) return;
      if (!(event.target instanceof Element)) return;
      if (previewClickToEdit) {
        const item = event.target.closest<HTMLElement>(MOVABLE_SELECTOR);
        if (item) { startFreeGesture(item, event); return; }
      }
      if (previewSelectionScope === 'multiple') {
        const box = document.createElement('div');
        box.className = 'website-editor-marquee';
        document.body.append(box);
        marquee = { startX: event.clientX, startY: event.clientY, box, moved: false };
        return;
      }
      if (previewSelectionScope === 'section') return;
      const block = event.target.closest<HTMLElement>('[data-website-editor-block]');
      const visual = block?.firstElementChild as HTMLElement | null;
      if (!block || !visual || !block.dataset.websiteEditorBlock || !block.dataset.websiteEditorSection || !block.dataset.websiteEditorGroup) return;
      drag = { id: block.dataset.websiteEditorBlock, sectionId: block.dataset.websiteEditorSection, groupId: block.dataset.websiteEditorGroup, startX: event.clientX, startY: event.clientY, visual, moved: false };
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (free) { moveFreeGesture(event); return; }
      if (marquee) {
        const left = Math.min(marquee.startX, event.clientX);
        const top = Math.min(marquee.startY, event.clientY);
        const width = Math.abs(event.clientX - marquee.startX);
        const height = Math.abs(event.clientY - marquee.startY);
        marquee.moved = width > 6 || height > 6;
        if (marquee.moved) event.preventDefault();
        Object.assign(marquee.box.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
        return;
      }
      if (!drag) return;
      const dx = event.clientX - drag.startX; const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 7) return;
      drag.moved = true;
      event.preventDefault();
      drag.visual.setAttribute('data-website-editor-dragging', 'true');
      drag.visual.style.zIndex = '5';
      drag.visual.style.pointerEvents = 'none';
      drag.visual.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.015)`;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-website-editor-block]');
      document.querySelectorAll('[data-website-editor-drop-target]').forEach((element) => element.removeAttribute('data-website-editor-drop-target'));
      drag.targetId = target?.dataset.websiteEditorBlock && target.dataset.websiteEditorGroup === drag.groupId && target.dataset.websiteEditorBlock !== drag.id
        ? target.dataset.websiteEditorBlock : undefined;
      target?.toggleAttribute('data-website-editor-drop-target', Boolean(drag.targetId));
    };
    const handlePointerUp = () => {
      if (free) { finishFreeGesture(); return; }
      if (marquee) {
        if (marquee.moved) {
          suppressClickAfterMarquee = true;
          window.setTimeout(() => { suppressClickAfterMarquee = false; }, 100);
          const rect = marquee.box.getBoundingClientRect();
          const candidates = Array.from(document.querySelectorAll<HTMLElement>('[data-website-editor-block], [data-website-editor-target]'));
          const matching = candidates.filter((element) => {
            const bounds = elementBounds(element);
            return bounds && rectsIntersect(bounds, rect);
          }).filter((element, _, all) => !all.some((child) => child !== element && element.contains(child)));
          const selections = matching.slice(0, 30).flatMap((element) => {
            const kind = element.dataset.websiteEditorBlock ? 'block' : 'native';
            const sectionId = element.dataset.websiteEditorSection;
            const blockId = element.dataset.websiteEditorBlock;
            const targetId = element.dataset.websiteEditorTarget;
            const bounds = elementBounds(element);
            if (!sectionId || !bounds || (kind === 'block' && !blockId) || (kind === 'native' && !targetId)) return [];
            const fields = Array.from(element.querySelectorAll<HTMLElement>('[data-website-editor-inline-field]'))
              .map((field) => field.dataset.websiteEditorInlineField ?? '').filter(Boolean);
            return [{ kind, sectionId, ...(blockId ? { blockId } : {}), ...(targetId ? { targetId } : {}), label: element.dataset.websiteEditorLabel ?? 'ელემენტი', fields, rect: bounds }];
          });
          window.parent.postMessage({ type: 'luka-website-editor-multi-selection', selections }, window.location.origin);
        }
        clearMarquee();
        return;
      }
      if (drag?.moved && drag.targetId) {
        window.parent.postMessage({ type: 'luka-website-editor-reorder', sectionId: drag.sectionId, sourceId: drag.id, targetId: drag.targetId, groupId: drag.groupId }, window.location.origin);
      }
      clearDrag();
    };

    const handleDoubleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const inline = event.target.closest('[data-website-editor-inline-field]');
      if (!inline) { preventNavigation(event); return; }
      event.preventDefault(); event.stopPropagation();
      startInlineEdit(inline);
    };

    const handleInput = (event: Event) => {
      if (!(event.target instanceof HTMLElement) || !event.target.isContentEditable) return;
      if (event.target.dataset.editText) {
        window.parent.postMessage({ type: 'luka-website-editor-label-change', id: event.target.dataset.editText, text: event.target.innerText }, window.location.origin);
        return;
      }
      const inline = event.target;
      const owner = inline.closest<HTMLElement>('[data-website-editor-block], [data-website-editor-target]');
      if (!owner) return;
      const block = inline.closest<HTMLElement>('[data-website-editor-block]');
      const native = inline.closest<HTMLElement>('[data-website-editor-target]');
      const sectionId = owner.dataset.websiteEditorSection;
      const field = inline.dataset.websiteEditorInlineField;
      if (!sectionId || !field) return;
      const selection: WebsiteEditorSelection = {
        kind: block ? 'block' : 'native', sectionId,
        ...(block?.dataset.websiteEditorBlock ? { blockId: block.dataset.websiteEditorBlock } : {}),
        ...(native?.dataset.websiteEditorTarget ? { targetId: native.dataset.websiteEditorTarget } : {}),
        label: owner.dataset.websiteEditorLabel ?? 'ტექსტი', fields: [field],
      };
      window.parent.postMessage({ type: 'luka-website-editor-inline-change', selection, field, text: inline.innerText }, window.location.origin);
    };

    const finishInlineEdit = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement) || !event.target.isContentEditable) return;
      if (event.target.dataset.editText) {
        const label = event.target;
        const canceled = label.dataset.websiteEditorCancel === 'true';
        window.parent.postMessage({ type: 'luka-website-editor-label-finish', id: label.dataset.editText, text: label.innerText, canceled }, window.location.origin);
        label.removeAttribute('contenteditable'); label.removeAttribute('spellcheck');
        delete label.dataset.websiteEditorOriginalText;
        delete label.dataset.websiteEditorCancel;
        return;
      }
      const inline = event.target;
      const owner = inline.closest<HTMLElement>('[data-website-editor-block], [data-website-editor-target]');
      const block = inline.closest<HTMLElement>('[data-website-editor-block]');
      const native = inline.closest<HTMLElement>('[data-website-editor-target]');
      const field = inline.dataset.websiteEditorInlineField;
      const sectionId = owner?.dataset.websiteEditorSection;
      if (owner && field && sectionId) {
        const canceled = inline.dataset.websiteEditorCancel === 'true';
        window.parent.postMessage({ type: canceled ? 'luka-website-editor-inline-cancel' : 'luka-website-editor-inline-finish', selection: {
          kind: block ? 'block' : 'native', sectionId, ...(block?.dataset.websiteEditorBlock ? { blockId: block.dataset.websiteEditorBlock } : {}),
          ...(native?.dataset.websiteEditorTarget ? { targetId: native.dataset.websiteEditorTarget } : {}),
          label: owner.dataset.websiteEditorLabel ?? 'ტექსტი', fields: [field],
        } }, window.location.origin);
      }
      inline.removeAttribute('contenteditable'); inline.removeAttribute('spellcheck');
      delete inline.dataset.websiteEditorOriginalText;
      delete inline.dataset.websiteEditorCancel;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Enter finishes the text (Shift+Enter adds a line break).
      if (event.key === 'Enter' && !event.shiftKey && event.target instanceof HTMLElement && event.target.isContentEditable) {
        event.preventDefault();
        event.target.blur();
        return;
      }
      // Editor shortcuts work while the page has focus; typing into a text keeps the browser's own.
      if (previewClickToEdit && !(event.target instanceof HTMLElement && event.target.isContentEditable)) {
        // Arrow keys nudge the selected movable item (Shift: 10px).
        const selectedId = lastEditElement.current;
        const selectedMovable = event.key.startsWith('Arrow') ? movableElement(selectedId) : null;
        if (selectedId && selectedMovable) {
          const item = selectedMovable;
          const layer = item.offsetParent;
          if (layer instanceof HTMLElement && layer.clientWidth > 0) {
            event.preventDefault();
            const step = event.shiftKey ? 10 : 1;
            const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
            const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
            const bounded = keepInBounds(item, layer, item.offsetLeft + dx, item.offsetTop + dy, item.offsetWidth);
            const posX = Math.min(200, Math.max(-100, Math.round(bounded.left / layer.clientWidth * 10000) / 100));
            const posY = Math.min(8000, Math.max(-2000, Math.round(bounded.top)));
            window.parent.postMessage({ type: 'luka-website-editor-free-change', id: selectedId, values: { posX, posY } }, window.location.origin);
            return;
          }
        }
        const mod = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        const command = mod && key === 'z' ? (event.shiftKey ? 'redo' : 'undo')
          : mod && key === 'y' ? 'redo'
            : mod && key === 's' ? 'save'
              : mod && key === 'd' ? 'duplicate'
                : (key === 'delete' || key === 'backspace') ? 'delete'
                  : null;
        if (command) {
          event.preventDefault();
          window.parent.postMessage({ type: 'luka-website-editor-key', command }, window.location.origin);
          return;
        }
      }
      if (event.key !== 'Escape') return;
      if (event.target instanceof HTMLElement && event.target.isContentEditable) {
        const inline = event.target;
        const originalText = inline.dataset.websiteEditorOriginalText;
        if (originalText !== undefined) {
          inline.innerText = originalText;
          inline.dataset.websiteEditorCancel = 'true';
        }
        inline.blur();
        event.preventDefault(); event.stopPropagation();
        return;
      }
      setPreviewSelection(null);
      lastPreviewSelection.current = null;
      lastEditElement.current = null;
      markSelectedFreeItem(null);
      window.parent.postMessage({ type: 'luka-website-editor-deselect' }, window.location.origin);
      window.parent.postMessage({ type: 'luka-website-editor-element', element: null }, window.location.origin);
    };

    // Hover reaction: every editable thing shows a small name tag; nothing else reacts.
    const hoverTag = document.createElement('div');
    hoverTag.className = 'website-editor-hover-tag';
    hoverTag.hidden = true;
    document.body.append(hoverTag);
    const handleHover = (event: MouseEvent) => {
      if (!previewClickToEdit || free || !(event.target instanceof Element)) { hoverTag.hidden = true; return; }
      const freeItem = event.target.closest<HTMLElement>(MOVABLE_SELECTOR);
      const text = freeItem ? null : event.target.closest<HTMLElement>('[data-edit-text], [data-website-editor-inline-field]');
      const element = freeItem ?? (text ? elementOwner(text) : event.target.closest<HTMLElement>('[data-edit-id]'));
      const target = text ?? element;
      const rect = target ? elementBounds(target) : null;
      if (!target || !rect) { hoverTag.hidden = true; return; }
      const hidden = element?.dataset.editHidden === 'true';
      const freeHint = freeItem
        ? `${freeItem.dataset.editLabel} — გადაათრიეთ${freeItem.dataset.editKind === 'free-text' ? '; მონიშნულზე დაჭერით — წერა' : ''}`
        : '';
      hoverTag.textContent = `${freeHint || (text ? 'ტექსტი — დააჭირეთ და დაწერეთ' : element?.dataset.editLabel ?? 'ელემენტი')}${hidden ? ' · დამალულია' : ''}`;
      hoverTag.style.left = `${Math.max(4, rect.left)}px`;
      hoverTag.style.top = `${Math.max(4, rect.top - 26)}px`;
      hoverTag.hidden = false;
    };
    const hideHoverTag = () => { hoverTag.hidden = true; };

    const handleScroll = () => {
      hoverTag.hidden = true;
      if (lastEditElement.current) {
        const element = document.querySelector<HTMLElement>(`[data-edit-id="${CSS.escape(lastEditElement.current)}"]`);
        const described = element ? describeEditElement(element) : null;
        if (described) window.parent.postMessage({ type: 'luka-website-editor-element', element: described }, window.location.origin);
      }
      if (!lastPreviewSelection.current) return;
      const selection = lastPreviewSelection.current;
      const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-website-editor-section-root], [data-website-editor-target], [data-website-editor-block]'));
      const rect = selection.kind === 'section'
        ? elementBoundsUnion(elements.filter((element) => element.dataset.websiteEditorSectionRoot === selection.sectionId))
        : selection.kind === 'native'
          ? (() => { const element = elements.find((item) => item.dataset.websiteEditorTarget === selection.targetId); return element ? elementBounds(element) : null; })()
          : (() => { const element = elements.find((item) => item.dataset.websiteEditorBlock === selection.blockId); return element ? elementBounds(element) : null; })();
      if (rect) window.parent.postMessage({ type: 'luka-website-editor-selection', selection: { ...selection, rect } }, window.location.origin);
    };
    const blockFormSubmission = (event: Event) => { event.preventDefault(); event.stopPropagation(); };

    // Requests from the editor: select an element by id (layers panel) or its parent (nesting).
    const handleEditorRequest = (event: MessageEvent) => {
      if (!isTrustedPreviewMessage(event.origin, event.source, window.location.origin, window.parent)) return;
      const data = event.data;
      if ((data?.type !== 'luka-website-editor-select-id' && data?.type !== 'luka-website-editor-select-parent') || typeof data.id !== 'string') return;
      const id: string = data.id;
      // A just-added item may need a moment to appear on the page.
      const find = (attempt: number) => {
        const element = document.querySelector<HTMLElement>(`[data-edit-id="${CSS.escape(id)}"]`);
        if (!element) { if (attempt < 12) window.setTimeout(() => find(attempt + 1), 100); return; }
        const target = data.type === 'luka-website-editor-select-parent'
          ? element.parentElement?.closest<HTMLElement>('[data-edit-id]') ?? null
          : element;
        if (!target) return;
        if (data.type === 'luka-website-editor-select-id') target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        window.setTimeout(() => postElement(target), data.type === 'luka-website-editor-select-id' ? 350 : 0);
      };
      find(0);
    };
    window.addEventListener('message', handleEditorRequest);

    document.addEventListener('click', preventNavigation, true);
    document.addEventListener('mouseover', handleHover, true);
    document.documentElement.addEventListener('mouseleave', hideHoverTag);
    document.addEventListener('dblclick', handleDoubleClick, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('focusout', finishInlineEdit, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('submit', blockFormSubmission, true);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    window.addEventListener('luka-website-editor-focus-field', handleParentInlineEdit);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointermove', handlePointerMove, { capture: true, passive: false });
    document.addEventListener('pointerup', handlePointerUp, true);
    document.addEventListener('pointercancel', handlePointerUp, true);
    return () => {
      document.removeEventListener('click', preventNavigation, true);
      document.removeEventListener('dblclick', handleDoubleClick, true);
      document.removeEventListener('input', handleInput, true);
      document.removeEventListener('focusout', finishInlineEdit, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('submit', blockFormSubmission, true);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('luka-website-editor-focus-field', handleParentInlineEdit);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('pointerup', handlePointerUp, true);
      document.removeEventListener('pointercancel', handlePointerUp, true);
      window.removeEventListener('message', handleEditorRequest);
      document.removeEventListener('mouseover', handleHover, true);
      document.documentElement.removeEventListener('mouseleave', hideHoverTag);
      hoverTag.remove();
      clearDrag();
      clearMarquee();
    };
  }, [isWebsiteBuilderPreview, previewAllowInline, previewClickToEdit, previewEditorMode, previewSelectionScope, websiteLayout]);

  useEffect(() => {
    const sections = sortWebsiteSections(websiteLayout)
      .filter((section) => section.visible && section.sectionKey !== 'site-footer')
      .map((section) => ({ id: section.anchorId, activeId: section.anchorId }));

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);

      let currentSection = 'home';
      const scrollPosition = window.scrollY + 200;

      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            currentSection = section.activeId;
            break;
          }
        }
      }
      setActiveSection(currentSection);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [websiteLayout]);

  useEffect(() => {
    if (!isWebsiteBuilderPreview || !previewTarget) return;
    const frame = requestAnimationFrame(() => document.getElementById(previewTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [isWebsiteBuilderPreview, previewTarget]);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const orderedSections = sortWebsiteSections(websiteLayout).filter((section) => section.visible);
  const headerNavItems = getWebsiteNavigationSections(websiteLayout)
    .map((section) => ({
      label: section.sectionKey === 'hero' ? 'მთავარი'
        : section.sectionKey === 'about' ? 'ჩემ შესახებ'
          : section.sectionKey === 'projects' ? 'პროექტები'
            : section.sectionKey === 'calculator' ? 'კალკულატორი'
              : section.sectionKey === 'contact' ? 'კონტაქტი'
                : section.label,
      href: `#${section.anchorId}`,
    }));
  const firstVisibleAnchor = orderedSections[0]?.anchorId ?? 'home';
  const contactAnchor = orderedSections.find((section) => section.sectionKey === 'contact')?.anchorId;

  const handleLoadingComplete = useCallback(() => {
    setShowLoadingScreen(false);

    if (!window.location.hash) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
        target?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    });
  }, []);

  if (isAdminPage) {
    return (
      <Suspense
        fallback={
          <main
            lang="ka-GE"
            role="status"
            aria-live="polite"
            style={{
              display: 'grid',
              minHeight: '100vh',
              placeItems: 'center',
              color: 'var(--brand-ink)',
              background: 'var(--brand-page)',
              fontFamily: 'var(--brand-font-sans)',
            }}
          >
            პანელი იტვირთება...
          </main>
        }
      >
        <AdminPanel />
      </Suspense>
    );
  }

  return (
    <SiteProfileProvider elementsOverride={isWebsiteBuilderPreview ? previewElements : null}>
    <div id="app-root" className="site-shell">
      <a href="#main-content" className="skip-link">
        მთავარ შინაარსზე გადასვლა
      </a>

      {isDraftPreview && (
        <div className="draft-preview-banner" role="status">მონახაზის ნახვა — ასე გამოჩნდება საიტი გამოქვეყნების შემდეგ. სხვები ამას ვერ ხედავენ.</div>
      )}

      <AnimatePresence>
        {showLoadingScreen && <LoadingScreen onComplete={handleLoadingComplete} />}
      </AnimatePresence>

      <WebsiteEditorRuntimeProvider enabled={isWebsiteBuilderPreview && previewEditorMode}>
        <Header
          activeSection={isPortfolioPage ? 'projects' : activeSection}
          navItems={isPortfolioPage ? undefined : headerNavItems}
          homeHref={isPortfolioPage ? undefined : `#${firstVisibleAnchor}`}
          contactHref={isPortfolioPage ? undefined : (contactAnchor ? `#${contactAnchor}` : undefined)}
        />
      </WebsiteEditorRuntimeProvider>

      {isPortfolioPage ? (
        <Suspense fallback={<CatalogPageFallback />}>
          <PortfolioCatalogPage />
        </Suspense>
      ) : (
      <main id="main-content" tabIndex={-1} className={`content-layer outline-none${isWebsiteBuilderPreview && previewEditorMode ? ` website-canvas-edit-mode website-canvas-${previewSelectionScope}-mode` : ''}`}>
        <WebsiteEditorRuntimeProvider enabled={isWebsiteBuilderPreview && previewEditorMode}>
          <WebsiteSectionRenderer config={websiteLayout} imageUrls={websiteImageUrls} />
        </WebsiteEditorRuntimeProvider>
      </main>
      )}

      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            onClick={handleScrollToTop}
            className="scroll-to-top icon-button fixed z-40 h-11 w-11 rounded-full bg-[var(--brand-panel-solid)] p-0 text-[var(--brand-ink)] shadow-[var(--brand-shadow)]"
            aria-label="გვერდის დასაწყისში დაბრუნება"
            title="გვერდის დასაწყისში დაბრუნება"
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
    </SiteProfileProvider>
  );
}

function elementBounds(element: HTMLElement) {
  const own = element.getBoundingClientRect();
  if (own.width > 0 && own.height > 0) return { top: own.top, left: own.left, right: own.right, bottom: own.bottom, width: own.width, height: own.height };
  const rects = Array.from(element.querySelectorAll<HTMLElement>('*')).map((child) => child.getBoundingClientRect()).filter((rect) => rect.width > 0 && rect.height > 0);
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return { top, left, right, bottom, width: right - left, height: bottom - top };
}

/** What the editor panel needs to know about a picked element (and the section it sits in). */
function describeEditElement(element: HTMLElement) {
  const rect = elementBounds(element);
  if (!rect || !element.dataset.editId) return null;
  const frame = element.closest<HTMLElement>('.site-section-frame');
  return {
    id: element.dataset.editId,
    kind: element.dataset.editKind ?? 'item',
    label: element.dataset.editLabel ?? 'ელემენტი',
    props: (element.dataset.editProps ?? '').split(',').filter(Boolean),
    hidden: element.dataset.editHidden === 'true',
    stripIndex: element.dataset.editStripIndex !== undefined ? Number(element.dataset.editStripIndex) : undefined,
    section: frame?.dataset.el?.startsWith('section.') ? frame.dataset.el.slice('section.'.length) : undefined,
    rect,
  };
}

/**
 * Things that can be dragged, sized and turned in the editor: free text/pictures, and built-in
 * pieces marked movable (the hero lettering, which stays inside its area: data-edit-bounds).
 */
const MOVABLE_SELECTOR = '.site-free-item[data-edit-id], [data-edit-movable][data-edit-id]';

const movableElement = (id: string | null) => {
  if (!id) return null;
  const element = document.querySelector<HTMLElement>(`[data-edit-id="${CSS.escape(id)}"]`);
  return element?.matches(MOVABLE_SELECTOR) ? element : null;
};

/**
 * Items marked data-edit-bounds="contain" stay inside their area: fully inside it from side to
 * side, a little play up and down, and between a quarter and the whole width in size.
 */
function keepInBounds(item: HTMLElement, layer: HTMLElement, left: number, top: number, width: number) {
  if (item.dataset.editBounds !== 'contain') return { left, top, width };
  const room = Math.max(1, layer.clientWidth);
  const size = Math.min(room, Math.max(room * 0.25, width));
  return {
    left: Math.min(Math.max(0, left), room - size),
    top: Math.min(Math.max(-60, top), 200),
    width: size,
  };
}

/** Shows the handles on the selected movable item (an attribute React leaves alone). */
function markSelectedFreeItem(id: string | null) {
  document.querySelectorAll('[data-free-selected]').forEach((node) => node.removeAttribute('data-free-selected'));
  movableElement(id)?.setAttribute('data-free-selected', '');
}

/** Drops the temporary drag styles once the stored values are on the page. */
function clearFreeInline(item: HTMLElement) {
  for (const property of ['left', 'top', 'width', 'height', 'rotate']) item.style.removeProperty(property);
  const image = item.querySelector<HTMLElement>(':scope > img');
  image?.style.removeProperty('height');
  image?.style.removeProperty('object-fit');
  delete item.dataset.freeInline;
}

function elementBoundsUnion(elements: HTMLElement[]) {
  const rects = elements.map(elementBounds).filter((rect): rect is NonNullable<ReturnType<typeof elementBounds>> => Boolean(rect));
  if (!rects.length) return null;
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return { top, left, right, bottom, width: right - left, height: bottom - top };
}
