export type CanvasRect = { top: number; left: number; right: number; bottom: number; width: number; height: number };

export type CanvasSelectionMessage = {
  kind: 'native' | 'block' | 'section';
  sectionId: string;
  targetId?: string;
  blockId?: string;
  label: string;
  fields: string[];
  rect: CanvasRect;
};

export type CanvasSelection = Omit<CanvasSelectionMessage, 'rect'> & { rect: CanvasRect; canvasX: number; canvasY: number };

export type SelectionScope = 'element' | 'section' | 'multiple';

export function rectsIntersect(first: CanvasRect, second: CanvasRect) {
  return first.left < second.right && first.right > second.left
    && first.top < second.bottom && first.bottom > second.top;
}

export function isTrustedPreviewMessage(origin: string, source: MessageEventSource | null, expectedOrigin: string, expectedSource: MessageEventSource | null) {
  return origin === expectedOrigin && source !== null && source === expectedSource;
}

export function shouldApplyPreviewRevision(currentRevision: number, nextRevision: unknown) {
  return Number.isSafeInteger(nextRevision) && typeof nextRevision === 'number' && nextRevision > currentRevision;
}

export function getBlockEditableField(type: string) {
  if (['eyebrow', 'heading', 'subheading', 'paragraph'].includes(type)) return 'text';
  if (['button'].includes(type)) return 'label';
  return '';
}
