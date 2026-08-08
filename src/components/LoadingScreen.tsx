/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Crop, Image, Layers3, Palette, PenTool, Type } from 'lucide-react';

interface LoadingScreenProps {
  onComplete: () => void;
}

const DESIGN_TOOLS = [
  { Icon: PenTool, label: 'Pen tool', tone: 'green' },
  { Icon: Palette, label: 'Color palette', tone: 'copper' },
  { Icon: Type, label: 'Typography', tone: 'plum' },
  { Icon: Layers3, label: 'Layers', tone: 'green' },
  { Icon: Crop, label: 'Crop', tone: 'copper' },
  { Icon: Image, label: 'Artwork', tone: 'plum' }
] as const;

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const activeTool = Math.min(
    DESIGN_TOOLS.length - 1,
    Math.floor((progress / 101) * DESIGN_TOOLS.length)
  );

  useEffect(() => {
    const duration = 2200;
    const startedAt = performance.now();
    let frameId = 0;
    let completionTimer: number | undefined;
    const previousOverflow = document.documentElement.style.overflow;

    document.documentElement.style.overflow = 'hidden';

    const tick = (now: number) => {
      const nextProgress = Math.max(
        0,
        Math.min(100, Math.round(((now - startedAt) / duration) * 100))
      );
      setProgress(nextProgress);

      if (nextProgress < 100) {
        frameId = requestAnimationFrame(tick);
        return;
      }

      completionTimer = window.setTimeout(onComplete, 160);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      if (completionTimer) window.clearTimeout(completionTimer);
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [onComplete]);

  return (
    <motion.div
      className="loading-screen"
      role="status"
      aria-live="polite"
      aria-label={`იტვირთება ${progress}%`}
      initial={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
      exit={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
      transition={{ duration: 0.72, ease: [0.76, 0, 0.24, 1] }}
    >
      <motion.div
        className="loading-panel"
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 1.015 }}
        transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="loading-crop-mark loading-crop-mark-top-left" aria-hidden="true" />
        <span className="loading-crop-mark loading-crop-mark-top-right" aria-hidden="true" />
        <span className="loading-crop-mark loading-crop-mark-bottom-left" aria-hidden="true" />
        <span className="loading-crop-mark loading-crop-mark-bottom-right" aria-hidden="true" />

        <div className="loading-tools" aria-hidden="true">
          {DESIGN_TOOLS.map(({ Icon, label, tone }, index) => {
            const isActive = index === activeTool;
            const isComplete = index < activeTool;

            return (
              <motion.span
                key={label}
                className={`loading-tool loading-tool-${tone}${isActive ? ' is-active' : ''}${isComplete ? ' is-complete' : ''}`}
                animate={{
                  y: isActive ? -6 : 0,
                  rotate: isActive ? (index % 2 === 0 ? -4 : 4) : 0,
                  scale: isActive ? 1.08 : 1
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 24 }}
              >
                <Icon strokeWidth={1.8} />
              </motion.span>
            );
          })}
        </div>

        <div className="loading-readout">
          <span className="loading-percent">
            {progress}
            <span>%</span>
          </span>
        </div>

        <div className="loading-track" aria-hidden="true">
          <motion.div
            className="loading-fill"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.08, ease: 'linear' }}
          >
            <span className="loading-fill-handle">
              <PenTool strokeWidth={2} />
            </span>
          </motion.div>
        </div>

        <div className="loading-registration" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </motion.div>
    </motion.div>
  );
}
