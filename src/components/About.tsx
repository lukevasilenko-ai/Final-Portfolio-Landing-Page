/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cpu, Award, Zap, Heart, CheckCircle2 } from 'lucide-react';
import { SKILL_CATEGORIES } from '../data';

export default function About() {
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);

  const activeCategory = SKILL_CATEGORIES[activeCategoryIndex];

  return (
    <section id="about" className="section-wrap section-rule">
      <div className="container-xl">
        <div className="mb-14 flex max-w-4xl flex-col gap-5">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            01 // ბიოგრაფია
          </span>
          <h2 className="section-title about-title">
            ვაერთიანებ კრეატიულ იდეებსა და <br className="hidden sm:inline" />
            თანამედროვე ვიზუალურ ესთეტიკას.
          </h2>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-7">
            <div className="surface-card-strong grid gap-6 p-6 sm:col-span-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] sm:p-8">
              <div className="flex flex-col justify-center gap-3 sm:border-r sm:border-[var(--brand-line)] sm:pr-8">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--brand-soft)]">
                  პროფილი // 01
                </span>
                <h3 className="text-3xl font-bold leading-tight text-[var(--brand-ink)]">ლუკა ვასილენკო</h3>
                <p className="font-mono text-xs font-bold uppercase leading-6 tracking-[0.08em] text-[var(--brand-accent)]">
                  პროფესიონალი გრაფიკული დიზაინერი
                </p>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--brand-muted)]">
                  Photoshop & Illustrator
                </p>
              </div>
              <div className="flex items-center sm:pl-2">
                <p className="text-sm leading-8 text-[var(--brand-muted)] sm:text-base sm:leading-9">
                  ჩემი სპეციალიზაციაა სარეკლამო პოსტერების, ლოგოების, ბანერებისა და ბრენდინგის უმაღლეს დონეზე შექმნა. ჩემი სამუშაო პროცესი ყოველთვის ითვალისწინებს კლიენტის მოთხოვნებს, კომპოზიციურ სრულყოფილებას, სწორ ტიპოგრაფიასა და ფერთა ჰარმონიას.
                </p>
              </div>
            </div>

            <div className="surface-card flex min-h-[220px] flex-col justify-between p-6 transition-transform duration-200 hover:-translate-y-1">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--brand-accent)] text-[var(--brand-on-accent)]">
                  <Cpu className="h-5 w-5" />
                </div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--brand-soft)]">ღირებულება // 01</span>
              </div>
              <div className="mt-8 flex flex-col gap-2">
                <h4 className="text-base font-bold text-[var(--brand-ink)]">კომპოზიცია და ფერები</h4>
                <p className="text-sm leading-7 text-[var(--brand-muted)]">
                  მიმაჩნია, რომ კარგი დიზაინი ამბავს ყვება. განსაკუთრებულ ყურადღებას ვუთმობ ფერთა თეორიას (RGB/CMYK) და ოქროს პროპორციას იდეალური ბალანსის მისაღწევად.
                </p>
              </div>
            </div>

            <div className="surface-card flex min-h-[220px] flex-col justify-between p-6 transition-transform duration-200 hover:-translate-y-1">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--brand-copper)] text-[var(--brand-on-accent)]">
                  <Award className="h-5 w-5" />
                </div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--brand-soft)]">ღირებულება // 02</span>
              </div>
              <div className="mt-8 flex flex-col gap-2">
                <h4 className="text-base font-bold text-[var(--brand-ink)]">დეტალების სიზუსტე</h4>
                <p className="text-sm leading-7 text-[var(--brand-muted)]">
                  ვექტორული სიზუსტე Adobe Illustrator-ში, მაღალი რეზოლუციის ფოტო-მანიპულაციები Photoshop-ში და ბეჭდვისთვის (Pre-press) გამზადებული მასალები ჩემი სამუშაო ხარისხის გარანტიაა.
                </p>
              </div>
            </div>

            <div className="surface-card grid grid-cols-3 gap-3 p-5 text-center sm:col-span-2">
              <div className="flex flex-col items-center justify-center gap-1">
                <span className="text-3xl font-extrabold text-[var(--brand-accent)]">2+</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--brand-muted)]">წლის გამოცდილება</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-1 border-x border-[var(--brand-line)] px-3">
                <span className="text-3xl font-extrabold text-[var(--brand-copper)]">4+</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--brand-muted)]">გაშვებული პროექტი</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-1">
                <span className="text-3xl font-extrabold text-[var(--brand-plum)]">100%</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--brand-muted)]">წარმატებული მიწოდება</span>
              </div>
            </div>
          </div>

          <div className="surface-card-strong flex min-h-[460px] w-full flex-col justify-between p-6 lg:col-span-5">
            <div>
              <div className="mb-8 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--brand-soft)]">
                    დიზაინის არსენალი
                  </span>
                  <Zap className="h-4 w-4 text-[var(--brand-copper)]" />
                </div>
                <h3 className="text-2xl font-bold text-[var(--brand-ink)]">პროფესიული უნარები</h3>
                <p className="text-sm leading-7 text-[var(--brand-muted)]">
                  {SKILL_CATEGORIES.length > 1
                    ? "დააწკაპუნეთ კატეგორიებზე ჩემი ინსტრუმენტებისა და მიმართულებების სანახავად."
                    : "ძირითადი გრაფიკული პროგრამები, რომლებსაც ყოველდღიურად და პროფესიონალურად ვიყენებ."
                  }
                </p>
              </div>

              {SKILL_CATEGORIES.length > 1 && (
                <div className="mb-6 flex gap-1 rounded-lg border border-[var(--brand-line)] bg-white/50 p-1">
                  {SKILL_CATEGORIES.map((cat, idx) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategoryIndex(idx)}
                      className={`flex-1 rounded-md py-2 text-center font-mono text-xs font-bold transition-colors duration-200 ${
                        activeCategoryIndex === idx
                          ? 'bg-[var(--brand-accent)] text-[var(--brand-on-accent)]'
                          : 'text-[var(--brand-muted)] hover:bg-white hover:text-[var(--brand-ink)]'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeCategory.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-4"
                  >
                    {activeCategory.skills.map((skill) => (
                      <div
                        key={skill.name}
                        className="rounded-lg border border-[var(--brand-line)] bg-white/55 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between gap-4 text-sm">
                          <span className="flex items-center gap-2 font-semibold text-[var(--brand-ink)]">
                            <CheckCircle2 className="h-4 w-4 text-[var(--brand-accent)]" />
                            {skill.name}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-[var(--brand-muted)]">{skill.level}%</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--brand-track)]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${skill.level}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="h-full rounded-full bg-[linear-gradient(90deg,var(--brand-accent),var(--brand-copper))]"
                          />
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="mt-8 flex items-start gap-3 border-t border-[var(--brand-line)] pt-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-copper-soft)]">
                <Heart className="h-4 w-4 text-[var(--brand-copper)]" />
              </div>
              <p className="font-mono text-[11px] italic leading-7 text-[var(--brand-muted)]">
                „სიმარტივე არის დახვეწილობის მწვერვალი. მე დაუღალავად ვმუშაობ ზედმეტი დეტალების მოსაშორებლად და მხოლოდ სუფთა ესთეტიკის შესანარჩუნებლად.“
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
