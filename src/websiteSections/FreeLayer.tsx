import { useWebsiteEditorRuntime } from './EditorRuntime';
import { useSiteElements } from '../SiteProfileContext';
import { freeElementId } from '../siteElements';

const DEFAULT_TEXT = 'ახალი ტექსტი';

/**
 * Text and pictures the admin placed freely on top of a section. Position, size, rotation and
 * look come from the compiled element styles ("free.<id>"), so the public site needs no script.
 * In the editor each item also gets handles: corner = size, top circle = rotation, bottom bar
 * (images) = crop height.
 */
export default function FreeLayer({ sectionId }: { sectionId: string }) {
  const { enabled } = useWebsiteEditorRuntime();
  const elements = useSiteElements();
  const items = elements.free.filter((item) => item.section === sectionId);
  if (!items.length) return null;
  return (
    <div className="site-free-layer">
      {items.map((item) => {
        const id = freeElementId(item);
        const hidden = elements.hidden.includes(id);
        if (hidden && !enabled) return null;
        const text = elements.text[id] ?? DEFAULT_TEXT;
        const editAttrs = enabled ? {
          'data-edit-id': id,
          'data-edit-kind': item.type === 'text' ? 'free-text' : 'free-image',
          'data-edit-label': item.type === 'text' ? 'თავისუფალი ტექსტი' : 'თავისუფალი სურათი',
          'data-edit-props': 'free,hide',
          ...(hidden ? { 'data-edit-hidden': 'true' } : {}),
        } : {};
        return (
          <div key={item.id} className={`site-free-item is-${item.type}`} data-el={id} {...editAttrs}>
            {item.type === 'text'
              ? <span className="site-free-text" {...(enabled ? { 'data-edit-text': id } : {})}>{text}</span>
              : <img src={item.src} alt={item.alt ?? ''} loading="lazy" decoding="async" draggable={false} />}
            {enabled && <>
              <span className="site-free-handle is-rotate" data-free-handle="rotate" aria-hidden="true" />
              <span className="site-free-handle is-resize" data-free-handle="resize" aria-hidden="true" />
              {item.type === 'image' && <span className="site-free-handle is-crop" data-free-handle="crop" aria-hidden="true" />}
            </>}
          </div>
        );
      })}
    </div>
  );
}
