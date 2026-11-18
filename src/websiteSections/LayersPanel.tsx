import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, Image as ImageIcon, LayoutPanelTop, Link2, MousePointerClick, Square, Type } from 'lucide-react';

/** One editable element on the page, as reported by the preview frame (flat, with its parent). */
export type LayerNode = { id: string; label: string; kind: string; hidden: boolean; parent: string | null; text: string };

const ICONS: Record<string, typeof Type> = {
  section: LayoutPanelTop, text: Type, image: ImageIcon, link: Link2, button: MousePointerClick, icon: Link2,
};

/** Page structure as a tree: sections, and inside each the elements that can be selected. */
export default function LayersPanel({ nodes, selectedId, onSelect, onToggleHidden, isHidden }: {
  nodes: LayerNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleHidden: (node: LayerNode) => void;
  isHidden: (node: LayerNode) => boolean;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const children = useMemo(() => {
    const map = new Map<string | null, LayerNode[]>();
    for (const node of nodes) {
      const parent = node.parent && nodes.some((item) => item.id === node.parent) ? node.parent : null;
      map.set(parent, [...(map.get(parent) ?? []), node]);
    }
    return map;
  }, [nodes]);

  const toggleOpen = (id: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const render = (parent: string | null, depth: number) => (children.get(parent) ?? []).map((node) => {
    const kids = children.get(node.id) ?? [];
    const open = !collapsed.has(node.id);
    const Icon = ICONS[node.kind] ?? Square;
    const hidden = isHidden(node);
    return (
      <li key={node.id}>
        <div className={`ve-layer${selectedId === node.id ? ' is-selected' : ''}${hidden ? ' is-hidden' : ''}`} style={{ paddingLeft: 6 + depth * 14 }}>
          {kids.length ? (
            <button type="button" className="ve-layer-caret" aria-label={open ? 'ჩაკეცვა' : 'გაშლა'} onClick={() => toggleOpen(node.id)}>
              {open ? <ChevronDown /> : <ChevronRight />}
            </button>
          ) : <span className="ve-layer-caret" aria-hidden="true" />}
          <button type="button" className="ve-layer-name" onClick={() => onSelect(node.id)} title={node.text || node.label}>
            <Icon aria-hidden="true" />
            <span>{node.kind === 'text' && node.text ? node.text : node.label.replace(/^სექცია: /, '')}</span>
          </button>
          <button type="button" className="ve-layer-eye" aria-label={hidden ? 'ჩვენება' : 'დამალვა'} title={hidden ? 'ჩვენება' : 'დამალვა'} onClick={() => onToggleHidden(node)}>
            {hidden ? <EyeOff /> : <Eye />}
          </button>
        </div>
        {kids.length > 0 && open && <ul>{render(node.id, depth + 1)}</ul>}
      </li>
    );
  });

  return (
    <aside className="ve-layers" aria-label="ფენები">
      <span className="ve-kicker">ფენები</span>
      {nodes.length === 0 ? <p className="ve-hint">გვერდი იტვირთება…</p> : <ul className="ve-layer-tree">{render(null, 0)}</ul>}
    </aside>
  );
}
