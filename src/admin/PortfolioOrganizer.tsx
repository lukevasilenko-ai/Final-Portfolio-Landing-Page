import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CircleAlert, LoaderCircle, RotateCcw, Save, Undo2, X } from 'lucide-react';
import type { PortfolioItem } from '../types';
import PortfolioCard from '../components/PortfolioCard';
import { supabase } from '../lib/supabase';
import { getCategoryAdminLabel } from './labels';

type OrganizerCategory = {
  id: string;
  slug: string;
  name: string;
  display_order: number;
  is_active: boolean;
};

type OrganizerProject = {
  id: string;
  source_key: string | null;
  slug: string;
  title: string;
  description: string;
  category_id: string;
  presentation_type: 'image' | 'project';
  cover_image_path: string | null;
  display_order: number;
  is_published: boolean;
  deleted_at: string | null;
  is_featured: boolean;
  tags: string[];
  tools: string[];
  year: number | null;
  created_at: string;
};

type Props = {
  categories: OrganizerCategory[];
  projects: OrganizerProject[];
  onClose: () => void;
  onEdit: (project: OrganizerProject) => void;
  onSaved: (message: string) => void;
};

type OrderMap = Record<string, string[]>;
type UndoMap = Record<string, string[][]>;
type DragPoint = { x: number; y: number };
type DragSession = { categoryId: string; projectId: string; initialOrder: string[] };

const sameOrder = (first: string[] = [], second: string[] = []) =>
  first.length === second.length && first.every((id, index) => id === second[index]);

function insertAt<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export default function PortfolioOrganizer({ categories, projects, onClose, onEdit, onSaved }: Props) {
  const activeCategories = useMemo(
    () => [...categories].filter((category) => category.is_active).sort((a, b) => a.display_order - b.display_order),
    [categories],
  );
  const [categoryId, setCategoryId] = useState(activeCategories[0]?.id ?? '');
  const [catalogItems, setCatalogItems] = useState<PortfolioItem[] | null>(null);
  const [draftOrders, setDraftOrders] = useState<OrderMap>({});
  const [savedOrders, setSavedOrders] = useState<OrderMap>({});
  const [undoStacks, setUndoStacks] = useState<UndoMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [draggingId, setDraggingId] = useState('');
  const [dropTargetId, setDropTargetId] = useState('');
  const draftOrdersRef = useRef<OrderMap>({});
  const savedOrdersRef = useRef<OrderMap>({});
  const undoStacksRef = useRef<UndoMap>({});
  const dragSessionRef = useRef<DragSession | null>(null);

  const replaceDraftOrders = useCallback((next: OrderMap) => {
    draftOrdersRef.current = next;
    setDraftOrders(next);
  }, []);

  const replaceUndoStacks = useCallback((next: UndoMap) => {
    undoStacksRef.current = next;
    setUndoStacks(next);
  }, []);

  useEffect(() => {
    if (!categoryId && activeCategories[0]) setCategoryId(activeCategories[0].id);
  }, [activeCategories, categoryId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    void import('../data/supabaseCatalog')
      .then(({ loadSupabaseCatalog }) => loadSupabaseCatalog())
      .then((catalog) => {
        if (!active) return;
        const activeSlugs = new Set(activeCategories.map((category) => category.slug));
        const expectedIds = new Set(projects
          .filter((project) => project.is_published && project.deleted_at === null && activeCategories.some((category) => category.id === project.category_id))
          .map((project) => project.id));
        const actualIds = new Set(catalog.items
          .filter((item) => activeSlugs.has(item.category))
          .map((item) => item.databaseProjectId)
          .filter((id): id is string => Boolean(id)));

        if (expectedIds.size !== actualIds.size || [...expectedIds].some((id) => !actualIds.has(id))) {
          setError('საჯარო კატალოგი სრულად ვერ ჩაიტვირთა. განლაგების შეცვლა დროებით გამორთულია, რათა არასრული სია არ შეინახოს.');
          setLoading(false);
          return;
        }

        const initialOrders: OrderMap = {};
        activeCategories.forEach((category) => {
          initialOrders[category.id] = catalog.items
            .filter((item) => item.category === category.slug)
            .map((item) => item.databaseProjectId)
            .filter((id): id is string => Boolean(id));
        });
        savedOrdersRef.current = initialOrders;
        draftOrdersRef.current = initialOrders;
        undoStacksRef.current = {};
        setSavedOrders(initialOrders);
        setDraftOrders(initialOrders);
        setUndoStacks({});
        setCatalogItems(catalog.items);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError('საჯარო პორტფოლიოს გადახედვა ვერ ჩაიტვირთა. შეამოწმეთ კავშირი და სცადეთ თავიდან.');
        setLoading(false);
      });

    return () => { active = false; };
  }, [activeCategories, projects]);

  useEffect(() => {
    const oldOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = oldOverflow; };
  }, []);

  const category = activeCategories.find((item) => item.id === categoryId);
  const categoryItems = useMemo(() => {
    if (!category || !catalogItems) return [];
    const itemByProjectId = new Map(catalogItems
      .filter((item) => item.category === category.slug && item.databaseProjectId)
      .map((item) => [item.databaseProjectId as string, item]));
    const order = draftOrders[category.id] ?? savedOrders[category.id] ?? [];
    return order.flatMap((id) => {
      const item = itemByProjectId.get(id);
      return item ? [item] : [];
    });
  }, [catalogItems, category, draftOrders, savedOrders]);

  const currentOrder = category ? draftOrders[category.id] ?? savedOrders[category.id] ?? [] : [];
  const originalOrder = category ? savedOrders[category.id] ?? [] : [];
  const hasChanges = !sameOrder(currentOrder, originalOrder);
  const canUndo = Boolean(category && undoStacks[category.id]?.length);
  const unsavedCategoryCount = activeCategories.filter((item) =>
    !sameOrder(draftOrders[item.id] ?? savedOrders[item.id] ?? [], savedOrders[item.id] ?? []),
  ).length;

  const updateDraftOrder = useCallback((nextOrder: string[], remember = true) => {
    if (!category) return;
    const current = draftOrdersRef.current[category.id] ?? savedOrdersRef.current[category.id] ?? [];
    if (sameOrder(current, nextOrder)) return;

    if (remember) {
      const nextUndo = {
        ...undoStacksRef.current,
        [category.id]: [...(undoStacksRef.current[category.id] ?? []), current].slice(-40),
      };
      replaceUndoStacks(nextUndo);
    }
    replaceDraftOrders({ ...draftOrdersRef.current, [category.id]: nextOrder });
    setError('');
    setSuccess('');
  }, [category, replaceDraftOrders, replaceUndoStacks]);

  const handleDragStart = (item: PortfolioItem) => {
    const id = item.databaseProjectId;
    if (!id || !category) return;
    const initialOrder = draftOrdersRef.current[category.id] ?? savedOrdersRef.current[category.id] ?? [];
    dragSessionRef.current = { categoryId: category.id, projectId: id, initialOrder: [...initialOrder] };
    setDraggingId(id);
    setDropTargetId('');
  };

  const handleDrag = (item: PortfolioItem, point: DragPoint) => {
    const session = dragSessionRef.current;
    if (!session || item.databaseProjectId !== session.projectId || category?.id !== session.categoryId) return;

    const targetCard = Array.from(document.querySelectorAll<HTMLElement>('[data-organizer-project-id]'))
      .find((card) => {
        if (card.dataset.organizerProjectId === session.projectId) return false;
        const rect = card.getBoundingClientRect();
        return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
      });
    const targetId = targetCard?.dataset.organizerProjectId;
    if (!targetId) return;

    const order = draftOrdersRef.current[session.categoryId] ?? session.initialOrder;
    const fromIndex = order.indexOf(session.projectId);
    const toIndex = order.indexOf(targetId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    updateDraftOrder(insertAt(order, fromIndex, toIndex), false);
    setDropTargetId(targetId);
  };

  const handleDragEnd = (item: PortfolioItem) => {
    const session = dragSessionRef.current;
    if (session && item.databaseProjectId === session.projectId) {
      const finalOrder = draftOrdersRef.current[session.categoryId] ?? session.initialOrder;
      if (!sameOrder(session.initialOrder, finalOrder)) {
        replaceUndoStacks({
          ...undoStacksRef.current,
          [session.categoryId]: [...(undoStacksRef.current[session.categoryId] ?? []), session.initialOrder].slice(-40),
        });
      }
    }
    dragSessionRef.current = null;
    setDraggingId('');
    setDropTargetId('');
  };

  const handleUndo = () => {
    if (!category) return;
    const stack = undoStacksRef.current[category.id] ?? [];
    const previous = stack.at(-1);
    if (!previous) return;
    replaceUndoStacks({ ...undoStacksRef.current, [category.id]: stack.slice(0, -1) });
    updateDraftOrder(previous, false);
  };

  const handleCancelChanges = () => {
    if (!category) return;
    updateDraftOrder(savedOrdersRef.current[category.id] ?? [], false);
    replaceUndoStacks({ ...undoStacksRef.current, [category.id]: [] });
    setError('');
    setSuccess('');
  };

  const handleClose = () => {
    if (unsavedCategoryCount && !window.confirm('შეუნახავი განლაგების ცვლილებები დაიკარგება. გსურთ დახურვა?')) return;
    onClose();
  };

  const handleEditProject = (project: OrganizerProject | undefined) => {
    if (!project) return;
    if (unsavedCategoryCount && !window.confirm('პროექტის რედაქტორზე გადასვლისას შეუნახავი განლაგების ცვლილებები დაიკარგება. გსურთ გაგრძელება?')) return;
    onClose();
    onEdit(project);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => {
    if (!unsavedCategoryCount) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [unsavedCategoryCount]);

  const handleImageError = async (item: PortfolioItem) => {
    if (!item.imagePath) return;
    try {
      const { refreshSupabaseImageUrl } = await import('../data/supabaseCatalog');
      const image = await refreshSupabaseImageUrl(item.imagePath);
      setCatalogItems((current) => current?.map((candidate) =>
        candidate.imagePath === item.imagePath ? { ...candidate, image } : candidate,
      ) ?? null);
    } catch {
      setError('სურათის ბმულის განახლება ვერ მოხერხდა. გადაამოწმეთ ინტერნეტკავშირი.');
    }
  };

  const handleSave = async () => {
    if (!category || !hasChanges || saving) return;
    const client = supabase;
    if (!client) {
      setError('Supabase-თან კავშირი გამართული არ არის.');
      return;
    }

    const byId = new Map(projects.map((project) => [project.id, project]));
    const orderedProjects = currentOrder.map((id) => byId.get(id));
    if (orderedProjects.some((project) => !project || !project.is_published || project.deleted_at !== null || project.category_id !== category.id)) {
      setError('პროექტების სია განახლებულია. დახურეთ განლაგება და თავიდან გახსენით.');
      return;
    }

    const changes = orderedProjects.flatMap((project, index) => {
      if (!project || project.display_order === index) return [];
      return [{ id: project.id, before: project.display_order, after: index }];
    });
    if (changes.length === 0) {
      setSavedOrders((current) => ({ ...current, [category.id]: currentOrder }));
      savedOrdersRef.current = { ...savedOrdersRef.current, [category.id]: currentOrder };
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { data: updatedCount, error: updateError } = await client.rpc('reorder_portfolio_projects', {
        p_category_id: category.id,
        p_project_ids: currentOrder,
      });
      if (updateError || updatedCount !== currentOrder.length) throw new Error('layout_update_failed');

      const nextSaved = { ...savedOrdersRef.current, [category.id]: currentOrder };
      savedOrdersRef.current = nextSaved;
      setSavedOrders(nextSaved);
      replaceUndoStacks({ ...undoStacksRef.current, [category.id]: [] });
      setSuccess('განლაგება წარმატებით შეინახა. საჯარო კატალოგში რიგი განახლებულია.');
      onSaved('პროექტების განლაგება განახლდა.');
    } catch {
      setError('განლაგება ვერ შეინახა. ბაზაში ცვლილება მთლიანად გაუქმდა; გადაამოწმეთ მიგრაცია და სცადეთ ხელახლა.');
    } finally {
      setSaving(false);
    }
  };

  const itemCount = categoryItems.length;
  const countLabel = new Intl.NumberFormat('ka-GE').format(itemCount);

  return (
    <div className="admin-organizer-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-organizer-title" lang="ka-GE">
      <header className="admin-organizer-header">
        <div className="admin-organizer-header-inner">
          <div className="admin-organizer-heading">
            <button type="button" className="admin-icon-button" onClick={handleClose} aria-label="მართვის პანელზე დაბრუნება" title="დახურვა">
              <ArrowLeft aria-hidden="true" />
            </button>
            <div>
              <span className="admin-organizer-kicker">Luka Imagines · პორტფოლიო</span>
              <h1 id="admin-organizer-title">განლაგების მართვა</h1>
            </div>
          </div>
          <div className="admin-organizer-actions">
            <span className="admin-organizer-unsaved" aria-live="polite">
              {unsavedCategoryCount ? `${new Intl.NumberFormat('ka-GE').format(unsavedCategoryCount)} კატეგორიაში შეუნახავი ცვლილება` : 'განლაგება შენახულია'}
            </span>
            <button type="button" className="admin-button admin-button-quiet" onClick={handleUndo} disabled={!canUndo || saving}>
              <Undo2 aria-hidden="true" /> ბოლო ცვლილების გაუქმება
            </button>
            <button type="button" className="admin-button admin-button-quiet" onClick={handleCancelChanges} disabled={!hasChanges || saving}>
              <RotateCcw aria-hidden="true" /> ცვლილებების გაუქმება
            </button>
            <button type="button" className="admin-button admin-button-primary" onClick={() => void handleSave()} disabled={!hasChanges || saving || loading || !catalogItems}>
              {saving ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              {saving ? 'შენახვა...' : 'განლაგების შენახვა'}
            </button>
          </div>
        </div>
      </header>

      <main className="admin-organizer-main">
        <section className="px-5 pb-24 sm:px-8">
          <div className="container-xl">
            <div className="admin-organizer-intro">
              <p className="admin-organizer-kicker">საჯაროდ გამოქვეყნებული ნამუშევრები</p>
              <h2>{category ? getCategoryAdminLabel(category) : 'კატეგორიები'}</h2>
              <p>{countLabel} ნამუშევარი · ცვლილებები საჯარო გახდება მხოლოდ შენახვის შემდეგ.</p>
            </div>

            <div className="sticky top-[76px] z-30 -mx-5 mb-8 border-y border-[var(--brand-line)] bg-[var(--brand-header-surface)] px-5 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8">
              <div className="container-xl flex gap-2 overflow-x-auto pb-1">
                {activeCategories.map((item) => {
                  const isActive = categoryId === item.id;
                  const count = catalogItems?.filter((portfolioItem) => portfolioItem.category === item.slug).length ?? 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { setCategoryId(item.id); setError(''); setSuccess(''); }}
                      aria-pressed={isActive}
                      className={`shrink-0 rounded-full px-4 py-2 font-mono text-xs font-bold transition-all duration-200 ${isActive
                        ? 'bg-[var(--brand-accent)] text-[var(--brand-on-accent)] shadow-[var(--brand-accent-shadow-sm)]'
                        : 'border border-[var(--brand-line)] bg-white/58 text-[var(--brand-muted)] hover:bg-white hover:text-[var(--brand-ink)]'}`}
                    >
                      {getCategoryAdminLabel(item)} <span className="ml-2 opacity-70">{new Intl.NumberFormat('ka-GE').format(count)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <div className="admin-alert admin-organizer-alert" role="alert"><CircleAlert aria-hidden="true" />{error}</div>}
            {success && <div className="admin-success-notice admin-organizer-alert" role="status">{success}<button type="button" aria-label="შეტყობინების დახურვა" onClick={() => setSuccess('')}><X aria-hidden="true" /></button></div>}

            {loading ? (
              <div className="admin-organizer-loading" role="status"><LoaderCircle className="admin-spin" aria-hidden="true" />საჯარო განლაგება იტვირთება...</div>
            ) : !error && categoryItems.length > 0 ? (
              <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label={`${category?.name ?? ''} — პროექტების განლაგება`}>
                {categoryItems.map((item) => {
                  const project = projects.find((candidate) => candidate.id === item.databaseProjectId);
                  return (
                    <PortfolioCard
                      key={item.databaseProjectId ?? item.id}
                      item={item}
                      onOpen={() => handleEditProject(project)}
                      onImageError={handleImageError}
                      imageOnly
                      organizer={{
                        dragging: draggingId === item.databaseProjectId,
                        dropTarget: dropTargetId === item.databaseProjectId,
                        onDragStart: handleDragStart,
                        onDrag: handleDrag,
                        onDragEnd: handleDragEnd,
                        onEdit: () => handleEditProject(project),
                      }}
                    />
                  );
                })}
              </div>
            ) : !error ? (
              <div className="admin-organizer-empty">ამ კატეგორიაში გამოქვეყნებული პროექტები ჯერ არ არის.</div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
