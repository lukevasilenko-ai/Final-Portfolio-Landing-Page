/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowUpRight, Clock, Mail, ShieldCheck } from 'lucide-react';
import WhatsAppIcon from './WhatsAppIcon';

const WHATSAPP_NUMBER = '995595213216';

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName || !trimmedEmail || !trimmedMessage) return;

    const whatsappMessage = [
      'გამარჯობა, მსურს დიზაინის პროექტზე საუბარი.',
      '',
      `სახელი: ${trimmedName}`,
      `ელფოსტა: ${trimmedEmail}`,
      `თემა: ${subject.trim() || 'ზოგადი დიზაინის პროექტი'}`,
      '',
      'პროექტის აღწერა:',
      trimmedMessage
    ].join('\n');
    const chatUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;
    window.location.assign(chatUrl);
  };

  return (
    <section id="contact" className="section-wrap">
      <div className="container-xl">
        <div className="mb-14 flex flex-col items-center gap-5 text-center">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            06 // თანამშრომლობა
          </span>
          <h2 className="section-title">თანამშრომლობის დაწყება</h2>
          <p className="section-subtitle max-w-2xl">
            გაქვთ ახალი ბრენდის, სოციალური მედიის ვიზუალის ან საბეჭდი მასალის იდეა? მოკლედ აღწერეთ პროექტი და საუბარს პირდაპირ WhatsApp-ში გავაგრძელებთ.
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
                ვიღებ ბრენდინგის, ლოგოს, სოციალური მედიის დიზაინისა და საბეჭდი მასალების პროექტებს. მომწერეთ იდეა, სასურველი ვადა და საჭირო ფორმატები.
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
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--brand-soft)]">ელფოსტა</span>
                    <span className="mt-1 flex items-center gap-1 break-all group-hover:underline">
                      lukevasilenko@gmail.com
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                  </div>
                </a>

                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-3 text-sm font-semibold text-[var(--brand-ink)]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]">
                    <WhatsAppIcon className="h-4 w-4" />
                  </div>
                  <div className="flex min-w-0 flex-col leading-tight">
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--brand-soft)]">WhatsApp</span>
                    <span className="mt-1 flex items-center gap-1 group-hover:underline">
                      (+995) 595 21 32 16
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                  </div>
                </a>

                <div className="flex items-center gap-3 text-sm text-[var(--brand-ink)]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-copper-soft)] text-[var(--brand-copper)]">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--brand-soft)]">სამუშაო საათები</span>
                    <span className="mt-1 font-semibold">09:00 - 18:00 GET</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-[var(--brand-line)] pt-6">
              <span className="block font-mono text-[10px] text-[var(--brand-muted)]">
                ლუკა ვასილენკო // დიზაინი, იდეა და ხასიათი
              </span>
            </div>
          </div>

          <div className="surface-card-strong relative p-6 sm:p-8 lg:col-span-8">
            <form onSubmit={handleSubmit} className="flex h-full flex-col gap-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="form-name" className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--brand-muted)]">თქვენი სახელი *</label>
                  <input
                    id="form-name"
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
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
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
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
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="მაგ: ბრენდინგი ან სოციალური მედიის პაკეტი"
                  className="field-control"
                />
              </div>

              <div className="flex flex-1 flex-col gap-2">
                <label htmlFor="form-message" className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--brand-muted)]">პროექტის აღწერა *</label>
                <textarea
                  id="form-message"
                  required
                  rows={6}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="აღწერეთ მიზანი, საჭირო მასალები, ვადა და ნებისმიერი მნიშვნელოვანი დეტალი..."
                  className="field-control min-h-40 flex-1 resize-y"
                />
              </div>

              <div className="flex flex-col items-start gap-3 border-t border-[var(--brand-line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p id="whatsapp-form-note" className="flex max-w-md items-start gap-2 text-xs leading-6 text-[var(--brand-muted)]">
                  <ShieldCheck className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--brand-accent)]" />
                  გაიხსნება WhatsApp და შეტყობინების გაგზავნას იქვე დაადასტურებთ.
                </p>
                <button
                  type="submit"
                  disabled={!name.trim() || !email.trim() || !message.trim()}
                  aria-describedby="whatsapp-form-note"
                  className="button-primary w-full shrink-0 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  WhatsApp-ში გაგრძელება
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
