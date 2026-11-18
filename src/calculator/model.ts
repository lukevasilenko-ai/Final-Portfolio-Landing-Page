export type Pricing =
  | { type: 'range'; min: number; max: number }
  | { type: 'fixed'; amount: number }
  | { type: 'per_item'; amount: number };

export interface CalculatorGroup {
  id: string;
  label: string;
  icon: 'calculator' | 'printer' | 'sparkles' | 'layers';
  enabled: boolean;
  order: number;
}

export interface CalculatorDiscount {
  minimumQuantity: number;
  percent: number;
}

export interface CalculatorExtra {
  id: string;
  label: string;
  enabled: boolean;
  amount: number;
  billing: 'fixed' | 'per_item';
  includedInRush: boolean;
}

export type CalculatorControlGroup = 'quantity' | 'changes' | 'options';

export interface CalculatorService {
  id: string;
  groupId: string;
  label: string;
  note: string;
  enabled: boolean;
  order: number;
  controlsOrder: CalculatorControlGroup[];
  pricing: Pricing;
  quantity: { enabled: boolean; min: number; max: number; label: string };
  changes?: { enabled: boolean; min: number; max: number; amountPerChange: number; label: string };
  rush: { enabled: boolean; percent: number; label: string };
  discounts: CalculatorDiscount[];
  extras: CalculatorExtra[];
}

export interface CalculatorPackage {
  id: string;
  name: string;
  price: number;
  summary: string;
  features: string[];
  extraChange: string;
  note: string;
  enabled: boolean;
  popular: boolean;
  accent: 'copper' | 'accent' | 'plum';
  order: number;
}

export interface CalculatorConfig {
  schemaVersion: 1;
  enabled: boolean;
  copy: {
    eyebrow: string;
    title: string;
    description: string;
    groupsLabel: string;
    estimateEyebrow: string;
    estimateLabel: string;
    templateEstimateDescription: string;
    estimateDescription: string;
    categoryLabel: string;
    designCategory: string;
    serviceLabel: string;
    quantityLabel: string;
    changesLabel: string;
    oneChangeLabel: string;
    rushLabel: string;
    resultButton: string;
    templateInfo: string;
    extraSizesLabel: string;
    packagesEyebrow: string;
    packagesTitle: string;
    packagesDescription: string;
    packageFeaturesLabel: string;
    popularLabel: string;
    packageButton: string;
    monthlyLabel: string;
  };
  groups: CalculatorGroup[];
  services: CalculatorService[];
  packages: CalculatorPackage[];
  roundingIncrement: number;
  appearance: {
    layout: 'split' | 'stacked';
    serviceColumns: 'responsive' | 'two' | 'three';
    palette: 'brand' | 'copper' | 'plum';
    typography: 'brand' | 'compact';
  };
}

export interface CalculatorInput {
  serviceId: string;
  quantity: number;
  changes: number;
  rush: boolean;
  selectedExtras: string[];
}

export interface Estimate {
  min: number;
  max: number;
}

const commonQuantity = { enabled: true, min: 1, max: 10, label: 'რაოდენობა' } as const;
const defaultControlsOrder: CalculatorControlGroup[] = ['quantity', 'changes', 'options'];
const noDiscounts: CalculatorDiscount[] = [];

export const DEFAULT_CALCULATOR_CONFIG: CalculatorConfig = {
  schemaVersion: 1,
  enabled: true,
  copy: {
    eyebrow: '05 // ფასის კალკულატორი',
    title: 'დათვალეთ სავარაუდო ბიუჯეტი.',
    description: 'აირჩიეთ დიზაინის მომსახურება ან საბეჭდი მასალა და მიუთითეთ საჭირო პარამეტრები.',
    groupsLabel: 'მომსახურების ტიპი',
    estimateEyebrow: 'შეფასება',
    estimateLabel: 'სავარაუდო დიაპაზონი',
    templateEstimateDescription: 'შაბლონურ პოსტერზე ფასი ითვლება ფორმულით: დიზაინი 140 ლარი + თითო ცვლილება 20 ლარი.',
    estimateDescription: 'ეს არის საორიენტაციო ფასი. ზუსტი ღირებულება დასტურდება ბრიფისა და სამუშაოს მოცულობის ნახვის შემდეგ.',
    categoryLabel: 'კატეგორია',
    designCategory: 'დიზაინი',
    serviceLabel: 'მომსახურება',
    quantityLabel: 'რაოდენობა',
    changesLabel: 'ცვლილებები',
    oneChangeLabel: '1 ცვლილება',
    rushLabel: 'სასწრაფო ვადა',
    resultButton: 'შეკვეთის განხილვა',
    templateInfo: 'ერთი შაბლონური პოსტერის დიზაინი ღირს 140 ლარი. თითო ცვლილება ემატება 20 ლარად; სასწრაფო ვადა და დამატებითი ზომები ცალკე ითვლება.',
    extraSizesLabel: 'დამატებითი ზომები (სთორი/ბანერი)',
    packagesEyebrow: 'ყოველთვიური მომსახურება',
    packagesTitle: 'სოციალური მედიის დიზაინის პაკეტები.',
    packagesDescription: 'აირჩიეთ სამუშაოს მოცულობაზე მორგებული ყოველთვიური პაკეტი და მიიღეთ ერთიანი ვიზუალური სტილი ყველა ფორმატში.',
    packageFeaturesLabel: 'პაკეტში შედის:',
    popularLabel: 'ყველაზე მოთხოვნადი',
    packageButton: 'პაკეტის არჩევა',
    monthlyLabel: '/ თვე',
  },
  groups: [
    { id: 'design', label: 'დიზაინის მომსახურება', icon: 'calculator', enabled: true, order: 0 },
    { id: 'print', label: 'საბეჭდი მასალა', icon: 'printer', enabled: true, order: 1 },
  ],
  services: [
    {
      id: 'poster', groupId: 'design', label: 'პოსტერი', note: 'ერთი პოსტერის დიზაინი: 100-130 ლარი', enabled: true, order: 0, controlsOrder: [...defaultControlsOrder],
      pricing: { type: 'range', min: 100, max: 130 }, quantity: { ...commonQuantity },
      rush: { enabled: true, percent: 20, label: 'სასწრაფო ვადა' },
      discounts: [{ minimumQuantity: 3, percent: 8 }, { minimumQuantity: 6, percent: 12 }],
      extras: [{ id: 'extra-sizes', label: 'დამატებითი ზომები (სთორი/ბანერი)', enabled: true, amount: 15, billing: 'per_item', includedInRush: false }],
    },
    {
      id: 'cover', groupId: 'design', label: 'ქავერი', note: 'Facebook, YouTube, LinkedIn ან სხვა პლატფორმისთვის', enabled: true, order: 1, controlsOrder: [...defaultControlsOrder],
      pricing: { type: 'range', min: 70, max: 100 }, quantity: { ...commonQuantity },
      rush: { enabled: true, percent: 20, label: 'სასწრაფო ვადა' }, discounts: [{ minimumQuantity: 3, percent: 8 }, { minimumQuantity: 6, percent: 12 }],
      extras: [{ id: 'extra-sizes', label: 'დამატებითი ზომები (სთორი/ბანერი)', enabled: true, amount: 15, billing: 'per_item', includedInRush: false }],
    },
    {
      id: 'templatePoster', groupId: 'design', label: 'შაბლონური პოსტერი', note: 'დიზაინი 140 ლარი, თითო ცვლილება 20 ლარი', enabled: true, order: 2, controlsOrder: [...defaultControlsOrder],
      pricing: { type: 'fixed', amount: 140 }, quantity: { enabled: false, min: 1, max: 1, label: 'რაოდენობა' },
      changes: { enabled: true, min: 0, max: 20, amountPerChange: 20, label: 'ცვლილებების რაოდენობა' },
      rush: { enabled: true, percent: 20, label: 'სასწრაფო ვადა' }, discounts: noDiscounts,
      extras: [{ id: 'extra-sizes', label: 'დამატებითი ზომები (სთორი/ბანერი)', enabled: true, amount: 15, billing: 'per_item', includedInRush: true }],
    },
    {
      id: 'businessCards', groupId: 'print', label: 'სავიზიტო ბარათები', note: 'დიზაინის სტანდარტული ფასი: 50-70 ლარი', enabled: true, order: 0, controlsOrder: [...defaultControlsOrder],
      pricing: { type: 'range', min: 50, max: 70 }, quantity: { ...commonQuantity },
      rush: { enabled: true, percent: 20, label: 'სასწრაფო ვადა' }, discounts: [{ minimumQuantity: 3, percent: 8 }, { minimumQuantity: 6, percent: 12 }], extras: [],
    },
    {
      id: 'googleReviewSet', groupId: 'print', label: 'Google Review Set', note: 'დიზაინის სტანდარტული ფასი: 150-250 ლარი', enabled: true, order: 1, controlsOrder: [...defaultControlsOrder],
      pricing: { type: 'range', min: 150, max: 250 }, quantity: { ...commonQuantity },
      rush: { enabled: true, percent: 20, label: 'სასწრაფო ვადა' }, discounts: [{ minimumQuantity: 3, percent: 8 }, { minimumQuantity: 6, percent: 12 }], extras: [],
    },
  ],
  packages: [
    {
      id: 'starter', name: 'Starter', price: 600, summary: '4-5 სოციალური მედიის დიზაინი', accent: 'copper', enabled: true, popular: false, order: 0,
      features: ['პოსტერები სოციალური მედიისთვის', 'დამატებითი ზომების მომზადება', 'Story ან Banner დიზაინი', 'ბრენდის სტილის დაცვა', '1 უფასო ცვლილება თითო დიზაინზე', 'საბოლოო ფაილების მომზადება გამოსაყენებლად'],
      extraChange: 'დამატებითი ცვლილება პოსტერზე - 20 ₾', note: '',
    },
    {
      id: 'business', name: 'Business', price: 1000, summary: '7-8 სოციალური მედიის დიზაინი', accent: 'accent', enabled: true, popular: true, order: 1,
      features: ['პოსტერები სოციალური მედიისთვის', 'დამატებითი ზომების მომზადება', 'Story და Banner დიზაინები', 'სარეკლამო ვიზუალები', 'ბრენდის ერთიანი ვიზუალური სტილის დაცვა', '1 ცვლილება თითო დიზაინზე', 'საბოლოო ფაილების მომზადება'],
      extraChange: 'დამატებითი ცვლილება - 20 ₾', note: '',
    },
    {
      id: 'premium', name: 'Premium', price: 1700, summary: '10-11 სოციალური მედიის დიზაინი', accent: 'plum', enabled: true, popular: false, order: 2,
      features: ['პოსტერები სოციალური მედიისთვის', 'დამატებითი ზომების მომზადება', 'Story და Banner დიზაინები', 'სარეკლამო ვიზუალები', 'Google Review დიზაინების ნაკრები', 'სავიზიტო ბარათის დიზაინი', 'ბრენდის ერთიანი ვიზუალური სტილის დაცვა', '1 ცვლილება თითო დიზაინზე', 'საბოლოო ფაილების მომზადება ციფრული და საბეჭდი გამოყენებისთვის'],
      extraChange: 'დამატებითი ცვლილება - 20 ₾', note: 'სავიზიტო ბარათის ბეჭდვის ღირებულება პაკეტში არ შედის.',
    },
  ],
  roundingIncrement: 5,
  appearance: { layout: 'split', serviceColumns: 'responsive', palette: 'brand', typography: 'brand' },
};

export function cloneCalculatorConfig(config: CalculatorConfig): CalculatorConfig {
  return structuredClone(config);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown, max = 500): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const isNumber = (value: unknown, min = 0, max = 100000): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const isInteger = (value: unknown, min = 0, max = 100000): value is number =>
  isNumber(value, min, max) && Number.isInteger(value);
const isId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value);

export function validateCalculatorConfig(value: unknown): value is CalculatorConfig {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.enabled !== 'boolean' || !isRecord(value.copy) || !Array.isArray(value.groups)
    || !Array.isArray(value.services) || !Array.isArray(value.packages) || !isRecord(value.appearance)) return false;
  const copyKeys = [
    'eyebrow', 'title', 'description', 'groupsLabel', 'estimateEyebrow', 'estimateLabel',
    'templateEstimateDescription', 'estimateDescription', 'categoryLabel', 'designCategory',
    'serviceLabel', 'quantityLabel', 'changesLabel', 'oneChangeLabel', 'rushLabel',
    'resultButton', 'templateInfo', 'extraSizesLabel', 'packagesEyebrow', 'packagesTitle',
    'packagesDescription', 'packageFeaturesLabel', 'popularLabel', 'packageButton', 'monthlyLabel',
  ];
  if (!copyKeys.every((key) => isText(value.copy[key], 1000))) return false;
  if (value.groups.length < 1 || value.groups.length > 20 || value.services.length < 1 || value.services.length > 100
    || value.packages.length > 30) return false;
  if (!isNumber(value.roundingIncrement, 1, 100)) return false;
  const groupIds = new Set<string>();
  for (const group of value.groups) {
    if (!isRecord(group) || !isId(group.id) || groupIds.has(group.id) || !isText(group.label, 120)
      || !['calculator', 'printer', 'sparkles', 'layers'].includes(String(group.icon))
      || typeof group.enabled !== 'boolean' || !isInteger(group.order, 0, 10000)) return false;
    groupIds.add(group.id);
  }
  const serviceIds = new Set<string>();
  for (const service of value.services) {
    if (!isRecord(service) || !isId(service.id) || serviceIds.has(service.id) || !groupIds.has(String(service.groupId))
      || !isText(service.label, 120) || typeof service.note !== 'string' || service.note.length > 1000
      || typeof service.enabled !== 'boolean' || !isInteger(service.order, 0, 10000)
      || !Array.isArray(service.controlsOrder) || service.controlsOrder.length !== 3
      || new Set(service.controlsOrder).size !== 3
      || service.controlsOrder.some((control) => !['quantity', 'changes', 'options'].includes(String(control)))
      || !isRecord(service.pricing) || !isRecord(service.quantity) || !isRecord(service.rush)
      || !Array.isArray(service.discounts) || service.discounts.length > 20
      || !Array.isArray(service.extras) || service.extras.length > 50) return false;
    serviceIds.add(service.id);
    const pricing = service.pricing;
    if (pricing.type === 'range') {
      if (!isNumber(pricing.min) || !isNumber(pricing.max) || pricing.min > pricing.max) return false;
    } else if (pricing.type === 'fixed' || pricing.type === 'per_item') {
      if (!isNumber(pricing.amount)) return false;
    } else return false;
    const quantity = service.quantity;
    if (typeof quantity.enabled !== 'boolean' || !isInteger(quantity.min, 1, 1000) || !isInteger(quantity.max, 1, 1000)
      || quantity.min > quantity.max || !isText(quantity.label, 120)) return false;
    if (service.pricing.type === 'fixed' && quantity.enabled) return false;
    if (typeof service.rush.enabled !== 'boolean' || !isNumber(service.rush.percent, 0, 500) || !isText(service.rush.label, 120)) return false;
    if (service.changes !== undefined) {
      if (!isRecord(service.changes) || typeof service.changes.enabled !== 'boolean'
        || !isInteger(service.changes.min, 0, 1000) || !isInteger(service.changes.max, 0, 1000)
        || service.changes.min > service.changes.max || !isNumber(service.changes.amountPerChange)
        || !isText(service.changes.label, 120)) return false;
    }
    let previousThreshold = 0;
    for (const discount of service.discounts) {
      if (!isRecord(discount) || !isInteger(discount.minimumQuantity, 1, 1000)
        || discount.minimumQuantity <= previousThreshold || !isNumber(discount.percent, 0, 100)) return false;
      previousThreshold = discount.minimumQuantity;
    }
    const extraIds = new Set<string>();
    for (const extra of service.extras) {
      if (!isRecord(extra) || !isId(extra.id) || extraIds.has(extra.id) || !isText(extra.label, 120)
        || typeof extra.enabled !== 'boolean' || !isNumber(extra.amount) || !['fixed', 'per_item'].includes(String(extra.billing))
        || typeof extra.includedInRush !== 'boolean') return false;
      extraIds.add(extra.id);
    }
  }
  const packageIds = new Set<string>();
  let popularPackages = 0;
  for (const item of value.packages) {
    if (!isRecord(item) || !isId(item.id) || packageIds.has(item.id) || !isText(item.name, 100)
      || !isNumber(item.price) || !isText(item.summary, 500) || !Array.isArray(item.features)
      || item.features.length > 50 || item.features.some((feature) => typeof feature !== 'string' || feature.length > 300)
      || typeof item.extraChange !== 'string' || item.extraChange.length > 300 || typeof item.note !== 'string' || item.note.length > 500
      || typeof item.enabled !== 'boolean' || typeof item.popular !== 'boolean'
      || !['copper', 'accent', 'plum'].includes(String(item.accent)) || !isInteger(item.order, 0, 10000)) return false;
    packageIds.add(item.id);
    if (item.popular) popularPackages += 1;
  }
  const visibleGroupIds = new Set(value.groups.filter((group) => isRecord(group) && group.enabled === true).map((group) => group.id));
  const hasVisibleService = value.services.some((service) => isRecord(service) && service.enabled === true && visibleGroupIds.has(service.groupId));
  return popularPackages <= 1 && hasVisibleService && ['split', 'stacked'].includes(String(value.appearance.layout))
    && ['responsive', 'two', 'three'].includes(String(value.appearance.serviceColumns))
    && ['brand', 'copper', 'plum'].includes(String(value.appearance.palette))
    && ['brand', 'compact'].includes(String(value.appearance.typography));
}

const roundTo = (value: number, increment: number) => Math.round(value / increment) * increment;

export function calculateEstimate(config: CalculatorConfig, input: CalculatorInput): Estimate {
  const service = config.services.find((item) => item.id === input.serviceId && item.enabled);
  if (!service) throw new Error('მომსახურება ვერ მოიძებნა ან გამორთულია.');
  const quantity = service.quantity.enabled
    ? Math.min(service.quantity.max, Math.max(service.quantity.min, Math.round(input.quantity)))
    : 1;
  const changes = service.changes?.enabled
    ? Math.min(service.changes.max, Math.max(service.changes.min, Math.round(input.changes)))
    : 0;
  const selectedExtras = new Set(input.selectedExtras);
  const baseMin = service.pricing.type === 'range' ? service.pricing.min : service.pricing.amount;
  const baseMax = service.pricing.type === 'range' ? service.pricing.max : service.pricing.amount;
  const multiplier = service.pricing.type === 'fixed' ? 1 : quantity;
  const discount = [...service.discounts]
    .filter((tier) => quantity >= tier.minimumQuantity)
    .sort((a, b) => b.minimumQuantity - a.minimumQuantity)[0]?.percent ?? 0;
  const discountedMin = baseMin * multiplier * (1 - discount / 100);
  const discountedMax = baseMax * multiplier * (1 - discount / 100);
  const changeCost = (service.changes?.enabled ? changes * service.changes.amountPerChange : 0);
  const extraFees = service.extras.filter((extra) => extra.enabled && selectedExtras.has(extra.id));
  const beforeRush = (minimum: number) => minimum + changeCost + extraFees
    .filter((extra) => extra.includedInRush)
    .reduce((sum, extra) => sum + extra.amount * (extra.billing === 'per_item' ? quantity : 1), 0);
  const afterRush = extraFees.filter((extra) => !extra.includedInRush)
    .reduce((sum, extra) => sum + extra.amount * (extra.billing === 'per_item' ? quantity : 1), 0);
  const rushFactor = input.rush && service.rush.enabled ? 1 + service.rush.percent / 100 : 1;
  return {
    min: roundTo(beforeRush(discountedMin) * rushFactor + afterRush, config.roundingIncrement),
    max: roundTo(beforeRush(discountedMax) * rushFactor + afterRush, config.roundingIncrement),
  };
}

export interface EstimateLine {
  id: string;
  label: string;
  /** Signed whole-lari amounts; base first. All lines add up exactly to `total`. */
  min: number;
  max: number;
}

export interface EstimateExplanation {
  lines: EstimateLine[];
  total: Estimate;
  discountPercent: number;
  /** The next quantity discount still to reach, if any. */
  nextDiscount: CalculatorDiscount | null;
}

/**
 * The same price as calculateEstimate, itemised: base × quantity, quantity discount, changes,
 * extras, rush, and a rounding line so the items always add up to the shown total.
 */
export function explainEstimate(config: CalculatorConfig, input: CalculatorInput): EstimateExplanation {
  const total = calculateEstimate(config, input);
  const service = config.services.find((item) => item.id === input.serviceId && item.enabled)!;
  const quantity = service.quantity.enabled
    ? Math.min(service.quantity.max, Math.max(service.quantity.min, Math.round(input.quantity)))
    : 1;
  const changes = service.changes?.enabled
    ? Math.min(service.changes.max, Math.max(service.changes.min, Math.round(input.changes)))
    : 0;
  const multiplier = service.pricing.type === 'fixed' ? 1 : quantity;
  const baseMin = (service.pricing.type === 'range' ? service.pricing.min : service.pricing.amount) * multiplier;
  const baseMax = (service.pricing.type === 'range' ? service.pricing.max : service.pricing.amount) * multiplier;
  const tiers = [...service.discounts].sort((a, b) => a.minimumQuantity - b.minimumQuantity);
  const discountPercent = [...tiers].reverse().find((tier) => quantity >= tier.minimumQuantity)?.percent ?? 0;
  const nextDiscount = service.quantity.enabled && service.pricing.type !== 'fixed'
    ? tiers.find((tier) => tier.minimumQuantity > quantity && tier.minimumQuantity <= service.quantity.max) ?? null
    : null;
  const raw: { id: string; label: string; min: number; max: number }[] = [
    { id: 'base', label: multiplier > 1 ? `${service.label} × ${quantity}` : service.label, min: baseMin, max: baseMax },
  ];
  if (discountPercent) raw.push({ id: 'discount', label: `ფასდაკლება ${discountPercent}%`, min: -baseMin * discountPercent / 100, max: -baseMax * discountPercent / 100 });
  const changeCost = service.changes?.enabled ? changes * service.changes.amountPerChange : 0;
  if (changeCost) raw.push({ id: 'changes', label: `${service.changes!.label || 'ცვლილებები'} × ${changes}`, min: changeCost, max: changeCost });
  const extras = service.extras.filter((extra) => extra.enabled && input.selectedExtras.includes(extra.id));
  const extraCost = (extra: CalculatorExtra) => extra.amount * (extra.billing === 'per_item' ? quantity : 1);
  for (const extra of extras) {
    raw.push({ id: `extra:${extra.id}`, label: extra.billing === 'per_item' && quantity > 1 ? `${extra.label} × ${quantity}` : extra.label, min: extraCost(extra), max: extraCost(extra) });
  }
  if (input.rush && service.rush.enabled) {
    const insideRush = extras.filter((extra) => extra.includedInRush).reduce((sum, extra) => sum + extraCost(extra), 0);
    const factor = service.rush.percent / 100;
    raw.push({
      id: 'rush',
      label: `${service.rush.label || 'სასწრაფო ვადა'} +${service.rush.percent}%`,
      min: (baseMin * (1 - discountPercent / 100) + changeCost + insideRush) * factor,
      max: (baseMax * (1 - discountPercent / 100) + changeCost + insideRush) * factor,
    });
  }
  const lines: EstimateLine[] = raw.map((line) => ({ ...line, min: Math.round(line.min), max: Math.round(line.max) }));
  const sum = (key: 'min' | 'max') => lines.reduce((value, line) => value + line[key], 0);
  const roundMin = total.min - sum('min');
  const roundMax = total.max - sum('max');
  if (roundMin || roundMax) lines.push({ id: 'rounding', label: 'დამრგვალება', min: roundMin, max: roundMax });
  return { lines, total, discountPercent, nextDiscount };
}
