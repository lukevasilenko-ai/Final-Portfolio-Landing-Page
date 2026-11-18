import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  DEFAULT_WEBSITE_LAYOUT,
  NATIVE_SECTION_KEYS,
  RETIRED_NATIVE_SECTION_KEYS,
  createTemplateSection,
  dropRetiredLayoutContent,
  duplicateNestedBlock,
  getWebsiteNavigationSections,
  moveNestedBlock,
  moveItem,
  removeNestedBlock,
  resolveWebsiteLayoutManagerConfig,
  updateNestedBlock,
  validateWebsiteLayout,
  WEBSITE_TEMPLATES,
  type WebsiteBlock,
  type WebsiteLayoutConfig,
} from '../src/websiteSections/model';
import { getNativeElementDefinitions, insertNativeElement, isNativeElementVisible, NATIVE_ELEMENT_SLOT_IDS, setNativeElementVisibility } from '../src/websiteSections/nativeSchema';
import { deleteCanvasBlock, duplicateCanvasBlock, insertCanvasBlockAfter, insertCanvasNativeBlock, insertCanvasSection, moveCanvasSection, popWebsiteLayoutUndo, pushWebsiteLayoutUndo, removeCanvasTemplateSection, reorderCanvasBlocks, setCanvasNativeVisibility, setCanvasSectionVisibility, updateWebsiteElementText } from '../src/websiteSections/canvasEditor';
import { isTrustedPreviewMessage, rectsIntersect, shouldApplyPreviewRevision } from '../src/websiteSections/previewProtocol';

function copyDefault(): WebsiteLayoutConfig {
  return JSON.parse(JSON.stringify(DEFAULT_WEBSITE_LAYOUT)) as WebsiteLayoutConfig;
}

test('the shipped fallback has the complete native homepage and validates', () => {
  assert.equal(validateWebsiteLayout(copyDefault()), true);
  assert.equal(copyDefault().sections.length, 8);
});

test('manager bootstrap uses the complete default when there is no published layout', () => {
  const config = resolveWebsiteLayoutManagerConfig([]);
  assert.equal(validateWebsiteLayout(config), true);
  assert.equal(config.sections.length, 8);
  assert.equal(WEBSITE_TEMPLATES.length, 12);
  assert.deepEqual(config, DEFAULT_WEBSITE_LAYOUT);
});

test('the template registry creates valid, visible sections for every supported template', () => {
  assert.equal(WEBSITE_TEMPLATES.length, 12);
  for (const template of WEBSITE_TEMPLATES) {
    const config = copyDefault();
    config.sections.push(createTemplateSection(template.id, config.sections.length));
    assert.equal(validateWebsiteLayout(config), true, template.id);
  }
});

test('visibility and order changes stay local and retain stable section anchors', () => {
  const config = copyDefault();
  config.sections[1].visible = false;
  config.sections = moveItem(config.sections, 1, 4).map((section, order) => ({ ...section, order }));
  assert.equal(validateWebsiteLayout(config), true);
  assert.equal(config.sections.find((section) => section.id === 'about')?.anchorId, 'about');
  assert.equal(config.sections.find((section) => section.id === 'about')?.visible, false);
  assert.ok(getWebsiteNavigationSections(config).every((section) => section.visible));
});

test('section selection actions hide native sections reversibly and only remove draft templates', () => {
  const original = copyDefault();
  const hidden = setCanvasSectionVisibility(original, 'projects', false);
  assert.equal(hidden.sections.find((section) => section.id === 'projects')?.visible, false);
  assert.equal(original.sections.find((section) => section.id === 'projects')?.visible, true);
  assert.equal(setCanvasSectionVisibility(hidden, 'projects', true).sections.find((section) => section.id === 'projects')?.visible, true);
  assert.equal(removeCanvasTemplateSection(hidden, 'projects'), hidden, 'native project section is protected from deletion');

  const template = createTemplateSection('text-heading', original.sections.length);
  const withTemplate = insertCanvasSection(original, template, 2);
  const withoutTemplate = removeCanvasTemplateSection(withTemplate, template.id);
  assert.equal(withoutTemplate.sections.some((section) => section.id === template.id), false);
  assert.equal(original.sections.some((section) => section.id === template.id), false);
  assert.equal(validateWebsiteLayout(withoutTemplate), true);
});

test('section insertion and movement preserve the ordered, stable layout', () => {
  const original = copyDefault();
  const template = createTemplateSection('gallery', 0);
  const inserted = insertCanvasSection(original, template, 1);
  assert.equal(inserted.sections[1].id, template.id);
  const moved = moveCanvasSection(moveCanvasSection(inserted, template.id, 1), template.id, 1);
  assert.equal(moved.sections[3].id, template.id);
  assert.equal(validateWebsiteLayout(moved), true);
  assert.deepEqual(original.sections.map((section) => section.id), DEFAULT_WEBSITE_LAYOUT.sections.map((section) => section.id));
});

test('marquee selection uses rectangle intersection without selecting non-overlapping elements', () => {
  const marquee = { left: 10, top: 10, right: 80, bottom: 80, width: 70, height: 70 };
  assert.equal(rectsIntersect(marquee, { left: 60, top: 60, right: 100, bottom: 100, width: 40, height: 40 }), true);
  assert.equal(rectsIntersect(marquee, { left: 80, top: 80, right: 100, bottom: 100, width: 20, height: 20 }), false);
});

test('canvas exposes element, section and marquee modes with safe section actions', () => {
  const source = readFileSync(new URL('../src/websiteSections/CanvasWebsiteEditor.tsx', import.meta.url), 'utf8');
  assert.match(source, /selectionScope === 'element'/);
  assert.match(source, /selectionScope === 'section'/);
  assert.match(source, /selectionScope === 'multiple'/);
  assert.match(source, /setCanvasSectionVisibilityModel\(layout, section\.id, !section\.visible\)/);
  assert.match(source, /სექციის დამატება წინ/);
  assert.match(source, /სექციის დამატება შემდეგ/);
  assert.match(source, /სექციის დამალვა/);
  assert.match(source, /სექციის დუბლირება/);
});

test('edit canvas intercepts links and submissions and section selection measures the full native section', () => {
  const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(source, /event\.target\.closest\('a,button(,label)?'\).*event\.preventDefault\(\)/);
  assert.match(source, /const blockFormSubmission = \(event: Event\) => \{ event\.preventDefault\(\)/);
  assert.match(source, /elementBoundsUnion\(roots\.length \? roots : \[sectionRoot\]\)/);
  assert.match(source, /suppressClickAfterMarquee/);
});

test('hidden sections disappear from public rendering and retain editor-only restore and insertion controls', () => {
  const source = readFileSync(new URL('../src/websiteSections/WebsiteSectionRenderer.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/websiteSections/website-sections.css', import.meta.url), 'utf8');
  assert.match(source, /!section\.visible \? editorEnabled && <div/);
  assert.match(source, /data-website-editor-restore-section=\{section\.id\}/);
  assert.match(source, /data-website-editor-add-section-before=\{section\.id\}/);
  assert.match(source, /data-website-editor-add-section-after=\{section\.id\}/);
  // Visible sections render inside a selectable frame (data-el="section.<id>").
  assert.match(source, /className=\{?[`"]site-section-frame[\s\S]*section\.kind === 'native'/);
  assert.match(styles, /\.website-editor-hidden-section-marker\s*\{[^}]*height:\s*0;[^}]*min-height:\s*0;/s);
});

test('native About and Contact content is editable while typed fields remain validated', () => {
  const config = copyDefault();
  const about = config.sections.find((section) => section.id === 'about');
  const contact = config.sections.find((section) => section.id === 'contact');
  assert.ok(about && contact);
  about.copy.statsExperienceValue = '3+';
  about.copy.skillOneLevel = '88';
  contact.copy.contactEmail = 'designer@example.com';
  contact.copy.whatsappNumber = '995599123456';
  assert.equal(validateWebsiteLayout(config), true);

  contact.copy.contactEmail = 'not-an-email';
  assert.equal(validateWebsiteLayout(config), false);
  contact.copy.contactEmail = 'designer@example.com';
  about.copy.skillOneLevel = '101';
  assert.equal(validateWebsiteLayout(config), false);
});

test('a portfolio native element can be hidden and replaced in place without touching other native content', () => {
  const config = copyDefault();
  const projects = config.sections.find((section) => section.id === 'projects');
  assert.ok(projects);
  const before = { ...projects.copy };
  const hidden = setNativeElementVisibility(projects, 'projects.category-label', false, 'native-hidden-category-label');
  assert.equal(isNativeElementVisible(hidden, 'projects.category-label'), false);

  const replacement: WebsiteBlock = { id: 'replacement-eyebrow', type: 'eyebrow', text: 'ALL CATEGORIES', visible: true };
  const replaced = insertNativeElement(hidden, 'projects.category-label', replacement, 'replace');
  assert.equal(isNativeElementVisible(replaced, 'projects.category-label'), false);
  assert.equal(replaced.copy.title, before.title);
  assert.equal(replaced.copy.description, before.description);
  assert.equal(replaced.copy.categoryLabel, before.categoryLabel);
  assert.deepEqual(replaced.elements.filter((item) => item.target === 'projects.category-label' && item.type !== 'native-visibility').map((item) => item.position), ['replace']);

  const sectionIndex = config.sections.findIndex((section) => section.id === 'projects');
  config.sections[sectionIndex] = replaced;
  assert.equal(validateWebsiteLayout(config), true);

  const restored = setNativeElementVisibility(replaced, 'projects.category-label', true, 'unused-marker');
  assert.equal(isNativeElementVisible(restored, 'projects.category-label'), true);
  assert.equal(restored.elements.find((item) => item.id === replacement.id)?.position, 'after');
});

test('the Selected Work showcase is removed from the portfolio section and the builder', () => {
  const projectsSource = readFileSync(new URL('../src/components/Projects.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(projectsSource, /FeaturedWorkShowcase/);
  assert.doesNotMatch(projectsSource, /NativeElementSlot id="projects\.featured-work"/);
  // The section heading (title, text, catalogue button) was later taken off the page on request;
  // the category list opens the section.
  assert.doesNotMatch(projectsSource, /slot: 'projects\.title'/);
  assert.match(projectsSource, /NativeElementSlot id="projects\.category-cards"/);
  assert.equal(NATIVE_ELEMENT_SLOT_IDS.includes('projects.eyebrow'), false);
  assert.equal(NATIVE_ELEMENT_SLOT_IDS.includes('projects.featured-work'), false);
});

test('saved layouts that still reference the removed Selected Work slots load without falling back to the default', () => {
  const saved = copyDefault() as unknown as { sections: { id: string; elements: unknown[] }[] };
  const projects = saved.sections.find((section) => section.id === 'projects');
  assert.ok(projects);
  projects.elements.push(
    { id: 'native-hidden-old', type: 'native-visibility', target: 'projects.eyebrow', visible: false },
    { id: 'old-eyebrow', type: 'eyebrow', text: 'ჩემი წარწერა', target: 'projects.eyebrow', position: 'replace', visible: true },
  );
  assert.equal(validateWebsiteLayout(saved), false);
  const cleaned = dropRetiredLayoutContent(saved);
  assert.equal(validateWebsiteLayout(cleaned), true);
  assert.deepEqual(cleaned, copyDefault());
});

test('retired sections (about, brief studio) stay hidden placeholders at the end of saved layouts and are never rendered', () => {
  const source = readFileSync(new URL('../src/websiteSections/WebsiteSectionRenderer.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /CreativeBriefStudio/);
  assert.doesNotMatch(source, /import About/);
  assert.deepEqual([...RETIRED_NATIVE_SECTION_KEYS], ['about', 'brief-studio']);

  const defaults = copyDefault();
  const tail = defaults.sections.slice(-RETIRED_NATIVE_SECTION_KEYS.length);
  assert.deepEqual(tail.map((section) => section.id), ['about', 'brief-studio']);
  for (const placeholder of tail) {
    assert.equal(getNativeElementDefinitions(placeholder.sectionKey!).length, 0);
    assert.equal(placeholder.visible, false);
    assert.equal(getWebsiteNavigationSections(defaults).some((section) => section.id === placeholder.id), false);
  }

  // A layout saved before the removals: both sections visible in their old places, with inserted content.
  const saved = copyDefault();
  saved.sections = saved.sections.map((section) => {
    const order = NATIVE_SECTION_KEYS.indexOf(section.sectionKey!);
    return RETIRED_NATIVE_SECTION_KEYS.includes(section.sectionKey!)
      ? { ...section, order, visible: true, inNavigation: section.id === 'about', elements: [{ id: `old-${section.id}-note`, type: 'paragraph', text: 'note', visible: true }] }
      : { ...section, order };
  });
  assert.equal(validateWebsiteLayout(saved), true);
  const cleaned = dropRetiredLayoutContent(saved) as WebsiteLayoutConfig;
  assert.equal(validateWebsiteLayout(cleaned), true);
  for (const id of ['about', 'brief-studio']) {
    const retired = cleaned.sections.find((section) => section.id === id);
    assert.ok(retired);
    assert.equal(retired.visible, false);
    assert.equal(retired.inNavigation, false);
    assert.deepEqual(retired.elements, []);
  }
  assert.deepEqual(
    [...cleaned.sections].sort((a, b) => a.order - b.order).map((section) => section.id),
    defaults.sections.map((section) => section.id),
  );
});

test('canvas hides a native element and inserts a replacement in the same slot without changing the title, description or cards', () => {
  const original = copyDefault();
  const projects = original.sections.find((section) => section.id === 'projects');
  assert.ok(projects);
  const originalCopy = { ...projects.copy };
  const hidden = setCanvasNativeVisibility(original, 'projects', 'projects.category-label', false);
  assert.equal(isNativeElementVisible(hidden.sections.find((section) => section.id === 'projects')!, 'projects.category-label'), false);
  const inserted = insertCanvasNativeBlock(hidden, 'projects', 'projects.category-label', 'eyebrow');
  const replacement = inserted.config.sections.find((section) => section.id === 'projects')?.elements.find((block) => block.id === inserted.blockId);
  assert.ok(replacement);
  assert.equal(replacement.position, 'replace');
  assert.equal(replacement.text, 'ახალი წარწერა');
  assert.deepEqual(inserted.config.sections.find((section) => section.id === 'projects')?.copy, originalCopy);
  assert.deepEqual(original, copyDefault(), 'editing a draft does not mutate the saved fallback snapshot');
});

test('double-click text edits update only the selected block and can be undone from an immutable snapshot', () => {
  const before = copyDefault();
  const projectSection = before.sections.find((section) => section.id === 'projects');
  assert.ok(projectSection);
  const selection = { kind: 'native' as const, sectionId: 'projects', targetId: 'projects.title', label: 'სათაური', fields: ['title'] };
  const edited = updateWebsiteElementText(before, selection, 'title', 'ჩემი ნამუშევრები');
  const projects = edited.sections.find((section) => section.id === 'projects');
  assert.ok(projects);
  assert.equal(projects.copy.title, 'ჩემი ნამუშევრები');
  assert.equal(projects.copy.description, projectSection.copy.description);
  assert.equal(projects.copy.categoryLabel, projectSection.copy.categoryLabel);
  assert.deepEqual(before, copyDefault());
  const undoEntry = popWebsiteLayoutUndo(pushWebsiteLayoutUndo([], before));
  assert.ok(undoEntry);
  assert.deepEqual(undoEntry.layout, before);
  assert.equal(undoEntry.history.length, 0);
  assert.equal(undoEntry.layout.sections.find((section) => section.id === 'projects')?.copy.title, projectSection.copy.title);
});

test('canvas insertion, duplication, deletion and reorder operations stay within compatible draft blocks', () => {
  const config = copyDefault();
  const section = createTemplateSection('text-heading', config.sections.length);
  const first = section.elements[0];
  const second = section.elements[1];
  const withSection = { ...config, sections: [...config.sections, section] };
  const inserted = insertCanvasBlockAfter(withSection, section.id, first.id, 'paragraph');
  assert.equal(inserted.config.sections.find((item) => item.id === section.id)?.elements[1]?.id, inserted.blockId);
  const duplicated = duplicateCanvasBlock(inserted.config, section.id, inserted.blockId);
  const afterDuplicate = duplicated.sections.find((item) => item.id === section.id)!;
  assert.equal(afterDuplicate.elements.length, section.elements.length + 2);
  const reordered = reorderCanvasBlocks(inserted.config, section.id, inserted.blockId, second.id);
  const reorderedItems = reordered.sections.find((item) => item.id === section.id)!.elements;
  assert.equal(reorderedItems[1].id, second.id);
  const deleted = deleteCanvasBlock(inserted.config, section.id, inserted.blockId);
  assert.equal(deleted.sections.find((item) => item.id === section.id)?.elements.some((item) => item.id === inserted.blockId), false);
});

test('preview synchronization accepts only the same-origin iframe and only newer draft revisions', () => {
  const iframeWindow = {} as Window;
  const parentWindow = {} as Window;
  assert.equal(isTrustedPreviewMessage('http://127.0.0.1:4175', iframeWindow, 'http://127.0.0.1:4175', iframeWindow), true);
  assert.equal(isTrustedPreviewMessage('http://127.0.0.1:4174', iframeWindow, 'http://127.0.0.1:4175', iframeWindow), false);
  assert.equal(isTrustedPreviewMessage('http://127.0.0.1:4175', parentWindow, 'http://127.0.0.1:4175', iframeWindow), false);
  assert.equal(shouldApplyPreviewRevision(4, 5), true);
  assert.equal(shouldApplyPreviewRevision(5, 5), false);
  assert.equal(shouldApplyPreviewRevision(5, 3), false);
});

test('native slot validation rejects unsupported locations, incompatible blocks and protected native groups', () => {
  const config = copyDefault();
  const projects = config.sections.find((section) => section.id === 'projects');
  assert.ok(projects);
  config.sections[config.sections.indexOf(projects)] = {
    ...projects,
    elements: [{ id: 'blocked-category-cards', type: 'native-visibility', target: 'projects.category-cards', visible: false }],
  };
  assert.equal(validateWebsiteLayout(config), false);

  const invalid = copyDefault();
  const projectsSection = invalid.sections.find((section) => section.id === 'projects');
  assert.ok(projectsSection);
  projectsSection.elements.push({ id: 'wrong-slot-kind', type: 'image', src: 'https://example.com/image.webp', target: 'projects.title', position: 'replace', visible: true });
  assert.equal(validateWebsiteLayout(invalid), false);
});

test('native element registry matches the SQL slot and insertion allowlists', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261023110000_native_website_elements.sql', import.meta.url), 'utf8');
  const targetLists = [...sql.matchAll(/if v_target not in \(([\s\S]*?)\) then return false; end if;/g)];
  assert.equal(targetLists.length, 2);
  const hideableTargets = targetLists[0][1];
  const supportedTargets = targetLists[1][1];
  assert.ok(supportedTargets);
  assert.ok(hideableTargets);

  for (const slotId of NATIVE_ELEMENT_SLOT_IDS) {
    assert.ok(supportedTargets.includes(`'${slotId}'`), `missing SQL target ${slotId}`);
    const definition = getNativeElementDefinitions(slotId.split('.')[0] as Parameters<typeof getNativeElementDefinitions>[0])
      .find((item) => item.id === slotId);
    assert.ok(definition, `missing client definition ${slotId}`);
    if (definition.canHide) assert.ok(hideableTargets.includes(`'${slotId}'`), `missing hide permission ${slotId}`);

    const caseLine = sql.split('\n').find((line) => line.includes(`when '${slotId}' then array[`));
    assert.ok(caseLine, `missing insertion policy ${slotId}`);
    const arrayExpression = caseLine.slice(caseLine.indexOf('then array[') + 'then array['.length);
    const sqlTypes = [...arrayExpression.matchAll(/'([a-z-]+)'/g)].map((match) => match[1]);
    assert.deepEqual(sqlTypes, definition.allowedInsertions, `insertion types differ for ${slotId}`);
  }
});

test('local draft configuration remains the manager selection after a reload/bootstrap', () => {
  const draft = copyDefault();
  const projects = draft.sections.find((section) => section.id === 'projects');
  assert.ok(projects);
  projects.elements.push({ id: 'draft-eyebrow', type: 'eyebrow', text: 'ჩემი წარწერა', target: 'projects.category-label', position: 'replace', visible: true });
  const restoredFromVersions = resolveWebsiteLayoutManagerConfig([
    { status: 'draft', config: draft },
    { status: 'published', config: copyDefault() },
  ]);
  assert.equal(restoredFromVersions.sections.find((section) => section.id === 'projects')?.elements[0]?.id, 'draft-eyebrow');
  assert.equal(validateWebsiteLayout(restoredFromVersions), true);
});

test('responsive-hidden template sections cannot create dead navigation links', () => {
  const config = copyDefault();
  const section = createTemplateSection('text-heading', config.sections.length);
  section.inNavigation = true;
  section.appearance.responsive = 'mobile';
  config.sections.push(section);
  assert.equal(validateWebsiteLayout(config), false);

  section.inNavigation = false;
  assert.equal(validateWebsiteLayout(config), true);
  assert.ok(getWebsiteNavigationSections(config).every((item) => item.id !== section.id));
});

test('native anchors and arbitrary section settings are rejected', () => {
  const wrongAnchor = copyDefault();
  wrongAnchor.sections[0].anchorId = 'not-home';
  assert.equal(validateWebsiteLayout(wrongAnchor), false);

  const unknownSetting = copyDefault() as WebsiteLayoutConfig & { arbitraryCss?: string };
  unknownSetting.arbitraryCss = 'display:none';
  assert.equal(validateWebsiteLayout(unknownSetting), false);
});

test('nested edits, movement, duplication and removal do not mutate siblings', () => {
  const config = copyDefault();
  const section = createTemplateSection('services-grid', config.sections.length);
  const group = section.elements.find((item) => item.type === 'content-group');
  assert.ok(group?.children?.length);
  const card = group.children[0];
  const originalIds = collectIds(section.elements);

  const edited = updateNestedBlock(section.elements, card.id, (item) => ({ ...item, text: 'განახლებული აღწერა' }));
  assert.equal(findBlock(edited, card.id)?.text, 'განახლებული აღწერა');
  assert.equal(findBlock(section.elements, card.id)?.text, 'ვიზუალური იდენტობის შექმნა.');

  const duplicated = duplicateNestedBlock(edited, card.id);
  const duplicatedIds = collectIds(duplicated);
  assert.equal(new Set(duplicatedIds).size, duplicatedIds.length);
  assert.ok(duplicatedIds.length > originalIds.length);
  assert.equal(findBlock(duplicated, card.id)?.text, 'განახლებული აღწერა');

  const moved = moveNestedBlock(duplicated, card.id, -1);
  assert.equal(findBlock(moved, card.id)?.text, 'განახლებული აღწერა');
  const removed = removeNestedBlock(moved, card.id);
  assert.equal(findBlock(removed, card.id), undefined);
  assert.ok(findBlock(removed, duplicatedIds.at(-1) ?? ''));
});

test('unsafe links, invalid asset references, and executable fields are rejected', () => {
  const config = copyDefault();
  const section = createTemplateSection('call-to-action', config.sections.length);
  const button = section.elements.find((item) => item.type === 'button');
  assert.ok(button);
  button.href = 'javascript:alert(1)';
  config.sections.push(section);
  assert.equal(validateWebsiteLayout(config), false);

  button.href = '#contact';
  button.src = 'asset:not-a-uuid';
  assert.equal(validateWebsiteLayout(config), false);

  delete button.src;
  (button as WebsiteBlock & { onClick?: string }).onClick = 'alert(1)';
  assert.equal(validateWebsiteLayout(config), false);
});

function collectIds(blocks: WebsiteBlock[]): string[] {
  return blocks.flatMap((block) => [block.id, ...(block.children ? collectIds(block.children) : [])]);
}

function findBlock(blocks: WebsiteBlock[], id: string): WebsiteBlock | undefined {
  for (const block of blocks) {
    if (block.id === id) return block;
    const child = block.children ? findBlock(block.children, id) : undefined;
    if (child) return child;
  }
  return undefined;
}
