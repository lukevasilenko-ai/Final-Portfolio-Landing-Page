/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ArrowRight } from 'lucide-react';
import { PORTFOLIO_CATEGORIES } from '../data/portfolioItems';
import { navigateWithinSite } from '../navigation';
import { websiteCopy, type WebsiteCopy } from '../websiteSections/copy';
import { NativeElementSlot } from '../websiteSections/NativeElements';
import SectionHeader, { stripSectionIndex } from './SectionHeader';
import { followSiteLink, isExternalLink } from '../navigation';
import { useEditable } from '../websiteSections/EditableText';
import WorkIndexList from './WorkIndexList';

export default function Projects({ content }: { content?: WebsiteCopy }) {
  const catalogButton = useEditable('projects.catalog-button', 'button', 'კატალოგის ღილაკი', ['hide', 'href']);
  const count = useEditable('projects.count', 'item', 'კატეგორიების რაოდენობა');
  const catalogHref = catalogButton.href('/portfolio');
  return (
    <section id="projects" className="section-wrap ed-section">
      <div className="container-xl">
        <SectionHeader
          eyebrow={{ content: <span data-website-editor-inline-field="eyebrow">{stripSectionIndex(websiteCopy(content, 'eyebrow', 'პორტფოლიო'))}</span> }}
          title={{ slot: 'projects.title', content: <span data-website-editor-inline-field="title">{websiteCopy(content, 'title', 'ნამუშევრები მიმართულებების მიხედვით.')}</span> }}
          description={{ slot: 'projects.description', content: <span data-website-editor-inline-field="description">{websiteCopy(content, 'description', 'დაათვალიერეთ პოსტერები, ბრენდინგის პროექტები და საბეჭდი ნამუშევრები ერთ სივრცეში.')}</span> }}
          action={{
            slot: 'projects.catalog-button',
            content: catalogButton.gone ? null : <a
              {...catalogButton.attrs}
              href={catalogHref}
              onClick={(event) => { if (followSiteLink(catalogHref)) event.preventDefault(); }}
              target={isExternalLink(catalogHref) ? '_blank' : undefined}
              rel={isExternalLink(catalogHref) ? 'noreferrer' : undefined}
              className="button-secondary shrink-0"
            >
              <span data-website-editor-inline-field="buttonLabel">{websiteCopy(content, 'buttonLabel', 'სრული კატალოგი')}</span>
              <ArrowRight className="h-4 w-4" />
            </a>,
          }}
        />

        <div className="flex items-center justify-between gap-4 border-b border-[var(--brand-line)] pb-4">
          <NativeElementSlot id="projects.category-label"><span className="ed-kicker">
            <span data-website-editor-inline-field="categoryLabel">{websiteCopy(content, 'categoryLabel', 'ყველა კატეგორია')}</span>
          </span></NativeElementSlot>
          {!count.gone && <span {...count.attrs} className="ed-kicker tabular-nums">{String(PORTFOLIO_CATEGORIES.length).padStart(2, '0')}</span>}
        </div>

        <NativeElementSlot id="projects.category-cards"><WorkIndexList /></NativeElementSlot>
      </div>
    </section>
  );
}
