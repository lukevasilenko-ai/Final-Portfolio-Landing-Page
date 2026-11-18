/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Fragment, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { useHomeCategories, type HomeCategory } from '../data/homeCategories';
import { navigateWithinSite } from '../navigation';
import CategoryCard, { categoryCardKind, type CategoryCardKind } from './CategoryCard';
import { EditableLabel, useEditable } from '../websiteSections/EditableText';

interface Row {
  category: HomeCategory;
  index: number;
  kind: CategoryCardKind;
  count: string;
}

/** Each row's card leans a different way, so moving down the list feels hand-placed. */
const TILTS = ['-4deg', '3deg', '-2deg'];

/**
 * Portfolio category index. On hover (fine pointers, ≥768px) a brand-green card opens from
 * the row with a mask reveal while its lettering writes itself in; touch screens get a small
 * inline card instead. The categories and their counts follow the admin (see homeCategories).
 */

/** One category row; in the visual editor its name can be changed and the row hidden. */
function IndexRow({ row, active, setActive }: { row: Row; active: number | null; setActive: (index: number | null) => void }) {
  const id = `projects.category.${row.category.id}`;
  const editable = useEditable(id, 'item', 'კატეგორიის რიგი');
  if (editable.gone) return null;
  return (
        <motion.li
          {...editable.attrs}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: row.index * 0.06 }}
        >
          <button
            type="button"
            onPointerEnter={() => setActive(row.index)}
            onFocus={() => setActive(row.index)}
            onBlur={() => setActive(null)}
            onClick={() => navigateWithinSite(`/portfolio/${row.category.slug}`)}
            className="work-index-row group"
            aria-label={`${row.category.label} — ${row.count}`}
          >
            <span className="work-index-num">{String(row.index + 1).padStart(2, '0')}</span>
            <span className="flex min-w-0 items-center gap-5">
              <span className="work-index-thumb" aria-hidden="true">
                <CategoryCard kind={row.kind} index={row.index} countLabel={row.count} label={row.category.label} radius={10} />
              </span>
              <span className="work-index-title min-w-0 break-words"><EditableLabel id={id} fallback={row.category.label} /></span>
            </span>
            <span className="work-index-meta">
              <span className="work-index-count">{row.count}</span>
              <span className="work-index-arrow" aria-hidden="true"><ArrowUpRight className="h-4 w-4" /></span>
            </span>
            <span
              className="wp-reveal wp-hover-only"
              style={{ ['--tilt' as string]: TILTS[row.index % TILTS.length] }}
              aria-hidden="true"
            >
              <span className="wp-reveal-mask block">
                <span className="wp-reveal-inner block">
                  <CategoryCard kind={row.kind} index={row.index} countLabel={row.count} label={row.category.label} drawn={active === row.index} radius={0} />
                </span>
              </span>
            </span>
          </button>
        </motion.li>
  );
}

export default function WorkIndexList() {
  const [active, setActive] = useState<number | null>(null);
  const categories = useHomeCategories();
  const rows = useMemo<Row[]>(() => categories.map((category, index) => ({
    category,
    index,
    kind: categoryCardKind(category.id),
    count: category.countLabel,
  })), [categories]);

  return (
    <ul onPointerLeave={() => setActive(null)}>
      {rows.map((row) => <Fragment key={row.category.id}><IndexRow row={row} active={active} setActive={setActive} /></Fragment>)}
    </ul>
  );
}
