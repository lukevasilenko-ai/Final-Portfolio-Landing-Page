import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowUpRight, AtSign, Facebook, Globe, Instagram, LoaderCircle, MapPin, RotateCcw, Save, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  DEFAULT_SITE_PROFILE,
  SEO_DESCRIPTION_LIMIT,
  SEO_TITLE_LIMIT,
  SITE_PROFILE_KEY,
  SITE_PROFILE_LOCALE,
  emailComposeLink,
  normalizeSiteProfile,
  validateSiteProfile,
  whatsappLink,
  type SiteProfile,
} from '../siteProfile';
import { adminConfirm, adminToast } from './feedback';

const AVAILABILITY_PRESETS = [
  { open: true, text: 'პროექტების მიღება აქტიურია' },
  { open: true, text: 'ვიღებ ახალ შეკვეთებს' },
  { open: false, text: 'ამჟამად დაკავებული ვარ' },
];

function Field({ label, hint, error, children, counter }: { label: string; hint?: string; error?: string; children: ReactNode; counter?: { value: number; limit: number } }) {
  return (
    <label className={`admin-form-field${error ? ' has-error' : ''}`}>
      <span className="admin-form-label">
        {label}
        {counter && <small className={counter.value > counter.limit ? 'is-over' : ''}>{counter.value}/{counter.limit}</small>}
      </span>
      {children}
      {error ? <span className="admin-form-error">{error}</span> : hint ? <span className="admin-form-hint">{hint}</span> : null}
    </label>
  );
}

/** Editable site profile (status, location, social links, SEO) that the public site reads. */
export default function SiteSettingsView({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [saved, setSaved] = useState<SiteProfile>(DEFAULT_SITE_PROFILE);
  const [draft, setDraft] = useState<SiteProfile>(DEFAULT_SITE_PROFILE);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    client.from('site_content')
      .select('content, updated_at')
      .eq('content_key', SITE_PROFILE_KEY)
      .eq('locale', SITE_PROFILE_LOCALE)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { setLoadError('პარამეტრების ჩატვირთვა ვერ მოხერხდა. სცადეთ გვერდის განახლება.'); return; }
        const profile = normalizeSiteProfile(data?.content);
        setExists(Boolean(data));
        setSaved(profile);
        setDraft(profile);
      }, () => { if (active) setLoadError('სერვერთან კავშირი ვერ დამყარდა.'); })
      .then(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const errors = useMemo(() => validateSiteProfile(draft), [draft]);
  const hasErrors = Object.keys(errors).length > 0;

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const update = (change: (current: SiteProfile) => SiteProfile) => setDraft((current) => change(current));
  const setSocial = (key: keyof SiteProfile['socials'], value: string) =>
    update((current) => ({ ...current, socials: { ...current.socials, [key]: key === 'whatsapp' ? value.replace(/\D/g, '') : value.trim() } }));

  const save = async () => {
    const client = supabase;
    if (!client || saving || hasErrors) return;
    const confirmed = await adminConfirm({
      title: 'პარამეტრების შენახვა',
      message: 'ცვლილებები მაშინვე გამოჩნდება საჯარო საიტზე: სტატუსი, მდებარეობა, სოციალური ბმულები და საძიებო სისტემების ტექსტი.',
      confirmLabel: 'შენახვა და გამოქვეყნება',
    });
    if (!confirmed) return;
    setSaving(true);
    const content = normalizeSiteProfile(draft);
    const { error } = await client.from('site_content').upsert(
      { content_key: SITE_PROFILE_KEY, locale: SITE_PROFILE_LOCALE, content, is_published: true, display_order: 0 },
      { onConflict: 'content_key,locale' },
    );
    setSaving(false);
    if (error) {
      adminToast('შენახვა ვერ მოხერხდა. გადაამოწმეთ კავშირი და ადმინისტრატორის უფლებები.', 'error');
      return;
    }
    setSaved(content);
    setDraft(content);
    setExists(true);
    adminToast('პარამეტრები შეინახა და საიტზე გამოჩნდა.');
  };

  if (loading) {
    return <div className="admin-loading-state" role="status"><LoaderCircle className="admin-spin" aria-hidden="true" />პარამეტრები იტვირთება...</div>;
  }

  const seoUrl = typeof window !== 'undefined' ? window.location.host : 'luka-imagines';

  return (
    <div className="admin-settings-v4">
      {loadError && <div className="admin-alert" role="alert">{loadError}</div>}
      {!exists && !loadError && (
        <p className="admin-settings-note">ქვემოთ არის ის, რაც ახლა საიტზე ჩანს. შეცვალეთ და დააჭირეთ „შენახვას“.</p>
      )}

      <section className="admin-form-card" aria-labelledby="settings-availability">
        <header>
          <h2 id="settings-availability">ხელმისაწვდომობა</h2>
          <p>სტატუსი ჩანს მთავარი გვერდის ზედა ნაწილში და მობილურ მენიუში.</p>
        </header>
        <div className="admin-form-grid">
          <div className="admin-form-field">
            <span className="admin-form-label">სტატუსი</span>
            <div className="admin-toggle-row">
              <button
                type="button"
                role="switch"
                aria-checked={draft.availability.open}
                className={`admin-switch${draft.availability.open ? ' is-on' : ''}`}
                onClick={() => update((current) => ({ ...current, availability: { ...current.availability, open: !current.availability.open } }))}
              ><i /></button>
              <span>{draft.availability.open ? 'ვიღებ ახალ პროექტებს' : 'ამჟამად არ ვიღებ'}</span>
            </div>
            <div className="admin-chip-row">
              {AVAILABILITY_PRESETS.map((preset) => (
                <button key={preset.text} type="button" className="admin-chip" onClick={() => update((current) => ({ ...current, availability: { ...preset } }))}>
                  {preset.text}
                </button>
              ))}
            </div>
          </div>
          <Field label="სტატუსის ტექსტი" error={errors.availabilityText} counter={{ value: draft.availability.text.length, limit: 60 }}>
            <input className="admin-input" value={draft.availability.text} maxLength={120} onChange={(event) => update((current) => ({ ...current, availability: { ...current.availability, text: event.target.value } }))} />
          </Field>
          <Field label="მდებარეობა" error={errors.location}>
            <span className="admin-input-icon"><MapPin aria-hidden="true" /><input className="admin-input" value={draft.location} maxLength={120} onChange={(event) => update((current) => ({ ...current, location: event.target.value }))} /></span>
          </Field>
        </div>
        <div className="admin-preview-strip" aria-label="წინასწარი ნახვა">
          <span>{draft.location}</span>
          <span className="admin-preview-status"><i className={draft.availability.open ? 'is-open' : ''} />{draft.availability.text || '—'}</span>
        </div>
      </section>

      <section className="admin-form-card" aria-labelledby="settings-socials">
        <header>
          <h2 id="settings-socials">კონტაქტი და სოციალური ბმულები</h2>
          <p>ელფოსტა და WhatsApp ჩანს კონტაქტის სექციაში, ბმულები — მთავარ გვერდზე და საიტის ბოლოში. ცარიელი ველი საიტზე არ ჩანს.</p>
        </header>
        <div className="admin-form-grid">
          {([
            ['facebook', 'Facebook', Facebook, 'https://www.facebook.com/…'],
            ['instagram', 'Instagram', Instagram, 'https://www.instagram.com/…'],
            ['behance', 'Behance', Globe, 'https://www.behance.net/…'],
          ] as const).map(([key, label, Icon, placeholder]) => (
            <Fragment key={key}><Field label={label} error={errors[key]}>
              <span className="admin-input-icon">
                <Icon aria-hidden="true" />
                <input className="admin-input" type="url" inputMode="url" placeholder={placeholder} value={draft.socials[key]} onChange={(event) => setSocial(key, event.target.value)} />
                {draft.socials[key] && !errors[key] && <a className="admin-input-action" href={draft.socials[key]} target="_blank" rel="noreferrer" aria-label={`${label} გახსნა`}><ArrowUpRight aria-hidden="true" /></a>}
              </span>
            </Field></Fragment>
          ))}
          <Field label="WhatsApp ნომერი" hint="ციფრები ქვეყნის კოდით, მაგ. 995595123456" error={errors.whatsapp}>
            <span className="admin-input-icon">
              <span className="admin-input-prefix" aria-hidden="true">+</span>
              <input className="admin-input" inputMode="numeric" value={draft.socials.whatsapp} onChange={(event) => setSocial('whatsapp', event.target.value)} />
              {draft.socials.whatsapp && !errors.whatsapp && <a className="admin-input-action" href={whatsappLink(draft.socials.whatsapp)} target="_blank" rel="noreferrer" aria-label="WhatsApp-ის შემოწმება"><ArrowUpRight aria-hidden="true" /></a>}
            </span>
          </Field>
          <Field label="ელფოსტა" error={errors.email}>
            <span className="admin-input-icon">
              <AtSign aria-hidden="true" />
              <input className="admin-input" type="email" value={draft.socials.email} onChange={(event) => setSocial('email', event.target.value)} />
              {draft.socials.email && !errors.email && <a className="admin-input-action" href={emailComposeLink(draft.socials.email)} target="_blank" rel="noreferrer" aria-label="ელფოსტის შემოწმება"><ArrowUpRight aria-hidden="true" /></a>}
            </span>
          </Field>
        </div>
      </section>

      {/* Rarely changed, so folded by default; opens itself when a field in it has an error. */}
      <details className="admin-form-card admin-form-card-fold" open={Boolean(errors.seoTitle || errors.seoDescription) || undefined}>
        <summary>
          <h2 id="settings-seo">Google-ში გამოჩენა</h2>
          <p>სათაური და აღწერა, რომელსაც Google და Facebook აჩვენებს საიტის ბმულთან.</p>
        </summary>
        <div className="admin-form-grid is-single">
          <Field label="გვერდის სათაური" error={errors.seoTitle} counter={{ value: draft.seo.title.length, limit: SEO_TITLE_LIMIT }} hint="იდეალურია 60 სიმბოლომდე.">
            <input className="admin-input" value={draft.seo.title} maxLength={120} onChange={(event) => update((current) => ({ ...current, seo: { ...current.seo, title: event.target.value } }))} />
          </Field>
          <Field label="აღწერა" error={errors.seoDescription} counter={{ value: draft.seo.description.length, limit: SEO_DESCRIPTION_LIMIT }} hint="იდეალურია 160 სიმბოლომდე.">
            <textarea className="admin-input" rows={3} value={draft.seo.description} maxLength={320} onChange={(event) => update((current) => ({ ...current, seo: { ...current.seo, description: event.target.value } }))} />
          </Field>
        </div>
        <div className="admin-serp-preview" aria-label="Google-ის შედეგის წინასწარი ნახვა">
          <span className="admin-serp-url"><Search aria-hidden="true" /> {seoUrl}</span>
          <strong>{draft.seo.title.length > SEO_TITLE_LIMIT ? `${draft.seo.title.slice(0, SEO_TITLE_LIMIT)}…` : draft.seo.title || 'სათაური'}</strong>
          <p>{draft.seo.description.length > SEO_DESCRIPTION_LIMIT ? `${draft.seo.description.slice(0, SEO_DESCRIPTION_LIMIT)}…` : draft.seo.description || 'აღწერა'}</p>
        </div>
      </details>

      <div className={`admin-save-bar${dirty ? ' is-dirty' : ''}`} role="region" aria-label="შენახვა">
        <span>{hasErrors ? 'გაასწორეთ მონიშნული ველები' : dirty ? 'შეუნახავი ცვლილებები' : 'ყველაფერი შენახულია'}</span>
        <button type="button" className="admin-button admin-button-quiet" disabled={!dirty || saving} onClick={() => setDraft(saved)}>
          <RotateCcw aria-hidden="true" /> გაუქმება
        </button>
        <button type="button" className="admin-button admin-button-primary" disabled={!dirty || saving || hasErrors} onClick={() => { void save(); }}>
          {saving ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : <Save aria-hidden="true" />} შენახვა
        </button>
      </div>
    </div>
  );
}
