/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useHomeCategories } from '../data/homeCategories';
import { websiteCopy, type WebsiteCopy } from '../websiteSections/copy';
import { NativeElementSlot } from '../websiteSections/NativeElements';
import { useEditable } from '../websiteSections/EditableText';
import WorkIndexList from './WorkIndexList';

/**
 * The home page's category list. (Its section heading — number, title, text and the catalogue
 * button — was taken off the page; the list opens the section directly.)
 */
export default function Projects({ content }: { content?: WebsiteCopy }) {
  const count = useEditable('projects.count', 'item', 'კატეგორიების რაოდენობა');
  const categoryCount = useHomeCategories().length;
  return (
    <section id="projects" className="section-wrap ed-section">
      <div className="container-xl">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--brand-line)] pb-4">
          <NativeElementSlot id="projects.category-label"><span className="ed-kicker">
            <span data-website-editor-inline-field="categoryLabel">{websiteCopy(content, 'categoryLabel', 'ყველა კატეგორია')}</span>
          </span></NativeElementSlot>
          {!count.gone && <span {...count.attrs} className="ed-kicker tabular-nums">{String(categoryCount).padStart(2, '0')}</span>}
        </div>

        <NativeElementSlot id="projects.category-cards"><WorkIndexList /></NativeElementSlot>
      </div>
    </section>
  );
}
