import {
  createStableId,
  createWebsiteBlock,
  duplicateNestedBlock,
  moveItem,
  removeNestedBlock,
  normalizeWebsiteSectionOrder,
  sortWebsiteSections,
  updateNestedBlock,
  type WebsiteBlock,
  type WebsiteBlockType,
  type WebsiteLayoutConfig,
  type WebsiteSection,
} from './model';
import { getNativeElementDefinitions, insertNativeElement, isNativeElementVisible, setNativeElementVisibility } from './nativeSchema';
import type { WebsiteEditorSelection } from './EditorRuntime';

export type CanvasInsertion = { config: WebsiteLayoutConfig; blockId: string };

export function pushWebsiteLayoutUndo(history: WebsiteLayoutConfig[], previous: WebsiteLayoutConfig, limit = 20) {
  return [...history.slice(-(limit - 1)), previous];
}

export function popWebsiteLayoutUndo(history: WebsiteLayoutConfig[]) {
  if (history.length === 0) return null;
  return { layout: history[history.length - 1], history: history.slice(0, -1) };
}

export function setCanvasSectionVisibility(config: WebsiteLayoutConfig, sectionId: string, visible: boolean) {
  return {
    ...config,
    sections: config.sections.map((section) => section.id === sectionId ? { ...section, visible } : section),
  };
}

export function removeCanvasTemplateSection(config: WebsiteLayoutConfig, sectionId: string) {
  const section = config.sections.find((item) => item.id === sectionId);
  if (!section || section.kind !== 'template') return config;
  return { ...config, sections: normalizeWebsiteSectionOrder(config.sections.filter((item) => item.id !== sectionId)) };
}

export function moveCanvasSection(config: WebsiteLayoutConfig, sectionId: string, direction: -1 | 1) {
  const sections = sortWebsiteSections(config);
  const index = sections.findIndex((section) => section.id === sectionId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sections.length) return config;
  const next = [...sections];
  const [section] = next.splice(index, 1);
  next.splice(target, 0, section);
  return { ...config, sections: normalizeWebsiteSectionOrder(next) };
}

export function insertCanvasSection(config: WebsiteLayoutConfig, section: WebsiteSection, index: number) {
  const sections = sortWebsiteSections(config);
  const insertionIndex = Math.max(0, Math.min(index, sections.length));
  sections.splice(insertionIndex, 0, section);
  return { ...config, sections: normalizeWebsiteSectionOrder(sections) };
}

export function updateWebsiteElementText(
  config: WebsiteLayoutConfig,
  selection: WebsiteEditorSelection,
  field: string,
  text: string,
): WebsiteLayoutConfig {
  return {
    ...config,
    sections: config.sections.map((section) => {
      if (section.id !== selection.sectionId) return section;
      // A key may be missing from older saved copy; any key the section's slots declare is editable.
      const knownKey = field in section.copy || Boolean(section.sectionKey
        && getNativeElementDefinitions(section.sectionKey).some((slot) => slot.copyKeys.includes(field)));
      if (selection.kind === 'native' && knownKey) return { ...section, copy: { ...section.copy, [field]: text } };
      if (selection.kind === 'block' && selection.blockId) {
        return { ...section, elements: updateNestedBlock(section.elements, selection.blockId, (block) => ({ ...block, [field]: text })) };
      }
      return section;
    }),
  };
}

export function setCanvasNativeVisibility(config: WebsiteLayoutConfig, sectionId: string, targetId: string, visible: boolean) {
  return {
    ...config,
    sections: config.sections.map((section) => section.id === sectionId
      ? setNativeElementVisibility(section, targetId, visible, createStableId('native-hidden'))
      : section),
  };
}

export function insertCanvasNativeBlock(
  config: WebsiteLayoutConfig,
  sectionId: string,
  targetId: string,
  type: Exclude<WebsiteBlockType, 'native-visibility'>,
): CanvasInsertion {
  let blockId = '';
  const next = {
    ...config,
    sections: config.sections.map((section) => {
      if (section.id !== sectionId) return section;
      const placement: NonNullable<WebsiteBlock['position']> = isNativeElementVisible(section, targetId) ? 'after' : 'replace';
      const block: WebsiteBlock = { ...createWebsiteBlock(type), target: targetId, position: placement };
      blockId = block.id;
      return insertNativeElement(section, targetId, block, placement);
    }),
  };
  return { config: next, blockId };
}

export function setCanvasBlockVisibility(config: WebsiteLayoutConfig, sectionId: string, blockId: string, visible: boolean) {
  return {
    ...config,
    sections: config.sections.map((section) => section.id === sectionId
      ? { ...section, elements: updateNestedBlock(section.elements, blockId, (block) => ({ ...block, visible })) }
      : section),
  };
}

export function deleteCanvasBlock(config: WebsiteLayoutConfig, sectionId: string, blockId: string) {
  return {
    ...config,
    sections: config.sections.map((section) => section.id === sectionId
      ? { ...section, elements: removeNestedBlock(section.elements, blockId) }
      : section),
  };
}

export function duplicateCanvasBlock(config: WebsiteLayoutConfig, sectionId: string, blockId: string) {
  return {
    ...config,
    sections: config.sections.map((section) => section.id === sectionId
      ? { ...section, elements: duplicateNestedBlock(section.elements, blockId) }
      : section),
  };
}

export function insertCanvasBlockAfter(
  config: WebsiteLayoutConfig,
  sectionId: string,
  blockId: string,
  type: Exclude<WebsiteBlockType, 'native-visibility'>,
): CanvasInsertion {
  const newBlock = createWebsiteBlock(type);
  let inserted = false;
  const section = config.sections.find((item) => item.id === sectionId);
  if (!section) return { config, blockId: '' };

  const insertAfter = (items: WebsiteBlock[]): WebsiteBlock[] => {
    const result: WebsiteBlock[] = [];
    for (const item of items) {
      result.push(item);
      if (item.id === blockId) {
        result.push(newBlock);
        inserted = true;
      } else if (item.children && !inserted) {
        result[result.length - 1] = { ...item, children: insertAfter(item.children) };
      }
    }
    return result;
  };
  const elements = insertAfter(section.elements);
  if (!inserted) return { config, blockId: '' };
  return {
    config: { ...config, sections: config.sections.map((item) => item.id === sectionId ? { ...item, elements } : item) },
    blockId: newBlock.id,
  };
}

export function reorderCanvasBlocks(config: WebsiteLayoutConfig, sectionId: string, sourceId: string, targetId: string) {
  if (sourceId === targetId) return config;
  const section = config.sections.find((item) => item.id === sectionId);
  if (!section) return config;
  let changed = false;
  const reorder = (items: WebsiteBlock[]): WebsiteBlock[] => {
    const sourceIndex = items.findIndex((item) => item.id === sourceId);
    const targetIndex = items.findIndex((item) => item.id === targetId);
    if (sourceIndex >= 0 && targetIndex >= 0) {
      if ((items[sourceIndex].target ?? '') !== (items[targetIndex].target ?? '')) return items;
      changed = true;
      return moveItem(items, sourceIndex, targetIndex);
    }
    for (let index = 0; index < items.length; index += 1) {
      const parent = items[index];
      if (!parent.children || changed) continue;
      const children = reorder(parent.children);
      if (children !== parent.children) {
        const next = [...items];
        next[index] = { ...parent, children };
        return next;
      }
    }
    return items;
  };
  const elements = reorder(section.elements);
  return changed ? { ...config, sections: config.sections.map((item) => item.id === sectionId ? { ...item, elements } : item) } : config;
}
