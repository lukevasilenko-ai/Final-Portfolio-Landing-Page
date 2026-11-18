import type { ReactNode } from 'react';
import { useWebsiteEditorRuntime } from './EditorRuntime';
import { useNativeSectionId } from './NativeElements';
import { useSiteElements } from '../SiteProfileContext';

/**
 * What the admin's visual editor can do with an element. "text" edits in place;
 * the others open a small panel next to the element.
 *  - hide: show/hide the element on the site
 *  - href: change where a link or button leads
 *  - copy:<key>: edit a section copy value that isn't visible text (placeholders, templates)
 *  - image: replace the image (hero artwork)
 *  - strip: a poster in the hero strip (replace, move, remove, add)
 */
export type EditKind = 'text' | 'link' | 'button' | 'image' | 'icon' | 'item' | 'field';

export function useEditable(id: string, kind: EditKind, label: string, props: string[] = ['hide']) {
  const { enabled } = useWebsiteEditorRuntime();
  const elements = useSiteElements();
  const hidden = elements.hidden.includes(id);
  return {
    editing: enabled,
    /** Hidden on the public site; in the editor it stays visible (dimmed) so it can be restored. */
    gone: hidden && !enabled,
    hidden,
    // data-el is always present so style changes from the editor apply on the public site too.
    attrs: enabled
      ? {
        'data-el': id,
        'data-edit-id': id,
        'data-edit-kind': kind,
        'data-edit-label': label,
        'data-edit-props': props.join(','),
        ...(hidden ? { 'data-edit-hidden': 'true' } : {}),
      }
      : { 'data-el': id },
    text: (fallback: string) => elements.text[id] ?? fallback,
    href: (fallback: string) => elements.href[id] ?? fallback,
  };
}

/** Short text owned by the element-change store (not section copy), editable in place. */
export function EditableLabel({ id, fallback }: { id: string; fallback: string }) {
  const { enabled } = useWebsiteEditorRuntime();
  const elements = useSiteElements();
  const value = elements.text[id] ?? fallback;
  return enabled ? <span data-edit-text={id}>{value}</span> : <>{value}</>;
}

/**
 * Marks a piece of section copy as editable in the visual editor. On the public site it renders
 * the text as-is (or nothing, if hidden in the editor); inside the editor it becomes a span the
 * editor types into. `field` is the section copy key (for example "titleLine1").
 */
export function EditableText({ field, children }: { field: string; children: ReactNode }) {
  const { enabled } = useWebsiteEditorRuntime();
  const sectionId = useNativeSectionId() ?? 'site';
  const elements = useSiteElements();
  const id = `${sectionId}.${field}`;
  const hidden = elements.hidden.includes(id);
  if (!enabled) return hidden ? null : <span data-el={id}>{children}</span>;
  return (
    <span
      data-el={id}
      data-website-editor-inline-field={field}
      data-edit-id={id}
      data-edit-kind="text"
      data-edit-label="ტექსტი"
      data-edit-props="hide"
      {...(hidden ? { 'data-edit-hidden': 'true' } : {})}
    >{children}</span>
  );
}
