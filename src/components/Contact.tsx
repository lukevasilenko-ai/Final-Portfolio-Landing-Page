/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import WhatsAppIcon from './WhatsAppIcon';
import { websiteCopy, type WebsiteCopy } from '../websiteSections/copy';
import { NativeElementSlot } from '../websiteSections/NativeElements';
import SectionHeader, { stripSectionIndex } from './SectionHeader';
import { useSiteProfile } from '../SiteProfileContext';
import { EditableText, useEditable } from '../websiteSections/EditableText';
import { useWebsiteEditorRuntime } from '../websiteSections/EditorRuntime';

/** One contact channel row (email / WhatsApp); each can be hidden in the editor. */
function ChannelRow({ id, label, value, href }: { id: string; label: React.ReactNode; value: string; href: string }) {
  const editable = useEditable(id, 'item', 'საკონტაქტო რიგი');
  if (editable.gone) return null;
  return (
    <a
      {...editable.attrs}
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex items-end justify-between gap-6 border-b border-[var(--brand-line)] py-6"
    >
      <span className="flex min-w-0 flex-col gap-2">
        <span className="ed-kicker">{label}</span>
        <span className="ed-display text-[clamp(1.25rem,1.9vw,1.75rem)] leading-tight text-[var(--brand-ink)] [overflow-wrap:anywhere]">{value}</span>
      </span>
      <ArrowUpRight className="mb-2 h-5 w-5 shrink-0 text-[var(--brand-soft)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-[var(--brand-ink)]" />
    </a>
  );
}

export default function Contact({ content }: { content?: WebsiteCopy }) {
  // Email and WhatsApp are edited once, in the admin's "კონტაქტი და სტატუსი"; section copy is only a fallback.
  const profile = useSiteProfile();
  const { enabled: editing } = useWebsiteEditorRuntime();
  const whatsappNumber = profile.socials.whatsapp || websiteCopy(content, 'whatsappNumber', '995595213216');
  const contactEmail = profile.socials.email || websiteCopy(content, 'contactEmail', 'lukevasilenko@gmail.com');
  const formattedPhone = whatsappNumber.startsWith('995') && whatsappNumber.length === 12
    ? `(+995) ${whatsappNumber.slice(3, 6)} ${whatsappNumber.slice(6, 8)} ${whatsappNumber.slice(8, 10)} ${whatsappNumber.slice(10)}`
    : whatsappNumber;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const lastPrefill = useRef({ subject: '', message: '' });

  // "Order" in the price calculator fills in the subject and description (never over what the
  // visitor has typed themselves).
  useEffect(() => {
    const fill = (event: Event) => {
      const detail = (event as CustomEvent<{ subject?: string; message?: string }>).detail;
      if (!detail || typeof detail.subject !== 'string' || typeof detail.message !== 'string') return;
      const next = { subject: detail.subject.slice(0, 120), message: detail.message.slice(0, 2000) };
      setSubject((current) => (!current.trim() || current === lastPrefill.current.subject ? next.subject : current));
      setMessage((current) => (!current.trim() || current === lastPrefill.current.message ? next.message : current));
      lastPrefill.current = next;
    };
    window.addEventListener('luka-calculator-request', fill);
    return () => window.removeEventListener('luka-calculator-request', fill);
  }, []);

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
    const chatUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
    window.location.assign(chatUrl);
  };

  const hours = useEditable('contact.hours', 'item', 'სამუშაო საათები');
  // Form fields: clicking one in the editor lets you change its hint (placeholder) text.
  const fieldAttrs = (id: string, label: string, key: string) => editing ? {
    'data-edit-id': id, 'data-edit-kind': 'field', 'data-edit-label': label, 'data-edit-props': `copy:contact.${key}`,
  } : {};

  return (
    <section id="contact" className="section-wrap ed-section">
      <div className="container-xl">
        <SectionHeader
          eyebrow={{ slot: 'contact.eyebrow', content: <EditableText field="eyebrow">{stripSectionIndex(websiteCopy(content, 'eyebrow', 'თანამშრომლობა'))}</EditableText> }}
          title={{ slot: 'contact.title', content: <EditableText field="title">{websiteCopy(content, 'title', 'თანამშრომლობის დაწყება')}</EditableText> }}
          description={{ slot: 'contact.description', content: <EditableText field="description">{websiteCopy(content, 'description', 'გაქვთ ახალი ბრენდის, სოციალური მედიის ვიზუალის ან საბეჭდი მასალის იდეა? მოკლედ აღწერეთ პროექტი და საუბარს პირდაპირ WhatsApp-ში გავაგრძელებთ.')}</EditableText> }}
        />

        <div className="ed-grid gap-y-20">
          <NativeElementSlot id="contact.channels"><div className="ed-main grid grid-cols-1 gap-x-16 gap-y-10 lg:grid-cols-2">
            <div className="flex flex-col gap-6">
              <span className="ed-kicker"><EditableText field="channelsTitle">{websiteCopy(content, 'channelsTitle', 'პირდაპირი არხები')}</EditableText></span>
              <h3 className="ed-display text-[clamp(1.9rem,3.4vw,3rem)] leading-[1.15] text-[var(--brand-ink)]">
                <EditableText field="cardTitleLead">{websiteCopy(content, 'cardTitleLead', 'შევქმნათ რამე ')}</EditableText>
                <em className="text-[var(--brand-accent)]"><EditableText field="cardTitleAccentOne">{websiteCopy(content, 'cardTitleAccentOne', 'ლამაზი')}</EditableText></em>
                <EditableText field="cardTitleMiddle">{websiteCopy(content, 'cardTitleMiddle', ' და ')}</EditableText>
                <em className="text-[var(--brand-accent)]"><EditableText field="cardTitleAccentTwo">{websiteCopy(content, 'cardTitleAccentTwo', 'განსაკუთრებული')}</EditableText></em>
                <EditableText field="cardTitleEnd">{websiteCopy(content, 'cardTitleEnd', '.')}</EditableText>
              </h3>
              <p className="max-w-[46ch] text-[15px] leading-7 text-[var(--brand-muted)]">
                <EditableText field="contactCardDescription">{websiteCopy(content, 'contactCardDescription', 'ვიღებ ბრენდინგის, ლოგოს, სოციალური მედიის დიზაინისა და საბეჭდი მასალების პროექტებს. მომწერეთ იდეა, სასურველი ვადა და საჭირო ფორმატები.')}</EditableText>
              </p>
            </div>

            <div className="flex flex-col border-t border-[var(--brand-line)]">
              {<ChannelRow id="contact.email-row" label={<EditableText field="emailLabel">{websiteCopy(content, 'emailLabel', 'ელფოსტა')}</EditableText>} value={contactEmail} href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contactEmail)}`} />}
              {<ChannelRow id="contact.whatsapp-row" label={<EditableText field="whatsappLabel">{websiteCopy(content, 'whatsappLabel', 'WhatsApp')}</EditableText>} value={formattedPhone} href={`https://wa.me/${whatsappNumber}`} />}
              {!hours.gone && <div {...hours.attrs} className="flex flex-col gap-2 py-6">
                <span className="ed-kicker"><EditableText field="workingHoursLabel">{websiteCopy(content, 'workingHoursLabel', 'სამუშაო საათები')}</EditableText></span>
                <span className="whitespace-nowrap text-[17px] text-[var(--brand-ink)]"><EditableText field="workingHours">{websiteCopy(content, 'workingHours', '09:00 - 18:00 GET')}</EditableText></span>
                <span className="mt-4 text-[13px] text-[var(--brand-soft)]">
                  <EditableText field="signature">{websiteCopy(content, 'signature', 'ლუკა ვასილენკო // დიზაინი, იდეა და ხასიათი')}</EditableText>
                </span>
              </div>}
            </div>
          </div></NativeElementSlot>

          <NativeElementSlot id="contact.form"><div className="ed-main border-t border-[var(--brand-ink)] pt-12">
            <form onSubmit={handleSubmit} className="flex flex-col gap-10">
              <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
                <div className="flex flex-col gap-1" {...fieldAttrs('contact.field-name', 'სახელის ველი', 'formNamePlaceholder')}>
                  <label htmlFor="form-name" className="field-label"><EditableText field="formNameLabel">{websiteCopy(content, 'formNameLabel', 'თქვენი სახელი *')}</EditableText></label>
                  <input
                    id="form-name"
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={websiteCopy(content, 'formNamePlaceholder', 'შეიყვანეთ თქვენი სახელი')}
                    className="field-control"
                  />
                </div>

                <div className="flex flex-col gap-1" {...fieldAttrs('contact.field-email', 'ელფოსტის ველი', 'formEmailPlaceholder')}>
                  <label htmlFor="form-email" className="field-label"><EditableText field="formEmailLabel">{websiteCopy(content, 'formEmailLabel', 'ელფოსტის მისამართი *')}</EditableText></label>
                  <input
                    id="form-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={websiteCopy(content, 'formEmailPlaceholder', 'you@company.com')}
                    className="field-control"
                  />
                </div>

                <div className="flex flex-col gap-1" {...fieldAttrs('contact.field-subject', 'თემის ველი', 'formSubjectPlaceholder')}>
                  <label htmlFor="form-subject" className="field-label"><EditableText field="formSubjectLabel">{websiteCopy(content, 'formSubjectLabel', 'თემა / საკითხი')}</EditableText></label>
                  <input
                    id="form-subject"
                    type="text"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder={websiteCopy(content, 'formSubjectPlaceholder', 'მაგ: ბრენდინგი ან სოციალური მედიის პაკეტი')}
                    className="field-control"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1" {...fieldAttrs('contact.field-message', 'აღწერის ველი', 'formMessagePlaceholder')}>
                <label htmlFor="form-message" className="field-label"><EditableText field="formMessageLabel">{websiteCopy(content, 'formMessageLabel', 'პროექტის აღწერა *')}</EditableText></label>
                <textarea
                  id="form-message"
                  required
                  rows={4}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={websiteCopy(content, 'formMessagePlaceholder', 'აღწერეთ მიზანი, საჭირო მასალები, ვადა და ნებისმიერი მნიშვნელოვანი დეტალი...')}
                  className="field-control min-h-32 resize-y"
                />
              </div>

              <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
                <p id="whatsapp-form-note" className="max-w-md text-[13px] leading-6 text-[var(--brand-muted)]">
                  <EditableText field="formNote">{websiteCopy(content, 'formNote', 'გაიხსნება WhatsApp და შეტყობინების გაგზავნას იქვე დაადასტურებთ.')}</EditableText>
                </p>
                <button
                  type="submit"
                  disabled={!editing && (!name.trim() || !email.trim() || !message.trim())}
                  aria-describedby="whatsapp-form-note"
                  className="button-primary w-full shrink-0 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  <EditableText field="formButtonLabel">{websiteCopy(content, 'formButtonLabel', 'WhatsApp-ში გაგრძელება')}</EditableText>
                </button>
              </div>
            </form>
          </div></NativeElementSlot>
        </div>
      </div>
    </section>
  );
}
