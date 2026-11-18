import Contact from '../components/Contact';
import Hero from '../components/Hero';
import PriceCalculator from '../components/PriceCalculator';
import Projects from '../components/Projects';
import LazyCrowdFooterScene from '../components/LazyCrowdFooterScene';
import SiteFooter from '../components/SiteFooter';
import type { WebsiteLayoutConfig, WebsiteSection } from './model';
import type { ReactNode } from 'react';
import { isRetiredNativeSection, sortWebsiteSections } from './model';
import { WebsiteBlocks } from './WebsiteBlocks';
import { NativeSectionProvider } from './NativeElements';
import { websiteCopy } from './copy';
import './website-sections.css';
import { Fragment } from 'react';
import { Eye, Plus } from 'lucide-react';
import { useWebsiteEditorRuntime } from './EditorRuntime';
import FreeLayer from './FreeLayer';
import { useSiteElements } from '../SiteProfileContext';

function resolveCopy(section: WebsiteSection, imageUrls: Record<string, string>) {
  const imageSource = section.copy.heroImageSrc;
  if (!imageSource) return section.copy;
  const resolved = imageSource.startsWith('asset:')
    ? imageUrls[imageSource.slice('asset:'.length)]
    : imageSource;
  return resolved ? { ...section.copy, heroImageSrc: resolved } : section.copy;
}

function NativeSection({ section, imageUrls, nextProjectTarget }: {
  section: WebsiteSection;
  imageUrls: Record<string, string>;
  nextProjectTarget: string;
}) {
  const { enabled: editorEnabled } = useWebsiteEditorRuntime();
  const copy = resolveCopy(section, imageUrls);
  let content: ReactNode = null;
  switch (section.sectionKey) {
    case 'hero': content = <Hero content={copy} primaryTarget={nextProjectTarget} />; break;
    case 'projects': content = <Projects content={copy} />; break;
    case 'calculator': content = <PriceCalculator />; break;
    case 'contact': content = <Contact content={copy} />; break;
    case 'closing-scene': content = <LazyCrowdFooterScene content={copy} />; break;
    case 'site-footer': content = <SiteFooter content={copy} />; break;
  }

  return (
    <Fragment>
        <NativeSectionProvider section={section} imageUrls={imageUrls}>{content}</NativeSectionProvider>
      {section.elements.some((item) => !item.target && item.type !== 'native-visibility') && (
        <section className={`section-wrap website-inserted-blocks website-template-spacing--${section.appearance.spacing}`} aria-label={section.label} data-website-section={section.id} data-website-editor-section-root={editorEnabled ? section.id : undefined} data-website-editor-section-label={editorEnabled ? section.label : undefined}>
          <div className={`container-xl website-template-content website-template-align--${section.appearance.alignment}`}>
          <WebsiteBlocks blocks={section.elements.filter((item) => !item.target && item.type !== 'native-visibility')} imageUrls={imageUrls} sectionId={section.id} />
          </div>
        </section>
      )}
    </Fragment>
  );
}

function TemplateSection({ section, imageUrls, editorEnabled }: { section: WebsiteSection; imageUrls: Record<string, string>; editorEnabled: boolean }) {
  const templateId = section.templateId ?? 'custom-content';
  const isDivider = templateId === 'divider';
  return (
    <section
      id={section.anchorId}
      className={`section-wrap website-template-section website-template-spacing--${section.appearance.spacing} website-template-background--${section.appearance.background} website-template-type--${section.appearance.typography} website-template-accent--${section.appearance.accent} website-template-responsive--${section.appearance.responsive}`}
      data-website-section={section.id}
      data-website-editor-section-root={editorEnabled ? section.id : undefined}
      data-website-editor-section-label={editorEnabled ? section.label : undefined}
      aria-label={section.label}
    >
      <div className={`container-xl website-template-content website-template-layout--${section.appearance.layout} website-template-align--${section.appearance.alignment}${isDivider ? ' is-divider-template' : ''}`}>
        <WebsiteBlocks blocks={section.elements} imageUrls={imageUrls} sectionId={section.id} />
      </div>
    </section>
  );
}

export default function WebsiteSectionRenderer({ config, imageUrls = {} }: {
  config: WebsiteLayoutConfig;
  imageUrls?: Record<string, string>;
}) {
  const { enabled: editorEnabled } = useWebsiteEditorRuntime();
  const siteElements = useSiteElements();
  const orderedSections = sortWebsiteSections(config).filter((section) => !isRetiredNativeSection(section));
  const visibleSections = orderedSections.filter((section) => section.visible);
  const nextProjectTarget = visibleSections.some((section) => section.id === 'projects')
    ? 'projects'
    : visibleSections.find((section) => section.id !== 'hero')?.anchorId ?? 'home';

  // Each section sits in a frame with a stable id so the visual editor can select and style it
  // (background, padding…) without touching the section component itself.
  const frameAttrs = (section: WebsiteSection) => ({
    'data-el': `section.${section.id}`,
    ...(editorEnabled ? {
      'data-edit-id': `section.${section.id}`,
      'data-edit-kind': 'section',
      'data-edit-label': `სექცია: ${section.label}`,
      'data-edit-props': 'section,style',
      ...(!section.visible ? { 'data-edit-hidden': 'true' } : {}),
    } : {}),
  });

  return <>{orderedSections.map((section) => (
    <Fragment key={section.id}>
      {!section.visible ? editorEnabled && <div
        {...frameAttrs(section)}
        className="website-editor-hidden-section-marker"
        data-website-editor-section-root={section.id}
        data-website-editor-section-label={section.label}
        aria-label={`${section.label}, დამალული სექცია`}
      >
        <span>{section.label} · დამალულია</span>
        <button type="button" data-website-editor-restore-section={section.id} aria-label={`აღდგენა: ${section.label}`} title="სექციის აღდგენა"><Eye aria-hidden="true" /> აღდგენა</button>
        <button type="button" data-website-editor-add-section-before={section.id} aria-label={`სექციის დამატება ${section.label}-მდე`} title="სექციის დამატება აქ"><Plus aria-hidden="true" /></button>
        <button type="button" data-website-editor-add-section-after={section.id} aria-label={`სექციის დამატება ${section.label}-ის შემდეგ`} title="სექციის დამატება შემდეგ"><Plus aria-hidden="true" /></button>
      </div> : <div className={`site-section-frame${siteElements.free.some((item) => item.section === section.id) ? ' has-free' : ''}`} {...frameAttrs(section)}>
        {section.kind === 'native'
          ? <NativeSection section={section} imageUrls={imageUrls} nextProjectTarget={nextProjectTarget} />
          : <TemplateSection section={section} imageUrls={imageUrls} editorEnabled={editorEnabled} />}
        <FreeLayer sectionId={section.id} />
      </div>}
    </Fragment>
  ))}</>;
}

export function sectionCopyText(section: WebsiteSection, key: string, fallback: string) {
  return websiteCopy(section.copy, key, fallback);
}
