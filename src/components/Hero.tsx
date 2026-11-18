/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Fragment, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { HERO_ARTWORK } from '../data';
import WorkStrip, { posterStyle } from './WorkStrip';
import ExploreWorksButton from './WorksPortal';
import HeroPhrase from './HeroPhrase';
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

export default function Hero({ content }: { content?: WebsiteCopy; primaryTarget?: string }) {
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

  // The works button opens the full catalogue (all works) unless a different link was set in the editor.
  const ctaHref = cta.href('/portfolio');
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

          {/* The statement on the left (it animates itself in); the works button and social links
              beside it (below on phones). */}
          <div className="mt-8 grid grid-cols-1 items-center gap-8 md:mb-10 md:mt-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12">
            <NativeElementSlot id="hero.title"><h1 className="hero-phrase-stage">
              <HeroPhrase content={content} />
            </h1></NativeElementSlot>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease, delay: 0.3 }}
              className="flex flex-wrap items-center gap-5 lg:flex-col lg:gap-6"
            >
              {!cta.gone && <NativeElementSlot id="hero.primary-action"><ExploreWorksButton
                attrs={cta.attrs}
                href={ctaHref}
                editing={cta.editing}
                plainLabel={websiteCopy(content, 'primaryButtonLabel', 'ნამუშევრების დათვალიერება')}
              >
                <EditableText field="primaryButtonLabel">{websiteCopy(content, 'primaryButtonLabel', 'ნამუშევრების დათვალიერება')}</EditableText>
              </ExploreWorksButton></NativeElementSlot>}

              <NativeElementSlot id="hero.social-links"><div className="flex items-center gap-2">
                {socialLinks.map((link) => <Fragment key={link.key}><SocialIcon link={link} scope="hero" className="icon-button h-11 w-11" /></Fragment>)}
              </div></NativeElementSlot>
            </motion.div>
          </div>
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
    </section>
  );
}
