/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  Clock,
  Layers,
  Minus,
  Plus,
  Printer,
  Sparkles
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  DEFAULT_CALCULATOR_CONFIG,
  explainEstimate,
  type CalculatorConfig,
  type CalculatorGroup,
  type CalculatorService,
  type EstimateLine,
} from '../calculator/model';
import ServicePackages from './ServicePackages';
import SectionHeader, { stripSectionIndex } from './SectionHeader';
import { NativeElementSlot } from '../websiteSections/NativeElements';
import './calculator.css';

const groupIcon: Record<CalculatorGroup['icon'], typeof Calculator> = {
  calculator: Calculator,
  printer: Printer,
  sparkles: Sparkles,
  layers: Layers,
};

const GEORGIAN_MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];

/** What a service costs on its own, for the price tag on its card. */
const priceTag = (service: CalculatorService) => service.pricing.type === 'range'
  ? `${service.pricing.min}–${service.pricing.max} ₾`
  : service.pricing.type === 'per_item'
    ? `${service.pricing.amount} ₾ / ცალი`
    : `${service.pricing.amount} ₾`;

/** "+20 ₾", "−24–31 ₾", "120–155 ₾" for a receipt line. */
function lineAmount(line: EstimateLine) {
  const signed = line.id !== 'base';
  const format = (value: number) => (value === 0 ? '0' : `${value < 0 ? '−' : signed ? '+' : ''}${Math.abs(value)}`);
  if (line.min === line.max) return `${format(line.min)} ₾`;
  if ((line.min < 0) !== (line.max < 0)) return `${format(line.min)} / ${format(line.max)} ₾`;
  const low = Math.min(Math.abs(line.min), Math.abs(line.max));
  const high = Math.max(Math.abs(line.min), Math.abs(line.max));
  return `${line.min < 0 ? '−' : signed ? '+' : ''}${low}–${high} ₾`;
}

/** Counts smoothly from the previous value to the new one (instantly for reduced motion). */
function useCountUp(target: number, duration = 650) {
  const reduceMotion = useReducedMotion() ?? false;
  const [value, setValue] = useState(target);
  const shown = useRef(target);
  useEffect(() => {
    if (reduceMotion) { shown.current = target; setValue(target); return; }
    const from = shown.current;
    if (from === target) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const next = from + (target - from) * (1 - (1 - progress) ** 3);
      shown.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, reduceMotion, target]);
  return Math.round(value);
}

function CountUp({ value }: { value: number }) {
  return <>{useCountUp(value)}</>;
}

interface RangeMark { value: number; label: string; discount?: boolean }

interface SmoothRangeProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  marks?: RangeMark[];
}

function SmoothRange({ min, max, value, onChange, ariaLabel, marks = [] }: SmoothRangeProps) {
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
    <div className="smooth-range-block">
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
      {/* Ends of the scale, and where quantity discounts begin. */}
      {marks.length > 0 && max > min && (
        <div className="smooth-range-marks" aria-hidden="true">
          {marks.map((mark) => (
            <span
              key={`${mark.value}-${mark.label}`}
              className={`${value >= mark.value ? 'is-reached' : ''}${mark.discount ? ' is-discount' : ''}`}
              style={{ left: `${((mark.value - min) / (max - min)) * 100}%` }}
            >{mark.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Price calculator: choose a service and its options; the estimate is shown as a printed receipt
 * with every line of the price, a counting total, and a button that carries the choice into the
 * contact form. A soft accent light follows the pointer across the card.
 */
export default function PriceCalculator({ config: previewConfig }: { config?: CalculatorConfig }) {
  const reduceMotion = useReducedMotion() ?? false;
  const [publishedConfig, setPublishedConfig] = useState(DEFAULT_CALCULATOR_CONFIG);
  const [loadWarning, setLoadWarning] = useState('');
  const [activeGroup, setActiveGroup] = useState('design');
  const [service, setService] = useState('poster');
  const [quantity, setQuantity] = useState(1);
  const [templateChanges, setTemplateChanges] = useState(0);
  const [rush, setRush] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const requestedConfig = previewConfig ?? publishedConfig;
  const hasActiveService = requestedConfig.groups.some((group) => group.enabled
    && requestedConfig.services.some((item) => item.enabled && item.groupId === group.id));
  const currentConfig = hasActiveService ? requestedConfig : DEFAULT_CALCULATOR_CONFIG;
  const activeGroups = currentConfig.groups
    .filter((group) => group.enabled && currentConfig.services.some((item) => item.enabled && item.groupId === group.id))
    .sort((a, b) => a.order - b.order);
  const activeServiceGroup = activeGroups.find((group) => group.id === activeGroup) ?? activeGroups[0];
  const groupServices = activeServiceGroup
    ? currentConfig.services.filter((item) => item.enabled && item.groupId === activeServiceGroup.id).sort((a, b) => a.order - b.order)
    : [];
  const selectedService: CalculatorService = groupServices.find((item) => item.id === service)
    ?? groupServices[0]
    ?? currentConfig.services[0];
  const copy = currentConfig.copy;

  useEffect(() => {
    if (previewConfig || (import.meta.env.MODE !== 'staging' && !import.meta.env.PROD)) return;
    let active = true;
    void import('../calculator/repository')
      .then(({ loadPublishedCalculator }) => loadPublishedCalculator())
      .then((result) => {
        if (!active) return;
        setPublishedConfig(result.config);
        setLoadWarning(result.warning ?? '');
      })
      .catch(() => {
        if (!active) return;
        setPublishedConfig(DEFAULT_CALCULATOR_CONFIG);
        setLoadWarning('გამოქვეყნებული კონფიგურაცია ვერ ჩაიტვირთა. ნაჩვენებია საწყისი ფასები.');
      });
    return () => { active = false; };
  }, [previewConfig]);

  useEffect(() => {
    if (!activeServiceGroup) return;
    if (activeGroup !== activeServiceGroup.id) setActiveGroup(activeServiceGroup.id);
    if (!groupServices.some((item) => item.id === service)) setService(groupServices[0]?.id ?? '');
  }, [activeGroup, activeServiceGroup, currentConfig, groupServices, service]);

  const explained = useMemo(() => explainEstimate(currentConfig, {
    serviceId: selectedService.id,
    quantity,
    changes: templateChanges,
    rush,
    selectedExtras,
  }), [currentConfig, quantity, rush, selectedExtras, selectedService, templateChanges]);
  const estimate = explained.total;

  const estimateLabel = estimate.min === estimate.max
    ? `${estimate.min} ლარი`
    : `${estimate.min}-${estimate.max} ლარი`;

  const setQuantitySafely = (nextValue: number) => {
    setQuantity(Math.min(selectedService.quantity.max, Math.max(selectedService.quantity.min, nextValue)));
  };

  const setTemplateChangesSafely = (nextValue: number) => {
    const changes = selectedService.changes;
    if (changes) setTemplateChanges(Math.min(changes.max, Math.max(changes.min, nextValue)));
  };

  const selectService = (nextService: string) => {
    setService(nextService);
    const next = currentConfig.services.find((item) => item.id === nextService);
    if (next?.changes?.enabled) {
      setQuantity(1);
      setRush(false);
      setSelectedExtras([]);
    } else if (next?.quantity.enabled) {
      setQuantity((value) => Math.min(next.quantity.max, Math.max(next.quantity.min, value)));
    }
  };

  const selectServiceGroup = (group: CalculatorGroup) => {
    const firstService = currentConfig.services
      .filter((item) => item.enabled && item.groupId === group.id)
      .sort((a, b) => a.order - b.order)[0];
    if (!firstService) return;
    setActiveGroup(group.id);
    setService(firstService.id);
    setQuantity(1);
    setTemplateChanges(0);
    setRush(false);
    setSelectedExtras([]);
  };

  const isTemplate = Boolean(selectedService.changes?.enabled);
  const selectedExtraOptions = selectedService.extras.filter((extra) => extra.enabled);
  const extraLabel = (id: string, fallback: string) => (id === 'extra-sizes' ? copy.extraSizesLabel : fallback);
  const serviceGridColumns = currentConfig.appearance.serviceColumns === 'two'
    ? 'grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2'
    : 'grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3';
  const quantityLabel = selectedService.quantity.label || copy.quantityLabel;
  const changesLabel = selectedService.changes?.label || copy.changesLabel;
  const categoryName = activeServiceGroup.id === 'design' ? copy.designCategory : activeServiceGroup.label;

  // Marks on the quantity scale: both ends and every discount threshold.
  const quantityMarks: RangeMark[] = selectedService.quantity.enabled ? [
    { value: selectedService.quantity.min, label: String(selectedService.quantity.min) },
    ...selectedService.discounts
      .filter((tier) => tier.minimumQuantity > selectedService.quantity.min && tier.minimumQuantity < selectedService.quantity.max)
      .map((tier) => ({ value: tier.minimumQuantity, label: `−${tier.percent}%`, discount: true })),
    { value: selectedService.quantity.max, label: String(selectedService.quantity.max) },
  ] : [];
  const nudge = selectedService.quantity.enabled
    ? explained.nextDiscount
      ? `${explained.discountPercent ? `ახლა −${explained.discountPercent}% · ` : ''}კიდევ ${explained.nextDiscount.minimumQuantity - quantity} ცალი — და ფასდაკლება ${explained.nextDiscount.percent}%`
      : explained.discountPercent ? `ფასდაკლება ${explained.discountPercent}% უკვე მოქმედებს` : ''
    : '';

  // Georgian month names written out: not every browser ships Georgian date formatting.
  const today = useMemo(() => {
    const date = new Date();
    return `${date.getDate()} ${GEORGIAN_MONTHS[date.getMonth()]}, ${date.getFullYear()}`;
  }, []);

  // "Order": the chosen settings go into the contact form's subject and description.
  const sendToContact = () => {
    const chosenExtras = selectedExtraOptions.filter((extra) => selectedExtras.includes(extra.id));
    const message = [
      'გამარჯობა! ფასის კალკულატორით დავითვალე:',
      `• მომსახურება: ${selectedService.label}`,
      ...(selectedService.quantity.enabled ? [`• ${quantityLabel}: ${quantity}`] : []),
      ...(selectedService.changes?.enabled ? [`• ${changesLabel}: ${templateChanges}`] : []),
      ...(rush ? [`• ${selectedService.rush.label || copy.rushLabel}`] : []),
      ...chosenExtras.map((extra) => `• ${extraLabel(extra.id, extra.label)}`),
      `სავარაუდო ბიუჯეტი: ${estimateLabel}`,
      '',
      'დამატებითი დეტალები: ',
    ].join('\n');
    window.dispatchEvent(new CustomEvent('luka-calculator-request', {
      detail: { subject: `${selectedService.label} — ${estimateLabel}`, message },
    }));
  };

  // A soft accent light follows the pointer across the card.
  const followSpotlight = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--sx', `${Math.round(event.clientX - box.left)}px`);
    event.currentTarget.style.setProperty('--sy', `${Math.round(event.clientY - box.top)}px`);
  };

  if (!requestedConfig.enabled && !previewConfig) return null;

  const indicatorTransition = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 420, damping: 36 };

  return (
    <section
      id="calculator"
      data-calculator-palette={currentConfig.appearance.palette}
      data-calculator-typography={currentConfig.appearance.typography}
      data-calculator-layout={currentConfig.appearance.layout}
      className={`section-wrap ed-section calculator-palette-${currentConfig.appearance.palette}${previewConfig ? ' calculator-live-preview' : ''}`}
    >
      <div className="container-xl">
        <SectionHeader
          eyebrow={{ slot: 'calculator.eyebrow', content: stripSectionIndex(copy.eyebrow) }}
          title={{ slot: 'calculator.title', content: copy.title }}
          description={{ slot: 'calculator.description', content: copy.description }}
        />

        {loadWarning && !previewConfig && <p className="calculator-load-warning" role="status">{loadWarning}</p>}

        <NativeElementSlot id="calculator.widget"><div
          className={`calc surface-card-strong grid grid-cols-1 gap-0 overflow-hidden ${currentConfig.appearance.layout === 'split' ? 'lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.7fr)]' : 'lg:grid-cols-1'}`}
          onPointerMove={followSpotlight}
        >
          <div className="calc-controls flex flex-col gap-8 p-6 sm:p-9">
            <div className="flex flex-col gap-8">
              <div
                className="segmented"
                style={{ gridTemplateColumns: `repeat(${Math.max(1, activeGroups.length)}, minmax(0, 1fr))` }}
                role="tablist"
                aria-label={copy.groupsLabel}
              >
                {activeGroups.map((group) => {
                  const GroupIcon = groupIcon[group.icon];
                  const isActive = activeGroup === group.id;

                  return (
                    <button
                      key={group.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`calculator-${group.id}-services`}
                      onClick={() => selectServiceGroup(group)}
                      className="segmented-item"
                    >
                      {/* The marker glides from the old tab to the new one. */}
                      {isActive && <motion.span layoutId="calc-tab-indicator" className="calc-tab-indicator" transition={indicatorTransition} aria-hidden="true" />}
                      <GroupIcon className="calc-tab-icon h-4 w-4 shrink-0" />
                      <span className="calc-tab-label">{group.label}</span>
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
                className={`grid ${serviceGridColumns}`}
              >
                {groupServices.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={service === item.id}
                    onClick={() => selectService(item.id)}
                    className="choice-tile calc-tile px-4 py-4 text-left"
                  >
                    <span className="calc-tile-name block text-[15px] font-bold text-[var(--brand-ink)]">{item.label}</span>
                    <span className="mt-1.5 block text-[13px] leading-6">{item.note}</span>
                    <span className="calc-tile-price">{priceTag(item)}</span>
                  </button>
                ))}
              </motion.div>
            </div>

            {selectedService.quantity.enabled && (
              <div style={{ order: 2 + selectedService.controlsOrder.indexOf('quantity') }} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-[var(--brand-ink)]">
                    <Layers className="h-4 w-4 text-[var(--brand-accent)]" />
                    {quantityLabel}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantitySafely(quantity - 1)}
                      className="icon-button h-9 w-9"
                      aria-label="რაოდენობის შემცირება"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <motion.span
                      key={quantity}
                      initial={{ y: 8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="stepper-value"
                    >
                      {quantity}
                    </motion.span>
                    <button
                      type="button"
                      onClick={() => setQuantitySafely(quantity + 1)}
                      className="icon-button h-9 w-9"
                      aria-label="რაოდენობის გაზრდა"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <SmoothRange
                  min={selectedService.quantity.min}
                  max={selectedService.quantity.max}
                  value={quantity}
                  onChange={setQuantitySafely}
                  ariaLabel={quantityLabel}
                  marks={quantityMarks}
                />
                {nudge && (
                  <p className="calc-nudge" aria-live="polite"><span className="calc-nudge-dot" aria-hidden="true" />{nudge}</p>
                )}
              </div>
            )}

            {selectedService.changes?.enabled && (
              <div style={{ order: 2 + selectedService.controlsOrder.indexOf('changes') }} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-[var(--brand-ink)]">
                    <Sparkles className="h-4 w-4 text-[var(--brand-accent)]" />
                    {changesLabel}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTemplateChangesSafely(templateChanges - 1)}
                      className="icon-button h-9 w-9"
                      aria-label="ცვლილებების რაოდენობის შემცირება"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <motion.span
                      key={templateChanges}
                      initial={{ y: 8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="stepper-value"
                    >
                      {templateChanges}
                    </motion.span>
                    <button
                      type="button"
                      onClick={() => setTemplateChangesSafely(templateChanges + 1)}
                      className="icon-button h-9 w-9"
                      aria-label="ცვლილებების რაოდენობის გაზრდა"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <SmoothRange
                  min={selectedService.changes.min}
                  max={selectedService.changes.max}
                  value={templateChanges}
                  onChange={setTemplateChangesSafely}
                  ariaLabel={changesLabel}
                  marks={[
                    { value: selectedService.changes.min, label: String(selectedService.changes.min) },
                    { value: selectedService.changes.max, label: String(selectedService.changes.max) },
                  ]}
                />
                <p className="text-sm leading-7 text-[var(--brand-muted)]">
                  {copy.templateInfo}
                </p>
              </div>
            )}

            {(selectedService.rush.enabled || selectedExtraOptions.length > 0) && (
              <div style={{ order: 2 + selectedService.controlsOrder.indexOf('options') }} className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {selectedService.rush.enabled && <button
                    type="button"
                    aria-pressed={rush}
                    onClick={() => setRush((value) => !value)}
                    className="choice-tile calc-option flex items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold"
                  >
                    <Clock className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">{selectedService.rush.label || copy.rushLabel}</span>
                    <span className="calc-option-chip">+{selectedService.rush.percent}%</span>
                  </button>}

                  {selectedExtraOptions.map((extra) => {
                    const isSelected = selectedExtras.includes(extra.id);
                    return (
                      <button
                        key={extra.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedExtras((current) => isSelected
                          ? current.filter((id) => id !== extra.id)
                          : [...current, extra.id])}
                        className="choice-tile calc-option flex items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span className="min-w-0">{extraLabel(extra.id, extra.label)}</span>
                        <span className="calc-option-chip">+{extra.amount} ₾{extra.billing === 'per_item' && selectedService.quantity.enabled ? ' / ც' : ''}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className={`calc-summary flex flex-col border-t border-[var(--brand-line)] bg-[var(--brand-page-soft)] p-6 sm:p-9 ${currentConfig.appearance.layout === 'split' ? 'lg:border-l lg:border-t-0' : 'lg:border-l-0 lg:border-t'}`}>
            <div className="calc-summary-body">
              <div className="calc-receipt">
                <div className="calc-receipt-head">
                  <span className="eyebrow">
                    <span className="eyebrow-dot" aria-hidden="true" />
                    {copy.estimateEyebrow}
                  </span>
                  <span className="calc-receipt-date">{today}</span>
                </div>

                <dl className="calc-meta">
                  <div><dt>{copy.categoryLabel}</dt><dd>{categoryName}</dd></div>
                  <div><dt>{copy.serviceLabel}</dt><dd>{selectedService.label}</dd></div>
                </dl>

                {/* What the price is made of; lines come and go as options change. */}
                <ul className="calc-lines" aria-label="ფასის შემადგენლობა">
                  <AnimatePresence initial={false}>
                    {explained.lines.map((line) => {
                      const extraId = line.id.startsWith('extra:') ? line.id.slice(6) : '';
                      const extra = extraId ? selectedService.extras.find((item) => item.id === extraId) : undefined;
                      const label = extra ? line.label.replace(extra.label, extraLabel(extra.id, extra.label)) : line.label;
                      return (
                        <motion.li
                          key={line.id}
                          className={`calc-line is-${line.id.split(':')[0]}`}
                          initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <div className="calc-line-row">
                            <span className="calc-line-label">{label}</span>
                            <span className="calc-line-fill" aria-hidden="true" />
                            <span className="calc-line-amount">{lineAmount(line)}</span>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
                {isTemplate && selectedService.changes && (
                  <p className="calc-line-note">{copy.oneChangeLabel}: {selectedService.changes.amountPerChange} ლარი</p>
                )}

                <div className="calc-total-row">
                  <span className="calc-total-label">{copy.estimateLabel}</span>
                  <strong className="calc-total ed-display">
                    <span className="calc-total-num tabular-nums" aria-hidden="true">
                      <CountUp value={estimate.min} />
                      {estimate.min !== estimate.max && <>–<CountUp value={estimate.max} /></>}
                    </span>
                    <small aria-hidden="true">ლარი</small>
                    <span className="sr-only" aria-live="polite">{estimateLabel}</span>
                  </strong>
                </div>
                <span className="calc-receipt-code" aria-hidden="true" />
              </div>

              <p className="calc-summary-text">
                {isTemplate ? copy.templateEstimateDescription : copy.estimateDescription}
              </p>
            </div>

            <div className="calc-cta-wrap">
              <a href="#contact" className="button-primary calc-cta w-full" onClick={sendToContact}>
                {copy.resultButton}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <p className="calc-cta-note">არჩეული პარამეტრები ავტომატურად ჩაიწერება შეტყობინებაში.</p>
            </div>
          </div>
        </div></NativeElementSlot>

        <ServicePackages config={currentConfig} />
      </div>
    </section>
  );
}
