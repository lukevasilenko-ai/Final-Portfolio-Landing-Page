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
  Lock,
  Unlock,
  Trash2,
  AlertCircle,
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

  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [messagesList, setMessagesList] = useState<ContactMessage[]>([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

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

  const handleAdminUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'luke2026' || adminPassword.toLowerCase() === 'demo') {
      setIsAdminUnlocked(true);
      setPasswordError('');
    } else {
      setPasswordError('არასწორი პაროლი. რჩევა: გამოიყენეთ "demo" ან "luke2026"');
    }
  };

  const deleteMessage = (id: string) => {
    const updated = messagesList.filter(msg => msg.id !== id);
    setMessagesList(updated);
    localStorage.setItem('luke-portfolio-messages', JSON.stringify(updated));
  };

  const clearAllMessages = () => {
    setMessagesList([]);
    localStorage.removeItem('luke-portfolio-messages');
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
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(36,72,61,0.1)] text-[var(--brand-accent)]">
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
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(36,72,61,0.1)] text-[var(--brand-accent)]">
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
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(180,95,60,0.12)] text-[var(--brand-copper)]">
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
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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
                  className="absolute inset-x-6 bottom-6 flex items-start gap-3 rounded-lg border border-[rgba(40,118,95,0.28)] bg-[rgba(255,255,252,0.92)] p-4 text-[var(--brand-ink)] shadow-[var(--brand-shadow)] backdrop-blur-xl sm:inset-x-8 sm:bottom-8"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-success)] text-white">
                    <Check className="h-5 w-5 stroke-[3px]" />
                  </div>
                  <div className="flex flex-col">
                    <p className="flex items-center gap-2 text-sm font-bold">
                      შეტყობინება წარმატებით გაიგზავნა
                      <Sparkles className="h-4 w-4 text-[var(--brand-copper)]" />
                    </p>
                    <p className="mt-1 text-xs leading-6 text-[var(--brand-muted)]">თქვენი შეტყობინება შენახულია localStorage-ში. შესამოწმებლად გახსენით ქვემოთ მოცემული ბაზის ლოგები!</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="surface-card mt-10 overflow-hidden">
          <div
            onClick={() => setShowAdminPanel(!showAdminPanel)}
            className="flex cursor-pointer items-center justify-between gap-4 border-b border-[var(--brand-line)] bg-white/45 px-5 py-4 transition-colors hover:bg-white/70 sm:px-6"
          >
            <div className="flex items-center gap-3">
              {isAdminUnlocked ? <Unlock className="h-4 w-4 text-[var(--brand-accent)]" /> : <Lock className="h-4 w-4 text-[var(--brand-muted)]" />}
              <span className="font-mono text-xs font-bold text-[var(--brand-ink)]">
                დეველოპერის კომპილატორი და შეტყობინებების ლოგი (EASTER EGG)
              </span>
            </div>

            <button className="font-mono text-xs font-bold text-[var(--brand-muted)] underline-offset-4 hover:text-[var(--brand-ink)] hover:underline">
              {showAdminPanel ? 'ლოგების დახურვა' : 'ლოგების ჩვენება'}
            </button>
          </div>

          <AnimatePresence>
            {showAdminPanel && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                {!isAdminUnlocked ? (
                  <form onSubmit={handleAdminUnlock} className="flex max-w-xl flex-col gap-4 p-6 sm:p-8">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--brand-ink)]">
                        <AlertCircle className="h-4 w-4 text-[var(--brand-copper)]" />
                        <span>ინტერაქტიული შენახვის ვერიფიკაცია</span>
                      </div>
                      <p className="text-sm leading-7 text-[var(--brand-muted)]">
                        იმის დასამტკიცებლად, რომ ეს არ არის სიმულირებული შაბლონი, შეტყობინებები ინახება კლიენტის ლოკალურ მეხსიერებაში (LocalStorage). განბლოკეთ ბაზის ლოგები თქვენი შეტყობინებების სანახავად.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        type="password"
                        required
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="რჩევა: ჩაწერეთ 'demo' ან 'luke2026'"
                        className="field-control"
                      />
                      <button type="submit" className="button-primary shrink-0 text-xs">
                        ლოგების განბლოკვა
                      </button>
                    </div>

                    {passwordError && (
                      <p className="font-mono text-[11px] font-semibold text-[var(--brand-danger)]">{passwordError}</p>
                    )}
                  </form>
                ) : (
                  <div className="flex flex-col gap-6 p-6 sm:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--brand-line)] pb-4">
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="h-2 w-2 rounded-full bg-[var(--brand-success)]" />
                        <span className="font-bold text-[var(--brand-ink)]">LOCALSTORE_ბაზა // აქტიური_შეტყობინებები: {messagesList.length}</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={clearAllMessages}
                          disabled={messagesList.length === 0}
                          className="flex items-center gap-2 rounded-lg border border-[rgba(175,61,56,0.24)] bg-[rgba(175,61,56,0.08)] px-3.5 py-2 text-xs font-semibold text-[var(--brand-danger)] transition-colors hover:bg-[rgba(175,61,56,0.14)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          ბაზის გასუფთავება
                        </button>
                        <button
                          onClick={() => setIsAdminUnlocked(false)}
                          className="button-secondary gap-2 text-xs"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          ლოგების ჩაკეტვა
                        </button>
                      </div>
                    </div>

                    {messagesList.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-10 text-center text-[var(--brand-muted)]">
                        <MessageSquare className="h-8 w-8 text-[var(--brand-accent)]" />
                        <p className="font-mono text-xs">შეტყობინებები კლიენტის ლოკალურ მეხსიერებაში ვერ მოიძებნა.</p>
                        <p className="text-sm">გამოაგზავნეთ შეტყობინება ზემოთ მოცემული ფორმიდან და ის მომენტალურად გამოჩნდება აქ!</p>
                      </div>
                    ) : (
                      <div className="flex max-h-[350px] flex-col gap-4 overflow-y-auto pr-2">
                        {messagesList.map((msg) => (
                          <div key={msg.id} className="flex flex-col justify-between gap-4 rounded-lg border border-[var(--brand-line)] bg-white/55 p-4 transition-colors hover:bg-white/75 sm:flex-row">
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="text-sm font-bold text-[var(--brand-ink)]">{msg.name}</span>
                                <span className="font-mono text-[10px] text-[var(--brand-muted)]">({msg.email})</span>
                              </div>
                              <p className="font-mono text-[11px] font-semibold uppercase text-[var(--brand-accent)]">თემა: {msg.subject}</p>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-[var(--brand-muted)]">{msg.message}</p>
                            </div>

                            <div className="flex shrink-0 items-end justify-between gap-2 sm:flex-col sm:items-end sm:justify-start">
                              <span className="font-mono text-[10px] font-bold text-[var(--brand-muted)]">{msg.timestamp}</span>
                              <button
                                onClick={() => deleteMessage(msg.id)}
                                className="rounded-lg border border-transparent p-2 text-[var(--brand-danger)] transition-colors hover:border-[rgba(175,61,56,0.24)] hover:bg-[rgba(175,61,56,0.08)]"
                                aria-label="Delete message record"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
