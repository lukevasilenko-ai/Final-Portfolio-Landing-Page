/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EXPERIENCES } from '../data';
import { Calendar, Plus, Minus } from 'lucide-react';

export default function Timeline() {
  const [expandedMilestoneId, setExpandedMilestoneId] = useState<string | null>('exp-1');

  const toggleMilestone = (id: string) => {
    setExpandedMilestoneId(expandedMilestoneId === id ? null : id);
  };

  return (
    <section id="experience" className="section-wrap section-rule">
      <div className="container-md">
        <div className="mb-14 flex flex-col items-center gap-5 text-center">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            03 // გამოცდილება // გზა
          </span>
          <h2 className="section-title">პროფესიული გზა</h2>
          <p className="section-subtitle max-w-xl">
            რთული ბრაუზერული სისტემების ხელახალი შექმნა, კოდის მოდულურობის დახვეწა და ერთიანი ვიზუალური ინტერფეისების ჩამოყალიბება. დააწკაპუნეთ ნებისმიერ როლზე ძირითადი მეტრიკების სანახავად.
          </p>
        </div>

        <div className="relative ml-3 flex flex-col gap-6 border-l border-[var(--brand-line)] pl-6 sm:ml-5 sm:pl-8">
          {EXPERIENCES.map((exp) => {
            const isExpanded = expandedMilestoneId === exp.id;
            return (
              <div key={exp.id} className="relative">
                <span className={`absolute -left-[33px] top-7 h-4 w-4 rounded-full border-2 bg-[var(--brand-page)] transition-all duration-300 sm:-left-[41px] ${
                  isExpanded
                    ? 'border-[var(--brand-accent)] shadow-[var(--brand-accent-ring-shadow)]'
                    : 'border-[var(--brand-line-strong)]'
                }`} />

                <div
                  onClick={() => toggleMilestone(exp.id)}
                  className={`surface-card cursor-pointer p-6 transition-all duration-300 sm:p-7 ${
                    isExpanded ? 'border-[var(--brand-line-strong)] bg-[var(--brand-panel-solid)]' : 'hover:-translate-y-0.5 hover:border-[var(--brand-line-strong)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-5">
                    <div className="flex flex-col gap-2">
                      <span className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--brand-muted)]">
                        <Calendar className="h-3.5 w-3.5 text-[var(--brand-copper)]" />
                        {exp.period}
                      </span>
                      <h3 className="text-2xl font-bold text-[var(--brand-ink)]">{exp.role}</h3>
                      <p className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-[var(--brand-accent)]">
                        @{exp.company}
                      </p>
                    </div>

                    <button
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors duration-200 ${
                        isExpanded
                          ? 'border-[var(--brand-accent)] bg-[var(--brand-accent)] text-[var(--brand-on-accent)]'
                          : 'border-[var(--brand-line)] bg-white/50 text-[var(--brand-muted)]'
                      }`}
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <div className="mt-6 flex flex-col gap-5 border-t border-[var(--brand-line)] pt-6">
                          <p className="text-sm leading-8 text-[var(--brand-muted)]">
                            {exp.description}
                          </p>

                          <div className="flex flex-col gap-3">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--brand-soft)]">
                              ძირითადი მიღწევები და მეტრიკა
                            </span>

                            <ul className="flex flex-col gap-3">
                              {exp.highlights.map((bullet, bIdx) => (
                                <li key={bIdx} className="flex items-start gap-3 text-sm leading-7 text-[var(--brand-muted)]">
                                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-copper)]" />
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            {exp.tags.map((tag) => (
                              <span key={tag} className="tag-chip px-3 py-1.5">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
