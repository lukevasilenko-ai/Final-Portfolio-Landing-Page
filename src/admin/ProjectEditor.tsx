import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  GripVertical,
  ImagePlus,
  LoaderCircle,
  Save,
  Star,
  Upload,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCategoryAdminLabel } from './labels';

export type ProjectEditorCategory = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
};

export type ProjectEditorRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category_id: string;
  presentation_type: 'image' | 'project';
  cover_image_path: string | null;
  display_order: number;
  is_published: boolean;
  is_featured: boolean;
  tags: string[];
  tools: string[];
  year: number | null;
};

type GalleryRow = {
  id: string;
  project_id: string;
  image_path: string;
  alt_text: string;
  caption: string;
  display_order: number;
};

type GalleryItem = {
  id?: string;
  path?: string;
  needsRecord?: boolean;
  altText: string;
  caption: string;
  previewUrl: string;
  file?: File;
};

type ProjectEditorProps = {
  project: ProjectEditorRecord | null;
  categories: ProjectEditorCategory[];
  onClose: () => void;
  onDraftCreated: () => void;
  onSaved: (message: string) => void;
};

const mimeByExtension: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};
const allowedMimeTypes = new Set(Object.values(mimeByExtension));
const maxImageBytes = 50 * 1024 * 1024;
const parseList = (value: string) => value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);

function getFileMimeType(file: File) {
  if (allowedMimeTypes.has(file.type)) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return mimeByExtension[extension] ?? '';
}

function getSafeFilename(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'img';
  const baseName = file.name
    .slice(0, Math.max(0, file.name.lastIndexOf('.')))
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `${crypto.randomUUID()}-${baseName || 'image'}.${extension}`;
}

function isValidImage(file: File) {
  return Boolean(getFileMimeType(file)) && file.size <= maxImageBytes;
}

function formatFileSize(bytes: number) {
  return new Intl.NumberFormat('ka-GE', { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024));
}

export default function ProjectEditor({ project, categories, onClose, onDraftCreated, onSaved }: ProjectEditorProps) {
  const [title, setTitle] = useState(project?.title ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [tagsText, setTagsText] = useState(project?.tags.join(', ') ?? '');
  const [toolsText, setToolsText] = useState(project?.tools.join(', ') ?? '');
  const [yearText, setYearText] = useState(project?.year?.toString() ?? '');
  const [categoryId, setCategoryId] = useState(project?.category_id ?? categories.find((item) => item.is_active)?.id ?? '');
  const [presentationType, setPresentationType] = useState<'image' | 'project'>(project?.presentation_type ?? 'project');
  const [displayOrder, setDisplayOrder] = useState(project?.display_order ?? 0);
  const [isPublished, setIsPublished] = useState(project?.is_published ?? false);
  const [isFeatured, setIsFeatured] = useState(project?.is_featured ?? false);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [coverPath, setCoverPath] = useState<string | null>(project?.cover_image_path ?? null);
  const [coverPreview, setCoverPreview] = useState('');
  const [newCover, setNewCover] = useState<File | null>(null);
  const [draftProjectId, setDraftProjectId] = useState<string | null>(null);
  const [galleryLoading, setGalleryLoading] = useState(Boolean(project));
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const previewUrls = useRef(new Set<string>());

  const eligibleCategories = useMemo(
    () => categories.filter((item) => item.is_active || item.id === project?.category_id),
    [categories, project?.category_id],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!project || !supabase) return;
    let active = true;
    setGalleryLoading(true);
    setErrorMessage('');

    void supabase
      .from('portfolio_gallery_images')
      .select('id, project_id, image_path, alt_text, caption, display_order')
      .eq('project_id', project.id)
      .order('display_order', { ascending: true })
      .then(async ({ data, error }) => {
        try {
          if (!active) return;
          if (error) {
            setErrorMessage('პროექტის გალერეის ჩატვირთვა ვერ მოხერხდა. სცადეთ თავიდან.');
            setGalleryLoading(false);
            return;
          }

          const rows = (data ?? []) as GalleryRow[];
          const paths = [project.cover_image_path, ...rows.map((item) => item.image_path)].filter(
            (path): path is string => Boolean(path),
          );
          let signedUrlByPath = new Map<string, string>();
          if (paths.length > 0) {
            const { data: signedData, error: signedError } = await supabase
              .storage.from('portfolio-images').createSignedUrls(paths, 3600);
            if (signedError) {
              setErrorMessage('არსებული სურათების დროებითი ბმულები ვერ შეიქმნა. მათი შეცვლა მაინც შეგიძლიათ.');
            } else {
              signedUrlByPath = new Map(
                (signedData ?? [])
                  .filter((item) => item.signedUrl)
                  .map((item) => [item.path, item.signedUrl as string]),
              );
            }
          }
          if (!active) return;

          if (project.cover_image_path) {
            setCoverPreview(signedUrlByPath.get(project.cover_image_path) ?? '');
          }
          setGallery(rows.map((item) => ({
            id: item.id,
            path: item.image_path,
            altText: item.alt_text,
            caption: item.caption,
            previewUrl: signedUrlByPath.get(item.image_path) ?? '',
          })));
          setGalleryLoading(false);
        } catch {
          if (!active) return;
          setErrorMessage('პროექტის გალერეის ჩატვირთვა ვერ მოხერხდა. შეამოწმეთ კავშირი და სცადეთ თავიდან.');
          setGalleryLoading(false);
        }
      });

    return () => { active = false; };
  }, [project]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) requestClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  });

  function requestClose() {
    if (isSaving) return;
    if (hasUnsavedChanges && !window.confirm('დახურვის შემთხვევაში შენახული ცვლილებები დაიკარგება. გსურთ დახურვა?')) return;
    onClose();
  }

  function stagePreview(file: File) {
    const url = URL.createObjectURL(file);
    previewUrls.current.add(url);
    return url;
  }

  function handleCoverSelection(file: File | undefined) {
    if (!file) return;
    setErrorMessage('');
    if (!isValidImage(file)) {
      setErrorMessage('აირჩიეთ JPG, PNG, WEBP ან AVIF სურათი, რომლის ზომაც 50 მბ-ს არ აღემატება.');
      return;
    }
    if (coverPreview.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreview);
      previewUrls.current.delete(coverPreview);
    }
    setNewCover(file);
    setCoverPreview(stagePreview(file));
    setHasUnsavedChanges(true);
  }

  function handleGallerySelection(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    const invalidCount = selected.filter((file) => !isValidImage(file)).length;
    const valid = selected.filter(isValidImage);
    if (invalidCount > 0) {
      setErrorMessage('ზოგი ფაილი გამოტოვებულია: დასაშვებია JPG, PNG, WEBP ან AVIF, მაქსიმუმ 50 მბ თითო ფაილზე.');
    } else {
      setErrorMessage('');
    }
    if (valid.length === 0) return;

    setGallery((current) => [
      ...current,
      ...valid.map((file) => ({
        file,
        altText: title.trim(),
        caption: '',
        previewUrl: stagePreview(file),
      })),
    ]);
    setHasUnsavedChanges(true);
  }

  function moveGalleryItem(from: number, to: number) {
    if (to < 0 || to >= gallery.length || from === to) return;
    setGallery((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setHasUnsavedChanges(true);
  }

  function handleGalleryDrop(event: DragEvent<HTMLElement>, targetIndex: number) {
    event.preventDefault();
    if (dragIndex !== null) moveGalleryItem(dragIndex, targetIndex);
    setDragIndex(null);
  }

  async function uploadImage(projectId: string, file: File) {
    const client = supabase;
    if (!client) throw new Error('not_configured');
    const path = `${projectId}/${getSafeFilename(file)}`;
    const { error } = await client.storage
      .from('portfolio-images')
      .upload(path, file, {
        cacheControl: '3600',
        contentType: getFileMimeType(file),
        upsert: false,
      });
    if (error) throw error;
    return path;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = supabase;
    if (!client || isSaving) return;

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setErrorMessage('შეავსეთ პროექტის სათაური.');
      return;
    }
    if (!categoryId) {
      setErrorMessage('აირჩიეთ პროექტის კატეგორია.');
      return;
    }
    const year = yearText.trim() ? Number(yearText) : null;
    if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 9999)) {
      setErrorMessage('წელი უნდა იყოს 1900-დან 9999-მდე.');
      return;
    }
    if (isPublished && !newCover && !coverPath) {
      setErrorMessage('გამოქვეყნებამდე პროექტს ქავერის სურათი უნდა ჰქონდეს.');
      return;
    }
    if (presentationType === 'image' && gallery.length > 0) {
      setErrorMessage('ინდივიდუალურ სურათს გალერეა არ უნდა ჰქონდეს. არსებული გალერეის წაშლა ამ ეტაპზე გამორთულია.');
      return;
    }
    if (!project && isPublished && !window.confirm('პროექტი გამოქვეყნდება და საჯაროდ გამოჩნდება. გაგრძელდეს?')) return;
    if (project && project.is_published !== isPublished) {
      const action = isPublished ? 'საჯაროდ გამოქვეყნდეს' : 'საჯარო პორტფოლიოდან მოიხსნას და მონახაზად დარჩეს';
      if (!window.confirm(`პროექტი ${action}. გსურთ გაგრძელება?`)) return;
    }
    if (project?.cover_image_path && newCover && !window.confirm('ახალი ქავერი ჩაენაცვლება პროექტის მიმდინარე ქავერს. ძველი ფაილი არ წაიშლება. გსურთ გაგრძელება?')) return;
    if (project && project.presentation_type !== presentationType && !window.confirm('პროექტის ჩვენების ფორმატი შეიცვლება. არსებული სურათები არ წაიშლება. გსურთ გაგრძელება?')) return;

    setIsSaving(true);
    setErrorMessage('');
    setSaveStatus('პროექტის მონახაზი მზადდება...');
    let newProjectCreated = false;
    const projectId = project?.id ?? draftProjectId ?? crypto.randomUUID();
    const slug = project?.slug ?? `project-${projectId.replaceAll('-', '').slice(0, 12)}`;
    let nextCoverPath = coverPath;

    try {
      if (!project && !draftProjectId) {
        const { error } = await client.from('portfolio_projects').insert({
          id: projectId,
          slug,
          title: normalizedTitle,
          description: description.trim(),
          category_id: categoryId,
          presentation_type: presentationType,
          tags: parseList(tagsText),
          tools: parseList(toolsText),
          year,
          cover_image_path: null,
          display_order: Math.max(0, Math.trunc(displayOrder)),
          is_published: false,
          is_featured: isFeatured,
        });
        if (error) throw error;
        newProjectCreated = true;
        setDraftProjectId(projectId);
        onDraftCreated();
      }

      if (newCover) {
        setSaveStatus('ქავერის სურათი იტვირთება...');
        nextCoverPath = await uploadImage(projectId, newCover);
        setCoverPath(nextCoverPath);
        setNewCover(null);
      }

      const newGalleryRows: Array<{
        project_id: string;
        image_path: string;
        alt_text: string;
        caption: string;
        display_order: number;
      }> = [];
      const orderedGallery = [...gallery];

      for (const [index, item] of orderedGallery.entries()) {
        if (item.file) {
          setSaveStatus(`გალერეის სურათები იტვირთება: ${new Intl.NumberFormat('ka-GE').format(index + 1)} / ${new Intl.NumberFormat('ka-GE').format(orderedGallery.length)}`);
          const path = await uploadImage(projectId, item.file);
          setGallery((current) => current.map((entry, entryIndex) => entryIndex === index
            ? { ...entry, file: undefined, path, needsRecord: true }
            : entry));
          newGalleryRows.push({
            project_id: projectId,
            image_path: path,
            alt_text: item.altText || normalizedTitle,
            caption: item.caption,
            display_order: index,
          });
        } else if (item.needsRecord && item.path) {
          newGalleryRows.push({
            project_id: projectId,
            image_path: item.path,
            alt_text: item.altText || normalizedTitle,
            caption: item.caption,
            display_order: index,
          });
        } else if (item.id) {
          const { error } = await client.from('portfolio_gallery_images')
            .update({ display_order: index })
            .eq('id', item.id)
            .eq('project_id', projectId);
          if (error) throw error;
        }
      }

      if (newGalleryRows.length > 0) {
        setSaveStatus('გალერეის ჩანაწერები ინახება...');
        const { data, error } = await client.from('portfolio_gallery_images')
          .insert(newGalleryRows)
          .select('id, project_id, image_path, alt_text, caption, display_order');
        if (error) throw error;
        const savedRows = (data ?? []) as GalleryRow[];
        const savedRowByPath = new Map(savedRows.map((row) => [row.image_path, row]));
        setGallery((current) => current.map((item) => {
          const savedRow = item.path ? savedRowByPath.get(item.path) : undefined;
          return savedRow ? { ...item, id: savedRow.id, needsRecord: false } : item;
        }));
      }
      setSaveStatus('პროექტის მონაცემები ინახება...');
      const { error } = await client
        .from('portfolio_projects')
        .update({
          title: normalizedTitle,
          description: description.trim(),
          category_id: categoryId,
          presentation_type: presentationType,
          tags: parseList(tagsText),
          tools: parseList(toolsText),
          year,
          cover_image_path: nextCoverPath,
          display_order: Math.max(0, Math.trunc(displayOrder)),
          is_published: isPublished,
          is_featured: isFeatured,
        })
        .eq('id', projectId);
      if (error) throw error;

      onSaved(project ? 'პროექტის ცვლილებები წარმატებით შეინახა.' : 'ახალი პროექტი წარმატებით შეიქმნა.');
    } catch {
      setErrorMessage(!project && (newProjectCreated || draftProjectId)
        ? 'პროექტის მონახაზი შეიქმნა, თუმცა ატვირთვა ან შენახვა ბოლომდე ვერ დასრულდა. მონახაზი პროექტების სიაში დაგხვდებათ და ხელახლა შეძლებთ გაგრძელებას.'
        : 'შენახვა ვერ მოხერხდა. შეამოწმეთ კავშირი, ატვირთვის წესები და ადმინისტრატორის უფლებები, შემდეგ სცადეთ თავიდან.');
      setSaveStatus('');
      setIsSaving(false);
    }
  }

  return (
    <div
      className="admin-editor-backdrop"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}
    >
      <section className="admin-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-editor-title" lang="ka-GE">
        <header className="admin-editor-header">
          <div>
            <p className="admin-eyebrow">პორტფოლიოს მართვა</p>
            <h2 id="admin-editor-title">{project ? 'პროექტის რედაქტირება' : 'პროექტის დამატება'}</h2>
          </div>
          <button className="admin-icon-button" type="button" aria-label="რედაქტორის დახურვა" onClick={requestClose} disabled={isSaving}>
            <X aria-hidden="true" />
          </button>
        </header>

        <form className="admin-editor-form" onSubmit={handleSubmit} onChange={() => setHasUnsavedChanges(true)}>
          {errorMessage && (
            <div className="admin-alert" role="alert"><CircleAlert aria-hidden="true" /><span>{errorMessage}</span></div>
          )}

          <div className="admin-editor-main-grid">
            <div className="admin-editor-fields">
              <section className="admin-editor-section">
                <div className="admin-editor-section-heading"><span>01</span><h3>ძირითადი ინფორმაცია</h3></div>
                <label className="admin-editor-field">
                  <span>პროექტის სათაური <i>*</i></span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder="მაგალითად, ბრენდის ვიზუალური იდენტობა" />
                </label>
                <label className="admin-editor-field">
                  <span>აღწერა</span>
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} maxLength={5000} placeholder="მოკლედ აღწერეთ პროექტი..." />
                  <small>{new Intl.NumberFormat('ka-GE').format(description.length)} / {new Intl.NumberFormat('ka-GE').format(5000)}</small>
                </label>
                <label className="admin-editor-field">
                  <span>ინსტრუმენტები</span>
                  <input value={toolsText} onChange={(event) => setToolsText(event.target.value)} maxLength={500} placeholder="მაგალითად, Adobe Illustrator, Photoshop" />
                  <small>გამოყავით მძიმეებით ან ახალ ხაზზე.</small>
                </label>
                <label className="admin-editor-field">
                  <span>თეგები</span>
                  <input value={tagsText} onChange={(event) => setTagsText(event.target.value)} maxLength={500} placeholder="მაგალითად, ბრენდინგი, ვიზუალური იდენტობა" />
                  <small>გამოყავით მძიმეებით ან ახალ ხაზზე.</small>
                </label>
                <label className="admin-editor-field admin-editor-year-field">
                  <span>წელი</span>
                  <input type="number" min="1900" max="9999" step="1" inputMode="numeric" value={yearText} onChange={(event) => setYearText(event.target.value)} placeholder="მაგ. 2026" />
                </label>
                <label className="admin-editor-field">
                  <span>კატეგორია <i>*</i></span>
                  <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
                    <option value="" disabled>აირჩიეთ კატეგორია</option>
                    {eligibleCategories.map((category) => (
                      <option key={category.id} value={category.id}>{getCategoryAdminLabel(category)}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-editor-field">
                  <span>ჩვენების ფორმატი <i>*</i></span>
                  <select value={presentationType} onChange={(event) => setPresentationType(event.target.value as 'image' | 'project')}>
                    <option value="image">ერთი სურათის ბარათი</option>
                    <option value="project">პროექტი გალერეით</option>
                  </select>
                  <small>{presentationType === 'image' ? 'ბარათზე დაჭერისას ფოტო სრულ ხედში გაიხსნება.' : 'ბარათზე დაჭერისას პროექტის გვერდი და გალერეა გაიხსნება.'}</small>
                </label>
              </section>

              <section className="admin-editor-section">
                <div className="admin-editor-section-heading"><span>02</span><h3>ქავერის სურათი</h3></div>
                <input
                  ref={coverInputRef}
                  className="admin-visually-hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif"
                  disabled={galleryLoading || isSaving}
                  onChange={(event) => { handleCoverSelection(event.target.files?.[0]); event.currentTarget.value = ''; }}
                />
                {coverPreview ? (
                  <div className="admin-editor-cover-preview">
                    <img src={coverPreview} alt={`${title || 'პროექტის'} ქავერის წინასწარი ხედი`} />
                    <span>{newCover || (coverPath && coverPath !== project?.cover_image_path) ? 'ახალი ქავერი' : 'მიმდინარე ქავერი'}</span>
                    <button type="button" className="admin-button admin-button-quiet" onClick={() => coverInputRef.current?.click()} disabled={galleryLoading || isSaving}>
                      <Upload aria-hidden="true" /> ქავერის შეცვლა
                    </button>
                  </div>
                ) : (
                  <button type="button" className="admin-editor-upload-zone" onClick={() => coverInputRef.current?.click()} disabled={galleryLoading || isSaving}>
                    <span><ImagePlus aria-hidden="true" /></span>
                    <strong>ატვირთეთ ქავერის სურათი</strong>
                    <small>JPG, PNG, WEBP ან AVIF · მაქსიმუმ 50 მბ</small>
                    <Upload aria-hidden="true" />
                  </button>
                )}
              </section>
            </div>

            <aside className="admin-editor-options">
              <section className="admin-editor-section">
                <div className="admin-editor-section-heading"><span>03</span><h3>გამოქვეყნება</h3></div>
                <label className="admin-editor-toggle">
                  <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />
                  <span className="admin-editor-toggle-mark" />
                  <span><strong>გამოქვეყნებულია</strong><small>{isPublished ? 'საჯაროდ გამოჩნდება პორტფოლიოში' : 'მხოლოდ ადმინისტრატორისთვის ხილული მონახაზია'}</small></span>
                </label>
                <label className="admin-editor-toggle">
                  <input type="checkbox" checked={isFeatured} onChange={(event) => setIsFeatured(event.target.checked)} />
                  <span className="admin-editor-toggle-mark" />
                  <span><strong>რჩეული პროექტი</strong><small>გამოიყენება რჩეული ნამუშევრის გამოსაყოფად</small></span>
                  <Star aria-hidden="true" />
                </label>
                <label className="admin-editor-field admin-editor-order-field">
                  <span>ჩვენების რიგი</span>
                  <input type="number" min="0" step="1" inputMode="numeric" value={displayOrder} onChange={(event) => setDisplayOrder(Number(event.target.value))} />
                </label>
              </section>
              <div className="admin-editor-policy-note">
                <CircleAlert aria-hidden="true" />
                <p>გამოქვეყნება დასტურდება ცალკე. არსებული პროექტებისა და სურათების წაშლა ამ ეტაპზე გამორთულია.</p>
              </div>
            </aside>
          </div>

          <section className="admin-editor-section admin-editor-gallery-section">
            <div className="admin-editor-section-heading admin-editor-gallery-heading">
              <div><span>04</span><h3>გალერეის სურათები</h3></div>
              <div className="admin-editor-gallery-actions">
                <span>{new Intl.NumberFormat('ka-GE').format(gallery.length)} სურათი</span>
                <input
                  ref={galleryInputRef}
                  className="admin-visually-hidden"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif"
                  onChange={(event) => { handleGallerySelection(event.target.files); event.currentTarget.value = ''; }}
                />
                <button className="admin-button admin-button-quiet" type="button" onClick={() => galleryInputRef.current?.click()} disabled={galleryLoading || isSaving || presentationType === 'image'}>
                  <ImagePlus aria-hidden="true" /> სურათების დამატება
                </button>
              </div>
            </div>
            <p className="admin-editor-helper">{presentationType === 'image' ? 'ინდივიდუალური სურათის ფორმატისთვის გალერეა ცარიელი უნდა იყოს.' : 'გადაათრიეთ სურათები რიგის შესაცვლელად, ან გამოიყენეთ ისრიანი ღილაკები.'} შენახვისას არსებული ფაილები არ იშლება.</p>

            {galleryLoading ? (
              <div className="admin-editor-loading" role="status"><LoaderCircle className="admin-spin" aria-hidden="true" />გალერეა იტვირთება...</div>
            ) : gallery.length === 0 ? (
              <button className="admin-editor-empty-gallery" type="button" onClick={() => galleryInputRef.current?.click()}>
                <ImagePlus aria-hidden="true" /> გალერეის სურათები ჯერ არ არის
              </button>
            ) : (
              <div className="admin-editor-gallery-list">
                {gallery.map((item, index) => (
                  <article
                    className={`admin-editor-gallery-item ${dragIndex === index ? 'is-dragging' : ''}`}
                    key={item.id ?? item.previewUrl}
                    draggable
                    onDragStart={(event) => { setDragIndex(index); event.dataTransfer.effectAllowed = 'move'; }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleGalleryDrop(event, index)}
                    onDragEnd={() => setDragIndex(null)}
                  >
                    <button className="admin-editor-drag-handle" type="button" aria-label={`${new Intl.NumberFormat('ka-GE').format(index + 1)} სურათის გადატანა`} title="გადაათრიეთ რიგის შესაცვლელად">
                      <GripVertical aria-hidden="true" />
                    </button>
                    <span className="admin-editor-image-order">{new Intl.NumberFormat('ka-GE', { minimumIntegerDigits: 2, useGrouping: false }).format(index + 1)}</span>
                    <div className="admin-editor-gallery-thumb">
                      {item.previewUrl ? <img src={item.previewUrl} alt={item.altText || title} /> : <ImagePlus aria-hidden="true" />}
                    </div>
                    <div className="admin-editor-gallery-copy">
                      <strong>{item.file?.name ?? item.path?.split('/').at(-1) ?? 'სურათი'}</strong>
                      <span>{item.file ? `${formatFileSize(item.file.size)} მბ · ახალი ფაილი` : 'არსებული სურათი'}</span>
                    </div>
                    <div className="admin-editor-image-tools">
                      <button type="button" className="admin-icon-button" aria-label={`${new Intl.NumberFormat('ka-GE').format(index + 1)} სურათის ზემოთ გადაადგილება`} title="ზემოთ გადაადგილება" onClick={() => moveGalleryItem(index, index - 1)} disabled={index === 0 || isSaving}>
                        <ArrowUp aria-hidden="true" />
                      </button>
                      <button type="button" className="admin-icon-button" aria-label={`${new Intl.NumberFormat('ka-GE').format(index + 1)} სურათის ქვემოთ გადაადგილება`} title="ქვემოთ გადაადგილება" onClick={() => moveGalleryItem(index, index + 1)} disabled={index === gallery.length - 1 || isSaving}>
                        <ArrowDown aria-hidden="true" />
                      </button>
                      {item.file && (
                        <button
                          type="button"
                          className="admin-icon-button admin-editor-remove-staged"
                          aria-label="ატვირთვის რიგიდან ამოღება"
                          title="ატვირთვის რიგიდან ამოღება"
                          onClick={() => {
                            URL.revokeObjectURL(item.previewUrl);
                            previewUrls.current.delete(item.previewUrl);
                            setGallery((current) => current.filter((_, currentIndex) => currentIndex !== index));
                            setHasUnsavedChanges(true);
                          }}
                          disabled={isSaving}
                        ><X aria-hidden="true" /></button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {saveStatus && <p className="admin-editor-save-status" role="status"><LoaderCircle className="admin-spin" aria-hidden="true" />{saveStatus}</p>}
          <footer className="admin-editor-footer">
            <button className="admin-button admin-button-quiet" type="button" onClick={requestClose} disabled={isSaving}>გაუქმება</button>
            <button className="admin-button admin-button-primary" type="submit" disabled={isSaving || galleryLoading || eligibleCategories.length === 0}>
              {isSaving ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              {isSaving ? 'ინახება...' : 'ცვლილებების შენახვა'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
