/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ArrowUpRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { DEFAULT_CALCULATOR_CONFIG, type CalculatorConfig } from '../calculator/model';
import { stripSectionIndex } from './SectionHeader';

const smoothEase = [0.16, 1, 0.3, 1] as const;

export default function ServicePackages({
  config = DEFAULT_CALCULATOR_CONFIG,
}: {
  config?: CalculatorConfig;
}) {
  const reduceMotion = useReducedMotion();
  const servicePackages = config.packages
    .filter((servicePackage) => servicePackage.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="mt-28 sm:mt-40" aria-labelledby="service-packages-title">
      <div className="ed-grid ed-header">
        <div className="ed-aside">
          <span className="ed-label">
            <span className="text-[var(--brand-soft)]" aria-hidden="true">—</span>
            <span>{stripSectionIndex(config.copy.packagesEyebrow)}</span>
          </span>
        </div>
        <div className="ed-main flex flex-col gap-8">
          <h3 id="service-packages-title" className="section-title">
            {config.copy.packagesTitle}
          </h3>
          <p className="section-subtitle">
            {config.copy.packagesDescription}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 border-t border-[var(--brand-ink)] lg:grid-cols-3">
        {servicePackages.map((servicePackage, packageIndex) => (
          <motion.article
            key={servicePackage.name}
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-70px' }}
            transition={{
              duration: reduceMotion ? 0 : 0.7,
              delay: reduceMotion ? 0 : packageIndex * 0.08,
              ease: smoothEase
            }}
            className={`group relative flex h-full flex-col py-10 lg:px-10 lg:first:pl-0 lg:last:pr-0 ${
              packageIndex > 0 ? 'border-t border-[var(--brand-line)] lg:border-l lg:border-t-0' : ''
            } ${servicePackage.popular ? 'bg-[var(--brand-page-soft)] px-6 lg:!px-10' : ''}`}
            aria-labelledby={`package-${servicePackage.id}`}
          >
            <div className="flex items-baseline justify-between gap-4">
              <h4
                id={`package-${servicePackage.id}`}
                className="ed-kicker text-[13px] text-[var(--brand-ink)]"
              >
                <span className="mr-3 tabular-nums text-[var(--brand-soft)]">{String(packageIndex + 1).padStart(2, '0')}</span>
                {servicePackage.name}
              </h4>
              {servicePackage.popular && (
                <span className="text-[12px] font-semibold text-[var(--brand-accent)]">
                  {config.copy.popularLabel}
                </span>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <strong className="ed-display text-[clamp(3rem,5vw,4.25rem)] leading-none tabular-nums text-[var(--brand-ink)]">
                {servicePackage.price.toLocaleString('en-US')} ₾
              </strong>
              <span className="text-[14px] text-[var(--brand-muted)]">{config.copy.monthlyLabel}</span>
            </div>

            <p className="mt-5 max-w-[34ch] text-[15px] leading-7 text-[var(--brand-ink)]">
              {servicePackage.summary}
            </p>

            <div className="mt-8 flex flex-1 flex-col">
              <h5 className="ed-kicker">{config.copy.packageFeaturesLabel}</h5>
              <ul className="mt-4 flex flex-col">
                {servicePackage.features.map((feature) => (
                  <li key={feature} className="border-b border-[var(--brand-line)] py-3 text-[14px] leading-6 text-[var(--brand-muted)]">
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 flex flex-col gap-1.5">
              <p className="text-[13px] leading-6 text-[var(--brand-muted)]">{servicePackage.extraChange}</p>
              {servicePackage.note && (
                <p className="text-[13px] leading-6 text-[var(--brand-soft)]">{servicePackage.note}</p>
              )}
            </div>

            <a
              href="#contact"
              className={`${servicePackage.popular ? 'button-primary' : 'button-secondary'} mt-8 w-full`}
            >
              {config.copy.packageButton}
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </motion.article>
        ))}
      </div>
    </div>
  );
}
