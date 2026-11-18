import { canHideNativeElement, isNativeElementTypeAllowed, NATIVE_ELEMENT_SLOT_IDS } from './nativeSchema';

export const NATIVE_SECTION_KEYS = ['hero', 'about', 'projects', 'brief-studio', 'calculator', 'contact', 'closing-scene', 'site-footer'] as const;
export type NativeSectionKey = typeof NATIVE_SECTION_KEYS[number];

// Sections removed from the website. The Supabase layout validator still requires every
// native key, so a retired section stays in saved layouts as a hidden placeholder at the
// end of the order; it is never rendered or listed in the builder.
export const RETIRED_NATIVE_SECTION_KEYS: readonly NativeSectionKey[] = ['about', 'brief-studio'];

export function isRetiredNativeSection(section: { sectionKey?: string }) {
  return section.sectionKey !== undefined && (RETIRED_NATIVE_SECTION_KEYS as readonly string[]).includes(section.sectionKey);
}

export const WEBSITE_TEMPLATE_IDS = [
  'text-heading',
  'image-text',
  'gallery',
  'call-to-action',
  'services-grid',
  'feature-cards',
  'statistics',
  'faq',
  'testimonials',
  'logo-grid',
  'divider',
  'custom-content',
] as const;
export type WebsiteTemplateId = typeof WEBSITE_TEMPLATE_IDS[number];

export const WEBSITE_BLOCK_TYPES = [
  'eyebrow',
  'heading',
  'subheading',
  'paragraph',
  'button',
  'image',
  'icon',
  'divider',
  'feature-list',
  'statistic',
  'gallery-item',
  'card',
  'content-group',
  'faq-item',
  'testimonial',
  'logo',
  'call-to-action',
  'native-visibility',
] as const;
export type WebsiteBlockType = typeof WEBSITE_BLOCK_TYPES[number];
export const WEBSITE_INSERTABLE_BLOCK_TYPES = WEBSITE_BLOCK_TYPES.filter((type) => type !== 'native-visibility') as Exclude<WebsiteBlockType, 'native-visibility'>[];

export interface WebsiteBlock {
  id: string;
  type: WebsiteBlockType;
  visible: boolean;
  title?: string;
  text?: string;
  label?: string;
  href?: string;
  src?: string;
  alt?: string;
  value?: string;
  icon?: 'sparkles' | 'palette' | 'layers' | 'check' | 'arrow' | 'star' | 'quote' | 'clock';
  children?: WebsiteBlock[];
  target?: string;
  position?: 'before' | 'after' | 'replace';
}

export const WEBSITE_INTERNAL_BLOCK_TYPES = ['native-visibility'] as const;

export interface WebsiteSection {
  id: string;
  kind: 'native' | 'template';
  sectionKey?: NativeSectionKey;
  templateId?: WebsiteTemplateId;
  label: string;
  anchorId: string;
  visible: boolean;
  inNavigation: boolean;
  order: number;
  copy: Record<string, string>;
  elements: WebsiteBlock[];
  appearance: {
    layout: 'one-column' | 'two-column' | 'grid';
    spacing: 'compact' | 'comfortable' | 'spacious';
    alignment: 'start' | 'center';
    background: 'default' | 'soft' | 'dark';
    typography: 'brand' | 'editorial' | 'compact';
    accent: 'forest' | 'copper' | 'neutral';
    responsive: 'all' | 'desktop' | 'mobile';
  };
}

export interface WebsiteLayoutConfig {
  schemaVersion: 1;
  sections: WebsiteSection[];
}

export interface WebsiteTemplateDefinition {
  id: WebsiteTemplateId;
  label: string;
  description: string;
  category: string;
  defaultElements: WebsiteTemplateSeed[];
}

export interface WebsiteTemplateSeed {
  type: WebsiteBlockType;
  title?: string;
  text?: string;
  label?: string;
  value?: string;
  icon?: WebsiteBlock['icon'];
  src?: string;
  alt?: string;
  children?: WebsiteTemplateSeed[];
}

const nativeCopy: Record<NativeSectionKey, Record<string, string>> = {
  hero: {
    eyebrow: 'გრაფიკული დიზაინერი',
    // The hero statement: two lines, then the words the last line cycles through (see heroPhraseCopy).
    titleLine1: 'ვქმნი დიზაინს,',
    titleLine2: 'რომელიც',
    titleLine3: 'ყიდის / ჩანს / ახსოვთ / მუშაობს',
    description: 'გამარჯობა, მე ვარ ლუკა ვასილენკო. მე ვქმნი თვალშისაცემ ვიზუალურ პროდუქტებს, სადაც კრეატიული იდეები და ვიზუალური მინიმალიზმი ერთმანეთს ერწყმის. სპეციალიზებული ვარ სოც. მედია პოსტერების, ლოგოების, ბანერების, სავიზიტო ბარათების, ბრენდინგისა და რებრენდინგის მიმართულებით. ვმუშაობ Adobe Photoshop-სა და Adobe Illustrator-ში.',
    primaryButtonLabel: 'ნამუშევრების დათვალიერება',
    imageAlt: 'ავეჯის სარეკლამო პოსტერი',
    featuredLabel: 'ბოლო ნამუშევარი',
    heroImageSrc: '',
  },
  about: {
    eyebrow: '01 // ბიოგრაფია',
    titleLine1: 'ვაერთიანებ კრეატიულ იდეებსა და',
    titleLine2: 'თანამედროვე ვიზუალურ ესთეტიკას.',
    profileName: 'ლუკა ვასილენკო',
    role: 'პროფესიონალი გრაფიკული დიზაინერი',
    profileDescription: 'ჩემი სპეციალიზაციაა სარეკლამო პოსტერების, ლოგოების, ბანერებისა და ბრენდინგის უმაღლეს დონეზე შექმნა. ჩემი სამუშაო პროცესი ყოველთვის ითვალისწინებს კლიენტის მოთხოვნებს, კომპოზიციურ სრულყოფილებას, სწორ ტიპოგრაფიასა და ფერთა ჰარმონიას.',
    featureOneTitle: 'კომპოზიცია და ფერები',
    featureOneText: 'მიმაჩნია, რომ კარგი დიზაინი ამბავს ყვება. განსაკუთრებულ ყურადღებას ვუთმობ ფერთა თეორიას (RGB/CMYK) და ოქროს პროპორციას იდეალური ბალანსის მისაღწევად.',
    featureTwoTitle: 'დეტალების სიზუსტე',
    featureTwoText: 'ვექტორული სიზუსტე Adobe Illustrator-ში, მაღალი რეზოლუციის ფოტო-მანიპულაციები Photoshop-ში და ბეჭდვისთვის (Pre-press) გამზადებული მასალები ჩემი სამუშაო ხარისხის გარანტიაა.',
    skillsTitle: 'პროფესიული უნარები',
    skillsDescription: 'ძირითადი გრაფიკული პროგრამები, რომლებსაც ყოველდღიურად და პროფესიონალურად ვიყენებ.',
    statsExperienceValue: '2+',
    statsExperienceLabel: 'წლის გამოცდილება',
    statsProjectsValue: '4+',
    statsProjectsLabel: 'გაშვებული პროექტი',
    statsSuccessValue: '100%',
    statsSuccessLabel: 'წარმატებული მიწოდება',
    skillCategoryLabel: 'ძირითადი ხელსაწყოები',
    skillOneName: 'Adobe Illustrator',
    skillOneLevel: '82',
    skillTwoName: 'Adobe Photoshop',
    skillTwoLevel: '97',
    skillsQuote: '„სიმარტივე არის დახვეწილობის მწვერვალი. მე დაუღალავად ვმუშაობ ზედმეტი დეტალების მოსაშორებლად და მხოლოდ სუფთა ესთეტიკის შესანარჩუნებლად.“',
  },
  projects: {
    eyebrow: '02 // portfolio',
    title: 'ნამუშევრები მიმართულებების მიხედვით.',
    description: 'დაათვალიერეთ პოსტერები, ბრენდინგის პროექტები და საბეჭდი ნამუშევრები ერთ სივრცეში.',
    buttonLabel: 'სრული კატალოგი',
    categoryLabel: 'ყველა კატეგორია',
  },
  'brief-studio': {},
  calculator: {},
  contact: {
    eyebrow: '06 // თანამშრომლობა',
    title: 'თანამშრომლობის დაწყება',
    description: 'გაქვთ ახალი ბრენდის, სოციალური მედიის ვიზუალის ან საბეჭდი მასალის იდეა? მოკლედ აღწერეთ პროექტი და საუბარს პირდაპირ WhatsApp-ში გავაგრძელებთ.',
    channelsTitle: 'პირდაპირი არხები',
    cardTitleLead: 'შევქმნათ რამე ',
    cardTitleAccentOne: 'ლამაზი',
    cardTitleMiddle: ' და ',
    cardTitleAccentTwo: 'განსაკუთრებული',
    cardTitleEnd: '.',
    contactCardDescription: 'ვიღებ ბრენდინგის, ლოგოს, სოციალური მედიის დიზაინისა და საბეჭდი მასალების პროექტებს. მომწერეთ იდეა, სასურველი ვადა და საჭირო ფორმატები.',
    emailLabel: 'ელფოსტა',
    contactEmail: 'lukevasilenko@gmail.com',
    whatsappLabel: 'WhatsApp',
    whatsappNumber: '995595213216',
    workingHoursLabel: 'სამუშაო საათები',
    workingHours: '09:00 - 18:00 GET',
    signature: 'ლუკა ვასილენკო // დიზაინი, იდეა და ხასიათი',
    formNameLabel: 'თქვენი სახელი *',
    formNamePlaceholder: 'შეიყვანეთ თქვენი სახელი',
    formEmailLabel: 'ელფოსტის მისამართი *',
    formEmailPlaceholder: 'you@company.com',
    formSubjectLabel: 'თემა / საკითხი',
    formSubjectPlaceholder: 'მაგ: ბრენდინგი ან სოციალური მედიის პაკეტი',
    formMessageLabel: 'პროექტის აღწერა *',
    formMessagePlaceholder: 'აღწერეთ მიზანი, საჭირო მასალები, ვადა და ნებისმიერი მნიშვნელოვანი დეტალი...',
    formNote: 'გაიხსნება WhatsApp და შეტყობინების გაგზავნას იქვე დაადასტურებთ.',
    formButtonLabel: 'WhatsApp-ში გაგრძელება',
  },
  'closing-scene': {
    titleLine1: 'იყავი ',
    titleAccent: 'გამორჩეული',
  },
  'site-footer': {
    role: 'გრაფიკული დიზაინერი',
    copyright: '© {year} Luka Imagines. გრაფიკული დიზაინი, ბრენდინგი და ვიზუალური იდენტობა.',
  },
};

export const WEBSITE_TEMPLATES: WebsiteTemplateDefinition[] = [
  { id: 'text-heading', label: 'ტექსტი და სათაური', description: 'სათაური და მკაფიო ტექსტური ბლოკი.', category: 'კონტენტი', defaultElements: [{ type: 'heading', text: 'ახალი იდეა' }, { type: 'paragraph', text: 'დაამატეთ მოკლე აღწერა თქვენი სექციისთვის.' }] },
  { id: 'image-text', label: 'სურათი და ტექსტი', description: 'სურათისა და ტექსტის ორსვეტიანი კომპოზიცია.', category: 'კონტენტი', defaultElements: [{ type: 'image', src: '', alt: 'სექციის სურათი' }, { type: 'heading', text: 'ვიზუალური ამბავი' }, { type: 'paragraph', text: 'აღწერეთ იდეა, პროცესი ან შეთავაზება.' }] },
  { id: 'gallery', label: 'გალერეა', description: 'მოქნილი ვიზუალური გალერეა.', category: 'ვიზუალი', defaultElements: [{ type: 'heading', text: 'რჩეული ნამუშევრები' }, { type: 'content-group', title: 'გალერეის სურათები', children: [{ type: 'gallery-item', src: '', alt: 'გალერეის სურათი' }] }] },
  { id: 'call-to-action', label: 'მოქმედებისკენ მოწოდება', description: 'აქცენტირებული შეთავაზება ღილაკით.', category: 'კონვერსია', defaultElements: [{ type: 'heading', text: 'მზად ხართ დასაწყებად?' }, { type: 'paragraph', text: 'მოკლედ აღწერეთ შემდეგი ნაბიჯი.' }, { type: 'button', label: 'დამიკავშირდით', href: '#contact' }] },
  { id: 'services-grid', label: 'სერვისების ბადე', description: 'სერვისების მარტივად შესადარებელი ბარათები.', category: 'კონტენტი', defaultElements: [{ type: 'heading', text: 'რას გთავაზობთ' }, { type: 'content-group', title: 'სერვისები', children: [{ type: 'card', title: 'ბრენდინგი', text: 'ვიზუალური იდენტობის შექმნა.', icon: 'palette' }] }] },
  { id: 'feature-cards', label: 'უპირატესობების ბარათები', description: 'მახასიათებლები მოკლე, ვიზუალურ ბარათებში.', category: 'კონტენტი', defaultElements: [{ type: 'heading', text: 'რატომ ეს მიდგომა' }, { type: 'feature-list', title: 'უპირატესობები', children: [{ type: 'card', title: 'მკაფიო იდეა', text: 'ერთიანი ვიზუალური მიმართულება.', icon: 'sparkles' }] }] },
  { id: 'statistics', label: 'სტატისტიკა და მაჩვენებლები', description: 'მნიშვნელოვანი რიცხვების ხაზგასმა.', category: 'კონტენტი', defaultElements: [{ type: 'heading', text: 'შედეგები ციფრებში' }, { type: 'statistic', value: '100%', label: 'კმაყოფილება' }] },
  { id: 'faq', label: 'ხშირად დასმული კითხვები', description: 'კითხვებისა და პასუხების დალაგებული სია.', category: 'ინფორმაცია', defaultElements: [{ type: 'heading', text: 'ხშირად დასმული კითხვები' }, { type: 'content-group', title: 'კითხვები', children: [{ type: 'faq-item', title: 'როგორ დავიწყოთ?', text: 'მომწერეთ პროექტის მოკლე აღწერა.' }] }] },
  { id: 'testimonials', label: 'შეფასებები', description: 'კლიენტების გამოცდილების წარდგენა.', category: 'ნდობა', defaultElements: [{ type: 'heading', text: 'კლიენტების შეფასებები' }, { type: 'testimonial', text: 'თანამშრომლობა იყო მარტივი და შედეგი ზუსტად ასახავდა ბრენდის ხასიათს.', label: 'კლიენტი' }] },
  { id: 'logo-grid', label: 'ლოგოები და კლიენტები', description: 'კლიენტების ან პარტნიორების სახელების ბადე.', category: 'ნდობა', defaultElements: [{ type: 'heading', text: 'კლიენტები და პარტნიორები' }, { type: 'content-group', title: 'ბრენდები', children: [{ type: 'logo', label: 'ბრენდის სახელი' }] }] },
  { id: 'divider', label: 'სექციის გამყოფი', description: 'სივრცის გასაყოფი მსუბუქი ვიზუალური ხაზი.', category: 'სტრუქტურა', defaultElements: [{ type: 'divider' }] },
  { id: 'custom-content', label: 'თავისუფალი კომპოზიცია', description: 'სათაურის, ტექსტის, სურათისა და ბარათების კომბინაცია.', category: 'კონტენტი', defaultElements: [{ type: 'heading', text: 'ახალი სექცია' }, { type: 'paragraph', text: 'დაამატეთ საჭირო ტექსტური და ვიზუალური ბლოკები.' }] },
].map((template) => ({
  ...template,
  defaultElements: template.defaultElements.map((element) => ({ ...element, visible: true })),
})) as WebsiteTemplateDefinition[];

const nativeLabels: Record<NativeSectionKey, string> = {
  hero: 'მთავარი გვერდი',
  about: 'ჩემ შესახებ',
  projects: 'პორტფოლიო',
  'brief-studio': 'კრეატიული ბრიფი',
  calculator: 'კალკულატორი',
  contact: 'კონტაქტი',
  'closing-scene': 'ფინალური ვიზუალური სცენა',
  'site-footer': 'საიტის ქვედა ნაწილი',
};

export const DEFAULT_WEBSITE_LAYOUT: WebsiteLayoutConfig = {
  schemaVersion: 1,
  sections: [
    ...NATIVE_SECTION_KEYS.filter((sectionKey) => !RETIRED_NATIVE_SECTION_KEYS.includes(sectionKey)),
    ...RETIRED_NATIVE_SECTION_KEYS,
  ].map((sectionKey, order) => ({
    id: sectionKey,
    kind: 'native',
    sectionKey,
    label: nativeLabels[sectionKey],
    anchorId: sectionKey === 'brief-studio' ? 'brief-studio' : sectionKey === 'hero' ? 'home' : sectionKey,
    visible: !RETIRED_NATIVE_SECTION_KEYS.includes(sectionKey),
    inNavigation: ['hero', 'projects', 'calculator', 'contact'].includes(sectionKey),
    order,
    copy: { ...nativeCopy[sectionKey] },
    elements: [],
    appearance: { layout: 'one-column', spacing: 'comfortable', alignment: 'start', background: 'default', typography: 'brand', accent: 'forest', responsive: 'all' },
  })),
};

export function resolveWebsiteLayoutManagerConfig(
  versions: readonly { status: 'draft' | 'published' | 'archived'; config: WebsiteLayoutConfig }[],
): WebsiteLayoutConfig {
  const source = versions.find((version) => version.status === 'draft')
    ?? versions.find((version) => version.status === 'published');
  return source?.config ?? DEFAULT_WEBSITE_LAYOUT;
}

export function createStableId(prefix = 'section') {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${id}`.toLowerCase();
}

export function createTemplateSection(templateId: WebsiteTemplateId, order: number): WebsiteSection {
  const template = WEBSITE_TEMPLATES.find((item) => item.id === templateId);
  if (!template) throw new Error('unsupported_template');
  const id = createStableId('section');
  return {
    id,
    kind: 'template',
    templateId,
    label: template.label,
    anchorId: id,
    visible: true,
    inNavigation: false,
    order,
    copy: {},
    elements: template.defaultElements.map(seedToBlock),
    appearance: { layout: templateId === 'image-text' ? 'two-column' : 'grid', spacing: 'comfortable', alignment: 'start', background: 'default', typography: 'brand', accent: 'forest', responsive: 'all' },
  };
}

function seedToBlock(seed: WebsiteTemplateSeed): WebsiteBlock {
  const { children, ...fields } = seed;
  return {
    id: createStableId('block'),
    visible: true,
    ...fields,
    ...(children ? { children: children.map(seedToBlock) } : {}),
  };
}

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length || fromIndex === toIndex) return items;
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function moveBlock(blocks: WebsiteBlock[], activeId: string, overId: string): WebsiteBlock[] {
  return moveItem(blocks, blocks.findIndex((block) => block.id === activeId), blocks.findIndex((block) => block.id === overId));
}

export function createWebsiteBlock(type: WebsiteBlockType): WebsiteBlock {
  const copy: Record<WebsiteBlockType, Partial<WebsiteBlock>> = {
    eyebrow: { text: 'ახალი წარწერა' },
    heading: { text: 'ახალი სათაური' },
    subheading: { text: 'ქვესათაური' },
    paragraph: { text: 'დაამატეთ თქვენი ტექსტი.' },
    button: { label: 'დეტალების ნახვა', href: '#contact' },
    image: { alt: 'სექციის სურათი', src: '' },
    icon: { icon: 'sparkles' },
    divider: {},
    'feature-list': { title: 'უპირატესობები', children: [] },
    statistic: { value: '100%', label: 'მაჩვენებელი' },
    'gallery-item': { alt: 'გალერეის სურათი', src: '' },
    card: { title: 'ახალი ბარათი', text: 'მოკლე აღწერა.' },
    'content-group': { title: 'კონტენტის ჯგუფი', children: [] },
    'faq-item': { title: 'კითხვა', text: 'პასუხი' },
    testimonial: { text: 'კლიენტის შეფასება.', label: 'კლიენტი' },
    logo: { label: 'ბრენდის სახელი' },
    'call-to-action': { title: 'მზად ხართ დასაწყებად?', text: 'შემდეგი ნაბიჯი აქ იწყება.', label: 'დამიკავშირდით', href: '#contact' },
    'native-visibility': {},
  };
  return { id: createStableId('block'), type, visible: true, ...copy[type] };
}

export function updateNestedBlock(blocks: WebsiteBlock[], id: string, update: (block: WebsiteBlock) => WebsiteBlock): WebsiteBlock[] {
  return blocks.map((block) => block.id === id
    ? update(block)
    : { ...block, ...(block.children ? { children: updateNestedBlock(block.children, id, update) } : {}) });
}

export function moveNestedBlock(blocks: WebsiteBlock[], id: string, direction: -1 | 1): WebsiteBlock[] {
  const index = blocks.findIndex((block) => block.id === id);
  if (index >= 0) return moveItem(blocks, index, index + direction);
  return blocks.map((block) => block.children
    ? { ...block, children: moveNestedBlock(block.children, id, direction) }
    : block);
}

export function removeNestedBlock(blocks: WebsiteBlock[], id: string): WebsiteBlock[] {
  return blocks.filter((block) => block.id !== id).map((block) => ({
    ...block,
    ...(block.children ? { children: removeNestedBlock(block.children, id) } : {}),
  }));
}

export function duplicateNestedBlock(blocks: WebsiteBlock[], id: string): WebsiteBlock[] {
  const result: WebsiteBlock[] = [];
  for (const block of blocks) {
    result.push(block);
    if (block.id === id) {
      result.push(cloneBlockWithNewIds(block));
    } else if (block.children?.some((child) => containsBlock(child, id))) {
      result[result.length - 1] = { ...block, children: duplicateNestedBlock(block.children, id) };
    }
  }
  return result;
}

function containsBlock(block: WebsiteBlock, id: string): boolean {
  return block.id === id || Boolean(block.children?.some((child) => containsBlock(child, id)));
}

function cloneBlockWithNewIds(block: WebsiteBlock): WebsiteBlock {
  return {
    ...block,
    id: createStableId('block'),
    ...(block.children ? { children: block.children.map(cloneBlockWithNewIds) } : {}),
  };
}

export function isSafeWebsiteLink(value: string) {
  const link = value.trim();
  return link.length <= 2048 && (
    /^https:\/\/[a-z0-9.-]+(?::\d+)?(?:[/?#][^\s]*)?$/i.test(link)
    || /^#[a-z0-9-]+$/i.test(link)
    || /^\/(?!\/)(?!.*\.\.)[a-z0-9/_-]*(?:[?#][^\s]*)?$/i.test(link)
    || /^(mailto|tel):[^\s]+$/i.test(link)
  );
}

export function isSafeWebsiteImage(value: string) {
  const source = value.trim();
  if (!source) return true;
  if (/^asset:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(source)) return true;
  return /^https:\/\/[a-z0-9.-]+(?::\d+)?(?:[/?#][^\s]*)?$/i.test(source);
}

const COPY_KEYS: Record<NativeSectionKey, string[]> = {
  hero: ['eyebrow', 'titleLine1', 'titleLine2', 'titleLine3', 'description', 'primaryButtonLabel', 'imageAlt', 'featuredLabel', 'heroImageSrc'],
  about: ['eyebrow', 'titleLine1', 'titleLine2', 'profileName', 'role', 'profileDescription', 'featureOneTitle', 'featureOneText', 'featureTwoTitle', 'featureTwoText', 'skillsTitle', 'skillsDescription', 'statsExperienceValue', 'statsExperienceLabel', 'statsProjectsValue', 'statsProjectsLabel', 'statsSuccessValue', 'statsSuccessLabel', 'skillCategoryLabel', 'skillOneName', 'skillOneLevel', 'skillTwoName', 'skillTwoLevel', 'skillsQuote'],
  projects: ['eyebrow', 'title', 'description', 'buttonLabel', 'categoryLabel'],
  'brief-studio': ['eyebrow', 'title', 'description'],
  calculator: [],
  contact: ['eyebrow', 'title', 'description', 'channelsTitle', 'cardTitleLead', 'cardTitleAccentOne', 'cardTitleMiddle', 'cardTitleAccentTwo', 'cardTitleEnd', 'contactCardDescription', 'emailLabel', 'contactEmail', 'whatsappLabel', 'whatsappNumber', 'workingHoursLabel', 'workingHours', 'signature', 'formNameLabel', 'formNamePlaceholder', 'formEmailLabel', 'formEmailPlaceholder', 'formSubjectLabel', 'formSubjectPlaceholder', 'formMessageLabel', 'formMessagePlaceholder', 'formNote', 'formButtonLabel'],
  'closing-scene': ['titleLine1', 'titleAccent'],
  'site-footer': ['role', 'copyright'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function validBlock(block: unknown, depth: number, ids: Set<string>): block is WebsiteBlock {
  if (!isRecord(block) || depth > 3) return false;
  const allowedKeys = new Set(['id', 'type', 'visible', 'title', 'text', 'label', 'href', 'src', 'alt', 'value', 'icon', 'children', 'target', 'position']);
  if (Object.keys(block).some((key) => !allowedKeys.has(key))) return false;
  if (typeof block.id !== 'string' || !/^[a-z0-9][a-z0-9-]{2,100}$/i.test(block.id) || ids.has(block.id)) return false;
  if (typeof block.type !== 'string' || !WEBSITE_BLOCK_TYPES.includes(block.type as WebsiteBlockType) || typeof block.visible !== 'boolean') return false;
  ids.add(block.id);
  for (const key of ['title', 'text', 'label', 'value', 'alt'] as const) {
    if (block[key] !== undefined && (typeof block[key] !== 'string' || block[key].length > (key === 'text' ? 3000 : 500))) return false;
  }
  if (block.href !== undefined && (typeof block.href !== 'string' || !isSafeWebsiteLink(block.href))) return false;
  if (block.src !== undefined && (typeof block.src !== 'string' || !isSafeWebsiteImage(block.src))) return false;
  if (block.icon !== undefined && !['sparkles', 'palette', 'layers', 'check', 'arrow', 'star', 'quote', 'clock'].includes(String(block.icon))) return false;
  if (block.target !== undefined && (depth !== 0 || typeof block.target !== 'string' || !NATIVE_ELEMENT_SLOT_IDS.includes(block.target as typeof NATIVE_ELEMENT_SLOT_IDS[number]))) return false;
  if (block.position !== undefined && (depth !== 0 || !['before', 'after', 'replace'].includes(String(block.position)))) return false;
  if (block.type === 'native-visibility') {
    if (depth !== 0 || !block.target || block.position !== undefined
      || block.visible !== false
      || !NATIVE_ELEMENT_SLOT_IDS.includes(block.target as typeof NATIVE_ELEMENT_SLOT_IDS[number])
      || block.title !== undefined || block.text !== undefined || block.label !== undefined
      || block.href !== undefined || block.src !== undefined || block.alt !== undefined || block.value !== undefined
      || block.icon !== undefined || block.children !== undefined) return false;
  } else if ((block.target === undefined) !== (block.position === undefined)) {
    return false;
  }
  if (block.children === undefined) return true;
  if (!['card', 'content-group', 'feature-list'].includes(String(block.type))
    || !Array.isArray(block.children) || block.children.length > 30 || depth >= 3) return false;
  return block.children.every((child) => validBlock(child, depth + 1, ids));
}

// Slots removed from the site. Saved layouts may still reference them, so loaders drop
// those references before validation instead of rejecting the whole layout.
const RETIRED_NATIVE_SLOT_IDS = new Set(['projects.eyebrow', 'projects.featured-work']);

/**
 * Brings a saved layout in line with removed parts of the site before validation:
 * drops blocks targeting retired slots, and turns retired sections into hidden,
 * empty placeholders ordered after every other section.
 */
export function dropRetiredLayoutContent(input: unknown): unknown {
  if (!isRecord(input) || !Array.isArray(input.sections)) return input;
  const sections = input.sections.map((section) => {
    if (!isRecord(section)) return section;
    if (isRetiredNativeSection({ sectionKey: typeof section.sectionKey === 'string' ? section.sectionKey : undefined })) {
      return { ...section, visible: false, inNavigation: false, elements: [] };
    }
    if (!Array.isArray(section.elements)) return section;
    return { ...section, elements: section.elements.filter((block) => !(isRecord(block) && typeof block.target === 'string' && RETIRED_NATIVE_SLOT_IDS.has(block.target))) };
  });
  if (!sections.every((section) => isRecord(section) && typeof section.order === 'number')) return { ...input, sections };
  const records = sections as Record<string, unknown>[];
  const ordered = [...records].sort((a, b) => (a.order as number) - (b.order as number));
  const isRetired = (section: Record<string, unknown>) => isRetiredNativeSection({ sectionKey: typeof section.sectionKey === 'string' ? section.sectionKey : undefined });
  const orderById = new Map([...ordered.filter((section) => !isRetired(section)), ...ordered.filter(isRetired)].map((section, order) => [section, order]));
  return { ...input, sections: records.map((section) => ({ ...section, order: orderById.get(section) })) };
}

export function validateWebsiteLayout(input: unknown): input is WebsiteLayoutConfig {
  if (!isRecord(input) || input.schemaVersion !== 1 || !Array.isArray(input.sections) || input.sections.length < NATIVE_SECTION_KEYS.length || input.sections.length > 30) return false;
  if (Object.keys(input).some((key) => !['schemaVersion', 'sections'].includes(key))) return false;
  const sectionIds = new Set<string>();
  const anchorIds = new Set<string>();
  const orders = new Set<number>();
  const nativeKeys = new Set<string>();
  for (const raw of input.sections) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !/^[a-z0-9][a-z0-9-]{2,100}$/i.test(raw.id) || sectionIds.has(raw.id)) return false;
    if (Object.keys(raw).some((key) => !['id', 'kind', 'sectionKey', 'templateId', 'label', 'anchorId', 'visible', 'inNavigation', 'order', 'copy', 'elements', 'appearance'].includes(key))) return false;
    sectionIds.add(raw.id);
    if (typeof raw.kind !== 'string' || !['native', 'template'].includes(raw.kind)) return false;
    if (typeof raw.label !== 'string' || raw.label.trim().length < 1 || raw.label.length > 120) return false;
    if (typeof raw.anchorId !== 'string' || !/^[a-z][a-z0-9-]{1,63}$/i.test(raw.anchorId) || anchorIds.has(raw.anchorId)) return false;
    anchorIds.add(raw.anchorId);
    if (typeof raw.visible !== 'boolean' || typeof raw.inNavigation !== 'boolean' || typeof raw.order !== 'number' || !Number.isInteger(raw.order) || orders.has(raw.order)) return false;
    orders.add(raw.order);
    if (!isRecord(raw.copy) || !Array.isArray(raw.elements) || raw.elements.length > 30 || !isRecord(raw.appearance)) return false;
    if (!['one-column', 'two-column', 'grid'].includes(String(raw.appearance.layout))
      || !['compact', 'comfortable', 'spacious'].includes(String(raw.appearance.spacing))
      || !['start', 'center'].includes(String(raw.appearance.alignment))
      || !['default', 'soft', 'dark'].includes(String(raw.appearance.background))
      || !['brand', 'editorial', 'compact'].includes(String(raw.appearance.typography))
      || !['forest', 'copper', 'neutral'].includes(String(raw.appearance.accent))
      || !['all', 'desktop', 'mobile'].includes(String(raw.appearance.responsive))
      || Object.keys(raw.appearance).some((key) => !['layout', 'spacing', 'alignment', 'background', 'typography', 'accent', 'responsive'].includes(key))) return false;
    if (raw.kind === 'native') {
      if (typeof raw.sectionKey !== 'string' || !NATIVE_SECTION_KEYS.includes(raw.sectionKey as NativeSectionKey)
        || raw.id !== raw.sectionKey || raw.templateId !== undefined) return false;
      const nativeAnchor = raw.sectionKey === 'hero' ? 'home' : raw.sectionKey;
      if (raw.anchorId !== nativeAnchor) return false;
      nativeKeys.add(raw.sectionKey);
      const allowedCopyKeys = COPY_KEYS[raw.sectionKey as NativeSectionKey];
      if (Object.keys(raw.copy).some((key) => !allowedCopyKeys.includes(key))) return false;
    } else if (typeof raw.templateId !== 'string' || !WEBSITE_TEMPLATE_IDS.includes(raw.templateId as WebsiteTemplateId) || raw.sectionKey !== undefined
      || (raw.appearance.responsive !== 'all' && raw.inNavigation)) {
      return false;
    } else if (Object.keys(raw.copy).length > 0) {
      return false;
    }
    if (Object.values(raw.copy).some((value) => typeof value !== 'string' || value.length > 3000)) return false;
    if (raw.sectionKey === 'hero' && raw.copy.heroImageSrc !== undefined
      && (typeof raw.copy.heroImageSrc !== 'string' || !isSafeWebsiteImage(raw.copy.heroImageSrc))) return false;
    if (raw.sectionKey === 'about') {
      for (const key of ['skillOneLevel', 'skillTwoLevel'] as const) {
        const level = raw.copy[key];
        if (level !== undefined && (typeof level !== 'string' || !/^\d{1,3}$/.test(level) || Number(level) < 1 || Number(level) > 100)) return false;
      }
      for (const key of ['statsExperienceValue', 'statsProjectsValue', 'statsSuccessValue'] as const) {
        const value = raw.copy[key];
        if (value !== undefined && (typeof value !== 'string' || !/^\d{1,4}(?:\+|%)?$/.test(value))) return false;
      }
    }
    if (raw.sectionKey === 'contact') {
      const email = raw.copy.contactEmail;
      const phone = raw.copy.whatsappNumber;
      if (email !== undefined && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return false;
      if (phone !== undefined && (typeof phone !== 'string' || !/^\d{7,15}$/.test(phone))) return false;
    }
    const blockIds = new Set<string>();
    if (!raw.elements.every((block) => validBlock(block, 0, blockIds))) return false;
    if (raw.kind === 'template' && raw.elements.some((block) => isRecord(block) && (block.target !== undefined || block.type === 'native-visibility'))) return false;
    if (raw.kind === 'native' && raw.elements.some((block) => isRecord(block) && block.target !== undefined
      && (block.type === 'native-visibility'
        ? !canHideNativeElement(raw.sectionKey as NativeSectionKey, String(block.target))
        : !isNativeElementTypeAllowed(raw.sectionKey as NativeSectionKey, String(block.target), String(block.type))))) return false;
  }
  return NATIVE_SECTION_KEYS.every((key) => nativeKeys.has(key))
    && input.sections.some((section) => isRecord(section) && section.visible === true);
}

export function sortWebsiteSections(config: WebsiteLayoutConfig) {
  return [...config.sections].sort((a, b) => a.order - b.order);
}

export function getWebsiteNavigationSections(config: WebsiteLayoutConfig) {
  return sortWebsiteSections(config).filter((section) => section.visible && section.inNavigation
    && (section.kind === 'native' || section.appearance.responsive === 'all'));
}

export function normalizeWebsiteSectionOrder(sections: WebsiteSection[]) {
  return sections.map((section, order) => ({ ...section, order }));
}
