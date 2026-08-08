/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import About from './components/About';
import Projects from './components/Projects';
import PriceCalculator from './components/PriceCalculator';
import Contact from './components/Contact';
import PortfolioCatalogPage from './components/PortfolioCatalogPage';
import LoadingScreen from './components/LoadingScreen';
import CustomCursor from './components/CustomCursor';
import CrowdFooterScene from './components/CrowdFooterScene';
import { ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BRAND_MARK } from './data';

export default function App() {
  const [activeSection, setActiveSection] = useState('home');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [routePath, setRoutePath] = useState(() => window.location.pathname);
  const isPortfolioPage = routePath.startsWith('/portfolio');

  useEffect(() => {
    const syncRoute = () => setRoutePath(window.location.pathname);

    window.addEventListener('popstate', syncRoute);
    window.addEventListener('app:navigate', syncRoute);

    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('app:navigate', syncRoute);
    };
  }, []);

  useEffect(() => {
    const sections = ['home', 'about', 'projects', 'calculator', 'contact'];

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);

      let currentSection = 'home';
      const scrollPosition = window.scrollY + 200;

      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            currentSection = sectionId;
            break;
          }
        }
      }
      setActiveSection(currentSection);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoadingComplete = useCallback(() => {
    setShowLoadingScreen(false);
  }, []);

  return (
    <div id="app-root" className="site-shell">
      <CustomCursor />

      <AnimatePresence>
        {showLoadingScreen && <LoadingScreen onComplete={handleLoadingComplete} />}
      </AnimatePresence>

      <Header activeSection={isPortfolioPage ? 'projects' : activeSection} />

      {isPortfolioPage ? (
        <PortfolioCatalogPage />
      ) : (
        <main className="content-layer">
          <Hero />
          <About />
          <Projects />
          <PriceCalculator />
          <Contact />
        </main>
      )}

      <CrowdFooterScene />

      <footer className="content-layer section-rule px-5 py-10 sm:px-8">
        <div className="container-xl flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-[#efeeea] shadow-sm">
              <img src={BRAND_MARK} alt="Luka Imagines" className="h-full w-full bg-[#efeeea] object-cover" />
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-bold leading-none text-[var(--brand-ink)]">Luka Imagines</span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--brand-muted)]">
                გრაფიკული დიზაინერი
              </span>
            </div>
          </div>

          <p className="max-w-md text-left font-mono text-xs leading-relaxed text-[var(--brand-muted)] md:text-right">
            © 2026 Luka Imagines. შექმნილია React 19-ის, TypeScript-ისა და Tailwind CSS v4-ის გამოყენებით. დამზადებულია Frosted Glass-ის დიზაინის პრინციპებით.
          </p>
        </div>
      </footer>

      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            onClick={handleScrollToTop}
            className="button-primary fixed bottom-6 right-6 z-40 h-11 w-11 p-0"
            aria-label="Scroll to top"
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
