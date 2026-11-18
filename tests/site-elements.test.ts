import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addFreeItem, duplicateFreeItem, EMPTY_SITE_ELEMENTS, normalizeSiteElements, removeFreeItem,
  setElementHidden, setElementHref, setElementText, siteElementsEqual,
} from '../src/siteElements';

test('saved element changes keep only well-formed entries', () => {
  const normalized = normalizeSiteElements({
    hidden: ['hero.catalog-link', 'hero.catalog-link', 'bad id with spaces', 7],
    text: { 'site-footer.top-link': 'ზემოთ ↑', ['x'.repeat(200)]: 'too long id', ok: 'y'.repeat(501) },
    href: { 'hero.catalog-link': '/portfolio', evil: 'javascript:alert(1)', mail: 'mailto:hi@example.com' },
    strip: ['static:15_result', 'work:0f8fad5b-d9cb-469f-a165-70867728950e', 'work:not-a-uuid', 'other'],
  });
  assert.deepEqual(normalized.hidden, ['hero.catalog-link']);
  assert.deepEqual(normalized.text, { 'site-footer.top-link': 'ზემოთ ↑' });
  assert.deepEqual(normalized.href, { 'hero.catalog-link': '/portfolio', mail: 'mailto:hi@example.com' });
  assert.deepEqual(normalized.strip, ['static:15_result', 'work:0f8fad5b-d9cb-469f-a165-70867728950e']);
});

test('missing or broken data means "site as designed"', () => {
  assert.deepEqual(normalizeSiteElements(null), EMPTY_SITE_ELEMENTS);
  assert.deepEqual(normalizeSiteElements({ strip: 'nope' }), EMPTY_SITE_ELEMENTS);
});

test('free items: only safe images and known sections; add, duplicate and remove clean up after themselves', () => {
  const normalized = normalizeSiteElements({ free: [
    { id: 'abc123def', section: 'hero', type: 'image', src: 'https://x.supabase.co/storage/v1/object/public/site-editor-assets/a.png' },
    { id: 'zzz999zzz', section: 'hero', type: 'image', src: 'javascript:alert(1)' },
    { id: 'abc123def', section: 'hero', type: 'text' },
    { id: 'bad', section: 'hero', type: 'text' },
  ] });
  assert.deepEqual(normalized.free.map((item) => item.id), ['abc123def']);

  const added = addFreeItem(EMPTY_SITE_ELEMENTS, 'contact', 'text');
  assert.equal(added.elements.text[added.elementId], 'ახალი ტექსტი');
  const copied = duplicateFreeItem(added.elements, added.elementId);
  assert.ok(copied);
  assert.equal(copied.elements.free.length, 2);
  assert.equal(copied.elements.style[copied.elementId]?.base?.posY, (added.elements.style[added.elementId]?.base?.posY ?? 0) + 32);
  const onPhone = { ...added.elements, style: { ...added.elements.style, [added.elementId]: { ...added.elements.style[added.elementId], mobile: { posY: 300 } } } };
  const phoneCopy = duplicateFreeItem(onPhone, added.elementId);
  assert.ok(phoneCopy);
  assert.equal(phoneCopy.elements.style[phoneCopy.elementId]?.mobile?.posY, 332);
  const removed = removeFreeItem(removeFreeItem(copied.elements, added.elementId), copied.elementId);
  assert.equal(siteElementsEqual(removed, EMPTY_SITE_ELEMENTS), true);
});

test('hide, relabel and relink helpers are reversible', () => {
  let elements = setElementHidden(EMPTY_SITE_ELEMENTS, 'hero.time', true);
  elements = setElementText(elements, 'header.cta', 'მომწერეთ');
  elements = setElementHref(elements, 'header.cta', '#contact');
  assert.equal(siteElementsEqual(elements, EMPTY_SITE_ELEMENTS), false);
  elements = setElementHidden(elements, 'hero.time', false);
  elements = setElementText(elements, 'header.cta', null);
  elements = setElementHref(elements, 'header.cta', null);
  assert.equal(siteElementsEqual(elements, EMPTY_SITE_ELEMENTS), true);
});
