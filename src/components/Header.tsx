/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, ArrowUpRight, Moon, Sun } from 'lucide-react';
import { BRAND_MARK } from '../data';
import { navigateWithinSite } from '../navigation';
import { useSiteProfile } from '../SiteProfileContext';
import { EditableLabel, useEditable } from '../websiteSections/EditableText';
import { followSiteLink, isExternalLink } from '../navigation';

interface HeaderProps {
  activeSection: string;
  navItems?: Array<{ label: string; href: string }>;
  homeHref?: string;
  contactHref?: string;
}

type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'luka-imagines-theme';

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

interface ThemeToggleProps {
  theme: ThemeMode;
  onToggle: () => void;
}

function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark';
  const label = isDark ? 'ღია თემაზე გადასვლა' : 'მუქ თემაზე გადასვლა';

  return (
    <button
      type="button"
      onClick={onToggle}
      className="icon-button h-10 w-10 shrink-0"
      aria-label={label}
      aria-pressed={isDark}
      title={label}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -35, scale: 0.75 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 35, scale: 0.75 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

const DEFAULT_NAV_ITEMS = [
  { label: 'მთავარი', href: '#home' },
  { label: 'პროექტები', href: '#projects' },
  { label: 'კალკულატორი', href: '#calculator' },
  { label: 'კონტაქტი', href: '#contact' },
];

function BrandLink({ href, onClick }: { href: string; onClick: (e: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <a href={href} onClick={onClick} className="flex shrink-0 items-center gap-3 text-[var(--brand-ink)]">
      <span className="flex h-7 w-7 items-center justify-center overflow-hidden">
        <span
          className="brand-mark-glyph"
          style={{ WebkitMaskImage: `url("${BRAND_MARK}")`, maskImage: `url("${BRAND_MARK}")` }}
          role="img"
          aria-label="Luka Imagines"
        />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-bold"><EditableLabel id="header.brand-name" fallback="Luka Imagines" /></span>
        <span className="mt-1.5 text-[11px] text-[var(--brand-muted)]"><EditableLabel id="header.brand-role" fallback="გრაფიკული დიზაინერი" /></span>
      </span>
    </a>
  );
}

export default function Header({ activeSection, navItems, homeHref, contactHref }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const profile = useSiteProfile();
  const headerCta = useEditable('header.cta', 'button', '„დამიკავშირდით“ ღილაკი', ['hide', 'href']);
  const themeToggle = useEditable('header.theme', 'item', 'თემის ღილაკი');

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);

    let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColor) {
      themeColor = document.createElement('meta');
      themeColor.name = 'theme-color';
      document.head.appendChild(themeColor);
    }
    themeColor.content = theme === 'dark' ? '#121110' : '#f2efe9';
  }, [theme]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  const resolvedNavItems = navItems ?? DEFAULT_NAV_ITEMS;
  const resolvedHomeHref = homeHref ?? '#home';
  const resolvedContactHref = contactHref ?? '#contact';
  const showContact = contactHref !== undefined || !navItems;
  const toggleTheme = () => setTheme((current) => (current === 'light' ? 'dark' : 'light'));

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);
    navigateWithinSite(`/${href}`);
  };

  return (
    <>
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        id="navbar"
        className={`fixed inset-x-0 top-0 z-50 border-b px-[var(--section-space-x)] transition-[background-color,border-color] duration-300 ${
          isScrolled && !isMobileMenuOpen
            ? 'border-[var(--brand-line)] bg-[var(--brand-header-surface)] backdrop-blur-xl'
            : 'border-transparent bg-transparent'
        }`}
      >
        <div className="container-xl flex h-[76px] items-center justify-between gap-6">
          <BrandLink href={resolvedHomeHref} onClick={(e) => handleNavClick(e, resolvedHomeHref)} />

          <nav aria-label="მთავარი ნავიგაცია" className="hidden items-center gap-9 lg:flex">
            {resolvedNavItems.map((item) => {
              const isActive = activeSection === item.href.substring(1);
              return (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  aria-current={isActive ? 'location' : undefined}
                  className={`relative py-2 text-[14px] transition-colors duration-200 ${
                    isActive ? 'text-[var(--brand-ink)]' : 'text-[var(--brand-muted)] hover:text-[var(--brand-ink)]'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <motion.span
                      layoutId="activeNavIndicator"
                      className="absolute inset-x-0 bottom-0 h-px bg-[var(--brand-ink)]"
                      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                    />
                  )}
                </a>
              );
            })}
          </nav>

          <div className="hidden shrink-0 items-center gap-3 lg:flex">
            {!themeToggle.gone && <span {...themeToggle.attrs} className="inline-flex"><ThemeToggle theme={theme} onToggle={toggleTheme} /></span>}
            {showContact && !headerCta.gone ? (
              <a
                {...headerCta.attrs}
                href={headerCta.href(resolvedContactHref)}
                onClick={(e) => {
                  const target = headerCta.href(resolvedContactHref);
                  if (target === resolvedContactHref) { handleNavClick(e, resolvedContactHref); return; }
                  if (followSiteLink(target)) e.preventDefault();
                }}
                target={isExternalLink(headerCta.href(resolvedContactHref)) ? '_blank' : undefined}
                rel={isExternalLink(headerCta.href(resolvedContactHref)) ? 'noreferrer' : undefined}
                className="button-secondary min-h-10 px-5 text-[13px]"
              >
                <EditableLabel id="header.cta" fallback="დამიკავშირდით" />
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="icon-button h-10 w-10"
              aria-label={isMobileMenuOpen ? 'მენიუს დახურვა' : 'მენიუს გახსნა'}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation"
            >
              {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            id="mobile-navigation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-[var(--brand-page)] px-[var(--section-space-x)] pb-10 pt-[100px] lg:hidden"
          >
            <nav aria-label="მობილური ნავიგაცია" className="flex flex-col border-t border-[var(--brand-line)]">
              {resolvedNavItems.map((item, index) => {
                const isActive = activeSection === item.href.substring(1);
                return (
                  <motion.a
                    key={item.label}
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.href)}
                    aria-current={isActive ? 'location' : undefined}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.04 * index, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-baseline gap-5 border-b border-[var(--brand-line)] py-5 text-[var(--brand-ink)]"
                  >
                    <span className="text-[13px] tabular-nums text-[var(--brand-soft)]">{String(index + 1).padStart(2, '0')}</span>
                    <span className={`ed-display text-[34px] leading-none ${isActive ? 'text-[var(--brand-accent)]' : ''}`}>{item.label}</span>
                  </motion.a>
                );
              })}
            </nav>

            <div className="mt-auto flex flex-col gap-4 pt-10">
              <p className="flex items-center gap-2 text-sm text-[var(--brand-muted)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-accent)]" />
                {profile.location} · {profile.availability.text}
              </p>
              {showContact ? (
                <a
                  href={resolvedContactHref}
                  onClick={(e) => handleNavClick(e, resolvedContactHref)}
                  className="button-primary w-full"
                >
                  ვითანამშრომლოთ
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
