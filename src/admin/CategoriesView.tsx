import { useEffect, useState, type DragEvent } from 'react';
import { Eye, EyeOff, GripVertical, Images, LoaderCircle, Pencil, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { adminToast } from './feedback';
import { getCategoryAdminLabel } from './labels';
import type { AdminCategoryRow, AdminProjectRow } from './types';

const formatNumber = (value: number) => new Intl.NumberFormat('ka-GE').format(value);

type Props = {
  categories: AdminCategoryRow[];
  /** Every project, including deleted ones (they still belong to a category). */
  projects: AdminProjectRow[];
  covers: Record<string, string>;
  onReload: () => Promise<void> | void;
  onEdit: (category: (AdminCategoryRow & { projectCount: number }) | null) => void;
};

/**
 * Categories as they appear on the site, in site order: show/hide with one click, rename,
 * delete (works move to another category first), drag to reorder, add new.
 */
export default function CategoriesView({ categories, projects, covers, onReload, onEdit }: Props) {
  const [order, setOrder] = useState(() => [...categories].sort((a, b) => a.display_order - b.display_order));
  const [busyId, setBusyId] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminCategoryRow | null>(null);

  useEffect(() => setOrder([...categories].sort((a, b) => a.display_order - b.display_order)), [categories]);

  const worksOf = (id: string) => projects.filter((project) => project.category_id === id);
  const activeWorksOf = (id: string) => worksOf(id).filter((project) => project.deleted_at === null);

  const toggle = async (category: AdminCategoryRow) => {
    if (!supabase) return;
    setBusyId(category.id);
    const { error } = await supabase.from('portfolio_categories').update({ is_active: !category.is_active }).eq('id', category.id);
    setBusyId('');
    if (error) { adminToast('ვერ შეიცვალა. სცადეთ ხელახლა.', 'error'); return; }
    adminToast(category.is_active ? `„${category.name}“ დაიმალა — საიტზე აღარ ჩანს.` : `„${category.name}“ ისევ ჩანს საიტზე.`, 'success');
    await onReload();
  };

  const saveOrder = async (next: AdminCategoryRow[]) => {
    if (!supabase) return;
    setOrder(next);
    const changes = next.flatMap((category, index) => category.display_order === index ? [] : [{ id: category.id, index }]);
    for (const change of changes) {
      const { error } = await supabase.from('portfolio_categories').update({ display_order: change.index }).eq('id', change.id);
      if (error) { adminToast('რიგი ვერ შეინახა.', 'error'); await onReload(); return; }
    }
    if (changes.length) adminToast('რიგი შეინახა.', 'success');
    await onReload();
  };

  const dragHandlers = (category: AdminCategoryRow) => ({
    draggable: true,
    onDragStart: (event: DragEvent) => { setDragId(category.id); event.dataTransfer.effectAllowed = 'move'; },
    onDragOver: (event: DragEvent) => { if (dragId && dragId !== category.id) { event.preventDefault(); setOverId(category.id); } },
    onDragLeave: () => setOverId((current) => (current === category.id ? null : current)),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      if (!dragId || dragId === category.id) return;
      const next = [...order];
      const [moved] = next.splice(next.findIndex((item) => item.id === dragId), 1);
      next.splice(next.findIndex((item) => item.id === category.id), 0, moved);
      setDragId(null); setOverId(null);
      void saveOrder(next);
    },
    onDragEnd: () => { setDragId(null); setOverId(null); },
  });

  return (
    <section className="admin-page-section cats" aria-labelledby="cats-heading">
      <div className="admin-page-heading">
        <div>
          <span className="cats-kicker">პორტფოლიო</span>
          <h1 id="cats-heading">კატეგორიები</h1>
          <p>ისე, როგორც საიტზე ჩანს. დამალეთ დროებით, შეცვალეთ, წაშალეთ ან გადაათრიეთ რიგის შესაცვლელად.</p>
        </div>
        <div className="admin-project-heading-actions">
          <button className="admin-button admin-button-primary" type="button" onClick={() => onEdit(null)}>
            <Plus aria-hidden="true" /> ახალი კატეგორია
          </button>
        </div>
      </div>

      {order.length === 0 ? (
        <p className="cats-empty">კატეგორიები ჯერ არ არის.</p>
      ) : (
        <ol className="cats-list">
          {order.map((category, index) => {
            const works = activeWorksOf(category.id);
            const visible = works.filter((work) => work.is_published).length;
            const thumb = works.map((work) => covers[work.id]).find(Boolean);
            return (
              <li
                key={category.id}
                className={`cats-row${category.is_active ? '' : ' is-hidden'}${dragId === category.id ? ' is-dragging' : ''}${overId === category.id ? ' is-over' : ''}`}
                {...dragHandlers(category)}
              >
                <span className="cats-grip" aria-hidden="true"><GripVertical /></span>
                <span className="cats-num">{String(index + 1).padStart(2, '0')}</span>
                <span className="cats-thumb" aria-hidden="true">{thumb ? <img src={thumb} alt="" loading="lazy" draggable={false} /> : <Images />}</span>
                <span className="cats-copy">
                  <strong>{category.name}</strong>
                  <small>
                    {getCategoryAdminLabel(category) !== category.name && <>{getCategoryAdminLabel(category)} · </>}
                    {formatNumber(visible)} ნამუშევარი საიტზე{works.length > visible && <> · {formatNumber(works.length - visible)} დამალული</>}
                  </small>
                </span>
                <button
                  type="button"
                  className={`works-visibility${category.is_active ? ' is-on' : ''}`}
                  disabled={busyId === category.id}
                  onClick={() => { void toggle(category); }}
                  title={category.is_active ? 'დროებით დამალვა' : 'საიტზე ჩვენება'}
                >
                  {busyId === category.id ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : category.is_active ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                  {category.is_active ? 'ჩანს' : 'დამალულია'}
                </button>
                <span className="cats-tools">
                  <button type="button" className="admin-icon-button" aria-label={`შეცვლა: ${category.name}`} title="სახელი და აღწერა" onClick={() => onEdit({ ...category, projectCount: works.length })}><Pencil aria-hidden="true" /></button>
                  <button type="button" className="admin-icon-button admin-project-trash-button" aria-label={`წაშლა: ${category.name}`} title="წაშლა" onClick={() => setDeleting(category)}><Trash2 aria-hidden="true" /></button>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {deleting && (
        <DeleteCategoryDialog
          category={deleting}
          works={worksOf(deleting.id)}
          others={order.filter((item) => item.id !== deleting.id)}
          onClose={() => setDeleting(null)}
          onDone={async () => { setDeleting(null); await onReload(); }}
        />
      )}
    </section>
  );
}

/** Deleting a category: its works (including deleted ones) first move to another category. */
function DeleteCategoryDialog({ category, works, others, onClose, onDone }: {
  category: AdminCategoryRow; works: AdminProjectRow[]; others: AdminCategoryRow[];
  onClose: () => void; onDone: () => Promise<void>;
}) {
  const [target, setTarget] = useState(others[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const blocked = works.length > 0 && !target;

  const run = async () => {
    if (!supabase || blocked) return;
    setBusy(true);
    try {
      if (works.length) {
        const { error: moveError } = await supabase.from('portfolio_projects').update({ category_id: target }).eq('category_id', category.id);
        if (moveError) throw moveError;
      }
      const { error } = await supabase.from('portfolio_categories').delete().eq('id', category.id);
      if (error) throw error;
      adminToast(`„${category.name}“ წაიშალა${works.length ? ` — ${formatNumber(works.length)} ნამუშევარი გადავიდა „${others.find((item) => item.id === target)?.name ?? ''}“-ში` : ''}.`, 'success');
      await onDone();
    } catch {
      adminToast('წაშლა ვერ მოხერხდა. სცადეთ ხელახლა.', 'error');
      setBusy(false);
    }
  };

  return (
    <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className="admin-dialog is-danger cats-delete" role="alertdialog" aria-modal="true" aria-labelledby="cats-delete-title">
        <button type="button" className="cats-delete-close" aria-label="დახურვა" onClick={onClose} disabled={busy}><X /></button>
        <h2 id="cats-delete-title">„{category.name}“ წაიშალოს?</h2>
        {works.length > 0 ? (
          <>
            <p>მასში {formatNumber(works.length)} ნამუშევარია. ისინი არ წაიშლება — აირჩიეთ, სად გადავიტანოთ:</p>
            {others.length ? (
              <select className="admin-select" value={target} onChange={(event) => setTarget(event.target.value)}>
                {others.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            ) : <p>სხვა კატეგორია არ არსებობს — ჯერ შექმენით ახალი.</p>}
          </>
        ) : <p>კატეგორია ცარიელია. წაშლის გაუქმება შეუძლებელია, მაგრამ ყოველთვის შეგიძლიათ ახლის შექმნა.</p>}
        <div className="admin-dialog-actions">
          <button type="button" className="admin-button admin-button-quiet" onClick={onClose} disabled={busy}>გაუქმება</button>
          <button type="button" className="admin-button admin-button-danger" onClick={() => { void run(); }} disabled={busy || blocked}>
            {busy ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />} წაშლა
          </button>
        </div>
      </div>
    </div>
  );
}
