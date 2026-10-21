/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useEffect, useRef, useState } from 'react';

const CrowdFooterScene = lazy(() => import('./CrowdFooterScene'));

function FooterScenePlaceholder() {
  return (
    <section
      aria-label="ფინალური ვიზუალური სცენა იტვირთება"
      className="content-layer section-rule relative isolate h-[560px] overflow-hidden bg-[var(--brand-accent-faint)] sm:h-[620px] lg:h-[650px]"
    >
      <div className="container-xl flex justify-center px-5 pt-16 text-center sm:px-8">
        <h2 className="text-[48px] font-extrabold leading-[1.08] text-[var(--brand-ink)] sm:text-[56px]">
          <span>იყავი </span>
          <span className="font-elene-akhvlediani inline-block text-[var(--brand-accent)]">გამორჩეული</span>
        </h2>
      </div>
    </section>
  );
}

export default function LazyCrowdFooterScene() {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const trigger = triggerRef.current;

    if (!trigger || !('IntersectionObserver' in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: '900px 0px' }
    );

    observer.observe(trigger);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={triggerRef}>
      {shouldLoad ? (
        <Suspense fallback={<FooterScenePlaceholder />}>
          <CrowdFooterScene />
        </Suspense>
      ) : (
        <FooterScenePlaceholder />
      )}
    </div>
  );
}
