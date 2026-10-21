/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useCallback, useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import About from './components/About';
import Projects from './components/Projects';
import CreativeBriefStudio from './components/CreativeBriefStudio';
import PriceCalculator from './components/PriceCalculator';
import Contact from './components/Contact';
import LoadingScreen from './components/LoadingScreen';
import CustomCursor from './components/CustomCursor';
import LazyCrowdFooterScene from './components/LazyCrowdFooterScene';
import { ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BRAND_MARK } from './data';

const PortfolioCatalogPage = lazy(() => import('./components/PortfolioCatalogPage'));
const AdminPanel = lazy(() => import('./admin/AdminPanel'));

function CatalogPageFallback() {
  return (
    <main id="main-content" tabIndex={-1} className="content-layer min-h-screen px-5 pt-36 outline-none sm:px-8">
      <div className="container-xl" role="status" aria-live="polite">
        <div className="flex items-center gap-3 border-b border-[var(--brand-line)] pb-8 text-sm font-semibold text-[var(--brand-muted)]">
          <span className="button-spinner h-4 w-4 animate-spin rounded-full border-2" />
          კატალოგი იტვირთება...
        </div>
      </div>
    </main>
  );
}

export default function App() {
  const currentYear = new Date().getFullYear();
  const [activeSection, setActiveSection] = useState('home');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [routePath, setRoutePath] = useState(() => window.location.pathname);
  const isAdminPage = routePath.replace(/\/+$/, '') === '/admin';
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
    const sections = [
      { id: 'home', activeId: 'home' },
      { id: 'about', activeId: 'about' },
      { id: 'projects', activeId: 'projects' },
      { id: 'brief-studio', activeId: 'calculator' },
      { id: 'calculator', activeId: 'calculator' },
      { id: 'contact', activeId: 'contact' }
    ];

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);

      let currentSection = 'home';
      const scrollPosition = window.scrollY + 200;

      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            currentSection = section.activeId;
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

    if (!window.location.hash) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
        target?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    });
  }, []);

  if (isAdminPage) {
    return (
      <Suspense
        fallback={
          <main
            lang="ka-GE"
            role="status"
            aria-live="polite"
            style={{
              display: 'grid',
              minHeight: '100vh',
              placeItems: 'center',
              color: 'var(--brand-ink)',
              background: 'var(--brand-page)',
              fontFamily: 'var(--brand-font-sans)',
            }}
          >
            პანელი იტვირთება...
          </main>
        }
      >
        <AdminPanel />
      </Suspense>
    );
  }

  return (
    <div id="app-root" className="site-shell">
      <a href="#main-content" className="skip-link">
        მთავარ შინაარსზე გადასვლა
      </a>

      <CustomCursor />

      <AnimatePresence>
        {showLoadingScreen && <LoadingScreen onComplete={handleLoadingComplete} />}
      </AnimatePresence>

      <Header activeSection={isPortfolioPage ? 'projects' : activeSection} />

      {isPortfolioPage ? (
        <Suspense fallback={<CatalogPageFallback />}>
          <PortfolioCatalogPage />
        </Suspense>
      ) : (
        <main id="main-content" tabIndex={-1} className="content-layer outline-none">
          <Hero />
          <About />
          <Projects />
          <CreativeBriefStudio />
          <PriceCalculator />
          <Contact />
        </main>
      )}

      <LazyCrowdFooterScene />

      <footer className="content-layer section-rule px-5 py-10 sm:px-8">
        <div className="container-xl flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg">
              <span
                className="brand-mark-glyph"
                style={{ WebkitMaskImage: `url("${BRAND_MARK}")`, maskImage: `url("${BRAND_MARK}")` }}
                role="img"
                aria-label="Luka Imagines"
              />
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-bold leading-none text-[var(--brand-ink)]">Luka Imagines</span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--brand-muted)]">
                გრაფიკული დიზაინერი
              </span>
            </div>
          </div>

          <p className="max-w-md text-left font-mono text-xs leading-relaxed text-[var(--brand-muted)] md:text-right">
            © {currentYear} Luka Imagines. გრაფიკული დიზაინი, ბრენდინგი და ვიზუალური იდენტობა.
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
            className="scroll-to-top button-primary fixed z-40 h-11 w-11 p-0"
            aria-label="გვერდის დასაწყისში დაბრუნება"
            title="გვერდის დასაწყისში დაბრუნება"
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
