import {
  ArrowUpRight,
  Check,
  Clock3,
  Layers3,
  Palette,
  Quote,
  Sparkles,
  Star,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { WebsiteBlock } from './model';
import { isSafeWebsiteLink } from './model';
import { useWebsiteEditorRuntime } from './EditorRuntime';

const blockIcons: Record<NonNullable<WebsiteBlock['icon']>, LucideIcon> = {
  sparkles: Sparkles,
  palette: Palette,
  layers: Layers3,
  check: Check,
  arrow: ArrowUpRight,
  star: Star,
  quote: Quote,
  clock: Clock3,
};

const blockNames: Record<WebsiteBlock['type'], string> = {
  eyebrow: 'მცირე წარწერა', 'native-visibility': 'ხილვადობის პარამეტრი', heading: 'სათაური',
  subheading: 'ქვესათაური', paragraph: 'ტექსტი', button: 'ღილაკი', image: 'ფოტო', icon: 'აიქონი',
  divider: 'გამყოფი', 'feature-list': 'ბარათების ჯგუფი', statistic: 'სტატისტიკა',
  'gallery-item': 'გალერეის ფოტო', card: 'ბარათი', 'content-group': 'კონტენტის ჯგუფი',
  'faq-item': 'კითხვა და პასუხი', testimonial: 'შეფასება', logo: 'ლოგო', 'call-to-action': 'მოქმედებისკენ მოწოდება',
};

function blockImageSource(block: WebsiteBlock, imageUrls: Record<string, string>) {
  if (!block.src) return '';
  if (block.src.startsWith('asset:')) return imageUrls[block.src.slice('asset:'.length)] ?? '';
  return block.src;
}

function renderBlock(block: WebsiteBlock, imageUrls: Record<string, string>, sectionId: string, editorEnabled: boolean, parentGroup: string): ReactNode {
  if (!block.visible || block.type === 'native-visibility') return null;
  const body = block.text ?? block.title ?? '';
  const children = block.children?.map((child) => renderBlock(child, imageUrls, sectionId, editorEnabled, block.id));
  let content: ReactNode = null;

  switch (block.type) {
    case 'eyebrow':
      content = <span className="eyebrow"><span className="eyebrow-dot" /><span data-website-editor-inline-field="text">{body}</span></span>;
      break;
    case 'heading':
      content = <h2 className="section-title" data-website-editor-inline-field="text">{body}</h2>;
      break;
    case 'subheading':
      content = <h3 className="website-template-subheading" data-website-editor-inline-field="text">{body}</h3>;
      break;
    case 'paragraph':
      content = <p className="section-subtitle website-template-paragraph" data-website-editor-inline-field="text">{body}</p>;
      break;
    case 'button':
      content = isSafeWebsiteLink(block.href ?? '') ? (
        <a className="button-primary website-template-button" href={block.href} target={block.href?.startsWith('https://') ? '_blank' : undefined} rel={block.href?.startsWith('https://') ? 'noreferrer' : undefined}>
          <span data-website-editor-inline-field="label">{block.label || 'დეტალების ნახვა'}</span><ArrowUpRight aria-hidden="true" />
        </a>
      ) : null;
      break;
    case 'image':
    case 'gallery-item': {
      const src = blockImageSource(block, imageUrls);
      content = src ? (
        <figure className={`website-template-image${block.type === 'gallery-item' ? ' is-gallery-item' : ''}`}>
          <img src={src} alt={block.alt ?? ''} loading="lazy" />
          {block.label && <figcaption data-website-editor-inline-field="label">{block.label}</figcaption>}
        </figure>
      ) : (
        <div className="website-template-image-placeholder" role="img" aria-label={block.alt || 'სურათი ჯერ არ არის არჩეული'}>
          <Palette aria-hidden="true" /><span>{block.alt || 'აირჩიეთ სურათი'}</span>
        </div>
      );
      break;
    }
    case 'icon': {
      const Icon = blockIcons[block.icon ?? 'sparkles'];
      content = <span className="website-template-icon"><Icon aria-hidden="true" /></span>;
      break;
    }
    case 'divider':
      content = <hr className="website-template-divider" />;
      break;
    case 'feature-list':
      content = <div className="website-template-feature-grid">{children}</div>;
      break;
    case 'statistic':
      content = <div className="website-template-stat"><strong data-website-editor-inline-field="value">{block.value || '—'}</strong><span data-website-editor-inline-field="label">{block.label || body}</span></div>;
      break;
    case 'card': {
      const Icon = block.icon ? blockIcons[block.icon] : null;
      content = <article className="website-template-card">{Icon && <span className="website-template-icon"><Icon aria-hidden="true" /></span>}<h3 data-website-editor-inline-field="title">{block.title || block.label || 'სათაური'}</h3>{block.text && <p data-website-editor-inline-field="text">{block.text}</p>}{children}</article>;
      break;
    }
    case 'content-group':
      content = <div className="website-template-content-group">{block.title && <h3 data-website-editor-inline-field="title">{block.title}</h3>}<div className="website-template-group-items">{children}</div></div>;
      break;
    case 'faq-item':
      content = <details className="website-template-faq"><summary data-website-editor-inline-field="title">{block.title || 'კითხვა'}</summary><p data-website-editor-inline-field="text">{block.text || ''}</p></details>;
      break;
    case 'testimonial':
      content = <figure className="website-template-testimonial"><Quote aria-hidden="true" /><blockquote data-website-editor-inline-field="text">{block.text || ''}</blockquote>{block.label && <figcaption data-website-editor-inline-field="label">{block.label}</figcaption>}</figure>;
      break;
    case 'logo':
      content = <div className="website-template-logo">{block.src ? <img src={blockImageSource(block, imageUrls)} alt={block.label || ''} loading="lazy" /> : <span data-website-editor-inline-field="label">{block.label || 'ბრენდი'}</span>}</div>;
      break;
    case 'call-to-action':
      content = <div className="website-template-cta"><div>{block.title && <h3 data-website-editor-inline-field="title">{block.title}</h3>}{block.text && <p data-website-editor-inline-field="text">{block.text}</p>}</div>{block.href && isSafeWebsiteLink(block.href) && <a className="button-primary" href={block.href}><span data-website-editor-inline-field="label">{block.label || 'დამიკავშირდით'}</span><ArrowUpRight aria-hidden="true" /></a>}</div>;
      break;
    default:
      content = null;
  }

  if (!editorEnabled || !content) return content;
  return <span
    key={block.id}
    className="website-editor-block-anchor"
    style={{ display: 'contents' }}
    data-website-editor-block={block.id}
    data-website-editor-section={sectionId}
    data-website-editor-group={block.target ? `slot:${block.target}` : parentGroup}
    data-website-editor-label={blockNames[block.type]}
    data-website-editor-type={block.type}
  >{content}</span>;
}

export function WebsiteBlocks({ blocks, imageUrls = {}, sectionId = '' }: { blocks: WebsiteBlock[]; imageUrls?: Record<string, string>; sectionId?: string }) {
  const { enabled } = useWebsiteEditorRuntime();
  return <>{blocks.map((block) => renderBlock(block, imageUrls, sectionId, enabled, sectionId))}</>;
}
