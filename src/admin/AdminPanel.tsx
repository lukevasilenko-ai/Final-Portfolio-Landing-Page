import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  CircleAlert,
  FolderOpen,
  Image as ImageIcon,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Pencil,
  Plus,
  Search,
  Settings2,
  Shapes,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ProjectEditor from './ProjectEditor';
import CategoryEditor, { type AdminCategory } from './CategoryEditor';
import { getCategoryAdminLabel } from './labels';
import './admin.css';

type AdminSection = 'overview' | 'projects' | 'categories' | 'media' | 'settings';
type GateState = 'loading' | 'unconfigured' | 'signed-out' | 'checking' | 'denied' | 'error' | 'authorized';

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  display_order: number;
  is_active: boolean;
};

type PortfolioProject = {
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
  created_at: string;
};

type SiteSetting = {
  setting_key: string;
  setting_value: unknown;
  updated_at: string;
};

type SiteContent = {
  id: string;
  content_key: string;
  locale: string;
  content: unknown;
  is_published: boolean;
  display_order: number;
  updated_at: string;
};

type MediaAsset = {
  id: string;
  projectTitle: string;
  path: string;
  altText: string;
  signedUrl: string;
  kind: 'cover' | 'gallery';
};

const navigation = [
  { id: 'overview', label: 'მიმოხილვა', Icon: LayoutDashboard },
  { id: 'projects', label: 'პროექტები', Icon: BriefcaseBusiness },
  { id: 'categories', label: 'კატეგორიები', Icon: Shapes },
  { id: 'media', label: 'მედია', Icon: ImageIcon },
  { id: 'settings', label: 'საიტის პარამეტრები', Icon: Settings2 },
] as const;

const formatNumber = (value: number) => new Intl.NumberFormat('ka-GE').format(value);
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('ka-GE', { dateStyle: 'medium' }).format(new Date(value));

function getAuthMessage(error: { message?: string; code?: string } | null | undefined) {
  const message = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase();

  if (message.includes('invalid login credentials') || message.includes('invalid_credentials')) {
    return 'ელფოსტა ან პაროლი არასწორია. გადაამოწმეთ მონაცემები და სცადეთ თავიდან.';
  }
  if (message.includes('email not confirmed')) {
    return 'ელფოსტის მისამართი ჯერ არ არის დადასტურებული.';
  }
  if (message.includes('too many requests') || message.includes('rate limit')) {
    return 'ცადეთ მოგვიანებით. შესვლის მცდელობების დროებითი ლიმიტი ამოიწურა.';
  }
  if (message.includes('fetch') || message.includes('network')) {
    return 'სერვერთან დაკავშირება ვერ მოხერხდა. შეამოწმეთ ინტერნეტი და სცადეთ თავიდან.';
  }

  return 'შესვლა ვერ მოხერხდა. გადაამოწმეთ ელფოსტა და პაროლი.';
}

function StatusScreen({
  title,
  message,
  icon = 'alert',
  action,
  actionLabel,
  secondaryAction,
  secondaryLabel,
}: {
  title: string;
  message: string;
  icon?: 'alert' | 'lock' | 'loading';
  action?: () => void;
  actionLabel?: string;
  secondaryAction?: () => void;
  secondaryLabel?: string;
}) {
  const Icon = icon === 'loading' ? LoaderCircle : icon === 'lock' ? LockKeyhole : CircleAlert;

  return (
    <main className="admin-status-screen" lang="ka-GE">
      <section className="admin-status-content" aria-live="polite">
        <div className={`admin-status-icon ${icon === 'alert' ? 'is-alert' : ''}`}>
          <Icon className={icon === 'loading' ? 'admin-spin' : ''} aria-hidden="true" />
        </div>
        <p className="admin-eyebrow">Luka Imagines · მართვის პანელი</p>
        <h1>{title}</h1>
        <p className="admin-status-message">{message}</p>
        <div className="admin-status-actions">
          {action && actionLabel && (
            <button type="button" className="admin-button admin-button-primary" onClick={action}>
              {actionLabel}
              <ArrowUpRight aria-hidden="true" />
            </button>
          )}
          {secondaryAction && secondaryLabel && (
            <button type="button" className="admin-button admin-button-quiet" onClick={secondaryAction}>
              {secondaryLabel}
            </button>
          )}
          {!action && !secondaryAction && (
            <a className="admin-button admin-button-quiet" href="/">
              <ArrowLeft aria-hidden="true" />
              საიტზე დაბრუნება
            </a>
          )}
        </div>
      </section>
    </main>
  );
}

function LoginScreen({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = supabase;
    if (!client) return;

    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(getAuthMessage(error));
        return;
      }
      if (data.session) onSignedIn(data.session);
    } catch {
      setErrorMessage('სერვერთან დაკავშირება ვერ მოხერხდა. შეამოწმეთ ინტერნეტი და სცადეთ თავიდან.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="admin-auth-screen" lang="ka-GE">
      <section className="admin-auth-panel">
        <a className="admin-brand" href="/" aria-label="Luka Imagines — მთავარ საიტზე დაბრუნება">
          <span className="admin-brand-mark" aria-hidden="true">LI</span>
          <span className="admin-brand-copy">
            <strong>Luka Imagines</strong>
            <small>მართვის სივრცე</small>
          </span>
        </a>

        <div className="admin-auth-heading">
          <span className="admin-eyebrow"><LockKeyhole aria-hidden="true" /> დაცული შესვლა</span>
          <h1>კეთილი იყოს თქვენი დაბრუნება</h1>
          <p>შედით ადმინისტრატორის ანგარიშით მართვის პანელზე გასაგრძელებლად.</p>
        </div>

        <form className="admin-auth-form" onSubmit={handleSubmit}>
          <label className="admin-field-label" htmlFor="admin-email">ელფოსტის მისამართი</label>
          <div className="admin-input-wrap">
            <Mail aria-hidden="true" />
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="თქვენი ელფოსტა"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <label className="admin-field-label" htmlFor="admin-password">პაროლი</label>
          <div className="admin-input-wrap">
            <LockKeyhole aria-hidden="true" />
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              placeholder="შეიყვანეთ პაროლი"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {errorMessage && (
            <p className="admin-inline-error" role="alert">
              <CircleAlert aria-hidden="true" />
              {errorMessage}
            </p>
          )}

          <button className="admin-button admin-button-primary admin-login-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}
            {isSubmitting ? 'მიმდინარეობს შესვლა...' : 'შესვლა'}
          </button>
        </form>

        <p className="admin-auth-footnote">
          <BadgeCheck aria-hidden="true" />
          წვდომა ენიჭება მხოლოდ ავტორიზებულ ადმინისტრატორებს.
        </p>
      </section>
      <div className="admin-auth-aside" aria-hidden="true">
        <span>LI</span>
        <p>იდეა, ფორმა<br />და ხასიათი.</p>
        <i />
      </div>
    </main>
  );
}

function StatCard({ label, value, detail, Icon, tone }: {
  label: string;
  value: number;
  detail: string;
  Icon: typeof BriefcaseBusiness;
  tone: 'green' | 'copper' | 'plum' | 'ink';
}) {
  return (
    <article className="admin-stat-card">
      <div className={`admin-stat-icon tone-${tone}`}><Icon aria-hidden="true" /></div>
      <div className="admin-stat-copy">
        <span>{label}</span>
        <strong>{formatNumber(value)}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="admin-empty-state">
      <span><FolderOpen aria-hidden="true" /></span>
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

export default function AdminPanel() {
  const [gate, setGate] = useState<GateState>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [gateMessage, setGateMessage] = useState('');
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [galleryCount, setGalleryCount] = useState(0);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const [siteContent, setSiteContent] = useState<SiteContent[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [sectionError, setSectionError] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [projectEditorTarget, setProjectEditorTarget] = useState<PortfolioProject | null | undefined>(undefined);
  const [categoryEditorTarget, setCategoryEditorTarget] = useState<AdminCategory | null | undefined>(undefined);
  const [saveNotice, setSaveNotice] = useState('');
  const [categoryNotice, setCategoryNotice] = useState('');
  const authorizationRequest = useRef(0);

  const verifySession = useCallback(async (nextSession: Session | null) => {
    const currentRequest = ++authorizationRequest.current;
    setSession(nextSession);
    setGateMessage('');

    if (!nextSession) {
      setGate('signed-out');
      return;
    }

    const client = supabase;
    if (!client) {
      setGate('unconfigured');
      return;
    }

    setGate('checking');
    const { data, error } = await client
      .from('authorized_administrators')
      .select('user_id')
      .eq('user_id', nextSession.user.id)
      .maybeSingle();

    if (currentRequest !== authorizationRequest.current) return;
    if (error) {
      setGate('error');
      setGateMessage('ადმინისტრატორის წვდომის შემოწმება ვერ მოხერხდა. გადაამოწმეთ კავშირი და მონაცემთა ბაზის წვდომის წესები.');
      return;
    }
    if (!data) {
      setGate('denied');
      return;
    }

    setGate('authorized');
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const oldLanguage = document.documentElement.lang;
    const oldTitle = document.title;
    const oldTheme = root.getAttribute('data-theme');
    const oldColorScheme = root.style.colorScheme;
    let savedTheme: string | null = null;
    try {
      savedTheme = window.localStorage.getItem('luka-imagines-theme');
    } catch {
      savedTheme = null;
    }
    const adminTheme = savedTheme === 'dark' || savedTheme === 'light'
      ? savedTheme
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

    root.lang = 'ka-GE';
    root.dataset.theme = adminTheme;
    root.style.colorScheme = adminTheme;
    document.title = 'მართვის პანელი | Luka Imagines';

    return () => {
      root.lang = oldLanguage;
      if (oldTheme === null) delete root.dataset.theme;
      else root.dataset.theme = oldTheme;
      root.style.colorScheme = oldColorScheme;
      document.title = oldTitle;
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setGate('unconfigured');
      return;
    }

    let active = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => {
        if (active) void verifySession(nextSession);
      }, 0);
    });

    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setGate('error');
        setGateMessage(getAuthMessage(error));
        return;
      }
      void verifySession(data.session);
    }).catch(() => {
      if (!active) return;
      setGate('error');
      setGateMessage('სესიის აღდგენა ვერ მოხერხდა. განაახლეთ გვერდი და სცადეთ თავიდან.');
    });

    return () => {
      active = false;
      authorizationRequest.current += 1;
      subscription.unsubscribe();
    };
  }, [verifySession]);

  const loadDashboard = useCallback(async () => {
    const client = supabase;
    if (!client) return;

    setDashboardLoading(true);
    setDashboardError('');
    const [projectResult, categoryResult, galleryResult] = await Promise.all([
      client
        .from('portfolio_projects')
        .select('id, slug, title, description, category_id, presentation_type, cover_image_path, display_order, is_published, is_featured, tags, tools, year, created_at')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false }),
      client
        .from('portfolio_categories')
        .select('id, slug, name, description, display_order, is_active')
        .order('display_order', { ascending: true }),
      client
        .from('portfolio_gallery_images')
        .select('id', { count: 'exact', head: true }),
    ]);

    const error = projectResult.error || categoryResult.error || galleryResult.error;
    if (error) {
      setDashboardError('მონაცემების ჩატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.');
      setDashboardLoading(false);
      return;
    }

    setProjects((projectResult.data ?? []) as PortfolioProject[]);
    setCategories((categoryResult.data ?? []) as Category[]);
    setGalleryCount(galleryResult.count ?? 0);
    setDashboardLoading(false);
  }, []);

  useEffect(() => {
    if (gate === 'authorized') void loadDashboard();
  }, [gate, loadDashboard]);

  useEffect(() => {
    const client = supabase;
    if (gate !== 'authorized' || activeSection !== 'settings' || settingsLoaded || !client) return;

    let active = true;
    setSettingsLoading(true);
    setSectionError('');
    void Promise.all([
      client
        .from('site_settings')
        .select('setting_key, setting_value, updated_at')
        .order('setting_key', { ascending: true }),
      client
        .from('site_content')
        .select('id, content_key, locale, content, is_published, display_order, updated_at')
        .order('display_order', { ascending: true })
        .order('content_key', { ascending: true }),
    ]).then(([settingsResult, contentResult]) => {
        if (!active) return;
        if (settingsResult.error || contentResult.error) {
          setSectionError('პარამეტრების ჩატვირთვა ვერ მოხერხდა. გადაამოწმეთ წვდომის წესები და სცადეთ ხელახლა.');
        } else {
          setSettings((settingsResult.data ?? []) as SiteSetting[]);
          setSiteContent((contentResult.data ?? []) as SiteContent[]);
          setSettingsLoaded(true);
        }
        setSettingsLoading(false);
      });

    return () => { active = false; };
  }, [activeSection, gate, settingsLoaded]);

  useEffect(() => {
    const client = supabase;
    if (gate !== 'authorized' || activeSection !== 'media' || mediaLoaded || !client) return;

    let active = true;
    setMediaLoading(true);
    setSectionError('');
    void client
      .from('portfolio_gallery_images')
      .select('id, project_id, image_path, alt_text, display_order')
      .order('display_order', { ascending: true })
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error) {
          setSectionError('მედიის ბიბლიოთეკის ჩატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.');
          setMediaLoading(false);
          return;
        }

        const galleryImages = (data ?? []) as Array<{
          id: string;
          project_id: string;
          image_path: string;
          alt_text: string;
          display_order: number;
        }>;
        const projectById = new Map<string, PortfolioProject>(
          projects.map((project) => [project.id, project]),
        );
        const references: Omit<MediaAsset, 'signedUrl'>[] = [
          ...projects.flatMap((project) => project.cover_image_path ? [{
            id: `${project.id}-cover`,
            projectTitle: project.title,
            path: project.cover_image_path,
            altText: project.title,
            kind: 'cover' as const,
          }] : []),
          ...galleryImages.map((image) => ({
            id: image.id,
            projectTitle: projectById.get(image.project_id)?.title ?? image.project_id,
            path: image.image_path,
            altText: image.alt_text,
            kind: 'gallery' as const,
          })),
        ];
        const uniquePaths = [...new Set(references.map((item) => item.path))];

        if (uniquePaths.length === 0) {
          setMedia([]);
          setMediaLoaded(true);
          setMediaLoading(false);
          return;
        }

        const signedResult = await client.storage.from('portfolio-images').createSignedUrls(uniquePaths, 600);
        if (!active) return;
        if (signedResult.error) {
          setSectionError('სურათების უსაფრთხო ბმულების შექმნა ვერ მოხერხდა. გადაამოწმეთ Storage-ის წესები.');
          setMediaLoading(false);
          return;
        }

        const signedUrls = new Map(
          (signedResult.data ?? [])
            .filter((item) => item.signedUrl)
            .map((item) => [item.path, item.signedUrl as string]),
        );
        setMedia(references.flatMap((item) => {
          const signedUrl = signedUrls.get(item.path);
          return signedUrl ? [{ ...item, signedUrl }] : [];
        }));
        setMediaLoaded(true);
        setMediaLoading(false);
      });

    return () => { active = false; };
  }, [activeSection, gate, mediaLoaded, projects]);

  const handleSignOut = async () => {
    const client = supabase;
    if (!client) return;
    setIsSigningOut(true);
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      setSession(null);
      setGate('signed-out');
    } catch {
      setGate('error');
      setGateMessage('სისტემიდან უსაფრთხოდ გასვლა ვერ მოხერხდა. სცადეთ ხელახლა.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const activeTitle = navigation.find((item) => item.id === activeSection)?.label ?? 'მიმოხილვა';
  const filteredProjects = useMemo(() => {
    const normalizedSearch = projectSearch.trim().toLocaleLowerCase('ka-GE');
    if (!normalizedSearch) return projects;
    return projects.filter((project) =>
      `${project.title} ${project.slug}`.toLocaleLowerCase('ka-GE').includes(normalizedSearch),
    );
  }, [projectSearch, projects]);
  const categoryLabelForId = (categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId);
    return category ? getCategoryAdminLabel(category) : 'კატეგორია არ არის მითითებული';
  };

  if (gate === 'loading' || gate === 'checking') {
    return <StatusScreen icon="loading" title="წვდომა მოწმდება" message="სესიისა და ადმინისტრატორის უფლებების უსაფრთხო შემოწმება მიმდინარეობს." />;
  }
  if (gate === 'unconfigured') {
    return <StatusScreen title="კავშირი გამართული არ არის" message="მართვის პანელის გასახსნელად ჰოსტინგის გარემოში Supabase-ის მისამართი და საჯარო გასაღები უნდა იყოს მითითებული." />;
  }
  if (gate === 'error' && !session) {
    return <StatusScreen title="კავშირი ვერ აღდგა" message={gateMessage || 'სესიის აღდგენა ვერ მოხერხდა. განაახლეთ გვერდი და სცადეთ თავიდან.'} action={() => window.location.reload()} actionLabel="ხელახლა ცდა" />;
  }
  if (gate === 'signed-out') {
    return (
      <LoginScreen
        onSignedIn={(nextSession) => {
          void verifySession(nextSession);
          if (gateMessage) setGateMessage('');
        }}
      />
    );
  }
  if (gate === 'denied') {
    return (
      <StatusScreen
        icon="lock"
        title="წვდომა შეზღუდულია"
        message="ეს ანგარიში ადმინისტრატორად არ არის ავტორიზებული. პანელის გამოყენება მხოლოდ დამტკიცებულ ანგარიშებს შეუძლიათ."
        action={handleSignOut}
        actionLabel={isSigningOut ? 'მიმდინარეობს გასვლა...' : 'სხვა ანგარიშით შესვლა'}
        secondaryAction={() => { window.location.href = '/'; }}
        secondaryLabel="საიტზე დაბრუნება"
      />
    );
  }
  if (gate === 'error' && session) {
    return (
      <StatusScreen
        title="წვდომის დადასტურება ვერ მოხერხდა"
        message={gateMessage || 'ადმინისტრატორის უფლებების შემოწმება ვერ მოხერხდა.'}
        action={() => { void verifySession(session); }}
        actionLabel="ხელახლა ცდა"
        secondaryAction={() => { void handleSignOut(); }}
        secondaryLabel="სისტემიდან გასვლა"
      />
    );
  }

  const projectsByCategory = categories.map((category) => ({
    ...category,
    projectCount: projects.filter((project) => project.category_id === category.id).length,
  }));
  const publishedCount = projects.filter((project) => project.is_published).length;
  const draftCount = projects.length - publishedCount;
  const activeCategoryCount = categories.filter((category) => category.is_active).length;

  return (
    <div className="admin-shell" lang="ka-GE">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <a className="admin-brand" href="/" aria-label="Luka Imagines — მთავარ საიტზე დაბრუნება">
            <span className="admin-brand-mark" aria-hidden="true">LI</span>
            <span className="admin-brand-copy">
              <strong>Luka Imagines</strong>
              <small>მართვის სივრცე</small>
            </span>
          </a>

          <div className="admin-sidebar-caption">სამუშაო სივრცე</div>
          <nav className="admin-nav" aria-label="მართვის სექციები">
            {navigation.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={`admin-nav-item ${activeSection === id ? 'is-active' : ''}`}
                onClick={() => {
                  setActiveSection(id);
                  setSectionError('');
                }}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
                {activeSection === id && <span className="admin-nav-marker" aria-hidden="true"><Check /></span>}
              </button>
            ))}
          </nav>

          <div className="admin-sidebar-footer">
            <div className="admin-user-avatar" aria-hidden="true">{session?.user.email?.slice(0, 1).toLocaleUpperCase('ka-GE') ?? 'L'}</div>
            <div className="admin-user-info">
              <strong>ადმინისტრატორი</strong>
              <span title={session?.user.email ?? ''}>{session?.user.email}</span>
            </div>
            <button
              className="admin-icon-button admin-logout-button"
              type="button"
              aria-label="სისტემიდან გასვლა"
              title="სისტემიდან გასვლა"
              disabled={isSigningOut}
              onClick={() => { void handleSignOut(); }}
            >
              {isSigningOut ? <LoaderCircle className="admin-spin" /> : <LogOut />}
            </button>
          </div>
        </aside>

        <main className="admin-main">
          <header className="admin-topbar">
            <div>
              <span className="admin-topbar-label">Luka Imagines</span>
              <strong>{activeTitle}</strong>
            </div>
            <div className="admin-topbar-right">
              <span className="admin-live-status"><i /> დაცული სესია</span>
              <a className="admin-site-link" href="/" target="_blank" rel="noreferrer">
                საიტის ნახვა <ArrowUpRight aria-hidden="true" />
              </a>
            </div>
          </header>

          <div className="admin-content">
            {dashboardError && (
              <div className="admin-alert" role="alert">
                <CircleAlert aria-hidden="true" />
                <span>{dashboardError}</span>
                <button type="button" onClick={() => { void loadDashboard(); }}>ხელახლა ცდა</button>
              </div>
            )}

            {dashboardLoading ? (
              <div className="admin-loading-state" role="status" aria-live="polite">
                <LoaderCircle className="admin-spin" aria-hidden="true" />
                მონაცემები იტვირთება...
              </div>
            ) : (
              <>
                {activeSection === 'overview' && (
                  <section className="admin-page-section" aria-labelledby="admin-overview-heading">
                    <div className="admin-page-heading">
                      <div>
                        <p className="admin-eyebrow">თქვენი სამუშაო სივრცე</p>
                        <h1 id="admin-overview-heading">მიმოხილვა</h1>
                        <p>პორტფოლიოს ძირითადი მონაცემები ერთ სივრცეში.</p>
                      </div>
                      <time className="admin-date" dateTime={new Date().toISOString()}>
                        {new Intl.DateTimeFormat('ka-GE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
                      </time>
                    </div>

                    <div className="admin-stats-grid">
                      <StatCard label="ყველა პროექტი" value={projects.length} detail="მონაცემთა ბაზაში" Icon={BriefcaseBusiness} tone="green" />
                      <StatCard label="გამოქვეყნებული" value={publishedCount} detail="საჯაროდ ხილული" Icon={BadgeCheck} tone="copper" />
                      <StatCard label="მონახაზი" value={draftCount} detail="მხოლოდ ადმინისტრატორისთვის" Icon={FolderOpen} tone="plum" />
                      <StatCard label="აქტიური კატეგორია" value={activeCategoryCount} detail={`${formatNumber(galleryCount)} გალერეის სურათი`} Icon={Shapes} tone="ink" />
                    </div>

                    <div className="admin-overview-grid">
                      <section className="admin-surface admin-recent-section">
                        <div className="admin-section-heading">
                          <div>
                            <p className="admin-eyebrow">ბიბლიოთეკა</p>
                            <h2>ბოლო პროექტები</h2>
                          </div>
                          <button className="admin-text-button" type="button" onClick={() => setActiveSection('projects')}>
                            ყველას ნახვა <ArrowUpRight aria-hidden="true" />
                          </button>
                        </div>
                        {projects.length === 0 ? (
                          <EmptyState title="პროექტები ჯერ არ არის" message="მონაცემთა ბაზაში პროექტები ჯერ არ გადმოტანილა. არსებული საიტის პორტფოლიო უცვლელად მუშაობს." />
                        ) : (
                          <div className="admin-recent-list">
                            {[...projects].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5).map((project) => (
                              <div className="admin-recent-row" key={project.id}>
                                <span className="admin-project-thumb"><BriefcaseBusiness aria-hidden="true" /></span>
                                <div className="admin-recent-copy">
                                  <strong>{project.title}</strong>
                                  <span>{categoryLabelForId(project.category_id)}</span>
                                </div>
                                <span className={`admin-state-pill ${project.is_published ? 'is-published' : 'is-draft'}`}>
                                  {project.is_published ? 'გამოქვეყნებული' : 'მონახაზი'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>

                      <section className="admin-surface admin-category-summary">
                        <div className="admin-section-heading">
                          <div>
                            <p className="admin-eyebrow">სტრუქტურა</p>
                            <h2>კატეგორიები</h2>
                          </div>
                          <button className="admin-icon-button" type="button" aria-label="კატეგორიების ნახვა" onClick={() => setActiveSection('categories')}>
                            <ArrowUpRight aria-hidden="true" />
                          </button>
                        </div>
                        {projectsByCategory.length === 0 ? (
                          <EmptyState title="კატეგორიები არ მოიძებნა" message="კატეგორიების სია ხელმისაწვდომი გახდება მონაცემების ჩატვირთვის შემდეგ." />
                        ) : (
                          <div className="admin-category-list">
                            {projectsByCategory.map((category) => (
                              <div className="admin-category-summary-row" key={category.id}>
                                <span><i className={category.is_active ? 'is-active' : ''} />{getCategoryAdminLabel(category)}</span>
                                <strong>{formatNumber(category.projectCount)}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>
                  </section>
                )}

                {activeSection === 'projects' && (
                  <section className="admin-page-section" aria-labelledby="admin-projects-heading">
                    <div className="admin-page-heading">
                      <div>
                        <p className="admin-eyebrow">პორტფოლიოს ბიბლიოთეკა</p>
                        <h1 id="admin-projects-heading">პროექტები</h1>
                        <p>მართეთ პროექტების აღწერა, კატეგორია, სურათები და გამოქვეყნება.</p>
                      </div>
                      <div className="admin-project-heading-actions">
                        <span className="admin-count-chip">{formatNumber(projects.length)} პროექტი</span>
                        <button className="admin-button admin-button-primary" type="button" onClick={() => { setSaveNotice(''); setProjectEditorTarget(null); }}>
                          <Plus aria-hidden="true" /> პროექტის დამატება
                        </button>
                      </div>
                    </div>
                    {saveNotice && (
                      <div className="admin-success-notice" role="status">
                        <CheckCircle2 aria-hidden="true" />
                        <span>{saveNotice}</span>
                        <button type="button" aria-label="შეტყობინების დახურვა" onClick={() => setSaveNotice('')}><X aria-hidden="true" /></button>
                      </div>
                    )}
                    <div className="admin-surface admin-table-surface">
                      <div className="admin-list-toolbar">
                        <label className="admin-search-wrap">
                          <Search aria-hidden="true" />
                          <input value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder="პროექტის ძიება" aria-label="პროექტის ძიება" />
                        </label>
                        <span>{formatNumber(filteredProjects.length)} შედეგი</span>
                      </div>
                      {filteredProjects.length === 0 ? (
                        <EmptyState title={projects.length ? 'შედეგი ვერ მოიძებნა' : 'პროექტები ჯერ არ არის'} message={projects.length ? 'სცადეთ სხვა სათაურით ძიება.' : 'მონაცემთა ბაზაში ჯერ პროექტი არ არის. დაამატეთ ახალი პროექტი; არსებული საიტის პორტფოლიო უცვლელი დარჩება.'} />
                      ) : (
                        <div className="admin-project-list">
                          {filteredProjects.map((project) => {
                            const category = categories.find((item) => item.id === project.category_id);
                            return (
                              <article className="admin-project-row" key={project.id}>
                                <div className="admin-project-thumb">
                                  {project.cover_image_path ? <ImageIcon aria-hidden="true" /> : <BriefcaseBusiness aria-hidden="true" />}
                                </div>
                                <div className="admin-project-main">
                                  <strong>{project.title}</strong>
                                  <span>{category ? getCategoryAdminLabel(category) : 'კატეგორია არ არის მითითებული'} <i /> {project.slug}</span>
                                </div>
                                <span className={`admin-state-pill ${project.is_published ? 'is-published' : 'is-draft'}`}>
                                  {project.is_published ? 'გამოქვეყნებული' : 'მონახაზი'}
                                </span>
                                {project.is_featured && <span className="admin-featured-label">რჩეული</span>}
                                <time dateTime={project.created_at}>{formatDate(project.created_at)}</time>
                                <button
                                  className="admin-icon-button admin-project-edit-button"
                                  type="button"
                                  aria-label={`პროექტის რედაქტირება: ${project.title}`}
                                  title="პროექტის რედაქტირება"
                                  onClick={() => { setSaveNotice(''); setProjectEditorTarget(project); }}
                                ><Pencil aria-hidden="true" /></button>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {activeSection === 'categories' && (
                  <section className="admin-page-section" aria-labelledby="admin-categories-heading">
                    <div className="admin-page-heading">
                      <div>
                        <p className="admin-eyebrow">პორტფოლიოს სტრუქტურა</p>
                        <h1 id="admin-categories-heading">კატეგორიები</h1>
                        <p>კატეგორიები პანელში ქართულად ჩანს; მონაცემთა ბაზის სახელები და იდენტიფიკატორები უცვლელია.</p>
                      </div>
                      <div className="admin-project-heading-actions">
                        <span className="admin-count-chip">{formatNumber(categories.length)} კატეგორია</span>
                        <button className="admin-button admin-button-primary" type="button" onClick={() => { setCategoryNotice(''); setCategoryEditorTarget(null); }}>
                          <Plus aria-hidden="true" /> კატეგორიის დამატება
                        </button>
                      </div>
                    </div>
                    {categoryNotice && (
                      <div className="admin-success-notice" role="status">
                        <CheckCircle2 aria-hidden="true" />
                        <span>{categoryNotice}</span>
                        <button type="button" aria-label="შეტყობინების დახურვა" onClick={() => setCategoryNotice('')}><X aria-hidden="true" /></button>
                      </div>
                    )}
                    <div className="admin-surface admin-category-table">
                      {categories.length === 0 ? (
                        <EmptyState title="კატეგორიები არ არის" message="ბაზაში კატეგორიების ჩანაწერები ჯერ არ მოიძებნა." />
                      ) : projectsByCategory.map((category, index) => (
                        <article className="admin-category-row" key={category.id}>
                          <span className="admin-order-number">{formatNumber(index + 1).padStart(2, '0')}</span>
                          <div className="admin-category-row-copy">
                            <strong>{getCategoryAdminLabel(category)}</strong>
                            <span>{category.slug}</span>
                            {category.description && <p>{category.description}</p>}
                          </div>
                          <span className={`admin-state-pill ${category.is_active ? 'is-published' : 'is-draft'}`}>
                            {category.is_active ? 'აქტიური' : 'არააქტიური'}
                          </span>
                          <span className="admin-category-project-count">{formatNumber(category.projectCount)} პროექტი</span>
                          <button
                            className="admin-icon-button admin-category-edit-button"
                            type="button"
                            aria-label={`კატეგორიის რედაქტირება: ${getCategoryAdminLabel(category)}`}
                            title="კატეგორიის რედაქტირება"
                            onClick={() => { setCategoryNotice(''); setCategoryEditorTarget(category); }}
                          ><Pencil aria-hidden="true" /></button>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                {activeSection === 'media' && (
                  <section className="admin-page-section" aria-labelledby="admin-media-heading">
                    <div className="admin-page-heading">
                      <div>
                        <p className="admin-eyebrow">პირადი საცავი</p>
                        <h1 id="admin-media-heading">მედია</h1>
                        <p>პროექტებთან დაკავშირებული სურათების ნახვა უსაფრთხო, დროებითი ბმულებით.</p>
                      </div>
                      <span className="admin-count-chip">{formatNumber(media.length)} ფაილი</span>
                    </div>
                    {sectionError && <div className="admin-alert" role="alert"><CircleAlert aria-hidden="true" />{sectionError}</div>}
                    {mediaLoading ? (
                      <div className="admin-loading-state" role="status"><LoaderCircle className="admin-spin" aria-hidden="true" />მედია იტვირთება...</div>
                    ) : media.length === 0 ? (
                      <div className="admin-surface"><EmptyState title="მედია ჯერ არ არის მიბმული" message="სურათები გამოჩნდება, როცა მონაცემთა ბაზაში პროექტებსა და გალერეის ჩანაწერებს დაამატებთ. ამ ეტაპზე ატვირთვისა და წაშლის მოქმედებები გამორთულია." /></div>
                    ) : (
                      <div className="admin-media-grid">
                        {media.map((asset) => (
                          <article className="admin-media-item" key={asset.id}>
                            <div className="admin-media-preview">
                              <img src={asset.signedUrl} alt={asset.altText || asset.projectTitle} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />
                              <span className="admin-media-kind">{asset.kind === 'cover' ? 'ქავერი' : 'გალერეა'}</span>
                            </div>
                            <div className="admin-media-copy">
                              <strong>{asset.projectTitle}</strong>
                              <span title={asset.path}>{asset.path.split('/').at(-1)}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {activeSection === 'settings' && (
                  <section className="admin-page-section" aria-labelledby="admin-settings-heading">
                    <div className="admin-page-heading">
                      <div>
                        <p className="admin-eyebrow">პირადი კონფიგურაცია</p>
                        <h1 id="admin-settings-heading">საიტის პარამეტრები</h1>
                        <p>პარამეტრები ადმინისტრატორისთვის არის განკუთვნილი და ამ ეტაპზე მხოლოდ იკითხება.</p>
                      </div>
                      <span className="admin-readonly-badge"><LockKeyhole aria-hidden="true" /> მხოლოდ ნახვა</span>
                    </div>
                    {sectionError && <div className="admin-alert" role="alert"><CircleAlert aria-hidden="true" />{sectionError}</div>}
                    {settingsLoading ? (
                      <div className="admin-loading-state" role="status"><LoaderCircle className="admin-spin" aria-hidden="true" />პარამეტრები იტვირთება...</div>
                    ) : settings.length === 0 && siteContent.length === 0 ? (
                      <div className="admin-surface"><EmptyState title="კონტენტი ჯერ არ არის" message="საიტის ტექსტი და პირადი პარამეტრები გამოჩნდება შესაბამისი ჩანაწერების დამატების შემდეგ. ამ ეტაპზე ისინი მხოლოდ წაკითხვადია." /></div>
                    ) : (
                      <div className="admin-surface admin-setting-list">
                        {siteContent.length > 0 && (
                          <section className="admin-settings-group">
                            <div className="admin-settings-group-heading">
                              <h2>საიტის ტექსტი და ინფორმაცია</h2>
                              <span>საჯარო კონტენტი</span>
                            </div>
                            {siteContent.map((item) => (
                              <article className="admin-setting-row" key={item.id}>
                                <div>
                                  <strong>{item.content_key}</strong>
                                  <span className="admin-setting-meta">{item.locale} · {item.is_published ? 'გამოქვეყნებული' : 'მონახაზი'}</span>
                                  <time dateTime={item.updated_at}>განახლდა {formatDate(item.updated_at)}</time>
                                </div>
                                <pre>{JSON.stringify(item.content, null, 2)}</pre>
                              </article>
                            ))}
                          </section>
                        )}
                        {settings.length > 0 && (
                          <section className="admin-settings-group">
                            <div className="admin-settings-group-heading">
                              <h2>პირადი პარამეტრები</h2>
                              <span>მხოლოდ ადმინისტრატორისთვის</span>
                            </div>
                            {settings.map((setting) => (
                              <article className="admin-setting-row" key={setting.setting_key}>
                                <div>
                                  <strong>{setting.setting_key}</strong>
                                  <time dateTime={setting.updated_at}>განახლდა {formatDate(setting.updated_at)}</time>
                                </div>
                                <pre>{JSON.stringify(setting.setting_value, null, 2)}</pre>
                              </article>
                            ))}
                          </section>
                        )}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </div>

          <footer className="admin-footer">
            <span>Luka Imagines</span>
            <span>დაცული მართვის სივრცე</span>
          </footer>
        </main>
      </div>
      {projectEditorTarget !== undefined && (
        <ProjectEditor
          project={projectEditorTarget}
          categories={categories}
          onClose={() => setProjectEditorTarget(undefined)}
          onDraftCreated={() => { void loadDashboard(); }}
          onSaved={(message) => {
            setProjectEditorTarget(undefined);
            setSaveNotice(message);
            setMediaLoaded(false);
            setMedia([]);
            void loadDashboard();
          }}
        />
      )}
      {categoryEditorTarget !== undefined && (
        <CategoryEditor
          category={categoryEditorTarget}
          onClose={() => setCategoryEditorTarget(undefined)}
          onSaved={(message) => {
            setCategoryEditorTarget(undefined);
            setCategoryNotice(message);
            void loadDashboard();
          }}
        />
      )}
    </div>
  );
}
