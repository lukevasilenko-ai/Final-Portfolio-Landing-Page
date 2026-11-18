import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { ArrowUpRight, BriefcaseBusiness, CornerDownLeft, Plus, Search } from 'lucide-react';

export type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  Icon: ComponentType<{ 'aria-hidden'?: boolean | 'true' }>;
  run: () => void;
};

/** Ctrl/⌘+K quick menu: sections, actions and projects in one filterable list. */
export default function CommandPalette({
  open,
  onClose,
  sections,
  projects,
  onNavigate,
  onNewProject,
  onOpenProject,
}: {
  open: boolean;
  onClose: () => void;
  sections: { id: string; label: string; Icon: CommandItem['Icon'] }[];
  projects: { id: string; title: string }[];
  onNavigate: (sectionId: string) => void;
  onNewProject: () => void;
  onOpenProject: (projectId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const items = useMemo<CommandItem[]>(() => {
    const base: CommandItem[] = [
      { id: 'new-project', label: 'ახალი პროექტი', group: 'მოქმედებები', Icon: Plus, run: onNewProject },
      { id: 'open-site', label: 'საიტის ნახვა ახალ ჩანართში', group: 'მოქმედებები', Icon: ArrowUpRight, run: () => { window.open('/', '_blank', 'noreferrer'); } },
      ...sections.map((section) => ({ id: `section-${section.id}`, label: section.label, hint: 'გადასვლა', group: 'განყოფილებები', Icon: section.Icon, run: () => onNavigate(section.id) })),
      ...projects.map((project) => ({ id: `project-${project.id}`, label: project.title, hint: 'რედაქტირება', group: 'პროექტები', Icon: BriefcaseBusiness, run: () => onOpenProject(project.id) })),
    ];
    const value = query.trim().toLocaleLowerCase('ka-GE');
    const filtered = value ? base.filter((item) => item.label.toLocaleLowerCase('ka-GE').includes(value)) : base.filter((item) => item.group !== 'პროექტები');
    return filtered.slice(0, 40);
  }, [onNavigate, onNewProject, onOpenProject, projects, query, sections]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const choose = (item: CommandItem | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  let lastGroup = '';

  return (
    <div className="admin-dialog-backdrop admin-palette-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="admin-palette" role="dialog" aria-modal="true" aria-label="სწრაფი მენიუ">
        <div className="admin-palette-search">
          <Search aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="მოძებნეთ განყოფილება, მოქმედება ან პროექტი…"
            aria-label="ძიება"
            role="combobox"
            aria-expanded="true"
            aria-controls="admin-palette-list"
            aria-activedescendant={items[active] ? `admin-palette-${items[active].id}` : undefined}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => Math.min(items.length - 1, index + 1)); }
              else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(0, index - 1)); }
              else if (event.key === 'Enter') { event.preventDefault(); choose(items[active]); }
              else if (event.key === 'Escape') { event.preventDefault(); onClose(); }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <ul id="admin-palette-list" ref={listRef} className="admin-palette-list" role="listbox">
          {items.length === 0 && <li className="admin-palette-empty">ვერაფერი მოიძებნა</li>}
          {items.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <li key={item.id} role="presentation">
                {header && <span className="admin-palette-group">{header}</span>}
                <button
                  id={`admin-palette-${item.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  data-index={index}
                  className="admin-palette-item"
                  onMouseMove={() => setActive(index)}
                  onClick={() => choose(item)}
                >
                  <item.Icon aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.hint && <small>{item.hint}</small>}
                  {index === active && <CornerDownLeft className="admin-palette-enter" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="admin-palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> არჩევა</span>
          <span><kbd>Enter</kbd> გახსნა</span>
          <span><kbd>Ctrl</kbd>+<kbd>K</kbd> ნებისმიერ ადგილას</span>
        </div>
      </div>
    </div>
  );
}
