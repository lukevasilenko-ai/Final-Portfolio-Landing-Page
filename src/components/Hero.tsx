/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Fragment, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { HERO_ARTWORK } from '../data';
import WorkStrip, { posterStyle } from './WorkStrip';
import { useSiteProfile } from '../SiteProfileContext';
import { useSocialLinks, type SocialLink } from './socialLinks';
import { followSiteLink, isExternalLink, navigateWithinSite } from '../navigation';
import { websiteCopy, type WebsiteCopy } from '../websiteSections/copy';
import { NativeElementSlot } from '../websiteSections/NativeElements';
import { EditableLabel, EditableText, useEditable } from '../websiteSections/EditableText';

const ease = [0.16, 1, 0.3, 1] as const;

const formatTime = (date: Date) => date.toLocaleTimeString('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Tbilisi'
});

/** One social icon; each can be hidden on its own in the editor. */
export function SocialIcon({ link, scope, className }: { link: SocialLink; scope: string; className: string }) {
  const editable = useEditable(`${scope}.social.${link.key}`, 'icon', link.label, ['hide']);
  if (editable.gone) return null;
  return (
    <a {...editable.attrs} href={link.href} target="_blank" rel="noreferrer" className={className} aria-label={link.label}>
      <link.Icon className="h-4 w-4" />
    </a>
  );
}

/** First tile of the strip: the main artwork (its image can be replaced in the editor). */
function HeroArtwork({ copy, content }: { copy: boolean; content?: WebsiteCopy }) {
  const editable = useEditable('hero.artwork', 'image', 'მთავარი ნამუშევარი', ['image', 'hide']);
  if (editable.gone) return null;
  const artwork = (
    <a
      {...(copy ? {} : editable.attrs)}
      href="/portfolio"
      onClick={(event) => {
        event.preventDefault();
        navigateWithinSite('/portfolio');
      }}
      className="work-strip-item"
      style={posterStyle(content?.heroImageSrc || HERO_ARTWORK)}
      aria-hidden={copy || undefined}
      tabIndex={copy ? -1 : undefined}
      aria-label={copy ? undefined : websiteCopy(content, 'imageAlt', 'ავეჯის სარეკლამო პოსტერი')}
    >
      <img alt="" src={content?.heroImageSrc || HERO_ARTWORK} decoding="async" />
    </a>
  );
  return copy ? artwork : <NativeElementSlot id="hero.artwork">{artwork}</NativeElementSlot>;
}

export default function Hero({ content, primaryTarget = 'projects' }: { content?: WebsiteCopy; primaryTarget?: string }) {
  const [time, setTime] = useState(() => new Date());
  const profile = useSiteProfile();
  const socialLinks = useSocialLinks();
  const location = useEditable('hero.location', 'item', 'მდებარეობა');
  const clock = useEditable('hero.time', 'item', 'საათი');
  const status = useEditable('hero.status', 'item', 'სტატუსი');
  const catalogLink = useEditable('hero.catalog-link', 'link', 'კატალოგის ბმული', ['hide', 'href']);
  const cta = useEditable('hero.cta', 'button', 'მთავარი ღილაკი', ['hide', 'href']);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  const ctaHref = cta.href(`#${primaryTarget}`);
  const catalogHref = catalogLink.href('/portfolio');
  const handleLink = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (followSiteLink(href)) event.preventDefault();
  };

  return (
    <section id="home" className="flex min-h-[100svh] flex-col pb-10 pt-[104px] md:pb-12 md:pt-[120px]">
      <div className="order-1 px-[var(--section-space-x)]">
        <div className="container-xl">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease, delay: 0.05 }}
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-[var(--brand-line)] pb-5"
          >
            <NativeElementSlot id="hero.eyebrow"><span className="ed-kicker">
              <EditableText field="eyebrow">{websiteCopy(content, 'eyebrow', 'გრაფიკული დიზაინერი')}</EditableText>
            </span></NativeElementSlot>
            <span className="ed-kicker flex flex-wrap items-center gap-x-4 gap-y-1">
              {!location.gone && <span {...location.attrs} className="hidden md:inline">{profile.location}</span>}
              {!clock.gone && <span {...clock.attrs} className="hidden tabular-nums md:inline">{formatTime(time)} GET</span>}
              {!status.gone && (
                <span {...status.attrs} className="flex items-center gap-2 text-[var(--brand-ink)]">
                  <span className={`h-1.5 w-1.5 rounded-full ${profile.availability.open ? 'bg-[var(--brand-accent)]' : 'bg-[var(--brand-copper)]'}`} aria-hidden="true" />
                  {profile.availability.text}
                </span>
              )}
            </span>
          </motion.div>

          <NativeElementSlot id="hero.title"><motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease, delay: 0.12 }}
            className="hero-display mt-10 md:mt-14"
          >
            <span className="block"><EditableText field="titleLine1">{websiteCopy(content, 'titleLine1', 'ესთეტიკა,')}</EditableText></span>
            <span className="block">
              <EditableText field="titleLine2">{websiteCopy(content, 'titleLine2', 'იდეა და ხასიათი')}</EditableText>{' '}
              <span className="hero-script whitespace-nowrap"><EditableText field="titleLine3">{websiteCopy(content, 'titleLine3', 'ერთ დიზაინში')}</EditableText></span>
            </span>
          </motion.h1></NativeElementSlot>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, ease, delay: 0.5 }}
        className="order-2 mt-12 md:order-3 md:mt-auto"
      >
        <div className="px-[var(--section-space-x)]">
          <div className="container-xl mb-4 flex items-center justify-between gap-4">
            <NativeElementSlot id="hero.featured-label"><span className="ed-kicker">
              <EditableText field="featuredLabel">{websiteCopy(content, 'featuredLabel', 'ბოლო ნამუშევარი')}</EditableText>
            </span></NativeElementSlot>
            {!catalogLink.gone && (
              <a
                {...catalogLink.attrs}
                href={catalogHref}
                onClick={handleLink(catalogHref)}
                target={isExternalLink(catalogHref) ? '_blank' : undefined}
                rel={isExternalLink(catalogHref) ? 'noreferrer' : undefined}
                className="ed-link text-[13px]"
              >
                <EditableLabel id="hero.catalog-link" fallback="სრული კატალოგი" />
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
        <WorkStrip lead={(copy) => <HeroArtwork copy={copy} content={content} />} />
      </motion.div>

      <div className="order-3 mt-10 px-[var(--section-space-x)] md:order-2 md:mb-14 md:mt-12">
        <div className="container-xl ed-grid gap-y-8">
          <NativeElementSlot id="hero.description"><motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.24 }}
            className="lead-copy col-span-12 max-w-[60ch] text-[16px] lg:col-span-6 lg:col-start-4"
          >
            <EditableText field="description">{websiteCopy(content, 'description', 'გამარჯობა, მე ვარ ლუკა ვასილენკო. მე ვქმნი თვალშისაცემ ვიზუალურ პროდუქტებს, სადაც კრეატიული იდეები და ვიზუალური მინიმალიზმი ერთმანეთს ერწყმის. სპეციალიზებული ვარ სოც. მედია პოსტერების, ლოგოების, ბანერების, სავიზიტო ბარათების, ბრენდინგისა და რებრენდინგის მიმართულებით. ვმუშაობ Adobe Photoshop-სა და Adobe Illustrator-ში.')}</EditableText>
          </motion.p></NativeElementSlot>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.32 }}
            className="col-span-12 flex flex-wrap items-center gap-3 lg:col-span-3 lg:col-start-10 lg:flex-col lg:items-end lg:justify-end"
          >
            {!cta.gone && <NativeElementSlot id="hero.primary-action"><a
              {...cta.attrs}
              href={ctaHref}
              onClick={handleLink(ctaHref)}
              target={isExternalLink(ctaHref) ? '_blank' : undefined}
              rel={isExternalLink(ctaHref) ? 'noreferrer' : undefined}
              className="button-primary"
            >
              <EditableText field="primaryButtonLabel">{websiteCopy(content, 'primaryButtonLabel', 'ნამუშევრების დათვალიერება')}</EditableText>
              <ArrowDown className="h-4 w-4" />
            </a></NativeElementSlot>}

            <NativeElementSlot id="hero.social-links"><div className="flex items-center gap-2">
              {socialLinks.map((link) => <Fragment key={link.key}><SocialIcon link={link} scope="hero" className="icon-button h-11 w-11" /></Fragment>)}
            </div></NativeElementSlot>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
