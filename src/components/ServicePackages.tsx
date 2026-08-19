/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ArrowUpRight, Check, Info, Star } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

interface ServicePackage {
  name: string;
  price: number;
  summary: string;
  features: string[];
  extraChange: string;
  note?: string;
  popular?: boolean;
  accent: 'copper' | 'accent' | 'plum';
}

const servicePackages: ServicePackage[] = [
  {
    name: 'Starter',
    price: 600,
    summary: '4-5 სოციალური მედიის დიზაინი',
    accent: 'copper',
    features: [
      'პოსტერები სოციალური მედიისთვის',
      'დამატებითი ზომების მომზადება',
      'Story ან Banner დიზაინი',
      'ბრენდის სტილის დაცვა',
      '1 უფასო ცვლილება თითო დიზაინზე',
      'საბოლოო ფაილების მომზადება გამოსაყენებლად'
    ],
    extraChange: 'დამატებითი ცვლილება პოსტერზე - 20 ₾'
  },
  {
    name: 'Business',
    price: 1000,
    summary: '7-8 სოციალური მედიის დიზაინი',
    accent: 'accent',
    popular: true,
    features: [
      'პოსტერები სოციალური მედიისთვის',
      'დამატებითი ზომების მომზადება',
      'Story და Banner დიზაინები',
      'სარეკლამო ვიზუალები',
      'ბრენდის ერთიანი ვიზუალური სტილის დაცვა',
      '1 ცვლილება თითო დიზაინზე',
      'საბოლოო ფაილების მომზადება'
    ],
    extraChange: 'დამატებითი ცვლილება - 20 ₾'
  },
  {
    name: 'Premium',
    price: 1500,
    summary: '10-11 სოციალური მედიის დიზაინი',
    accent: 'plum',
    features: [
      'პოსტერები სოციალური მედიისთვის',
      'დამატებითი ზომების მომზადება',
      'Story და Banner დიზაინები',
      'სარეკლამო ვიზუალები',
      'Google Review დიზაინების ნაკრები',
      'სავიზიტო ბარათის დიზაინი',
      'ბრენდის ერთიანი ვიზუალური სტილის დაცვა',
      '1 ცვლილება თითო დიზაინზე',
      'საბოლოო ფაილების მომზადება ციფრული და საბეჭდი გამოყენებისთვის'
    ],
    extraChange: 'დამატებითი ცვლილება - 20 ₾',
    note: 'სავიზიტო ბარათის ბეჭდვის ღირებულება პაკეტში არ შედის.'
  }
];

const accentClasses = {
  copper: {
    line: 'bg-[var(--brand-copper)]',
    icon: 'bg-[var(--brand-copper-soft)] text-[var(--brand-copper)]'
  },
  accent: {
    line: 'bg-[var(--brand-accent)]',
    icon: 'bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]'
  },
  plum: {
    line: 'bg-[var(--brand-plum)]',
    icon: 'bg-[rgb(var(--brand-plum-rgb)/0.12)] text-[var(--brand-plum)]'
  }
} as const;

const smoothEase = [0.16, 1, 0.3, 1] as const;

export default function ServicePackages() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="mt-20 border-t border-[var(--brand-line)] pt-20 sm:mt-24 sm:pt-24" aria-labelledby="service-packages-title">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-90px' }}
        transition={{ duration: reduceMotion ? 0 : 0.55, ease: smoothEase }}
        className="mb-14 flex max-w-3xl flex-col gap-5"
      >
        <span className="eyebrow">
          <span className="eyebrow-dot" />
          ყოველთვიური მომსახურება
        </span>
        <h3 id="service-packages-title" className="text-3xl font-extrabold leading-tight text-[var(--brand-ink)] sm:text-4xl lg:text-5xl">
          სოციალური მედიის დიზაინის პაკეტები.
        </h3>
        <p className="section-subtitle max-w-2xl">
          აირჩიეთ სამუშაოს მოცულობაზე მორგებული ყოველთვიური პაკეტი და მიიღეთ ერთიანი ვიზუალური სტილი ყველა ფორმატში.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3">
        {servicePackages.map((servicePackage, packageIndex) => {
          const accent = accentClasses[servicePackage.accent];

          return (
            <motion.article
              key={servicePackage.name}
              initial={reduceMotion ? false : { opacity: 0, y: 34, scale: 0.985 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={reduceMotion ? undefined : {
                y: -8,
                transition: { type: 'spring', stiffness: 250, damping: 22 }
              }}
              viewport={{ once: true, margin: '-70px' }}
              transition={{
                duration: reduceMotion ? 0 : 0.58,
                delay: reduceMotion ? 0 : packageIndex * 0.09,
                ease: smoothEase
              }}
              className={`surface-card group relative flex h-full flex-col overflow-visible p-6 sm:p-7 ${
                servicePackage.popular
                  ? 'border-[var(--brand-accent)] shadow-[var(--brand-shadow)]'
                  : 'hover:border-[var(--brand-line-strong)] hover:shadow-[var(--brand-shadow)]'
              }`}
              aria-labelledby={`package-${servicePackage.name.toLowerCase()}`}
            >
              <motion.span
                initial={reduceMotion ? false : { scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{
                  duration: reduceMotion ? 0 : 0.7,
                  delay: reduceMotion ? 0 : 0.12 + packageIndex * 0.09,
                  ease: smoothEase
                }}
                className={`absolute inset-x-0 top-0 h-1 origin-left rounded-t-[var(--radius-card)] ${accent.line}`}
                aria-hidden="true"
              />

              {servicePackage.popular && (
                <motion.span
                  initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.94 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.45,
                    delay: reduceMotion ? 0 : 0.28,
                    ease: smoothEase
                  }}
                  className="absolute left-1/2 top-0 flex max-w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[var(--brand-accent)] px-5 py-2 text-xs font-bold text-[var(--brand-on-accent)] shadow-[var(--brand-accent-shadow-sm)]"
                >
                  <Star className="h-4 w-4 shrink-0" fill="currentColor" />
                  ყველაზე მოთხოვნადი
                </motion.span>
              )}

              <div className={`flex flex-1 flex-col gap-5 ${servicePackage.popular ? 'pt-5' : ''}`}>
                <div className="flex flex-col gap-4 border-b border-[var(--brand-line)] pb-6">
                  <div className="flex items-center justify-between gap-4">
                    <h4
                      id={`package-${servicePackage.name.toLowerCase()}`}
                      className="text-2xl font-extrabold uppercase leading-none text-[var(--brand-ink)] sm:text-3xl"
                    >
                      {servicePackage.name}
                    </h4>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent.icon}`} aria-hidden="true">
                      <Star className="h-4 w-4" />
                    </span>
                  </div>

                  <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                    <strong className="text-4xl font-extrabold leading-none text-[var(--brand-accent)] sm:text-5xl">
                      {servicePackage.price.toLocaleString('en-US')} ₾
                    </strong>
                    <span className="pb-1 text-sm font-bold text-[var(--brand-muted)]">/ თვე</span>
                  </div>

                  <p className="text-sm font-semibold leading-6 text-[var(--brand-ink)]">
                    {servicePackage.summary}
                  </p>
                </div>

                <div className="flex flex-1 flex-col">
                  <h5 className="text-sm font-extrabold text-[var(--brand-accent)]">პაკეტში შედის:</h5>
                  <ul className="mt-4 flex flex-col gap-3">
                    {servicePackage.features.map((feature, featureIndex) => (
                      <motion.li
                        key={feature}
                        initial={reduceMotion ? false : { opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: '-35px' }}
                        transition={{
                          duration: reduceMotion ? 0 : 0.35,
                          delay: reduceMotion ? 0 : packageIndex * 0.04 + featureIndex * 0.035,
                          ease: smoothEase
                        }}
                        className="flex items-start gap-3 text-sm leading-6 text-[var(--brand-muted)]"
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-on-accent)] shadow-[0_5px_12px_rgb(var(--brand-accent-rgb)/0.16)]">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        <span>{feature}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-3 border-t border-[var(--brand-line)] pt-5">
                <p className="flex items-start gap-3 text-xs font-semibold leading-6 text-[var(--brand-muted)]">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-accent)]" />
                  <span>{servicePackage.extraChange}</span>
                </p>
                {servicePackage.note && (
                  <p className="text-xs leading-6 text-[var(--brand-soft)]">{servicePackage.note}</p>
                )}
                <a
                  href="#contact"
                  className={`${servicePackage.popular ? 'button-primary' : 'button-secondary'} mt-1 w-full gap-2 text-sm`}
                >
                  პაკეტის არჩევა
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}
