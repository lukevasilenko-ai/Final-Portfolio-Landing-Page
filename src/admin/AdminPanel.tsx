import { Component, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type FormEvent, type ReactNode } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Calculator,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  CircleAlert,
  Eye,
  EyeOff,
  FolderOpen,
  GripVertical,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutTemplate,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Pencil,
  Plus,
  Search,
  Settings2,
  Shapes,
  RotateCcw,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ProjectEditor from './ProjectEditor';
import CategoryEditor, { type AdminCategory } from './CategoryEditor';
import PortfolioOrganizer from './PortfolioOrganizer';
import CalculatorManagement from './CalculatorManagement';
import WebsiteSectionsManager from './WebsiteSectionsManager';
import { getAdminAuthorizationTransition, withTimeout } from '../lib/authLifecycle';
import { getCategoryAdminLabel } from './labels';
import {
  ADMIN_SCHEMA_UNCHECKED,
  checkAdminSchema,
  isMissingColumn,
  missingAdminMigrations,
  supabaseSqlEditorUrl,
  type AdminSchemaHealth,
  type SchemaProbeClient,
} from './schemaHealth';
import { getAttentionIssues, type AttentionIssue, type ProjectStatusFilter } from './attention';
import { AdminFeedbackHost, adminConfirm, adminToast } from './feedback';
import WorksManager from './WorksManager';
import CategoriesView from './CategoriesView';
import CommandPalette from './CommandPalette';
import SiteSettingsView from './SiteSettingsView';
import type { AdminCategoryRow, AdminProjectRow, BulkProjectAction } from './types';
import './admin.css';

const PROJECT_COLUMNS = 'id, source_key, slug, title, description, category_id, presentation_type, cover_image_path, display_order, is_published, is_featured, tags, tools, year, created_at';
const SQL_EDITOR_URL = supabaseSqlEditorUrl(import.meta.env.VITE_SUPABASE_URL);

type AdminSection = 'overview' | 'projects' | 'categories' | 'settings' | 'trash' | 'calculator' | 'website-sections';
type AdminNavigationItem = { id: AdminSection; label: string; Icon: LucideIcon };
type AdminNavigationGroup = { label: string; items: AdminNavigationItem[] };
type GateState = 'loading' | 'unconfigured' | 'signed-out' | 'checking' | 'denied' | 'error' | 'authorized';

type Category = AdminCategoryRow;
type PortfolioProject = AdminProjectRow;

const navigationGroups: AdminNavigationGroup[] = [
  {
    label: 'პორტფოლიო',
    items: [
      { id: 'overview', label: 'მთავარი', Icon: LayoutDashboard },
      { id: 'projects', label: 'პროექტები', Icon: BriefcaseBusiness },
      { id: 'categories', label: 'კატეგორიები', Icon: Shapes },
    ],
  },
  {
    label: 'საიტი',
    items: [
      { id: 'website-sections', label: 'ტექსტები', Icon: LayoutTemplate },
      { id: 'calculator', label: 'ფასები', Icon: Calculator },
      { id: 'settings', label: 'კონტაქტი და სტატუსი', Icon: Settings2 },
    ],
  },
];
const WHERE_LINKS: { id: AdminSection; label: string; text: string; Icon: LucideIcon }[] = [
  { id: 'website-sections', label: 'ტექსტები', text: 'სათაურები, აღწერები და ღილაკები მთავარ გვერდზე', Icon: LayoutTemplate },
  { id: 'calculator', label: 'ფასები', text: 'სერვისები და ფასები კალკულატორში', Icon: Calculator },
  { id: 'settings', label: 'კონტაქტი და სტატუსი', text: 'სოციალური ბმულები, მდებარეობა, „ხელმისაწვდომი ვარ“', Icon: Settings2 },
  { id: 'categories', label: 'კატეგორიები', text: 'პოსტერები, ბრენდინგი, ბილბორდები და სხვა', Icon: Shapes },
];

// Trash is reached from the Projects page, so it is not a sidebar item.
const navigation: AdminNavigationItem[] = [
  ...navigationGroups.flatMap((group) => group.items),
  { id: 'trash', label: 'წაშლილი', Icon: Trash2 },
];

const ATTENTION_COPY: Record<AttentionIssue['id'], { title: string; text: string; action: string }> = {
  'placeholder-title': { title: 'სათაური ფაილის სახელიდანაა', text: 'ეს პროექტები იმპორტისას ფაილის სახელს ატარებს („1 result“ და მსგავსი). მიეცით გასაგები სათაური.', action: 'სათაურების შეცვლა' },
  'no-cover': { title: 'მთავარი სურათი არ აქვს', text: 'მთავარი სურათის გარეშე პროექტი საიტზე ვერ გამოჩნდება.', action: 'სურათების დამატება' },
  draft: { title: 'დამალული ნამუშევრები', text: 'ეს ნამუშევრები საიტზე არ ჩანს. თუ მზადაა, გახსენით და დააჭირეთ „ჩანს“.', action: 'პროექტების გახსნა' },
  'empty-category': { title: 'ცარიელი კატეგორია', text: 'აქტიურ კატეგორიაში არცერთი პროექტი არ არის. დაამატეთ პროექტები ან დამალეთ კატეგორია.', action: 'კატეგორიების ნახვა' },
};

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

function logAdminAuthDiagnostic(event: string, outcome: string, durationMs?: number) {
  if (!import.meta.env.DEV) return;
  console.info('[admin-auth]', {
    event,
    outcome,
    ...(durationMs === undefined ? {} : { durationMs: Math.round(durationMs) }),
  });
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
    <main className="admin-auth-screen admin-auth-screen-v3" lang="ka-GE">
      <section className="admin-auth-panel admin-auth-panel-v3">
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
      <div className="admin-auth-aside admin-auth-aside-v3" aria-hidden="true">
        <span>LI</span>
        <p>იდეა, ფორმა<br />და ხასიათი.</p>
        <i />
      </div>
    </main>
  );
}

function StatCard({ label, value, detail, Icon, tone, onClick }: {
  label: string;
  value: number;
  detail: string;
  Icon: typeof BriefcaseBusiness;
  tone: 'green' | 'copper' | 'plum' | 'ink';
  onClick?: () => void;
}) {
  return (
    <button type="button" className={`admin-stat-card admin-stat-card-v3 tone-${tone}`} onClick={onClick}>
      <div className={`admin-stat-icon tone-${tone}`}><Icon aria-hidden="true" /></div>
      <div className="admin-stat-copy">
        <span>{label}</span>
        <strong>{formatNumber(value)}</strong>
        <small>{detail}</small>
      </div>
    </button>
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

type WebsiteSectionsBoundaryProps = { children: ReactNode };
type WebsiteSectionsBoundaryState = { hasError: boolean };
type WebsiteSectionsBoundaryInstance = {
  props: WebsiteSectionsBoundaryProps;
  state: WebsiteSectionsBoundaryState;
  setState: (state: WebsiteSectionsBoundaryState) => void;
};
const ErrorBoundaryBase = Component as unknown as new (props: WebsiteSectionsBoundaryProps) => WebsiteSectionsBoundaryInstance;

class WebsiteSectionsErrorBoundary extends ErrorBoundaryBase {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error('[WebsiteSectionsManager] render failed', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="admin-feature-error" role="alert" lang="ka-GE">
          <CircleAlert aria-hidden="true" />
          <div>
            <h2>საიტის სექციების გახსნა ვერ მოხერხდა</h2>
            <p>დანარჩენი მართვის პანელი მუშაობს. სცადეთ ხელახლა; პრობლემა გაგრძელების შემთხვევაში მოგვაწოდეთ ბრაუზერის Console-ის შეცდომა.</p>
          </div>
          <button type="button" className="admin-button admin-button-primary" onClick={() => this.setState({ hasError: false })}>
            ხელახლა ცდა
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}

export default function AdminPanel() {
  const [gate, setGate] = useState<GateState>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [gateMessage, setGateMessage] = useState('');
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [coverPreviewByProject, setCoverPreviewByProject] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [galleryCount, setGalleryCount] = useState(0);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [trashSearch, setTrashSearch] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState<ProjectStatusFilter>('all');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [projectActionId, setProjectActionId] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [projectEditorTarget, setProjectEditorTarget] = useState<PortfolioProject | null | undefined>(undefined);
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [categoryEditorTarget, setCategoryEditorTarget] = useState<AdminCategory | null | undefined>(undefined);
  const [saveNotice, setSaveNotice] = useState('');
  const [categoryNotice, setCategoryNotice] = useState('');
  const [calculatorDirty, setCalculatorDirty] = useState(false);
  const [websiteSectionsDirty, setWebsiteSectionsDirty] = useState(false);
  const [schemaHealth, setSchemaHealth] = useState<AdminSchemaHealth>(ADMIN_SCHEMA_UNCHECKED);
  const coverUrlCache = useRef(new Map<string, { url: string; at: number }>());
  const authorizationRequest = useRef(0);
  const authorizedUserId = useRef<string | null>(null);
  const authorizationInFlight = useRef<{ userId: string; requestId: number; promise: Promise<void> } | null>(null);

  const verifySession = useCallback(async (
    nextSession: Session | null,
    source = 'manual',
    force = false,
  ) => {
    setSession(nextSession);

    if (!nextSession) {
      authorizationRequest.current += 1;
      authorizationInFlight.current = null;
      authorizedUserId.current = null;
      setGateMessage('');
      setGate('signed-out');
      logAdminAuthDiagnostic(source, 'signed-out');
      return;
    }

    const client = supabase;
    if (!client) {
      setGate('unconfigured');
      logAdminAuthDiagnostic(source, 'unconfigured');
      return;
    }

    const userId = nextSession.user.id;
    const transition = getAdminAuthorizationTransition(userId, authorizedUserId.current);
    const blocksAdminShell = force || transition === 'blocking-check';

    // Revalidate a known user without unmounting the dashboard on routine auth refresh events.
    if (blocksAdminShell) {
      authorizedUserId.current = null;
      setGateMessage('');
      setGate('checking');
    }

    const existing = authorizationInFlight.current;
    if (!force && existing?.userId === userId) {
      logAdminAuthDiagnostic(source, blocksAdminShell ? 'blocking-check-coalesced' : 'background-check-coalesced');
      await existing.promise;
      return;
    }

    const requestId = ++authorizationRequest.current;
    const startedAt = performance.now();
    logAdminAuthDiagnostic(source, blocksAdminShell ? 'blocking-check-started' : 'background-check-started');
    const request = (async () => {
      try {
        const { data, error } = await withTimeout(
          client
            .from('authorized_administrators')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle(),
          12_000,
        );

        if (requestId !== authorizationRequest.current) return;
        if (error) {
          setGate('error');
          setGateMessage('ადმინისტრატორის წვდომის შემოწმება ვერ მოხერხდა. გადაამოწმეთ ინტერნეტ-კავშირი და მონაცემთა ბაზის წვდომის წესები, შემდეგ სცადეთ ხელახლა.');
          logAdminAuthDiagnostic(source, 'check-failed', performance.now() - startedAt);
          return;
        }
        if (!data) {
          authorizedUserId.current = null;
          setGate('denied');
          setGateMessage('');
          logAdminAuthDiagnostic(source, 'not-authorized', performance.now() - startedAt);
          return;
        }

        authorizedUserId.current = userId;
        setGate('authorized');
        setGateMessage('');
        logAdminAuthDiagnostic(source, 'authorized', performance.now() - startedAt);
      } catch (failure) {
        if (requestId !== authorizationRequest.current) return;
        const timedOut = failure instanceof Error && failure.message === 'authorization_timeout';
        setGate('error');
        setGateMessage(timedOut
          ? 'ადმინისტრატორის უფლებების შემოწმებას 12 წამზე მეტი დასჭირდა. შეამოწმეთ ინტერნეტ-კავშირი და სცადეთ ხელახლა.'
          : 'ადმინისტრატორის წვდომის შემოწმება ვერ მოხერხდა. გადაამოწმეთ ინტერნეტ-კავშირი და სცადეთ ხელახლა.');
        logAdminAuthDiagnostic(source, timedOut ? 'timeout' : 'check-failed', performance.now() - startedAt);
      } finally {
        if (authorizationInFlight.current?.requestId === requestId) authorizationInFlight.current = null;
      }
    })();

    authorizationInFlight.current = { userId, requestId, promise: request };
    await request;
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
    const bootstrapRequest = authorizationRequest.current;
    const { data: { subscription } } = client.auth.onAuthStateChange((event, nextSession) => {
      window.setTimeout(() => {
        if (active) void verifySession(nextSession, event);
      }, 0);
    });

    void withTimeout(client.auth.getSession(), 12_000).then(({ data, error }) => {
      if (!active) return;
      if (authorizationRequest.current !== bootstrapRequest) return;
      if (error) {
        setGate('error');
        setGateMessage(getAuthMessage(error));
        logAdminAuthDiagnostic('getSession', 'restore-failed');
        return;
      }
      void verifySession(data.session, 'getSession');
    }).catch((failure: unknown) => {
      if (!active) return;
      if (authorizationRequest.current !== bootstrapRequest) return;
      setGate('error');
      const timedOut = failure instanceof Error && failure.message === 'authorization_timeout';
      setGateMessage(timedOut
        ? 'სესიის აღდგენას 12 წამზე მეტი დასჭირდა. სცადეთ ხელახლა.'
        : 'სესიის აღდგენა ვერ მოხერხდა. განაახლეთ გვერდი და სცადეთ თავიდან.');
      logAdminAuthDiagnostic('getSession', timedOut ? 'restore-timeout' : 'restore-failed');
    });

    return () => {
      active = false;
      authorizationRequest.current += 1;
      authorizationInFlight.current = null;
      authorizedUserId.current = null;
      subscription.unsubscribe();
    };
  }, [verifySession]);

  // A silent reload keeps the current screen mounted (no loading state), e.g. after an upload.
  const loadDashboard = useCallback(async (options: { silent?: boolean } = {}) => {
    const client = supabase;
    if (!client) return;

    if (!options.silent) setDashboardLoading(true);
    setDashboardError('');
    try {
    const queryProjects = (columns: string) => client
      .from('portfolio_projects')
      .select(columns)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    const [fullProjectResult, categoryResult, galleryResult, health] = await Promise.all([
      queryProjects(`${PROJECT_COLUMNS}, deleted_at, deleted_by`),
      client
        .from('portfolio_categories')
        .select('id, slug, name, description, display_order, is_active')
        .order('display_order', { ascending: true }),
      client
        .from('portfolio_gallery_images')
        .select('id', { count: 'exact', head: true }),
      checkAdminSchema(client as unknown as SchemaProbeClient).catch(() => null),
    ]);
    if (health) setSchemaHealth(health);

    // Before the trash migration runs on this database, load projects without the trash
    // columns and treat every project as active, instead of failing the whole dashboard.
    let projectResult: { data: unknown[] | null; error: unknown } = fullProjectResult;
    if (isMissingColumn(fullProjectResult.error)) {
      const fallback = await queryProjects(PROJECT_COLUMNS);
      projectResult = {
        error: fallback.error,
        data: (fallback.data ?? []).map((project) => ({ ...(project as object), deleted_at: null, deleted_by: null })),
      };
    }

    const error = projectResult.error || categoryResult.error || galleryResult.error;
    if (error) throw error;

    const nextProjects = (projectResult.data ?? []) as PortfolioProject[];
    setProjects(nextProjects);
    setCategories((categoryResult.data ?? []) as Category[]);
    setGalleryCount(galleryResult.count ?? 0);

    const coverPaths = [...new Set(nextProjects
      .filter((project) => project.deleted_at === null && project.cover_image_path)
      .map((project) => project.cover_image_path as string))];
    // Reuse recent signed links so thumbnails don't reload on every refresh; links last 10 min.
    const now = Date.now();
    const cache = coverUrlCache.current;
    const toSign = coverPaths.filter((path) => !cache.has(path) || now - cache.get(path)!.at > 8 * 60 * 1000);
    if (toSign.length > 0) {
      try {
        const { data: signedCovers, error: signedCoverError } = await client
          .storage.from('portfolio-images').createSignedUrls(toSign, 600);
        if (!signedCoverError) {
          for (const item of signedCovers ?? []) {
            if (item.signedUrl && item.path) cache.set(item.path, { url: item.signedUrl, at: now });
          }
        }
      } catch {
        // Keep whatever links are cached; missing thumbnails fall back to an icon.
      }
    }
    setCoverPreviewByProject(Object.fromEntries(nextProjects.flatMap((project) => {
      const signedUrl = project.cover_image_path ? cache.get(project.cover_image_path)?.url : undefined;
      return signedUrl ? [[project.id, signedUrl]] : [];
    })));
    } catch {
      setDashboardError('მონაცემების ჩატვირთვა ვერ მოხერხდა. შეამოწმეთ კავშირი და სცადეთ ხელახლა.');
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (gate === 'authorized') void loadDashboard();
  }, [gate, loadDashboard]);

  // Ctrl/⌘+K opens the quick menu anywhere in the signed-in panel.
  useEffect(() => {
    if (gate !== 'authorized') return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gate]);

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
  const filteredTrash = useMemo(() => {
    const normalizedSearch = trashSearch.trim().toLocaleLowerCase('ka-GE');
    return projects
      .filter((project) => project.deleted_at !== null
        && (!normalizedSearch || `${project.title} ${project.slug}`.toLocaleLowerCase('ka-GE').includes(normalizedSearch)))
      .sort((first, second) => (second.deleted_at ?? '').localeCompare(first.deleted_at ?? ''));
  }, [projects, trashSearch]);
  const categoryLabelForId = (categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId);
    return category ? getCategoryAdminLabel(category) : 'კატეგორია არ არის მითითებული';
  };

  const runProjectAction = async (project: PortfolioProject, action: 'publish' | 'unpublish' | 'trash' | 'restore' | 'delete') => {
    const client = supabase;
    if (!client || projectActionId) return;

    if (action === 'publish' && !project.cover_image_path) {
      adminToast('საიტზე გამოსაჩენად ჯერ მთავარი სურათი დაამატეთ.', 'error');
      return;
    }
    const confirmations: Record<typeof action, Parameters<typeof adminConfirm>[0]> = {
      publish: { title: 'საიტზე ჩვენება', message: `„${project.title}“ გამოჩნდება საიტზე.`, confirmLabel: 'ჩვენება' },
      unpublish: { title: 'დამალვა', message: `„${project.title}“ საიტზე აღარ გამოჩნდება.`, confirmLabel: 'დამალვა' },
      trash: { title: 'წაშლა', message: `„${project.title}“ საიტიდან წაიშლება. თუ გადაიფიქრებთ, „წაშლილებიდან“ აღადგენთ.`, confirmLabel: 'წაშლა', tone: 'danger' },
      restore: { title: 'აღდგენა', message: `„${project.title}“ დაბრუნდება თავის ადგილას${project.is_published ? ' და გამოჩნდება საიტზე' : ''}.`, confirmLabel: 'აღდგენა' },
      delete: { title: 'სამუდამო წაშლა', message: `„${project.title}“ და მისი გალერეის ჩანაწერები სამუდამოდ წაიშლება. ამის გაუქმება შეუძლებელია. საცავში ატვირთული სურათის ფაილები უცვლელი დარჩება.`, confirmLabel: 'სამუდამოდ წაშლა', tone: 'danger', requireText: 'წაშლა' },
    };
    if (!await adminConfirm(confirmations[action])) return;

    setProjectActionId(project.id);
    setDashboardError('');
    setSaveNotice('');
    try {
      let result;
      if (action === 'delete') {
        result = await client.from('portfolio_projects')
          .delete()
          .eq('id', project.id)
          .not('deleted_at', 'is', null)
          .select('id')
          .maybeSingle();
      } else if (action === 'trash') {
        result = await client.from('portfolio_projects')
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by: session?.user.id ?? null,
            trashed_display_order: project.display_order,
          })
          .eq('id', project.id)
          .is('deleted_at', null)
          .select('id')
          .maybeSingle();
      } else if (action === 'restore') {
        result = await client.rpc('restore_trashed_portfolio_project', { p_project_id: project.id });
      } else {
        const update = client.from('portfolio_projects')
          .update({ is_published: action === 'publish' })
          .eq('id', project.id);
        // The deleted_at guard only exists once the trash migration has run.
        result = await (schemaHealth.trash ? update.is('deleted_at', null) : update)
          .select('id')
          .maybeSingle();
      }
      if (result.error || !result.data) throw new Error('project_action_failed');

      const messages = {
        publish: 'პროექტი წარმატებით გამოქვეყნდა.',
        unpublish: 'დაიმალა — საიტზე აღარ ჩანს.',
        trash: 'წაიშალა. აღდგენა შეგიძლიათ „წაშლილებიდან“.',
        restore: 'პროექტი ნაგვიდან აღდგა.',
        delete: 'პროექტი და მისი გალერეის ჩანაწერები სამუდამოდ წაიშალა. სურათების საცავის ფაილები შენარჩუნებულია.',
      };
      adminToast(messages[action]);
      await loadDashboard({ silent: true });
    } catch {
      adminToast('მოქმედება ვერ შესრულდა. გადაამოწმეთ ინტერნეტ-კავშირი და სცადეთ ხელახლა.', 'error');
    } finally {
      setProjectActionId('');
    }
  };

  /** Publish, unpublish or trash several projects in one request; resolves true on success. */
  const runBulkProjectAction = async (ids: string[], action: BulkProjectAction) => {
    const client = supabase;
    if (!client || ids.length === 0) return false;
    const chosen = projects.filter((project) => ids.includes(project.id) && project.deleted_at === null);
    const withoutCover = action === 'publish' ? chosen.filter((project) => !project.cover_image_path) : [];
    const targets = chosen.filter((project) => !withoutCover.includes(project));
    if (targets.length === 0) {
      adminToast('მონიშნულ პროექტებს მთავარი სურათი არ აქვთ, ამიტომ ვერ გამოქვეყნდება.', 'error');
      return false;
    }

    const count = formatNumber(targets.length);
    const skipped = withoutCover.length ? ` ${formatNumber(withoutCover.length)} პროექტი მთავარი სურათის გარეშეა და გამოტოვდება.` : '';
    const confirmed = await adminConfirm(
      action === 'publish'
        ? { title: `${count} პროექტის გამოქვეყნება`, message: `მონიშნული პროექტები საჯაროდ გამოჩნდება.${skipped}`, confirmLabel: 'გამოქვეყნება' }
        : action === 'unpublish'
          ? { title: `${count} პროექტის მოხსნა`, message: 'მონიშნული ნამუშევრები საიტზე აღარ გამოჩნდება.', confirmLabel: 'დამალვა' }
          : { title: `${count} ნამუშევრის წაშლა`, message: 'მონიშნული ნამუშევრები საიტიდან წაიშლება. აღდგენა შეგიძლიათ „წაშლილებიდან“.', confirmLabel: 'წაშლა', tone: 'danger' },
    );
    if (!confirmed) return false;

    try {
      const targetIds = targets.map((project) => project.id);
      if (action === 'trash') {
        // Each row keeps its own position so a restore puts it back where it was.
        const results = await Promise.all(targets.map((project) => client.from('portfolio_projects')
          .update({ deleted_at: new Date().toISOString(), deleted_by: session?.user.id ?? null, trashed_display_order: project.display_order })
          .eq('id', project.id)
          .is('deleted_at', null)));
        if (results.some((result) => result.error)) throw new Error('bulk_trash_failed');
      } else {
        const update = client.from('portfolio_projects').update({ is_published: action === 'publish' }).in('id', targetIds);
        const { error } = await (schemaHealth.trash ? update.is('deleted_at', null) : update);
        if (error) throw error;
      }
      adminToast(action === 'publish'
        ? `${count} პროექტი გამოქვეყნდა.${skipped}`
        : action === 'unpublish' ? `${count} პროექტი საიტიდან მოიხსნა.` : `${count} ნამუშევარი წაიშალა.`);
      await loadDashboard({ silent: true });
      return true;
    } catch {
      adminToast('ერთდროული მოქმედება ვერ შესრულდა. სცადეთ ხელახლა.', 'error');
      await loadDashboard({ silent: true });
      return false;
    }
  };

  const goToSection = async (id: AdminSection) => {
    if (id === activeSection) return;
    if (activeSection === 'calculator' && calculatorDirty
      && !await adminConfirm({ title: 'შეუნახავი ცვლილებები', message: 'კალკულატორში შეუნახავი ცვლილებებია. დატოვების შემთხვევაში ისინი დაიკარგება.', confirmLabel: 'დატოვება', tone: 'danger' })) return;
    if (activeSection === 'website-sections' && websiteSectionsDirty
      && !await adminConfirm({ title: 'შეუნახავი ცვლილებები', message: 'საიტის სექციებში შეუნახავი ცვლილებებია. დატოვების შემთხვევაში ისინი დაიკარგება.', confirmLabel: 'დატოვება', tone: 'danger' })) return;
    if (activeSection === 'settings' && settingsDirty
      && !await adminConfirm({ title: 'შეუნახავი ცვლილებები', message: 'პარამეტრებში შეუნახავი ცვლილებებია. დატოვების შემთხვევაში ისინი დაიკარგება.', confirmLabel: 'დატოვება', tone: 'danger' })) return;
    if (activeSection === 'calculator') setCalculatorDirty(false);
    if (activeSection === 'website-sections') setWebsiteSectionsDirty(false);
    setActiveSection(id);
    document.querySelector('.admin-main')?.scrollTo?.({ top: 0 });
    window.scrollTo({ top: 0 });
  };

  const openProjectsWith = (filter: ProjectStatusFilter) => {
    setProjectStatusFilter(filter);
    void goToSection('projects');
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
        action={() => { void verifySession(session, 'retry', true); }}
        actionLabel="ხელახლა ცდა"
        secondaryAction={() => { void handleSignOut(); }}
        secondaryLabel="სისტემიდან გასვლა"
      />
    );
  }

  const activeProjects = projects.filter((project) => project.deleted_at === null);
  const trashedProjects = projects.filter((project) => project.deleted_at !== null);
  const missingMigrations = missingAdminMigrations(schemaHealth);
  const attentionIssues: AttentionIssue[] = getAttentionIssues(activeProjects, categories);
  const projectsByCategory = categories.map((category) => ({
    ...category,
    projectCount: activeProjects.filter((project) => project.category_id === category.id).length,
  }));
  const publishedCount = activeProjects.filter((project) => project.is_published).length;
  const draftCount = activeProjects.length - publishedCount;
  const activeCategoryCount = categories.filter((category) => category.is_active).length;
  return (
    <div className="admin-shell admin-shell-v3" lang="ka-GE">
      <div className="admin-layout admin-layout-v3">
        <aside className="admin-sidebar admin-sidebar-v3">
          <a className="admin-brand" href="/" aria-label="Luka Imagines — მთავარ საიტზე დაბრუნება">
            <span className="admin-brand-mark" aria-hidden="true">LI</span>
            <span className="admin-brand-copy">
              <strong>Luka Imagines</strong>
              <small>მართვის სივრცე</small>
            </span>
          </a>

          <nav className="admin-nav admin-nav-v3" aria-label="მართვის სექციები">
            {navigationGroups.map((group) => (
              <div className="admin-nav-group" key={group.label}>
                <span className="admin-nav-group-label">{group.label}</span>
                {group.items.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={`admin-nav-item ${activeSection === id ? 'is-active' : ''}`}
                    onClick={() => { void goToSection(id); }}
                  >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                    {id === 'trash' && trashedProjects.length > 0 && <span className="admin-nav-count">{formatNumber(trashedProjects.length)}</span>}
                    {activeSection === id && <span className="admin-nav-marker" aria-hidden="true"><Check /></span>}
                  </button>
                ))}
              </div>
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
              onClick={async () => {
                if ((calculatorDirty || websiteSectionsDirty) && !await adminConfirm({
                  title: 'შეუნახავი ცვლილებები',
                  message: 'გასვლის შემთხვევაში შეუნახავი ცვლილებები დაიკარგება.',
                  confirmLabel: 'გასვლა',
                  tone: 'danger',
                })) return;
                if (!(calculatorDirty || websiteSectionsDirty) && !await adminConfirm({ title: 'სისტემიდან გასვლა', message: 'ხელახლა შესასვლელად ელფოსტა და პაროლი დაგჭირდებათ.', confirmLabel: 'გასვლა' })) return;
                void handleSignOut();
              }}
            >
              {isSigningOut ? <LoaderCircle className="admin-spin" /> : <LogOut />}
            </button>
          </div>
        </aside>

        <main className="admin-main">
          <header className="admin-topbar admin-topbar-v3">
            <div>
              <span className="admin-topbar-label">Luka Imagines</span>
              <strong>{activeTitle}</strong>
            </div>
            <div className="admin-topbar-right">
              <button type="button" className="admin-palette-trigger" onClick={() => setPaletteOpen(true)} aria-label="სწრაფი მენიუ (Ctrl+K)">
                <Search aria-hidden="true" />
                <span>ძიება და მოქმედებები</span>
                <kbd>Ctrl K</kbd>
              </button>
              <a className="admin-site-link" href="/" target="_blank" rel="noreferrer">
                საიტის ნახვა <ArrowUpRight aria-hidden="true" />
              </a>
            </div>
          </header>

          <div className="admin-content admin-content-v3">
            {dashboardError && (
              <div className="admin-alert" role="alert">
                <CircleAlert aria-hidden="true" />
                <span>{dashboardError}</span>
                <button type="button" onClick={() => { void loadDashboard(); }}>ხელახლა ცდა</button>
              </div>
            )}

            {missingMigrations.length > 0 && (
              <section className="admin-schema-notice" aria-labelledby="admin-schema-notice-title">
                <div className="admin-schema-notice-head">
                  <CircleAlert aria-hidden="true" />
                  <div>
                    <h2 id="admin-schema-notice-title">მონაცემთა ბაზას განახლება სჭირდება</h2>
                    <p>
                      თქვენი პროექტები და კატეგორიები ჩანს, მაგრამ ქვემოთ ჩამოთვლილი ფუნქციები ჩაირთვება მას შემდეგ, რაც
                      Supabase-ის SQL რედაქტორში ერთხელ ჩასვამთ და გაუშვებთ (Run) ფაილს <code>supabase/apply-admin-updates.sql</code>.
                      ის მხოლოდ ამატებს ახალ ცხრილებსა და სვეტებს; არსებულ მონაცემებს არ შლის.
                    </p>
                  </div>
                  {SQL_EDITOR_URL && (
                    <a className="admin-button admin-button-secondary" href={SQL_EDITOR_URL} target="_blank" rel="noreferrer">
                      SQL რედაქტორი <ArrowUpRight aria-hidden="true" />
                    </a>
                  )}
                </div>
                <ol className="admin-schema-notice-list">
                  {missingMigrations.map((migration) => (
                    <li key={migration.feature}>
                      <strong>{migration.label}</strong>
                      <span>{migration.effect}</span>
                    </li>
                  ))}
                </ol>
                <button className="admin-button admin-button-secondary" type="button" onClick={() => { void loadDashboard(); }}>
                  განახლების შემდეგ ხელახლა შემოწმება
                </button>
              </section>
            )}

            {dashboardLoading ? (
              <div className="admin-loading-state" role="status" aria-live="polite">
                <LoaderCircle className="admin-spin" aria-hidden="true" />
                მონაცემები იტვირთება...
              </div>
            ) : (
              <>
                {activeSection === 'overview' && (
                  <section className="admin-page-section admin-dashboard-v3" aria-labelledby="admin-overview-heading">
                    <div className="admin-page-heading admin-dashboard-heading-v3">
                      <div>
                        <h1 id="admin-overview-heading">გამარჯობა</h1>
                        <p>აირჩიეთ, რისი შეცვლა გსურთ — ან დაამატეთ ახალი ნამუშევარი.</p>
                      </div>
                      <div className="admin-page-heading-actions">
                        <button className="admin-button admin-button-primary" type="button" onClick={() => { setSaveNotice(''); setProjectEditorTarget(null); }}>
                          <Plus aria-hidden="true" /> ახალი პროექტი
                        </button>
                      </div>
                    </div>

                    <div className="admin-stats-grid admin-stats-grid-v3 admin-stats-grid-3">
                      <StatCard label="საიტზე ჩანს" value={publishedCount} detail="ნამუშევარი" Icon={BadgeCheck} tone="green" onClick={() => openProjectsWith('published')} />
                      <StatCard label="დამალული" value={draftCount} detail="საიტზე არ ჩანს" Icon={FolderOpen} tone="plum" onClick={() => openProjectsWith('draft')} />
                      <StatCard label="კატეგორია" value={activeCategoryCount} detail="აქტიური კატეგორია" Icon={Shapes} tone="ink" onClick={() => { void goToSection('categories'); }} />
                    </div>

                    <section className="admin-attention" aria-labelledby="admin-attention-heading">
                      <div className="admin-attention-head">
                        <div>
                          <p className="admin-eyebrow">სამუშაო სია</p>
                          <h2 id="admin-attention-heading">{attentionIssues.length ? 'ყურადღებას საჭიროებს' : 'ყველაფერი წესრიგშია'}</h2>
                        </div>
                        {attentionIssues.length === 0 && <span className="admin-attention-ok"><CheckCircle2 aria-hidden="true" /> გასასწორებელი არაფერია</span>}
                      </div>
                      {attentionIssues.length > 0 && (
                        <ul className="admin-attention-list">
                          {attentionIssues.map((issue) => {
                            const copy = ATTENTION_COPY[issue.id];
                            return (
                              <li key={issue.id} className="admin-attention-item">
                                <strong className="admin-attention-count">{formatNumber(issue.count)}</strong>
                                <div>
                                  <h3>{copy.title}</h3>
                                  <p>{copy.text}</p>
                                  {issue.samples.length > 0 && <small>მაგ.: {issue.samples.map((sample) => `„${sample}“`).join(', ')}{issue.count > issue.samples.length ? ' …' : ''}</small>}
                                </div>
                                <button
                                  type="button"
                                  className="admin-button admin-button-quiet"
                                  onClick={() => {
                                    if (issue.id === 'empty-category') void goToSection('categories');
                                    else openProjectsWith(issue.id);
                                  }}
                                >
                                  {copy.action} <ArrowUpRight aria-hidden="true" />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>

                    <div className="admin-overview-grid admin-overview-grid-v3">
                      <section className="admin-surface admin-recent-section admin-dashboard-panel-v3">
                        <div className="admin-section-heading">
                          <div>
                            <p className="admin-eyebrow">ბიბლიოთეკა</p>
                            <h2>ბოლო პროექტები</h2>
                          </div>
                          <button className="admin-text-button" type="button" onClick={() => setActiveSection('projects')}>
                            ყველას ნახვა <ArrowUpRight aria-hidden="true" />
                          </button>
                        </div>
                        {activeProjects.length === 0 ? (
                          <EmptyState title="აქტიური პროექტები ჯერ არ არის" message="აქტიურ ბიბლიოთეკაში პროექტები არ მოიძებნა. წაშლილი ნამუშევრები „წაშლილში“ ინახება." />
                        ) : (
                          <div className="admin-recent-list">
                            {[...activeProjects].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5).map((project) => (
                              <button type="button" className="admin-recent-row admin-recent-row-v3" key={project.id} onClick={() => { setSaveNotice(''); setProjectEditorTarget(project); }}>
                                <span className="admin-project-thumb admin-project-thumb-v3">
                                  <BriefcaseBusiness aria-hidden="true" />
                                  {coverPreviewByProject[project.id] && <img src={coverPreviewByProject[project.id]} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />}
                                </span>
                                <span className="admin-recent-copy">
                                  <strong>{project.title}</strong>
                                  <span>{categoryLabelForId(project.category_id)} · {formatDate(project.created_at)}</span>
                                </span>
                                <span className={`admin-state-pill ${project.is_published ? 'is-published' : 'is-draft'}`}>
                                  {project.is_published ? 'ჩანს' : 'დამალულია'}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </section>

                      <section className="admin-surface admin-dashboard-panel-v3 admin-where-panel" aria-labelledby="admin-where-heading">
                        <div className="admin-section-heading">
                          <div>
                            <p className="admin-eyebrow">საიტის შეცვლა</p>
                            <h2 id="admin-where-heading">სად რა იცვლება</h2>
                          </div>
                        </div>
                        <ul className="admin-where-list">
                          {WHERE_LINKS.map((link) => (
                            <li key={link.id}>
                              <button type="button" onClick={() => { void goToSection(link.id); }}>
                                <link.Icon aria-hidden="true" />
                                <span><strong>{link.label}</strong><small>{link.text}</small></span>
                                <ArrowUpRight aria-hidden="true" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    </div>
                  </section>
                )}

                {activeSection === 'projects' && (
                  <WorksManager
                    projects={activeProjects}
                    categories={categories}
                    covers={coverPreviewByProject}
                    trashCount={trashedProjects.length}
                    onOpenTrash={() => { void goToSection('trash'); }}
                    onReload={() => loadDashboard({ silent: true })}
                    onTrash={(project) => { void runProjectAction(project, 'trash'); }}
                    onOpenDetails={(project) => { setSaveNotice(''); setProjectEditorTarget(project); }}
                  />
                )}

                {activeSection === 'trash' && (
                  <section className="admin-page-section" aria-labelledby="admin-trash-heading">
                    <div className="admin-page-heading">
                      <div>
                        <button type="button" className="admin-back-link" onClick={() => { void goToSection('projects'); }}>
                          <ArrowLeft aria-hidden="true" /> პროექტებზე დაბრუნება
                        </button>
                        <h1 id="admin-trash-heading">წაშლილი</h1>
                        <p>აქ არის წაშლილი ნამუშევრები. ნებისმიერი შეგიძლიათ აღადგინოთ.</p>
                      </div>
                      <span className="admin-count-chip">{formatNumber(trashedProjects.length)} პროექტი</span>
                    </div>
                    {saveNotice && (
                      <div className="admin-success-notice" role="status">
                        <CheckCircle2 aria-hidden="true" />
                        <span>{saveNotice}</span>
                        <button type="button" aria-label="შეტყობინების დახურვა" onClick={() => setSaveNotice('')}><X aria-hidden="true" /></button>
                      </div>
                    )}
                    <div className="admin-trash-warning" role="note">
                      <CircleAlert aria-hidden="true" />
                      <p>სამუდამო წაშლა ცალკე, ორჯერ დადასტურებას მოითხოვს. მონაცემთა ბაზის ჩანაწერები წაიშლება, სურათების საცავის ფაილები კი უცვლელი დარჩება.</p>
                    </div>
                    <div className="admin-surface admin-table-surface">
                      <div className="admin-list-toolbar">
                        <label className="admin-search-wrap">
                          <Search aria-hidden="true" />
                          <input value={trashSearch} onChange={(event) => setTrashSearch(event.target.value)} placeholder="ძიება" aria-label="წაშლილებში ძიება" />
                        </label>
                        <span>{formatNumber(filteredTrash.length)} შედეგი</span>
                      </div>
                      {filteredTrash.length === 0 ? (
                        <EmptyState title={trashedProjects.length ? 'შედეგი ვერ მოიძებნა' : 'წაშლილი არაფერია'} message={trashedProjects.length ? 'სცადეთ სხვა სათაურით ძიება.' : 'წაშლილი ნამუშევრები აქ გამოჩნდება.'} />
                      ) : (
                        <div className="admin-project-list admin-project-grid-v3 admin-trash-grid-v3">
                          {filteredTrash.map((project) => (
                            <article className="admin-project-row admin-trash-row admin-project-card-v3" key={project.id}>
                              <span className="admin-project-thumb admin-project-card-cover-v3">{project.cover_image_path ? <ImageIcon aria-hidden="true" /> : <BriefcaseBusiness aria-hidden="true" />}</span>
                              <div className="admin-project-main">
                                <strong>{project.title}</strong>
                                <span>{categoryLabelForId(project.category_id)} <i /> {project.slug}</span>
                              </div>
                              <span className={`admin-state-pill ${project.is_published ? 'is-published' : 'is-draft'}`}>
                                {project.is_published ? 'აღდგენისას გამოჩნდება' : 'დამალულია'}
                              </span>
                              <time dateTime={project.deleted_at ?? undefined}>{project.deleted_at ? `წაიშალა: ${formatDate(project.deleted_at)}` : ''}</time>
                              <div className="admin-project-row-actions">
                                <button className="admin-icon-button" type="button" aria-label={`პროექტის აღდგენა: ${project.title}`} title="აღდგენა" disabled={Boolean(projectActionId)} onClick={() => { void runProjectAction(project, 'restore'); }}>
                                  {projectActionId === project.id ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
                                </button>
                                <button className="admin-icon-button admin-project-trash-button" type="button" aria-label={`სამუდამოდ წაშლა: ${project.title}`} title="სამუდამოდ წაშლა" disabled={Boolean(projectActionId)} onClick={() => { void runProjectAction(project, 'delete'); }}>
                                  <Trash2 aria-hidden="true" />
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {activeSection === 'categories' && (
                  <CategoriesView
                    categories={categories}
                    projects={projects}
                    covers={coverPreviewByProject}
                    onReload={() => loadDashboard({ silent: true })}
                    onEdit={(category) => { setCategoryNotice(''); setCategoryEditorTarget(category); }}
                  />
                )}

                {activeSection === 'calculator' && (
                  <CalculatorManagement onDirtyChange={setCalculatorDirty} />
                )}

                {activeSection === 'website-sections' && (
                  <WebsiteSectionsErrorBoundary>
                    <WebsiteSectionsManager onDirtyChange={setWebsiteSectionsDirty} />
                  </WebsiteSectionsErrorBoundary>
                )}

                {activeSection === 'settings' && (
                  <section className="admin-page-section" aria-labelledby="admin-settings-heading">
                    <div className="admin-page-heading">
                      <div>
                        <h1 id="admin-settings-heading">კონტაქტი და სტატუსი</h1>
                        <p>იღებთ თუ არა ახალ პროექტებს, სად ხართ და როგორ დაგიკავშირდნენ. შენახვისთანავე ჩანს საიტზე.</p>
                      </div>
                    </div>
                    <SiteSettingsView onDirtyChange={setSettingsDirty} />
                  </section>
                )}
              </>
            )}
          </div>

        </main>
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        sections={navigation}
        projects={activeProjects.map((project) => ({ id: project.id, title: project.title }))}
        onNavigate={(id) => { void goToSection(id as AdminSection); }}
        onNewProject={() => { setSaveNotice(''); setProjectEditorTarget(null); }}
        onOpenProject={(id) => {
          const project = activeProjects.find((item) => item.id === id);
          if (project) { setSaveNotice(''); setProjectEditorTarget(project); }
        }}
      />
      <AdminFeedbackHost />
      {projectEditorTarget !== undefined && (
        <ProjectEditor
          project={projectEditorTarget}
          categories={categories}
          onClose={() => setProjectEditorTarget(undefined)}
          onDraftCreated={() => { void loadDashboard({ silent: true }); }}
          onSaved={(message) => {
            setProjectEditorTarget(undefined);
            setSaveNotice(message);
            adminToast(message, 'success');
            void loadDashboard({ silent: true });
          }}
        />
      )}
      {categoryEditorTarget !== undefined && (
        <CategoryEditor
          category={categoryEditorTarget}
          onClose={() => setCategoryEditorTarget(undefined)}
          onSaved={(message) => {
            setCategoryEditorTarget(undefined);
            adminToast(message, 'success');
            void loadDashboard({ silent: true });
          }}
        />
      )}
      {organizerOpen && (
        <PortfolioOrganizer
          categories={categories}
          projects={projects}
          onClose={() => setOrganizerOpen(false)}
          onEdit={(project) => { setProjectEditorTarget(project); }}
          onSaved={(message) => {
            setSaveNotice(message);
            void loadDashboard({ silent: true });
          }}
        />
      )}
    </div>
  );
}
