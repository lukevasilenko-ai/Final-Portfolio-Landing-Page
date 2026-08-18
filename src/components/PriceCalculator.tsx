/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { type KeyboardEvent, useEffect, useMemo, useState } from 'react';
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
  | 'googleReviewSet';

type ServiceGroup = 'design' | 'print';

interface Service {
  label: string;
  note: string;
  group: ServiceGroup;
  priceRange?: [number, number];
  template?: boolean;
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
    note: 'დიზაინი 140 ლარი, თითო ცვლილება 20 ლარი',
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
    label: 'საბეჭდი მასალა',
    icon: Printer,
    items: ['businessCards', 'googleReviewSet']
  }
];

const roundToFive = (value: number) => Math.round(value / 5) * 5;

interface SmoothRangeProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}

function SmoothRange({ min, max, value, onChange, ariaLabel }: SmoothRangeProps) {
  const [draftValue, setDraftValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);
  const progress = ((draftValue - min) / (max - min)) * 100;

  useEffect(() => {
    if (!isDragging) {
      setDraftValue(value);
    }
  }, [isDragging, value]);

  const updateDraftValue = (nextValue: number) => {
    const clampedValue = Math.min(max, Math.max(min, nextValue));
    const roundedValue = Math.round(clampedValue);

    setDraftValue(clampedValue);

    if (roundedValue !== value) {
      onChange(roundedValue);
    }
  };

  const commitValue = (nextValue: number) => {
    const roundedValue = Math.min(max, Math.max(min, Math.round(nextValue)));

    setIsDragging(false);
    setDraftValue(roundedValue);
    onChange(roundedValue);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowDown'
      ? -1
      : event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? 1
        : 0;

    if (direction === 0) return;

    event.preventDefault();
    commitValue(value + direction);
  };

  return (
    <div className="smooth-range-wrap">
      <div
        className={`smooth-range-fill${isDragging ? ' is-dragging' : ''}`}
        style={{ transform: `translateY(-50%) scaleX(${progress / 100})` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step="0.01"
        value={draftValue}
        onPointerDown={() => setIsDragging(true)}
        onPointerUp={(event) => commitValue(Number(event.currentTarget.value))}
        onPointerCancel={(event) => commitValue(Number(event.currentTarget.value))}
        onBlur={(event) => commitValue(Number(event.currentTarget.value))}
        onChange={(event) => updateDraftValue(Number(event.currentTarget.value))}
        onKeyDown={handleKeyDown}
        className="smooth-range"
        aria-label={ariaLabel}
        aria-valuetext={String(Math.round(draftValue))}
      />
    </div>
  );
}

export default function PriceCalculator() {
  const [activeGroup, setActiveGroup] = useState<ServiceGroup>('design');
  const [service, setService] = useState<ServiceId>('poster');
  const [quantity, setQuantity] = useState(1);
  const [templateChanges, setTemplateChanges] = useState(0);
  const [rush, setRush] = useState(false);
  const [extraFormats, setExtraFormats] = useState(false);

  const selectedService = services[service];
  const activeServiceGroup = serviceGroups.find((group) => group.id === activeGroup) ?? serviceGroups[0];

  const estimate = useMemo(() => {
    const rushMultiplier = rush ? 1.2 : 1;
    const serviceQuantity = selectedService.template ? 1 : quantity;
    const extraFormatsFee = selectedService.supportsExtraFormats && extraFormats
      ? 15 * serviceQuantity
      : 0;

    if (selectedService.template) {
      const templateBase = 140;
      const changesFee = templateChanges * 20;
      const total = roundToFive((templateBase + changesFee + extraFormatsFee) * rushMultiplier);

      return { min: total, max: total };
    }

    const base = selectedService.priceRange as [number, number];
    const quantityDiscount = quantity >= 6 ? 0.88 : quantity >= 3 ? 0.92 : 1;
    const min = roundToFive((base[0] * quantity * quantityDiscount * rushMultiplier) + extraFormatsFee);
    const max = roundToFive((base[1] * quantity * quantityDiscount * rushMultiplier) + extraFormatsFee);

    return { min, max };
  }, [extraFormats, quantity, rush, selectedService, templateChanges]);

  const estimateLabel = estimate.min === estimate.max
    ? `${estimate.min} ლარი`
    : `${estimate.min}-${estimate.max} ლარი`;

  const setQuantitySafely = (nextValue: number) => {
    setQuantity(Math.min(10, Math.max(1, nextValue)));
  };

  const setTemplateChangesSafely = (nextValue: number) => {
    setTemplateChanges(Math.min(20, Math.max(0, nextValue)));
  };

  const selectService = (nextService: ServiceId) => {
    setService(nextService);

    if (services[nextService].template) {
      setQuantity(1);
      setRush(false);
      setExtraFormats(false);
    }
  };

  const selectServiceGroup = (nextGroup: ServiceGroup) => {
    const group = serviceGroups.find((candidate) => candidate.id === nextGroup);

    if (!group) return;

    setActiveGroup(nextGroup);
    setService(group.items[0]);
    setQuantity(1);
    setTemplateChanges(0);
    setRush(false);
    setExtraFormats(false);
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
            აირჩიეთ დიზაინის მომსახურება ან საბეჭდი მასალა და მიუთითეთ საჭირო პარამეტრები.
          </p>
        </div>

        <div className="surface-card-strong grid grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col gap-8 p-6 sm:p-8">
            <div
              className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--brand-line)] bg-white/45 p-1"
              role="tablist"
              aria-label="მომსახურების ტიპი"
            >
              {serviceGroups.map((group) => {
                const GroupIcon = group.icon;
                const isActive = activeGroup === group.id;

                return (
                  <button
                    key={group.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`calculator-${group.id}-services`}
                    onClick={() => selectServiceGroup(group.id)}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition-colors ${
                      isActive
                        ? 'bg-[var(--brand-accent)] text-[var(--brand-on-accent)] shadow-[var(--brand-accent-shadow-xs)]'
                        : 'text-[var(--brand-muted)] hover:bg-white hover:text-[var(--brand-ink)]'
                    }`}
                  >
                    <GroupIcon className="h-4 w-4 shrink-0" />
                    <span>{group.label}</span>
                  </button>
                );
              })}
            </div>

            <motion.div
              key={activeServiceGroup.id}
              id={`calculator-${activeServiceGroup.id}-services`}
              role="tabpanel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {activeServiceGroup.items.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={service === item}
                  onClick={() => selectService(item)}
                  className={`rounded-lg border px-4 py-4 text-left transition-colors ${
                    service === item
                      ? 'border-[var(--brand-accent)] bg-[var(--brand-accent-soft)] text-[var(--brand-ink)]'
                      : 'border-[var(--brand-line)] bg-white/55 text-[var(--brand-muted)] hover:bg-white'
                  }`}
                >
                  <span className="block text-base font-bold">{services[item].label}</span>
                  <span className="mt-2 block text-sm leading-6">{services[item].note}</span>
                </button>
              ))}
            </motion.div>

            {!selectedService.template && (
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
                <SmoothRange
                  min={1}
                  max={10}
                  value={quantity}
                  onChange={setQuantitySafely}
                  ariaLabel="Project quantity"
                />
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
                <SmoothRange
                  min={0}
                  max={20}
                  value={templateChanges}
                  onChange={setTemplateChangesSafely}
                  ariaLabel="Template changes quantity"
                />
                <p className="text-sm leading-7 text-[var(--brand-muted)]">
                  ერთი შაბლონური პოსტერის დიზაინი ღირს 140 ლარი. თითო ცვლილება ემატება 20 ლარად; სასწრაფო ვადა და დამატებითი ზომები ცალკე ითვლება.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setRush((value) => !value)}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                  rush
                    ? 'border-[var(--brand-copper)] bg-[var(--brand-copper-soft)] text-[var(--brand-ink)]'
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
                      ? 'border-[var(--brand-accent)] bg-[var(--brand-accent-soft)] text-[var(--brand-ink)]'
                      : 'border-[var(--brand-line)] bg-white/55 text-[var(--brand-muted)] hover:bg-white'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  დამატებითი ზომები (სთორი/ბანერი)
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-8 border-t border-[var(--brand-line)] bg-[var(--brand-accent-wash)] p-6 sm:p-8 lg:border-l lg:border-t-0">
            <div className="flex flex-col gap-5">
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                შეფასება
              </span>
              <div className="flex flex-col gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-muted)]">
                  სავარაუდო დიაპაზონი
                </span>
                <motion.strong
                  key={estimateLabel}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, ease: 'easeOut' }}
                  className="text-5xl font-extrabold leading-tight text-[var(--brand-accent)]"
                >
                  {estimateLabel}
                </motion.strong>
              </div>
              <p className="text-sm leading-7 text-[var(--brand-muted)]">
                {selectedService.template
                  ? 'შაბლონურ პოსტერზე ფასი ითვლება ფორმულით: დიზაინი 140 ლარი + თითო ცვლილება 20 ლარი.'
                  : 'ეს არის საორიენტაციო ფასი. ზუსტი ღირებულება დასტურდება ბრიფისა და სამუშაოს მოცულობის ნახვის შემდეგ.'}
              </p>
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--brand-line)] pt-5 text-sm text-[var(--brand-muted)]">
              <div className="flex items-center justify-between gap-4">
                <span>კატეგორია</span>
                <strong className="text-right text-[var(--brand-ink)]">
                  {selectedService.group === 'print' ? 'საბეჭდი მასალა' : 'დიზაინი'}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>მომსახურება</span>
                <strong className="text-right text-[var(--brand-ink)]">{selectedService.label}</strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>რაოდენობა</span>
                <strong className="text-[var(--brand-ink)]">
                  {selectedService.template ? 1 : quantity}
                </strong>
              </div>
              {selectedService.template && (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <span>ცვლილებები</span>
                    <strong className="text-[var(--brand-ink)]">{templateChanges}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>1 ცვლილება</span>
                    <strong className="text-[var(--brand-ink)]">20 ლარი</strong>
                  </div>
                </>
              )}
            </div>

            <a href="#contact" className="button-primary w-full">
              შეკვეთის განხილვა
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
