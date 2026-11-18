/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { BRAND_MARK } from '../data';

interface LoadingScreenProps {
  onComplete: () => void;
}

/** Short brand intro: the mark and a thin progress line, then the page. */
export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const shouldReduceMotion = useReducedMotion();
  const duration = shouldReduceMotion ? 0.15 : 0.85;

  useEffect(() => {
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const timer = window.setTimeout(onComplete, duration * 1000 + 120);

    return () => {
      window.clearTimeout(timer);
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [duration, onComplete]);

  return (
    <motion.div
      className="loading-screen"
      role="status"
      aria-live="polite"
      aria-label="იტვირთება"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.1 : 0.45, ease: [0.65, 0, 0.35, 1] }}
    >
      <motion.div
        className="loading-brand"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: shouldReduceMotion ? 0.1 : 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="loading-mark" aria-hidden="true">
          <span
            className="brand-mark-glyph"
            style={{ WebkitMaskImage: `url("${BRAND_MARK}")`, maskImage: `url("${BRAND_MARK}")` }}
          />
        </span>
        <span className="loading-line" aria-hidden="true">
          <motion.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration, ease: [0.65, 0, 0.35, 1] }}
          />
        </span>
      </motion.div>
    </motion.div>
  );
}
