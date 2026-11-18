import { useState, type FormEvent } from 'react';
import { CircleAlert, LoaderCircle, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { adminConfirm } from './feedback';
import { slugifyCategoryName } from './labels';

export type AdminCategory = {
  id: string;
  slug: string;
  name: string;
  description: string;
  display_order: number;
  is_active: boolean;
  projectCount: number;
};

type CategoryEditorProps = {
  category: AdminCategory | null;
  onClose: () => void;
  onSaved: (message: string) => void;
};

export default function CategoryEditor({ category, onClose, onSaved }: CategoryEditorProps) {
  // New categories get their URL code from the name until the user edits the code themselves.
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [name, setName] = useState(category?.name ?? '');
  const effectiveSlug = slugTouched ? slug : slugifyCategoryName(name);
  const [description, setDescription] = useState(category?.description ?? '');
  const [displayOrder, setDisplayOrder] = useState(category?.display_order ?? 0);
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = supabase;
    if (!client || isSaving) return;

    const normalizedSlug = effectiveSlug.trim().toLowerCase().replace(/\s+/g, '-');
    const normalizedName = name.trim();
    if (!normalizedName) {
      setErrorMessage('შეავსეთ კატეგორიის სახელი.');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
      setErrorMessage('ბმულის კოდი ვერ შეიქმნა სახელიდან. „დამატებითში“ მიუთითეთ ლათინური ასოებით, მაგ. packaging.');
      return;
    }
    if (category?.is_active && !isActive && category.projectCount > 0 && !await adminConfirm({
      title: 'კატეგორიის დამალვა',
      message: 'კატეგორია და მისი პროექტები საიტზე აღარ გამოჩნდება. არაფერი წაიშლება.',
      confirmLabel: 'დამალვა',
    })) return;

    setIsSaving(true);
    setErrorMessage('');
    const values = {
      name: normalizedName,
      description: description.trim(),
      display_order: Math.max(0, Math.trunc(displayOrder)),
      is_active: isActive,
    };

    try {
      const result = category
        ? await client.from('portfolio_categories').update(values).eq('id', category.id)
        : await client.from('portfolio_categories').insert({ slug: normalizedSlug, ...values });
      if (result.error) throw result.error;
      onSaved(category ? 'კატეგორიის ცვლილებები შეინახა.' : 'კატეგორია წარმატებით დაემატა.');
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
      setErrorMessage(code === '23505'
        ? 'ეს მისამართის კოდი უკვე გამოყენებულია. მიუთითეთ სხვა კოდი.'
        : 'კატეგორიის შენახვა ვერ მოხერხდა. შეამოწმეთ კავშირი და ადმინისტრატორის უფლებები.');
      setIsSaving(false);
    }
  }

  return (
    <div className="admin-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) onClose(); }}>
      <section className="admin-editor-dialog admin-category-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-category-editor-title" lang="ka-GE">
        <header className="admin-editor-header">
          <div>
            <h2 id="admin-category-editor-title">{category ? 'კატეგორიის შეცვლა' : 'ახალი კატეგორია'}</h2>
          </div>
          <button className="admin-icon-button" type="button" aria-label="რედაქტორის დახურვა" onClick={onClose} disabled={isSaving}><X aria-hidden="true" /></button>
        </header>

        <form className="admin-category-editor-form" onSubmit={handleSubmit}>
          {errorMessage && <div className="admin-alert" role="alert"><CircleAlert aria-hidden="true" /><span>{errorMessage}</span></div>}
          <label className="admin-editor-field">
            <span>სახელი <i>*</i></span>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required placeholder="მაგალითად, შეფუთვის დიზაინი" />
          </label>
          <label className="admin-editor-field">
            <span>აღწერა <em>არასავალდებულო</em></span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={3} placeholder="ერთი წინადადება კატალოგის გვერდისთვის" />
          </label>
          <label className="admin-editor-toggle">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            <span className="admin-editor-toggle-mark" />
            <span><strong>{isActive ? 'საიტზე ჩანს' : 'დამალულია'}</strong><small>{isActive ? 'კატეგორია და მისი პროექტები კატალოგში ჩანს.' : 'კატეგორია და მისი პროექტები საიტზე არ ჩანს.'}</small></span>
          </label>
          <details className="admin-editor-more">
            <summary>დამატებითი <small>ბმული და რიგი</small></summary>
            <div className="admin-editor-more-body">
              <label className="admin-editor-field">
                <span>ბმულის კოდი</span>
                <input
                  value={effectiveSlug}
                  onChange={(event) => { setSlugTouched(true); setSlug(event.target.value); }}
                  maxLength={80}
                  disabled={Boolean(category)}
                  placeholder="packaging-design"
                />
                <small>{category ? 'არსებული კატეგორიის ბმული არ იცვლება.' : `კატალოგის მისამართი: /portfolio/${effectiveSlug || '…'}`}</small>
              </label>
              <label className="admin-editor-field">
                <span>რიგი</span>
                <input type="number" min="0" step="1" inputMode="numeric" value={displayOrder} onChange={(event) => setDisplayOrder(Number(event.target.value))} />
              </label>
            </div>
          </details>
          <footer className="admin-editor-footer">
            <button className="admin-button admin-button-quiet" type="button" onClick={onClose} disabled={isSaving}>გაუქმება</button>
            <button className="admin-button admin-button-primary" type="submit" disabled={isSaving}>
              {isSaving ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              {isSaving ? 'ინახება...' : 'შენახვა'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
