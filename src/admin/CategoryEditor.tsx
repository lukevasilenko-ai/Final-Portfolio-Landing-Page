import { useState, type FormEvent } from 'react';
import { CircleAlert, LoaderCircle, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [displayOrder, setDisplayOrder] = useState(category?.display_order ?? 0);
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = supabase;
    if (!client || isSaving) return;

    const normalizedSlug = slug.trim().toLowerCase().replace(/\s+/g, '-');
    const normalizedName = name.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
      setErrorMessage('კოდი გამოიყენებს მხოლოდ ლათინურ პატარა ასოებს, ციფრებსა და დეფისს.');
      return;
    }
    if (!normalizedName) {
      setErrorMessage('შეავსეთ კატეგორიის სახელი.');
      return;
    }
    if (category?.is_active && !isActive && category.projectCount > 0) {
      const confirmed = window.confirm('კატეგორია საჯარო სიიდან დაიმალება. პროექტები და სურათები არ წაიშლება. გსურთ გაგრძელება?');
      if (!confirmed) return;
    }

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
            <p className="admin-eyebrow">პორტფოლიოს სტრუქტურა</p>
            <h2 id="admin-category-editor-title">{category ? 'კატეგორიის რედაქტირება' : 'კატეგორიის დამატება'}</h2>
          </div>
          <button className="admin-icon-button" type="button" aria-label="რედაქტორის დახურვა" onClick={onClose} disabled={isSaving}><X aria-hidden="true" /></button>
        </header>

        <form className="admin-category-editor-form" onSubmit={handleSubmit}>
          {errorMessage && <div className="admin-alert" role="alert"><CircleAlert aria-hidden="true" /><span>{errorMessage}</span></div>}
          <label className="admin-editor-field">
            <span>კატეგორიის სახელი <i>*</i></span>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required placeholder="მაგალითად, შეფუთვის დიზაინი" />
          </label>
          <label className="admin-editor-field">
            <span>აღწერა</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={3} placeholder="მოკლე აღწერა კატალოგისთვის" />
          </label>
          <label className="admin-editor-field">
            <span>მისამართის კოდი <i>*</i></span>
            <input value={slug} onChange={(event) => setSlug(event.target.value)} maxLength={80} required disabled={Boolean(category)} placeholder="მაგ. packaging-design" />
            <small>{category ? 'არსებული კოდი და იდენტიფიკატორი უცვლელი დარჩება.' : 'ლათინური პატარა ასოები, ციფრები და დეფისი; შემდეგ კოდი აღარ შეიცვლება.'}</small>
          </label>
          <label className="admin-editor-field admin-category-editor-order">
            <span>ჩვენების რიგი</span>
            <input type="number" min="0" step="1" inputMode="numeric" value={displayOrder} onChange={(event) => setDisplayOrder(Number(event.target.value))} />
          </label>
          <label className="admin-editor-toggle">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            <span className="admin-editor-toggle-mark" />
            <span><strong>აქტიური კატეგორია</strong><small>აქტიური კატეგორია საჯარო კატალოგში გამოჩნდება.</small></span>
          </label>
          <div className="admin-editor-policy-note">
            <CircleAlert aria-hidden="true" />
            <p>კატეგორიის წაშლა გამორთულია. მისი გამორთვა პროექტებსა და სურათებს არ შლის.</p>
          </div>
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
