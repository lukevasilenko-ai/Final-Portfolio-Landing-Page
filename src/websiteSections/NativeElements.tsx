import { createContext, Fragment, useContext, type ReactNode } from 'react';
import type { WebsiteBlock, WebsiteSection } from './model';
import { WebsiteBlocks } from './WebsiteBlocks';
import { getNativeElementDefinition, isNativeElementVisible } from './nativeSchema';
import { useWebsiteEditorRuntime } from './EditorRuntime';

interface NativeSectionValue {
  section: WebsiteSection;
  imageUrls: Record<string, string>;
}

const NativeSectionContext = createContext<NativeSectionValue | null>(null);

/** Id of the native section being rendered (e.g. "hero"), or undefined outside one. */
export function useNativeSectionId() {
  return useContext(NativeSectionContext)?.section.id;
}

export function NativeSectionProvider({ section, imageUrls, children }: NativeSectionValue & { children: ReactNode }) {
  return <NativeSectionContext.Provider value={{ section, imageUrls }}>{children}</NativeSectionContext.Provider>;
}

export function NativeElementSlot({ id, children }: { id: string; children: ReactNode }) {
  const context = useContext(NativeSectionContext);
  const { enabled } = useWebsiteEditorRuntime();
  if (!context) return <>{children}</>;

  const entries = context.section.elements.filter((item) => item.target === id && item.type !== 'native-visibility');
  const before = entries.filter((item) => item.position === 'before' && item.visible);
  const replacements = entries.filter((item) => item.position === 'replace' && item.visible);
  const after = entries.filter((item) => item.position === 'after' && item.visible);
  const showNative = isNativeElementVisible(context.section, id);
  const render = (items: WebsiteBlock[]) => items.map((block) => <Fragment key={block.id}><WebsiteBlocks blocks={[block]} imageUrls={context.imageUrls} sectionId={context.section.id} /></Fragment>);
  const content = <>{render(before)}{showNative ? children : render(replacements)}{render(after)}</>;
  if (!enabled) return content;

  const definition = context.section.sectionKey ? getNativeElementDefinition(context.section.sectionKey, id) : undefined;

  return <span
    className="website-editor-native-slot"
    style={{ display: 'contents' }}
    data-website-editor-target={id}
    data-website-editor-section={context.section.id}
    data-website-editor-label={definition?.label ?? id}
    data-website-editor-fields={definition?.copyKeys.join(',') ?? ''}
  >{content}</span>;
}

export function nativeSectionBlockIds(section: WebsiteSection, slot: string) {
  return section.elements.filter((item) => item.target === slot && item.type !== 'native-visibility');
}

