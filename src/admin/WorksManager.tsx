import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, Eye, EyeOff, ImagePlus, Images, LoaderCircle, Pencil, Star, Trash2, Upload, X, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PORTFOLIO_CATEGORIES } from '../data/portfolioItems';
import { adminConfirm, adminToast } from './feedback';
import type { AdminCategoryRow, AdminProjectRow } from './types';
import {
  addGalleryImages, createMissingThumbnails, createWork, loadGallery, nextWorkTitle, removeGalleryImage, renameWork,
  saveGalleryOrder, saveWorkOrder, setMainImage, setWorkVisible, splitImageFiles, worksInCategory,
  type GalleryImage,
} from './works';

const formatNumber = (value: number) => new Intl.NumberFormat('ka-GE').format(value);
const SITE_CATEGORY_SLUGS = new Set<string>(PORTFOLIO_CATEGORIES.map((category) => category.id));

type Props = {
  projects: AdminProjectRow[];
  categories: AdminCategoryRow[];
  covers: Record<string, string>;
  trashCount: number;
  onOpenTrash: () => void;
  onReload: () => Promise<void> | void;
  onTrash: (project: AdminProjectRow) => void;
  onOpenDetails: (project: AdminProjectRow) => void;
};

function rejectedToast(rejected: string[]) {
  if (rejected.length) adminToast(`${formatNumber(rejected.length)} ფაილი გამოტოვდა — მხოლოდ JPG, PNG, WEBP ან AVIF, მაქს. 50 მბ.`, 'error');
}

/**
 * Makes light copies for works uploaded before light copies existed (new uploads get one on their
 * own). Safe to run again: it only does the images that still lack one.
 */
function ThumbnailsButton() {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const run = async () => {
    const confirmed = await adminConfirm({
      title: 'სურათების მსუბუქი ასლები',
      message: 'ყველა ნამუშევრის სურათს შეექმნება პატარა, მსუბუქი ასლი — საიტი მას აჩვენებს ბადეში და ზოლში, რომ უფრო სწრაფად ჩაიტვირთოს. ორიგინალები არ იცვლება. რამდენიმე წუთი შეიძლება დასჭირდეს; გვერდი არ დახუროთ.',
      confirmLabel: 'შექმნა',
    });
    if (!confirmed) return;
    setProgress({ done: 0, total: 0 });
    try {
      const report = await createMissingThumbnails((done, total) => setProgress({ done, total }));
      if (report.made === 0 && report.failed === 0) adminToast('ყველა სურათს უკვე აქვს მსუბუქი ასლი.', 'success');
      else if (report.failed === 0) adminToast(`შეიქმნა ${formatNumber(report.made)} მსუბუქი ასლი.`, 'success');
      else adminToast(`შეიქმნა ${formatNumber(report.made)}, ვერ შეიქმნა ${formatNumber(report.failed)}. სცადეთ ხელახლა — დარჩენილებს გააგრძელებს.`, 'error');
    } catch {
      adminToast('ვერ დასრულდა. შეამოწმეთ კავშირი და სცადეთ ხელახლა — დაწყებულს გააგრძელებს.', 'error');
    } finally {
      setProgress(null);
    }
  };
  return (
    <button className="admin-button admin-button-quiet" type="button" onClick={() => { void run(); }} disabled={progress !== null}
      title="ძველი ნამუშევრებისთვის პატარა ასლების შექმნა (საიტი უფრო სწრაფად ჩაიტვირთება)">
      {progress ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : <Zap aria-hidden="true" />}
      {progress ? `ასლები… ${formatNumber(progress.done)}/${formatNumber(progress.total)}` : 'მსუბუქი ასლები'}
    </button>
  );
}

/** Big drop target; also opens the file picker on click. */
function DropZone({ title, hint, busy, progress, onFiles }: {
  title: string; hint: string; busy: boolean; progress?: string; onFiles: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`works-drop${over ? ' is-over' : ''}${busy ? ' is-busy' : ''}`}
      onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        setOver(false);
        if (!busy) onFiles([...event.dataTransfer.files]);
      }}
    >
      <input ref={input} type="file" multiple hidden accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => {
        const files = [...(event.currentTarget.files ?? [])];
        event.currentTarget.value = '';
        if (files.length) onFiles(files);
      }} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>
        <span className="works-drop-icon">{busy ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}</span>
        <strong>{busy ? progress ?? 'იტვირთება…' : title}</strong>
        <small>{hint}</small>
      </button>
    </div>
  );
}

/** Reorderable tile grid (drag a tile onto another to move it there). */
function useDragOrder<T extends { id: string }>(items: T[], onDrop: (next: T[]) => void) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const handlers = (item: T) => ({
    draggable: true,
    onDragStart: (event: DragEvent) => { setDragId(item.id); event.dataTransfer.effectAllowed = 'move'; },
    onDragOver: (event: DragEvent) => { if (dragId && dragId !== item.id) { event.preventDefault(); setOverId(item.id); } },
    onDragLeave: () => setOverId((current) => (current === item.id ? null : current)),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      if (!dragId || dragId === item.id) return;
      const from = items.findIndex((candidate) => candidate.id === dragId);
      const to = items.findIndex((candidate) => candidate.id === item.id);
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setDragId(null); setOverId(null);
      onDrop(next);
    },
    onDragEnd: () => { setDragId(null); setOverId(null); },
  });
  return { dragId, overId, handlers };
}

export default function WorksManager({ projects, categories, covers, trashCount, onOpenTrash, onReload, onTrash, onOpenDetails }: Props) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const category = categories.find((item) => item.id === categoryId) ?? null;
  const project = projects.find((item) => item.id === projectId) ?? null;

  // If the open project or category disappears (trashed elsewhere), step back.
  useEffect(() => { if (projectId && !project) setProjectId(null); }, [project, projectId]);
  useEffect(() => { if (categoryId && !category) setCategoryId(null); }, [category, categoryId]);

  if (project && category) {
    return <ProjectView project={project} category={category}
      onBack={() => setProjectId(null)} onReload={onReload} onTrash={onTrash} onOpenDetails={onOpenDetails} />;
  }
  if (category) {
    return <CategoryView category={category} projects={projects} covers={covers}
      onBack={() => setCategoryId(null)} onOpenProject={setProjectId} onReload={onReload} onTrash={onTrash} onOpenDetails={onOpenDetails} />;
  }
  return <CategoryList projects={projects} categories={categories} covers={covers}
    trashCount={trashCount} onOpenTrash={onOpenTrash} onOpen={setCategoryId} />;
}

function PageHead({ back, title, text, actions }: { back?: { label: string; onClick: () => void }; title: string; text?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="admin-page-heading works-head">
      <div>
        {back && <button type="button" className="admin-back-link" onClick={back.onClick}><ArrowLeft aria-hidden="true" /> {back.label}</button>}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {actions && <div className="admin-project-heading-actions">{actions}</div>}
    </div>
  );
}

function CategoryList({ projects, categories, covers, trashCount, onOpenTrash, onOpen }: {
  projects: AdminProjectRow[]; categories: AdminCategoryRow[]; covers: Record<string, string>;
  trashCount: number; onOpenTrash: () => void; onOpen: (id: string) => void;
}) {
  const ordered = [...categories].filter((item) => item.is_active).sort((a, b) => a.display_order - b.display_order);
  const onSite = ordered.filter((item) => SITE_CATEGORY_SLUGS.has(item.slug) || worksInCategory(projects, item.id).some((work) => work.is_published));
  const others = ordered.filter((item) => !onSite.includes(item));

  const card = (item: AdminCategoryRow) => {
    const works = worksInCategory(projects, item.id);
    const visible = works.filter((work) => work.is_published);
    const hidden = works.length - visible.length;
    const thumbs = (visible.length ? visible : works).slice(0, 4).map((work) => covers[work.id]).filter(Boolean);
    return (
      <button type="button" className="works-category" key={item.id} onClick={() => onOpen(item.id)}>
        <span className={`works-category-mosaic is-${Math.max(1, thumbs.length)}`} aria-hidden="true">
          {thumbs.length ? thumbs.map((src) => <img key={src} src={src} alt="" loading="lazy" />) : <Images />}
        </span>
        <span className="works-category-copy">
          <strong>{item.name}</strong>
          <small>
            {formatNumber(visible.length)} ნამუშევარი საიტზე
            {hidden > 0 && <> · {formatNumber(hidden)} დამალული</>}
          </small>
        </span>
        <ArrowUpRight className="works-category-arrow" aria-hidden="true" />
      </button>
    );
  };

  return (
    <section className="admin-page-section works" aria-label="პროექტები">
      <PageHead
        title="პროექტები"
        text="ზუსტად ისე, როგორც საიტზეა. გახსენით და ჩააგდეთ ახალი ნამუშევრები."
        actions={<>
          <ThumbnailsButton />
          {trashCount > 0 && <button className="admin-button admin-button-quiet" type="button" onClick={onOpenTrash}><Trash2 aria-hidden="true" /> წაშლილი <span className="admin-button-count">{formatNumber(trashCount)}</span></button>}
        </>}
      />
      <div className="works-category-grid">{onSite.map(card)}</div>
      {others.length > 0 && (
        <details className="works-others">
          <summary>სხვა კატეგორიები ({formatNumber(others.length)}) — საიტის მთავარ გვერდზე არ ჩანს</summary>
          <div className="works-category-grid is-small">{others.map(card)}</div>
        </details>
      )}
    </section>
  );
}

function CategoryView({ category, projects, covers, onBack, onOpenProject, onReload, onTrash, onOpenDetails }: {
  category: AdminCategoryRow; projects: AdminProjectRow[]; covers: Record<string, string>;
  onBack: () => void; onOpenProject: (id: string) => void; onReload: () => Promise<void> | void;
  onTrash: (project: AdminProjectRow) => void; onOpenDetails: (project: AdminProjectRow) => void;
}) {
  const works = useMemo(() => worksInCategory(projects, category.id), [category.id, projects]);
  const [order, setOrder] = useState<AdminProjectRow[]>(works);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [togglingId, setTogglingId] = useState('');
  const [galleryCounts, setGalleryCounts] = useState<Record<string, number>>({});
  const groupInput = useRef<HTMLInputElement>(null);

  useEffect(() => setOrder(works), [works]);

  useEffect(() => {
    const ids = works.filter((work) => work.presentation_type === 'project').map((work) => work.id);
    if (!ids.length || !supabase) { setGalleryCounts({}); return; }
    let active = true;
    void supabase.from('portfolio_gallery_images').select('project_id').in('project_id', ids).then(({ data }) => {
      if (!active) return;
      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as { project_id: string }[]) counts[row.project_id] = (counts[row.project_id] ?? 0) + 1;
      setGalleryCounts(counts);
    });
    return () => { active = false; };
  }, [works]);

  const visibleCount = works.filter((work) => work.is_published).length;

  const addSeparate = async (files: File[]) => {
    const { accepted, rejected } = splitImageFiles(files);
    rejectedToast(rejected);
    if (!accepted.length) return;
    setBusy(true);
    const created: AdminProjectRow[] = [];
    try {
      for (const [index, file] of accepted.entries()) {
        setProgress(`იტვირთება ${formatNumber(index + 1)} / ${formatNumber(accepted.length)}`);
        const id = await createWork({
          category, files: [file],
          title: nextWorkTitle(category.name, [...works, ...created]),
          existing: [],
        });
        created.push({ id, display_order: -1 } as AdminProjectRow);
      }
      // Newest first, in the order they were picked; the rest keep their order behind them.
      await saveWorkOrder([...created, ...order]).catch(() => 0);
      adminToast(`${formatNumber(created.length)} ნამუშევარი დაემატა და უკვე ჩანს საიტზე.`, 'success');
    } catch {
      adminToast(created.length
        ? `${formatNumber(created.length)} დაემატა, დანარჩენი ვერ აიტვირთა. სცადეთ ხელახლა.`
        : 'ატვირთვა ვერ მოხერხდა. შეამოწმეთ კავშირი და სცადეთ ხელახლა.', 'error');
    } finally {
      setBusy(false); setProgress('');
      await onReload();
    }
  };

  const addGroup = async (files: File[]) => {
    const { accepted, rejected } = splitImageFiles(files);
    rejectedToast(rejected);
    if (!accepted.length) return;
    setBusy(true);
    try {
      const id = await createWork({
        category, files: accepted, title: nextWorkTitle(category.name, works), existing: order,
        onProgress: (done) => setProgress(`იტვირთება ${formatNumber(done)} / ${formatNumber(accepted.length)}`),
      });
      adminToast(accepted.length > 1 ? 'პროექტი დაემატა და უკვე ჩანს საიტზე.' : 'ნამუშევარი დაემატა და უკვე ჩანს საიტზე.', 'success');
      await onReload();
      if (accepted.length > 1) onOpenProject(id);
    } catch {
      adminToast('ატვირთვა ვერ მოხერხდა. შეამოწმეთ კავშირი და სცადეთ ხელახლა.', 'error');
      await onReload();
    } finally {
      setBusy(false); setProgress('');
    }
  };

  const toggleVisible = async (work: AdminProjectRow) => {
    if (!work.is_published && !work.cover_image_path) { adminToast('ამ ნამუშევარს სურათი არ აქვს — ჯერ დაამატეთ სურათი.', 'error'); return; }
    setTogglingId(work.id);
    try {
      await setWorkVisible(work.id, !work.is_published);
      adminToast(work.is_published ? 'დაიმალა — საიტზე აღარ ჩანს.' : 'ახლა ჩანს საიტზე.', 'success');
      await onReload();
    } catch {
      adminToast('ვერ შეიცვალა. სცადეთ ხელახლა.', 'error');
    } finally {
      setTogglingId('');
    }
  };

  const { dragId, overId, handlers } = useDragOrder<AdminProjectRow>(order, (next) => {
    setOrder(next);
    void saveWorkOrder(next)
      .then((changed) => { if (changed) adminToast('რიგი შეინახა.', 'success'); return onReload(); })
      .catch(() => { adminToast('რიგი ვერ შეინახა.', 'error'); setOrder(works); });
  });

  return (
    <section className="admin-page-section works" aria-label={category.name}>
      <PageHead
        back={{ label: 'ყველა პროექტი', onClick: onBack }}
        title={category.name}
        text={<>{formatNumber(visibleCount)} ნამუშევარი ჩანს საიტზე. გადაათრიეთ რიგის შესაცვლელად.</>}
      />

      <DropZone
        title="ჩააგდეთ ახალი ნამუშევრები აქ"
        hint="ან დააჭირეთ და აირჩიეთ. თითო სურათი — ცალკე ნამუშევარი, გამოჩნდება პირველი."
        busy={busy}
        progress={progress}
        onFiles={(files) => { void addSeparate(files); }}
      />
      <p className="works-alt-action">
        <input ref={groupInput} type="file" multiple hidden accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => {
          const files = [...(event.currentTarget.files ?? [])];
          event.currentTarget.value = '';
          if (files.length) void addGroup(files);
        }} />
        <button type="button" disabled={busy} onClick={() => groupInput.current?.click()}>
          <Images aria-hidden="true" /> ან ერთი პროექტი რამდენიმე სურათით (მაგ. ბრენდინგი)
        </button>
      </p>

      {order.length === 0 ? (
        <p className="works-empty">ჯერ ცარიელია — ჩააგდეთ პირველი ნამუშევარი ზემოთ.</p>
      ) : (
        <ul className="works-grid">
          {order.map((work) => {
            const isGallery = work.presentation_type === 'project';
            const count = galleryCounts[work.id];
            return (
              <li
                key={work.id}
                className={`works-tile${work.is_published ? '' : ' is-hidden'}${dragId === work.id ? ' is-dragging' : ''}${overId === work.id ? ' is-over' : ''}`}
                {...handlers(work)}
              >
                <button
                  type="button"
                  className="works-tile-media"
                  onClick={() => (isGallery ? onOpenProject(work.id) : onOpenDetails(work))}
                  title={isGallery ? 'გახსნა და სურათების დამატება' : 'დეტალები'}
                >
                  {covers[work.id] ? <img src={covers[work.id]} alt="" loading="lazy" draggable={false} /> : <Images aria-hidden="true" />}
                  {isGallery && <span className="works-tile-badge"><Images aria-hidden="true" /> {count ? `${formatNumber(count)} სურათი` : 'პროექტი'}</span>}
                  {!work.is_published && <span className="works-tile-hidden">დამალულია</span>}
                </button>
                <div className="works-tile-bar">
                  <button
                    type="button"
                    className={`works-visibility${work.is_published ? ' is-on' : ''}`}
                    onClick={() => { void toggleVisible(work); }}
                    disabled={togglingId === work.id}
                    title={work.is_published ? 'საიტიდან დამალვა' : 'საიტზე ჩვენება'}
                  >
                    {togglingId === work.id ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : work.is_published ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                    {work.is_published ? 'ჩანს' : 'დამალულია'}
                  </button>
                  <span className="works-tile-tools">
                    {isGallery && <button type="button" className="admin-icon-button" aria-label="გახსნა" title="გახსნა და სურათების დამატება" onClick={() => onOpenProject(work.id)}><ImagePlus aria-hidden="true" /></button>}
                    <button type="button" className="admin-icon-button" aria-label="დეტალები" title="სათაური, აღწერა და სხვა" onClick={() => onOpenDetails(work)}><Pencil aria-hidden="true" /></button>
                    <button type="button" className="admin-icon-button admin-project-trash-button" aria-label="წაშლა" title="წაშლა (აღდგენა შესაძლებელია)" onClick={() => onTrash(work)}><Trash2 aria-hidden="true" /></button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ProjectView({ project, category, onBack, onReload, onTrash, onOpenDetails }: {
  project: AdminProjectRow; category: AdminCategoryRow;
  onBack: () => void; onReload: () => Promise<void> | void;
  onTrash: (project: AdminProjectRow) => void; onOpenDetails: (project: AdminProjectRow) => void;
}) {
  const [images, setImages] = useState<GalleryImage[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [title, setTitle] = useState(project.title);
  const [toggling, setToggling] = useState(false);

  useEffect(() => setTitle(project.title), [project.title]);

  const reloadGallery = async () => {
    try { setImages(await loadGallery(project.id)); setLoadError(''); }
    catch { setLoadError('სურათები ვერ ჩაიტვირთა. განაახლეთ გვერდი.'); setImages([]); }
  };
  useEffect(() => { void reloadGallery(); }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const addImages = async (files: File[]) => {
    const { accepted, rejected } = splitImageFiles(files);
    rejectedToast(rejected);
    if (!accepted.length) return;
    setBusy(true);
    try {
      await addGalleryImages(project.id, accepted, images?.length ?? 0, project.title,
        (done) => setProgress(`იტვირთება ${formatNumber(done)} / ${formatNumber(accepted.length)}`));
      adminToast(`${formatNumber(accepted.length)} სურათი დაემატა.`, 'success');
    } catch {
      adminToast('ატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.', 'error');
    } finally {
      setBusy(false); setProgress('');
      await reloadGallery();
    }
  };

  const remove = async (image: GalleryImage) => {
    if (!await adminConfirm({ title: 'სურათის ამოღება', message: 'სურათი ამ პროექტიდან ამოიღება.', confirmLabel: 'ამოღება', tone: 'danger' })) return;
    try {
      await removeGalleryImage(image.id);
      setImages((current) => current?.filter((item) => item.id !== image.id) ?? null);
      adminToast('სურათი ამოღებულია.', 'success');
    } catch {
      adminToast('ვერ ამოიღო. სცადეთ ხელახლა.', 'error');
    }
  };

  const makeMain = async (image: GalleryImage) => {
    try {
      await setMainImage(project.id, image.path);
      adminToast('მთავარი სურათი შეიცვალა.', 'success');
      await onReload();
    } catch {
      adminToast('ვერ შეიცვალა. სცადეთ ხელახლა.', 'error');
    }
  };

  const saveTitle = async () => {
    const next = title.trim();
    if (!next || next === project.title) { setTitle(project.title); return; }
    try { await renameWork(project.id, next); adminToast('სახელი შეინახა.', 'success'); await onReload(); }
    catch { adminToast('სახელი ვერ შეინახა.', 'error'); setTitle(project.title); }
  };

  const toggleVisible = async () => {
    setToggling(true);
    try {
      await setWorkVisible(project.id, !project.is_published);
      adminToast(project.is_published ? 'დაიმალა — საიტზე აღარ ჩანს.' : 'ახლა ჩანს საიტზე.', 'success');
      await onReload();
    } catch { adminToast('ვერ შეიცვალა. სცადეთ ხელახლა.', 'error'); }
    finally { setToggling(false); }
  };

  const list = images ?? [];
  const { dragId, overId, handlers } = useDragOrder<GalleryImage>(list, (next) => {
    setImages(next);
    void saveGalleryOrder(next)
      .then(() => { setImages(next.map((image, index) => ({ ...image, order: index }))); adminToast('რიგი შეინახა.', 'success'); })
      .catch(() => { adminToast('რიგი ვერ შეინახა.', 'error'); void reloadGallery(); });
  });

  return (
    <section className="admin-page-section works" aria-label={project.title}>
      <div className="admin-page-heading works-head">
        <div>
          <button type="button" className="admin-back-link" onClick={onBack}><ArrowLeft aria-hidden="true" /> {category.name}</button>
          <input
            className="works-title-input"
            value={title}
            aria-label="პროექტის სახელი"
            maxLength={160}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => { void saveTitle(); }}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setTitle(project.title); event.currentTarget.blur(); } }}
          />
          <p>{images ? `${formatNumber(list.length)} სურათი` : 'იტვირთება…'} · გადაათრიეთ რიგის შესაცვლელად.</p>
        </div>
        <div className="admin-project-heading-actions">
          <button type="button" className={`works-visibility is-large${project.is_published ? ' is-on' : ''}`} onClick={() => { void toggleVisible(); }} disabled={toggling}>
            {toggling ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : project.is_published ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
            {project.is_published ? 'ჩანს საიტზე' : 'დამალულია'}
          </button>
          <button className="admin-icon-button" type="button" aria-label="დეტალები" title="აღწერა და სხვა" onClick={() => onOpenDetails(project)}><Pencil aria-hidden="true" /></button>
          <button className="admin-icon-button admin-project-trash-button" type="button" aria-label="პროექტის წაშლა" title="წაშლა (აღდგენა შესაძლებელია)" onClick={() => onTrash(project)}><Trash2 aria-hidden="true" /></button>
        </div>
      </div>

      <DropZone
        title="ჩააგდეთ სურათები ამ პროექტში"
        hint="ან დააჭირეთ და აირჩიეთ. დაემატება ბოლოში."
        busy={busy}
        progress={progress}
        onFiles={(files) => { void addImages(files); }}
      />

      {loadError && <div className="admin-alert" role="alert">{loadError}</div>}
      {!images ? (
        <div className="admin-loading-state" role="status"><LoaderCircle className="admin-spin" aria-hidden="true" />სურათები იტვირთება…</div>
      ) : list.length === 0 ? (
        <p className="works-empty">ამ პროექტში ჯერ სურათები არ არის.</p>
      ) : (
        <ul className="works-grid">
          {list.map((image, index) => {
            const isMain = image.path === project.cover_image_path;
            return (
              <li key={image.id} className={`works-tile${dragId === image.id ? ' is-dragging' : ''}${overId === image.id ? ' is-over' : ''}`} {...handlers(image)}>
                <div className="works-tile-media">
                  {image.url ? <img src={image.url} alt="" loading="lazy" draggable={false} /> : <Images aria-hidden="true" />}
                  <span className="works-tile-number">{formatNumber(index + 1)}</span>
                  {isMain && <span className="works-tile-badge is-main"><Star aria-hidden="true" /> მთავარი</span>}
                </div>
                <div className="works-tile-bar">
                  {!isMain
                    ? <button type="button" className="works-text-button" onClick={() => { void makeMain(image); }}><Star aria-hidden="true" /> მთავარად</button>
                    : <span className="works-text-muted">ყდაზე ჩანს</span>}
                  <button type="button" className="admin-icon-button admin-project-trash-button" aria-label="ამოღება" title="ამოღება პროექტიდან" onClick={() => { void remove(image); }}><X aria-hidden="true" /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
