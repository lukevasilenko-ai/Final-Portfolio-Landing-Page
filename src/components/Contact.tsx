/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  Mail,
  Phone,
  MessageSquare,
  Check,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { ContactMessage } from '../types';

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [messagesList, setMessagesList] = useState<ContactMessage[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('luke-portfolio-messages');
    if (saved) {
      try {
        setMessagesList(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to parse saved messages", err);
      }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;

    setIsSubmitting(true);

    setTimeout(() => {
      const newMessage: ContactMessage = {
        id: 'msg-' + Date.now(),
        name,
        email,
        subject: subject || 'ზოგადი თანამშრომლობა',
        message,
        timestamp: new Date().toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      const updatedList = [newMessage, ...messagesList];
      setMessagesList(updatedList);
      localStorage.setItem('luke-portfolio-messages', JSON.stringify(updatedList));

      setIsSubmitting(false);
      setSubmitSuccess(true);

      setName('');
      setEmail('');
      setSubject('');
      setMessage('');

      setTimeout(() => {
        setSubmitSuccess(false);
      }, 5000);

    }, 1200);
  };

  return (
    <section id="contact" className="section-wrap">
      <div className="container-xl">
        <div className="mb-14 flex flex-col items-center gap-5 text-center">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            06 // შემოსულები // თანამშრომლობა
          </span>
          <h2 className="section-title">თანამშრომლობის დაწყება</h2>
          <p className="section-subtitle max-w-xl">
            გჭირდებათ არქიტექტორი რთული ვებ აპლიკაციის რეფაქტორირებისთვის ან კომპონენტების ძლიერი ვიზუალური ენის შესაქმნელად? გამოაგზავნეთ შეტყობინება ქვემოთ.
          </p>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
          <div className="surface-card-strong flex flex-col justify-between p-6 sm:p-8 lg:col-span-4">
            <div className="flex flex-col gap-6">
              <div className="eyebrow">
                <span className="eyebrow-dot" />
                პირდაპირი არხები
              </div>

              <h3 className="text-3xl font-bold leading-tight text-[var(--brand-ink)]">
                შევქმნათ რამე <span className="text-[var(--brand-accent)]">ლამაზი</span> და{' '}
                <span className="text-[var(--brand-accent)]">განსაკუთრებული</span>.
              </h3>
              <p className="text-sm leading-8 text-[var(--brand-muted)]">
                როგორც წესი, სწრაფად ვპასუხობ შემოთავაზებებს დიზაინ სისტემების ინტეგრაციასთან, წარმადობის ოპტიმიზაციის კონსულტაციებთან ან სრულყოფილი React პროექტების შექმნასთან დაკავშირებით.
              </p>

              <div className="h-px bg-[var(--brand-line)]" />

              <div className="flex flex-col gap-5">
                <a
                  href="https://mail.google.com/mail/?view=cm&fs=1&to=lukevasilenko%40gmail.com"
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-3 text-sm font-semibold text-[var(--brand-ink)]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="flex min-w-0 flex-col leading-tight">
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--brand-soft)]">ძირითადი ელფოსტა</span>
                    <span className="mt-1 flex items-center gap-1 break-all group-hover:underline">
                      lukevasilenko@gmail.com
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                  </div>
                </a>

                <a
                  href="tel:+995595213216"
                  className="group flex items-center gap-3 text-sm font-semibold text-[var(--brand-ink)]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div className="flex min-w-0 flex-col leading-tight">
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--brand-soft)]">ტელეფონი</span>
                    <span className="mt-1 flex items-center gap-1 group-hover:underline">
                      (+995) 595 21 32 16
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                  </div>
                </a>

                <div className="flex items-center gap-3 text-sm text-[var(--brand-ink)]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-copper-soft)] text-[var(--brand-copper)]">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--brand-soft)]">სამუშაო საათები</span>
                    <span className="mt-1 font-semibold">09:00 - 18:00 GMT</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-[var(--brand-line)] pt-6">
              <span className="block font-mono text-[10px] text-[var(--brand-muted)]">
                ლუკ_ვასილენკო // დიზაინ_სისტემა_სტაბილური_V1
              </span>
            </div>
          </div>

          <div className="surface-card-strong relative p-6 sm:p-8 lg:col-span-8">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="form-name" className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--brand-muted)]">თქვენი სახელი *</label>
                  <input
                    id="form-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="შეიყვანეთ თქვენი სახელი"
                    className="field-control"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="form-email" className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--brand-muted)]">ელფოსტის მისამართი *</label>
                  <input
                    id="form-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="field-control"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="form-subject" className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--brand-muted)]">თემა / საკითხი</label>
                <input
                  id="form-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="მაგ: დიზაინ სისტემის პროექტი"
                  className="field-control"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="form-message" className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--brand-muted)]">უსაფრთხო შეტყობინება *</label>
                <textarea
                  id="form-message"
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="აღწერეთ თქვენი მიზნები, მოთხოვნები, ვადები ან შეკითხვები..."
                  className="field-control resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !name || !email || !message}
                className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:self-start"
              >
                {isSubmitting ? (
                  <>
                    <div className="button-spinner h-4 w-4 animate-spin rounded-full border-2" />
                    უსაფრთხოდ იგზავნება...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    შეტყობინების გაგზავნა
                  </>
                )}
              </button>
            </form>

            <AnimatePresence>
              {submitSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute inset-x-6 bottom-6 flex items-start gap-3 rounded-lg border border-[var(--brand-success-line)] bg-[var(--brand-canvas-92)] p-4 text-[var(--brand-ink)] shadow-[var(--brand-shadow)] backdrop-blur-xl sm:inset-x-8 sm:bottom-8"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-success)] text-[var(--brand-on-accent)]">
                    <Check className="h-5 w-5 stroke-[3px]" />
                  </div>
                  <div className="flex flex-col">
                    <p className="flex items-center gap-2 text-sm font-bold">
                      შეტყობინება წარმატებით გაიგზავნა
                      <Sparkles className="h-4 w-4 text-[var(--brand-copper)]" />
                    </p>
                    <p className="mt-1 text-xs leading-6 text-[var(--brand-muted)]">თქვენი შეტყობინება წარმატებით დამუშავდა. პასუხს მალე მიიღებთ.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </section>
  );
}
