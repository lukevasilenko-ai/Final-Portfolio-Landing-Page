/**
 * Site-wide profile settings edited in the admin ("საიტის პარამეტრები") and read by the public
 * site: availability status, location, social links and SEO text. Stored as one published
 * site_content row (content_key "site-profile", locale "ka"); anything missing or invalid
 * falls back to the defaults below, which match the previously hardcoded values.
 */

export const SITE_PROFILE_KEY = 'site-profile';
export const SITE_PROFILE_LOCALE = 'ka';

export interface SiteProfile {
  availability: { open: boolean; text: string };
  location: string;
  socials: { facebook: string; instagram: string; behance: string; whatsapp: string; email: string };
  seo: { title: string; description: string };
}

export const DEFAULT_SITE_PROFILE: SiteProfile = {
  availability: { open: true, text: 'პროექტების მიღება აქტიურია' },
  location: 'ქუთაისი, საქართველო',
  socials: {
    facebook: 'https://www.facebook.com/luka.vasilenko.2025/',
    instagram: '',
    behance: '',
    whatsapp: '995595213216',
    email: 'lukevasilenko@gmail.com',
  },
  seo: {
    title: 'Luka Imagines — Graphic Design & Branding Portfolio',
    description: 'Luka Imagines — ლუკა ვასილენკოს გრაფიკული დიზაინის პორტფოლიო: ბრენდინგი, ლოგო, სოციალური მედიის დიზაინი და საბეჭდი მასალები.',
  },
};

export const SEO_TITLE_LIMIT = 60;
export const SEO_DESCRIPTION_LIMIT = 160;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown, fallback: string, max = 300) =>
  typeof value === 'string' ? value.trim().slice(0, max) : fallback;

export const isSafeHttpsUrl = (value: string) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
};
export const isValidPhone = (value: string) => !value || /^\d{7,15}$/.test(value);
export const isValidEmail = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const url = (value: unknown, fallback: string) => {
  const candidate = text(value, fallback, 500);
  return isSafeHttpsUrl(candidate) ? candidate : fallback;
};

/** Merge stored content over the defaults, keeping only well-formed values. */
export function normalizeSiteProfile(raw: unknown): SiteProfile {
  const source = isRecord(raw) ? raw : {};
  const availability = isRecord(source.availability) ? source.availability : {};
  const socials = isRecord(source.socials) ? source.socials : {};
  const seo = isRecord(source.seo) ? source.seo : {};
  const defaults = DEFAULT_SITE_PROFILE;
  const phone = text(socials.whatsapp, defaults.socials.whatsapp, 20).replace(/\D/g, '');
  const email = text(socials.email, defaults.socials.email, 200);

  return {
    availability: {
      open: typeof availability.open === 'boolean' ? availability.open : defaults.availability.open,
      text: text(availability.text, defaults.availability.text, 120) || defaults.availability.text,
    },
    location: text(source.location, defaults.location, 120) || defaults.location,
    socials: {
      facebook: url(socials.facebook, defaults.socials.facebook),
      instagram: url(socials.instagram, defaults.socials.instagram),
      behance: url(socials.behance, defaults.socials.behance),
      whatsapp: isValidPhone(phone) ? phone : defaults.socials.whatsapp,
      email: isValidEmail(email) ? email : defaults.socials.email,
    },
    seo: {
      title: text(seo.title, defaults.seo.title, 120) || defaults.seo.title,
      description: text(seo.description, defaults.seo.description, 320) || defaults.seo.description,
    },
  };
}

/** Field-level problems for the admin form (empty object = valid). */
export function validateSiteProfile(profile: SiteProfile): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};
  for (const key of ['facebook', 'instagram', 'behance'] as const) {
    if (!isSafeHttpsUrl(profile.socials[key])) errors[key] = 'ბმული უნდა იწყებოდეს https://-ით.';
  }
  if (!isValidPhone(profile.socials.whatsapp)) errors.whatsapp = 'მხოლოდ ციფრები, ქვეყნის კოდით (მაგ. 995595123456).';
  if (!isValidEmail(profile.socials.email)) errors.email = 'ელფოსტის ფორმატი არასწორია.';
  if (!profile.availability.text.trim()) errors.availabilityText = 'სტატუსის ტექსტი სავალდებულოა.';
  if (!profile.location.trim()) errors.location = 'მდებარეობა სავალდებულოა.';
  if (!profile.seo.title.trim()) errors.seoTitle = 'სათაური სავალდებულოა.';
  if (!profile.seo.description.trim()) errors.seoDescription = 'აღწერა სავალდებულოა.';
  return errors;
}

export const whatsappLink = (phone: string) => (phone ? `https://wa.me/${phone}` : '');
export const emailComposeLink = (email: string) => (email ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}` : '');

type ProfileQuery = PromiseLike<{ data: { content: unknown } | null; error: unknown }>;
export interface SiteProfileClient {
  from(table: 'site_content'): {
    select(columns: string): {
      eq(column: string, value: string): { eq(column: string, value: string): { maybeSingle(): ProfileQuery } };
    };
  };
}

/** Loads the published profile; null means "not saved yet or unreachable" (callers keep defaults). */
export async function loadSiteProfile(client: SiteProfileClient): Promise<SiteProfile | null> {
  const { data, error } = await client
    .from('site_content')
    .select('content')
    .eq('content_key', SITE_PROFILE_KEY)
    .eq('locale', SITE_PROFILE_LOCALE)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeSiteProfile(data.content);
}
