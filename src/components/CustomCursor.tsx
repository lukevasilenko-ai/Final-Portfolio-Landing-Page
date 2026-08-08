/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { MousePointer2 } from 'lucide-react';
import { motion, useMotionValue } from 'motion/react';

const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  '[role="button"]',
  '.surface-card',
  '.surface-card-strong',
  '.tag-chip',
  '.status-pill'
].join(',');

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const pointerX = useMotionValue(-100);
  const pointerY = useMotionValue(-100);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const syncEnabled = () => setEnabled(mediaQuery.matches);
    syncEnabled();

    mediaQuery.addEventListener('change', syncEnabled);
    return () => mediaQuery.removeEventListener('change', syncEnabled);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const playClickSound = (interactive: boolean) => {
      const AudioContextClass = window.AudioContext
        || (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioContextClass) return;

      const audioContext = audioContextRef.current ?? new AudioContextClass();
      audioContextRef.current = audioContext;
      if (audioContext.state === 'suspended') void audioContext.resume();

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(interactive ? 640 : 520, now);
      oscillator.frequency.exponentialRampToValueAtTime(interactive ? 320 : 260, now + 0.05);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.06);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      pointerX.set(event.clientX);
      pointerY.set(event.clientY);
      setVisible(true);
      setIsHovering(Boolean(target?.closest(INTERACTIVE_SELECTOR)));
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      setIsPressed(true);
      playClickSound(Boolean(target?.closest(INTERACTIVE_SELECTOR)));
    };

    const releasePointer = () => setIsPressed(false);
    const handlePointerLeave = () => {
      setVisible(false);
      setIsHovering(false);
      setIsPressed(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('pointercancel', releasePointer);
    window.addEventListener('blur', releasePointer);
    document.documentElement.addEventListener('mouseleave', handlePointerLeave);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', releasePointer);
      window.removeEventListener('pointercancel', releasePointer);
      window.removeEventListener('blur', releasePointer);
      document.documentElement.removeEventListener('mouseleave', handlePointerLeave);
    };
  }, [enabled, pointerX, pointerY]);

  useEffect(() => () => {
    if (audioContextRef.current) void audioContextRef.current.close();
  }, []);

  if (!enabled) return null;

  return (
    <motion.div
      aria-hidden="true"
      className={`custom-cursor-arrow${visible ? ' is-visible' : ''}${isHovering ? ' is-hovering' : ''}${isPressed ? ' is-pressed' : ''}`}
      style={{ x: pointerX, y: pointerY }}
      animate={{
        scale: isPressed ? 0.76 : isHovering ? 1.08 : 1,
        rotate: isPressed ? -12 : isHovering ? 3 : 0
      }}
      transition={{ type: 'spring', stiffness: 620, damping: 28, mass: 0.22 }}
    >
      <MousePointer2 strokeWidth={1.7} />
    </motion.div>
  );
}
