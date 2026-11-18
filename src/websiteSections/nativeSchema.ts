import type { NativeSectionKey, WebsiteBlock, WebsiteBlockType, WebsiteSection } from './model';

export interface NativeElementDefinition {
  id: string;
  label: string;
  description: string;
  copyKeys: string[];
  canHide: boolean;
  allowedInsertions: WebsiteBlockType[];
}

const textAndMedia: WebsiteBlockType[] = [
  'eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider',
  'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item',
  'testimonial', 'logo', 'call-to-action',
];
const textOnly: WebsiteBlockType[] = ['eyebrow', 'heading', 'subheading', 'paragraph'];
const copyOnly: WebsiteBlockType[] = [];

const definitions: Record<NativeSectionKey, NativeElementDefinition[]> = {
  hero: [
    { id: 'hero.eyebrow', label: 'მცირე წარწერა', description: 'მთავარი სათაურის ზემოთ', copyKeys: ['eyebrow'], canHide: true, allowedInsertions: textAndMedia },
    { id: 'hero.title', label: 'მთავარი ფრაზა', description: 'ორი სტრიქონი და ცვალებადი სიტყვები („/“-ით)', copyKeys: ['titleLine1', 'titleLine2', 'titleLine3'], canHide: true, allowedInsertions: textOnly },
    { id: 'hero.description', label: 'აღწერა', description: 'მთავარი გვერდის შესავალი ტექსტი', copyKeys: ['description'], canHide: true, allowedInsertions: textAndMedia },
    { id: 'hero.primary-action', label: 'მთავარი ღილაკი', description: 'კატალოგზე გადასვლის ღილაკი', copyKeys: ['primaryButtonLabel'], canHide: true, allowedInsertions: ['button', 'eyebrow', 'paragraph'] },
    { id: 'hero.artwork', label: 'მთავარი ნამუშევარი', description: 'პორტფოლიოს სურათი', copyKeys: ['heroImageSrc', 'imageAlt'], canHide: false, allowedInsertions: ['image', 'gallery-item', 'eyebrow', 'paragraph'] },
    { id: 'hero.featured-label', label: 'ნამუშევრის წარწერა', description: 'სურათზე განთავსებული მოკლე წარწერა', copyKeys: ['featuredLabel'], canHide: true, allowedInsertions: ['eyebrow', 'paragraph', 'button'] },
    { id: 'hero.social-links', label: 'სოციალური ბმულები', description: 'Facebook, WhatsApp და ელფოსტა', copyKeys: [], canHide: false, allowedInsertions: copyOnly },
  ],
  // Retired section: kept only so saved layouts keep validating (see RETIRED_NATIVE_SECTION_KEYS).
  about: [],
  projects: [
    { id: 'projects.title', label: 'სათაური', description: 'პორტფოლიოს სათაური', copyKeys: ['title'], canHide: true, allowedInsertions: textOnly },
    { id: 'projects.description', label: 'აღწერა', description: 'პორტფოლიოს მოკლე აღწერა', copyKeys: ['description'], canHide: true, allowedInsertions: textAndMedia },
    { id: 'projects.catalog-button', label: 'კატალოგის ღილაკი', description: 'სრულ კატალოგზე გადასვლა', copyKeys: ['buttonLabel'], canHide: true, allowedInsertions: ['button', 'eyebrow', 'paragraph'] },
    { id: 'projects.category-label', label: 'კატეგორიის წარწერა', description: 'კატეგორიის ბარათების ზემოთ', copyKeys: ['categoryLabel'], canHide: true, allowedInsertions: textAndMedia },
    { id: 'projects.category-cards', label: 'კატეგორიის ბარათები', description: 'აქტიური კატეგორიები და პროექტების რაოდენობა', copyKeys: [], canHide: false, allowedInsertions: copyOnly },
  ],
  // Retired section: kept only so saved layouts keep validating (see RETIRED_NATIVE_SECTION_KEYS).
  'brief-studio': [],
  calculator: [
    { id: 'calculator.eyebrow', label: 'მცირე წარწერა', description: 'კალკულატორის კონფიგურაციიდან იმართება', copyKeys: [], canHide: true, allowedInsertions: textAndMedia },
    { id: 'calculator.title', label: 'სათაური', description: 'კალკულატორის კონფიგურაციიდან იმართება', copyKeys: [], canHide: true, allowedInsertions: textOnly },
    { id: 'calculator.description', label: 'აღწერა', description: 'კალკულატორის კონფიგურაციიდან იმართება', copyKeys: [], canHide: true, allowedInsertions: textAndMedia },
    { id: 'calculator.widget', label: 'ფასის კალკულატორი', description: 'ინტერაქტიული ფორმულა და სერვისები; ცალკე მართვის განყოფილება', copyKeys: [], canHide: false, allowedInsertions: copyOnly },
  ],
  contact: [
    { id: 'contact.eyebrow', label: 'მცირე წარწერა', description: 'კონტაქტის სათაურის ზემოთ', copyKeys: ['eyebrow'], canHide: true, allowedInsertions: textAndMedia },
    { id: 'contact.title', label: 'სათაური', description: 'თანამშრომლობის სათაური', copyKeys: ['title'], canHide: true, allowedInsertions: textOnly },
    { id: 'contact.description', label: 'აღწერა', description: 'საკონტაქტო შესავალი ტექსტი', copyKeys: ['description'], canHide: true, allowedInsertions: textAndMedia },
    { id: 'contact.channels', label: 'საკონტაქტო არხები', description: 'ელფოსტა, WhatsApp და სამუშაო საათები', copyKeys: ['channelsTitle', 'cardTitleLead', 'cardTitleAccentOne', 'cardTitleMiddle', 'cardTitleAccentTwo', 'cardTitleEnd', 'contactCardDescription', 'emailLabel', 'contactEmail', 'whatsappLabel', 'whatsappNumber', 'workingHoursLabel', 'workingHours', 'signature'], canHide: false, allowedInsertions: copyOnly },
    { id: 'contact.form', label: 'საკონტაქტო ფორმა', description: 'ველები და WhatsApp შეტყობინების ფორმირება', copyKeys: ['formNameLabel', 'formNamePlaceholder', 'formEmailLabel', 'formEmailPlaceholder', 'formSubjectLabel', 'formSubjectPlaceholder', 'formMessageLabel', 'formMessagePlaceholder', 'formNote', 'formButtonLabel'], canHide: false, allowedInsertions: copyOnly },
  ],
  'closing-scene': [
    { id: 'closing-scene.title', label: 'ფინალური სათაური', description: 'ფინალური ვიზუალური სცენის ტექსტი', copyKeys: ['titleLine1', 'titleAccent'], canHide: true, allowedInsertions: textOnly },
    { id: 'closing-scene.animation', label: 'ანიმაციური სცენა', description: 'ინტერაქტიული canvas სცენა', copyKeys: [], canHide: false, allowedInsertions: copyOnly },
  ],
  'site-footer': [
    { id: 'site-footer.brand', label: 'ბრენდის წარწერა', description: 'ლოგო და პროფესიის ტექსტი', copyKeys: ['role'], canHide: false, allowedInsertions: copyOnly },
    { id: 'site-footer.copyright', label: 'საავტორო ტექსტი', description: 'Footer-ის ქვედა ტექსტი', copyKeys: ['copyright'], canHide: true, allowedInsertions: textAndMedia },
  ],
};

export const NATIVE_ELEMENT_DEFINITIONS = definitions;
export const NATIVE_ELEMENT_SLOT_IDS = Object.values(definitions).flatMap((items) => items.map((item) => item.id));

export function getNativeElementDefinitions(sectionKey: NativeSectionKey) {
  return definitions[sectionKey];
}

export function getNativeElementDefinition(sectionKey: NativeSectionKey, id: string) {
  return definitions[sectionKey].find((item) => item.id === id);
}

export function canHideNativeElement(sectionKey: NativeSectionKey, id: string) {
  return definitions[sectionKey].some((item) => item.id === id && item.canHide);
}

export function isNativeElementTypeAllowed(sectionKey: NativeSectionKey, slotId: string, type: string) {
  return definitions[sectionKey].some((slot) => slot.id === slotId && slot.allowedInsertions.includes(type as WebsiteBlockType));
}

export function isNativeElementVisible(section: WebsiteSection, slotId: string) {
  const hidden = section.elements.some((item) => item.type === 'native-visibility' && item.target === slotId && !item.visible);
  const replaced = section.elements.some((item) => item.target === slotId && item.position === 'replace' && item.visible);
  return !hidden && !replaced;
}

export function setNativeElementVisibility(section: WebsiteSection, slotId: string, visible: boolean, markerId: string): WebsiteSection {
  if (visible) {
    return {
      ...section,
      elements: section.elements
        .filter((item) => !(item.type === 'native-visibility' && item.target === slotId))
        .map((item) => item.target === slotId && item.position === 'replace' ? { ...item, position: 'after' as const } : item),
    };
  }
  if (section.elements.some((item) => item.type === 'native-visibility' && item.target === slotId)) return section;
  return { ...section, elements: [...section.elements, { id: markerId, type: 'native-visibility', visible: false, target: slotId }] };
}

export function insertNativeElement(section: WebsiteSection, slotId: string, block: WebsiteBlock, position: NonNullable<WebsiteBlock['position']>): WebsiteSection {
  return { ...section, elements: [...section.elements, { ...block, target: slotId, position }] };
}
