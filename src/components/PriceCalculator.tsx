/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  Clock,
  Layers,
  Minus,
  Plus,
  Printer,
  Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';

type ServiceId =
  | 'poster'
  | 'cover'
  | 'templatePoster'
  | 'businessCards'
  | 'googleReviewSet'
  | 'stickers';

type ServiceGroup = 'design' | 'print';

interface Service {
  label: string;
  note: string;
  group: ServiceGroup;
  priceRange?: [number, number];
  template?: boolean;
  customPrice?: boolean;
  supportsExtraFormats?: boolean;
}

const services: Record<ServiceId, Service> = {
  poster: {
    label: 'პოსტერი',
    note: 'ერთი პოსტერის დიზაინი: 100-130 ლარი',
    group: 'design',
    priceRange: [100, 130],
    supportsExtraFormats: true
  },
  cover: {
    label: 'ქავერი',
    note: 'Facebook, YouTube, LinkedIn ან სხვა პლატფორმისთვის',
    group: 'design',
    priceRange: [70, 100],
    supportsExtraFormats: true
  },
  templatePoster: {
    label: 'შაბლონური პოსტერი',
    note: 'დიზაინი 100 ლარი, ყოველი ცვლილება 15 ლარი',
    group: 'design',
    template: true,
    supportsExtraFormats: true
  },
  businessCards: {
    label: 'სავიზიტო ბარათები',
    note: 'დიზაინის სტანდარტული ფასი: 50-70 ლარი',
    group: 'print',
    priceRange: [50, 70]
  },
  googleReviewSet: {
    label: 'Google Review Set',
    note: 'დიზაინის სტანდარტული ფასი: 150-250 ლარი',
    group: 'print',
    priceRange: [150, 250]
  },
  stickers: {
    label: 'სტიკერები',
    note: 'ფასი დამოკიდებულია ზომასა და ტირაჟზე',
    group: 'print',
    customPrice: true
  }
};

const serviceGroups: Array<{
  id: ServiceGroup;
  label: string;
  icon: typeof Calculator;
  items: ServiceId[];
}> = [
  {
    id: 'design',
    label: 'დიზაინის მომსახურება',
    icon: Calculator,
    items: ['poster', 'cover', 'templatePoster']
  },
  {
    id: 'print',
    label: 'საბეჭდი მასალები',
    icon: Printer,
    items: ['businessCards', 'googleReviewSet', 'stickers']
  }
];

const roundToFive = (value: number) => Math.round(value / 5) * 5;

export default function PriceCalculator() {
  const [service, setService] = useState<ServiceId>('poster');
  const [quantity, setQuantity] = useState(1);
  const [templateChanges, setTemplateChanges] = useState(0);
  const [rush, setRush] = useState(false);
  const [extraFormats, setExtraFormats] = useState(false);

  const selectedService = services[service];
  const isCustomPrice = Boolean(selectedService.customPrice);

  const estimate = useMemo(() => {
    if (selectedService.customPrice) return null;

    const rushMultiplier = rush ? 1.2 : 1;
    const extraFormatsFee = selectedService.supportsExtraFormats && extraFormats ? 15 * quantity : 0;

    if (selectedService.template) {
      const templateBase = 100 * quantity;
      const changesFee = templateChanges * 15;
      const total = roundToFive((templateBase + changesFee + extraFormatsFee) * rushMultiplier);

      return { min: total, max: total };
    }

    const base = selectedService.priceRange as [number, number];
    const quantityDiscount = quantity >= 6 ? 0.88 : quantity >= 3 ? 0.92 : 1;
    const min = roundToFive((base[0] * quantity * quantityDiscount * rushMultiplier) + extraFormatsFee);
    const max = roundToFive((base[1] * quantity * quantityDiscount * rushMultiplier) + extraFormatsFee);

    return { min, max };
  }, [extraFormats, quantity, rush, selectedService, templateChanges]);

  const quantityProgress = ((quantity - 1) / 9) * 100;
  const templateChangesProgress = (templateChanges / 20) * 100;
  const estimateLabel = estimate
    ? estimate.min === estimate.max
      ? `${estimate.min} ლარი`
      : `${estimate.min}-${estimate.max} ლარი`
    : 'ინდივიდუალური ფასი';

  const setQuantitySafely = (nextValue: number) => {
    setQuantity(Math.min(10, Math.max(1, nextValue)));
  };

  const setTemplateChangesSafely = (nextValue: number) => {
    setTemplateChanges(Math.min(20, Math.max(0, nextValue)));
  };

  return (
    <section id="calculator" className="section-wrap section-rule">
      <div className="container-xl">
        <div className="mb-12 flex max-w-3xl flex-col gap-5">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            05 // ფასის კალკულატორი
          </span>
          <h2 className="section-title">დათვალეთ სავარაუდო ბიუჯეტი.</h2>
          <p className="section-subtitle max-w-2xl">
            აირჩიეთ დიზაინის ან საბეჭდი მომსახურება და რაოდენობა. სტიკერების ფასი ზომისა და ტირაჟის მიხედვით ინდივიდუალურად განისაზღვრება.
          </p>
        </div>

        <div className="surface-card-strong grid grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col gap-8 p-6 sm:p-8">
            {serviceGroups.map((group) => {
              const GroupIcon = group.icon;

              return (
                <div key={group.id} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-[var(--brand-ink)]">
                    <GroupIcon
                      className={`h-4 w-4 ${group.id === 'print' ? 'text-[var(--brand-copper)]' : 'text-[var(--brand-accent)]'}`}
                    />
                    {group.label}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((item) => (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={service === item}
                        onClick={() => setService(item)}
                        className={`rounded-lg border px-4 py-4 text-left transition-colors ${
                          service === item
                            ? 'border-[var(--brand-accent)] bg-[rgba(36,72,61,0.1)] text-[var(--brand-ink)]'
                            : 'border-[var(--brand-line)] bg-white/55 text-[var(--brand-muted)] hover:bg-white'
                        }`}
                      >
                        <span className="block text-base font-bold">{services[item].label}</span>
                        <span className="mt-2 block text-sm leading-6">{services[item].note}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {!isCustomPrice && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-[var(--brand-ink)]">
                    <Layers className="h-4 w-4 text-[var(--brand-copper)]" />
                    რაოდენობა
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantitySafely(quantity - 1)}
                      className="icon-button h-9 w-9"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <motion.span
                      key={quantity}
                      initial={{ y: 8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="flex h-9 min-w-12 items-center justify-center rounded-lg border border-[var(--brand-line)] bg-white/60 font-mono text-sm font-bold text-[var(--brand-ink)]"
                    >
                      {quantity}
                    </motion.span>
                    <button
                      type="button"
                      onClick={() => setQuantitySafely(quantity + 1)}
                      className="icon-button h-9 w-9"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="smooth-range-wrap">
                  <motion.div
                    className="smooth-range-fill"
                    animate={{ width: `${quantityProgress}%` }}
                    transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  />
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={quantity}
                    onChange={(event) => setQuantitySafely(Number(event.target.value))}
                    className="smooth-range"
                    aria-label="Project quantity"
                  />
                </div>
              </div>
            )}

            {selectedService.template && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-[var(--brand-ink)]">
                    <Sparkles className="h-4 w-4 text-[var(--brand-plum)]" />
                    ცვლილებების რაოდენობა
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTemplateChangesSafely(templateChanges - 1)}
                      className="icon-button h-9 w-9"
                      aria-label="Decrease template changes"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <motion.span
                      key={templateChanges}
                      initial={{ y: 8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="flex h-9 min-w-12 items-center justify-center rounded-lg border border-[var(--brand-line)] bg-white/60 font-mono text-sm font-bold text-[var(--brand-ink)]"
                    >
                      {templateChanges}
                    </motion.span>
                    <button
                      type="button"
                      onClick={() => setTemplateChangesSafely(templateChanges + 1)}
                      className="icon-button h-9 w-9"
                      aria-label="Increase template changes"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="smooth-range-wrap">
                  <motion.div
                    className="smooth-range-fill"
                    animate={{ width: `${templateChangesProgress}%` }}
                    transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={templateChanges}
                    onChange={(event) => setTemplateChangesSafely(Number(event.target.value))}
                    className="smooth-range"
                    aria-label="Template changes quantity"
                  />
                </div>
                <p className="text-sm leading-7 text-[var(--brand-muted)]">
                  შაბლონური დიზაინის საბაზო ფასი არის 100 ლარი. თითო ცვლილება ემატება 15 ლარად.
                </p>
              </div>
            )}

            {isCustomPrice ? (
              <div className="rounded-lg border border-[var(--brand-line)] bg-white/55 p-5">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--brand-ink)]">
                  <Sparkles className="h-4 w-4 text-[var(--brand-plum)]" />
                  ინდივიდუალური გაანგარიშება
                </div>
                <p className="mt-2 text-sm leading-7 text-[var(--brand-muted)]">
                  სტიკერების საბოლოო ფასი ითვლება ზომის, ფორმის, მასალისა და ტირაჟის მიხედვით. მომწერეთ სასურველი პარამეტრები ზუსტი შეთავაზებისთვის.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRush((value) => !value)}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                    rush
                      ? 'border-[var(--brand-copper)] bg-[rgba(180,95,60,0.12)] text-[var(--brand-ink)]'
                      : 'border-[var(--brand-line)] bg-white/55 text-[var(--brand-muted)] hover:bg-white'
                  }`}
                >
                  <Clock className="h-4 w-4 shrink-0" />
                  სასწრაფო ვადა
                </button>

                {selectedService.supportsExtraFormats && (
                  <button
                    type="button"
                    onClick={() => setExtraFormats((value) => !value)}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                      extraFormats
                        ? 'border-[var(--brand-accent)] bg-[rgba(36,72,61,0.1)] text-[var(--brand-ink)]'
                        : 'border-[var(--brand-line)] bg-white/55 text-[var(--brand-muted)] hover:bg-white'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    დამატებითი ზომები (სთორი/ბანერი)
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between gap-8 border-t border-[var(--brand-line)] bg-[rgba(36,72,61,0.06)] p-6 sm:p-8 lg:border-l lg:border-t-0">
            <div className="flex flex-col gap-5">
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                შეფასება
              </span>
              <div className="flex flex-col gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-muted)]">
                  {isCustomPrice ? 'ზუსტი ფასი შეთანხმებით' : 'სავარაუდო დიაპაზონი'}
                </span>
                <motion.strong
                  key={estimateLabel}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, ease: 'easeOut' }}
                  className={`${isCustomPrice ? 'text-4xl' : 'text-5xl'} font-extrabold leading-tight text-[var(--brand-accent)]`}
                >
                  {estimateLabel}
                </motion.strong>
              </div>
              <p className="text-sm leading-7 text-[var(--brand-muted)]">
                {selectedService.template
                  ? 'შაბლონურ პოსტერზე ფასი ითვლება ფორმულით: დიზაინი 100 ლარი + თითო ცვლილება 15 ლარი.'
                  : isCustomPrice
                    ? 'მიუთითეთ სასურველი ზომა, რაოდენობა და მასალა. ამის შემდეგ მიიღებთ ზუსტ ღირებულებას.'
                    : 'ეს არის საორიენტაციო ფასი. ზუსტი ღირებულება დასტურდება ბრიფისა და სამუშაოს მოცულობის ნახვის შემდეგ.'}
              </p>
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--brand-line)] pt-5 text-sm text-[var(--brand-muted)]">
              <div className="flex items-center justify-between gap-4">
                <span>კატეგორია</span>
                <strong className="text-right text-[var(--brand-ink)]">
                  {selectedService.group === 'print' ? 'საბეჭდი მასალები' : 'დიზაინი'}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>მომსახურება</span>
                <strong className="text-right text-[var(--brand-ink)]">{selectedService.label}</strong>
              </div>
              {!isCustomPrice && (
                <div className="flex items-center justify-between gap-4">
                  <span>რაოდენობა</span>
                  <strong className="text-[var(--brand-ink)]">{quantity}</strong>
                </div>
              )}
              {selectedService.template && (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <span>ცვლილებები</span>
                    <strong className="text-[var(--brand-ink)]">{templateChanges}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>1 ცვლილება</span>
                    <strong className="text-[var(--brand-ink)]">15 ლარი</strong>
                  </div>
                </>
              )}
              {isCustomPrice && (
                <div className="flex items-center justify-between gap-4">
                  <span>ზომა / ტირაჟი</span>
                  <strong className="text-[var(--brand-ink)]">შეთანხმებით</strong>
                </div>
              )}
            </div>

            <a href="#contact" className="button-primary w-full">
              {isCustomPrice ? 'ზუსტი ფასის მოთხოვნა' : 'შეკვეთის განხილვა'}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
