/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, ArrowUpRight, Moon, Sun } from 'lucide-react';
import { BRAND_MARK } from '../data';
import { navigateWithinSite } from '../navigation';

interface HeaderProps {
  activeSection: string;
}

type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'luka-imagines-theme';

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';

  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
};

interface ThemeToggleProps {
  theme: ThemeMode;
  onToggle: () => void;
}

function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';

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

export default function Header({ activeSection }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

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
    themeColor.content = theme === 'dark' ? '#0b0e0c' : '#f4f6f2';
  }, [theme]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'მთავარი', href: '#home' },
    { label: 'ჩემ შესახებ', href: '#about' },
    { label: 'პროექტები', href: '#projects' },
    { label: 'კალკულატორი', href: '#calculator' },
    { label: 'კონტაქტი', href: '#contact' }
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);
    navigateWithinSite(`/${href}`);
  };

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        id="navbar"
        className={`fixed inset-x-0 top-0 z-50 px-5 py-4 transition-all duration-300 sm:px-8 ${
          isScrolled
            ? 'border-b border-[var(--brand-line)] bg-[var(--brand-header-surface)] shadow-[var(--brand-shadow-soft)] backdrop-blur-xl'
            : 'bg-transparent'
        }`}
      >
        <div className="container-xl flex items-center justify-between gap-4">
          <a
            href="#home"
            onClick={(e) => handleNavClick(e, '#home')}
            className="group flex items-center gap-3 font-sans text-[var(--brand-ink)]"
          >
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg transition-transform duration-300 group-hover:-translate-y-0.5">
              <span
                className="brand-mark-glyph"
                style={{ WebkitMaskImage: `url("${BRAND_MARK}")`, maskImage: `url("${BRAND_MARK}")` }}
                role="img"
                aria-label="Luka Imagines"
              />
            </span>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-bold">Luka Imagines</span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--brand-muted)]">
                გრაფიკული დიზაინერი
              </span>
            </div>
          </a>

          <nav className="surface-card hidden items-center gap-1 rounded-full p-1 lg:flex">
            {navItems.map((item) => {
              const isActive = activeSection === item.href.substring(1);
              return (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={`relative rounded-full px-3 py-2 text-xs font-semibold transition-colors duration-200 xl:px-4 ${
                    isActive ? 'text-[var(--brand-on-accent)]' : 'text-[var(--brand-muted)] hover:text-[var(--brand-ink)]'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="activeNavBubble"
                      className="absolute inset-0 -z-10 rounded-full bg-[var(--brand-accent)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <ThemeToggle
              theme={theme}
              onToggle={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
            />
            <span className="status-pill flex items-center gap-2 px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-success)]" />
              ხელმისაწვდომია სამუშაოდ
            </span>
            <a
              href="#contact"
              onClick={(e) => handleNavClick(e, '#contact')}
              className="button-primary min-h-10 px-4 text-xs"
            >
              დამიკავშირდით
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle
              theme={theme}
              onToggle={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
            />
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="icon-button"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
            className="surface-card fixed inset-x-4 top-[76px] z-40 flex flex-col gap-5 p-5 shadow-[var(--brand-shadow)] lg:hidden"
          >
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => {
                const isActive = activeSection === item.href.substring(1);
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.href)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-200 ${
                      isActive ? 'bg-[var(--brand-accent)] text-[var(--brand-on-accent)]' : 'text-[var(--brand-muted)] hover:bg-white/60 hover:text-[var(--brand-ink)]'
                    }`}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>

            <div className="h-px bg-[var(--brand-line)]" />

            <div className="flex flex-col gap-3">
              <div className="status-pill flex items-center gap-2 px-3 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-success)]" />
                საქართველო, ქუთაისი
              </div>
              <a
                href="#contact"
                onClick={(e) => handleNavClick(e, '#contact')}
                className="button-primary w-full"
              >
                ვითანამშრომლოთ
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
