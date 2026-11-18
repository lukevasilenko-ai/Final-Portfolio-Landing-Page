/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { websiteCopy, type WebsiteCopy } from '../websiteSections/copy';
import { NativeElementSlot } from '../websiteSections/NativeElements';
import { EditableText } from '../websiteSections/EditableText';

const CrowdFooterScene = lazy(() => import('./CrowdFooterScene'));

function FooterScenePlaceholder({ content }: { content?: WebsiteCopy }) {
  return (
    <section
      id="closing-scene"
      aria-label="ფინალური ვიზუალური სცენა იტვირთება"
      className="content-layer relative isolate border-t border-[var(--brand-line)] h-[560px] overflow-hidden bg-[var(--brand-accent-faint)] sm:h-[620px] lg:h-[650px]"
    >
      <div className="container-xl flex justify-center px-5 pt-20 text-center sm:px-8">
        <NativeElementSlot id="closing-scene.title"><h2 className="ed-display text-[44px] leading-[1.1] text-[var(--brand-ink)] sm:text-[64px] lg:text-[80px]">
          <span><EditableText field="titleLine1">{websiteCopy(content, 'titleLine1', 'იყავი ')}</EditableText></span>
          <span className="font-elene-akhvlediani inline-block text-[var(--brand-accent)]"><EditableText field="titleAccent">{websiteCopy(content, 'titleAccent', 'გამორჩეული')}</EditableText></span>
        </h2></NativeElementSlot>
      </div>
    </section>
  );
}

export default function LazyCrowdFooterScene({ content }: { content?: WebsiteCopy }) {
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
        <Suspense fallback={<FooterScenePlaceholder content={content} />}>
          <NativeElementSlot id="closing-scene.animation"><CrowdFooterScene content={content} /></NativeElementSlot>
        </Suspense>
      ) : (
        <FooterScenePlaceholder content={content} />
      )}
    </div>
  );
}
