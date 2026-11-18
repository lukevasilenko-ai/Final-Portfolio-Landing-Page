import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { NativeElementSlot } from '../websiteSections/NativeElements';

/** Drops legacy "05 // " style numbering from saved section labels; numbering is now automatic. */
export const stripSectionIndex = (label: string) => label.replace(/^\s*\d+\s*\/\/\s*/, '');

interface SlotText {
  /** Website-builder slot id; omit for parts that have no builder slot. */
  slot?: string;
  content: ReactNode;
}

function Slot({ id, children }: { id?: string; children: ReactNode }) {
  return id ? <NativeElementSlot id={id}>{children}</NativeElementSlot> : <>{children}</>;
}

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * Editorial section header: an automatically numbered label in the left column,
 * the title with its supporting copy and optional action in the main column.
 * Each part keeps its own native slot so the website builder can still edit it.
 */
export default function SectionHeader({ eyebrow, title, description, action, titleClassName = '' }: {
  eyebrow: SlotText;
  title: SlotText;
  description?: SlotText;
  action?: SlotText;
  titleClassName?: string;
}) {
  const reduceMotion = useReducedMotion();
  const reveal = (delay: number) => (reduceMotion ? {} : {
    initial: { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' },
    transition: { duration: 0.8, ease, delay },
  });

  return (
    <div className="ed-grid ed-header">
      <div className="ed-aside">
        <Slot id={eyebrow.slot}><span className="ed-label">
          <span className="ed-index" aria-hidden="true" />
          <span>{eyebrow.content}</span>
        </span></Slot>
      </div>
      <div className="ed-main flex flex-col gap-8">
        <motion.div {...reveal(0)}>
          <Slot id={title.slot}><h2 className={`section-title ${titleClassName}`}>{title.content}</h2></Slot>
        </motion.div>
        {(description || action) && (
          <motion.div {...reveal(0.1)} className="flex flex-col items-start gap-7 md:flex-row md:items-end md:justify-between md:gap-12">
            {description && <Slot id={description.slot}><p className="section-subtitle">{description.content}</p></Slot>}
            {action && <Slot id={action.slot}>{action.content}</Slot>}
          </motion.div>
        )}
      </div>
    </div>
  );
}
