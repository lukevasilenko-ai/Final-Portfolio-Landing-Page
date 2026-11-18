import assert from 'node:assert/strict';
import test from 'node:test';
import { compileStyleMap, effectiveStyle, normalizeStyleMap, setStyleValue } from '../src/siteElementStyles';

test('only known properties with sane values survive', () => {
  const map = normalizeStyleMap({
    'hero.cta': { base: { fontSize: 18, color: '#2c5a4c', bogus: 1, rotate: 9999, background: 'url(javascript:1)' } },
    'bad id!': { base: { fontSize: 18 } },
    'hero.time': { mobile: { hidden: true }, desktop: { fontSize: 12 } },
  });
  assert.deepEqual(map, { 'hero.cta': { base: { fontSize: 18, color: '#2c5a4c' } }, 'hero.time': { mobile: { hidden: true } } });
});

test('compiled CSS targets data-el ids, with tablet and phone overrides in media queries', () => {
  let map = setStyleValue({}, 'hero.cta', 'base', 'fontSize', 20);
  map = setStyleValue(map, 'hero.cta', 'mobile', 'x', 12);
  map = setStyleValue(map, 'hero.time', 'tablet', 'hidden', true);
  const css = compileStyleMap(map);
  assert.match(css, /\[data-el="hero\.cta"\]\{font-size:20px !important\}/);
  assert.match(css, /@media \(max-width:1023px\)\{\[data-el="hero\.time"\]\{display:none !important\}\}/);
  assert.match(css, /@media \(max-width:767px\)\{.*translate\(12px, 0px\).*span\[data-el="hero\.cta"\]\{display:inline-block/s);
  assert.equal(compileStyleMap({}), '');
});

test('free items compile to absolute placement and an image crop', () => {
  let map = setStyleValue({}, 'free.abc123', 'base', 'posX', 10);
  map = setStyleValue(map, 'free.abc123', 'base', 'posY', 120);
  map = setStyleValue(map, 'free.abc123', 'base', 'widthPct', 25);
  map = setStyleValue(map, 'free.abc123', 'base', 'heightPx', 200);
  map = setStyleValue(map, 'free.abc123', 'base', 'objectY', 20);
  map = setStyleValue(map, 'free.abc123', 'base', 'zIndex', 12);
  const css = compileStyleMap(map);
  assert.match(css, /left:10% !important;top:120px !important;width:25% !important;height:200px !important/);
  assert.match(css, /\[data-el="free\.abc123"\] > img\{height:100% !important;object-fit:cover !important;object-position:50% 20% !important\}/);
  assert.doesNotMatch(css, /position:relative/);
});

test('phone falls back to tablet and desktop values; clearing removes empty entries', () => {
  let map = setStyleValue({}, 'x.y', 'base', 'color', '#111111');
  map = setStyleValue(map, 'x.y', 'tablet', 'fontSize', 14);
  assert.deepEqual(effectiveStyle(map, 'x.y', 'mobile'), { color: '#111111', fontSize: 14 });
  map = setStyleValue(map, 'x.y', 'tablet', 'fontSize', undefined);
  map = setStyleValue(map, 'x.y', 'base', 'color', undefined);
  assert.deepEqual(map, {});
});
