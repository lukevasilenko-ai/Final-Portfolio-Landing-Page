import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateEstimate,
  cloneCalculatorConfig,
  DEFAULT_CALCULATOR_CONFIG,
  explainEstimate,
  validateCalculatorConfig,
} from '../src/calculator/model.ts';

const estimate = (serviceId: string, overrides: Partial<{
  quantity: number;
  changes: number;
  rush: boolean;
  selectedExtras: string[];
}> = {}) => calculateEstimate(DEFAULT_CALCULATOR_CONFIG, {
  serviceId,
  quantity: overrides.quantity ?? 1,
  changes: overrides.changes ?? 0,
  rush: overrides.rush ?? false,
  selectedExtras: overrides.selectedExtras ?? [],
});

test('default calculator configuration validates and keeps the original package prices', () => {
  assert.equal(validateCalculatorConfig(DEFAULT_CALCULATOR_CONFIG), true);
  assert.deepEqual(DEFAULT_CALCULATOR_CONFIG.packages.map((item) => item.price), [600, 1000, 1700]);
});

test('poster and cover ranges match the existing calculator', () => {
  assert.deepEqual(estimate('poster'), { min: 100, max: 130 });
  assert.deepEqual(estimate('cover'), { min: 70, max: 100 });
  assert.deepEqual(estimate('businessCards'), { min: 50, max: 70 });
  assert.deepEqual(estimate('googleReviewSet'), { min: 150, max: 250 });
});

test('quantity discounts apply at three and six items with nearest-five rounding', () => {
  assert.deepEqual(estimate('poster', { quantity: 3 }), { min: 275, max: 360 });
  assert.deepEqual(estimate('poster', { quantity: 6 }), { min: 530, max: 685 });
});

test('rush adds twenty percent to the base and rounds to five GEL', () => {
  assert.deepEqual(estimate('poster', { rush: true }), { min: 120, max: 155 });
});

test('additional sizes remain outside rush pricing for ordinary services', () => {
  assert.deepEqual(estimate('poster', { selectedExtras: ['extra-sizes'] }), { min: 115, max: 145 });
  assert.deepEqual(estimate('poster', { rush: true, selectedExtras: ['extra-sizes'] }), { min: 135, max: 170 });
});

test('template poster stays at one unit and preserves change and extra-size rules', () => {
  assert.deepEqual(estimate('templatePoster', { quantity: 8 }), { min: 140, max: 140 });
  assert.deepEqual(estimate('templatePoster', { quantity: 8, changes: 2 }), { min: 180, max: 180 });
  assert.deepEqual(estimate('templatePoster', { changes: 2, rush: true, selectedExtras: ['extra-sizes'] }), { min: 235, max: 235 });
});

test('itemised estimate always adds up to the total and points to the next discount', () => {
  const cases = [
    { serviceId: 'poster', quantity: 1, changes: 0, rush: false, selectedExtras: [] },
    { serviceId: 'poster', quantity: 3, changes: 0, rush: true, selectedExtras: ['extra-sizes'] },
    { serviceId: 'cover', quantity: 7, changes: 0, rush: true, selectedExtras: [] },
    { serviceId: 'templatePoster', quantity: 1, changes: 2, rush: true, selectedExtras: ['extra-sizes'] },
    { serviceId: 'googleReviewSet', quantity: 4, changes: 0, rush: false, selectedExtras: [] },
  ];
  for (const input of cases) {
    const explained = explainEstimate(DEFAULT_CALCULATOR_CONFIG, input);
    assert.deepEqual(explained.total, calculateEstimate(DEFAULT_CALCULATOR_CONFIG, input));
    assert.equal(explained.lines.reduce((sum, line) => sum + line.min, 0), explained.total.min);
    assert.equal(explained.lines.reduce((sum, line) => sum + line.max, 0), explained.total.max);
  }
  const two = explainEstimate(DEFAULT_CALCULATOR_CONFIG, { serviceId: 'cover', quantity: 2, changes: 0, rush: false, selectedExtras: [] });
  assert.deepEqual(two.nextDiscount, { minimumQuantity: 3, percent: 8 });
  assert.equal(two.discountPercent, 0);
  const four = explainEstimate(DEFAULT_CALCULATOR_CONFIG, { serviceId: 'cover', quantity: 4, changes: 0, rush: false, selectedExtras: [] });
  assert.equal(four.discountPercent, 8);
  assert.deepEqual(four.nextDiscount, { minimumQuantity: 6, percent: 12 });
  assert.equal(explainEstimate(DEFAULT_CALCULATOR_CONFIG, { serviceId: 'templatePoster', quantity: 1, changes: 0, rush: false, selectedExtras: [] }).nextDiscount, null);
});

test('invalid ranges and unsupported configuration variants fail validation', () => {
  const config = cloneCalculatorConfig(DEFAULT_CALCULATOR_CONFIG);
  config.services[0].pricing = { type: 'range', min: 140, max: 100 };
  assert.equal(validateCalculatorConfig(config), false);
  config.services[0].pricing = { type: 'range', min: 100, max: 130 };
  config.schemaVersion = 2 as 1;
  assert.equal(validateCalculatorConfig(config), false);
  config.schemaVersion = 1;
  config.services[0].controlsOrder = ['quantity', 'quantity', 'options'];
  assert.equal(validateCalculatorConfig(config), false);
});

test('new per-item services can be added and disabled services are not quoted', () => {
  const config = cloneCalculatorConfig(DEFAULT_CALCULATOR_CONFIG);
  config.services.push({
    id: 'sticker-design',
    groupId: 'design',
    label: 'სტიკერის დიზაინი',
    note: 'ფასი თითოეულ დიზაინზე',
    enabled: true,
    order: 3,
    controlsOrder: ['quantity', 'changes', 'options'],
    pricing: { type: 'per_item', amount: 35 },
    quantity: { enabled: true, min: 1, max: 10, label: 'რაოდენობა' },
    rush: { enabled: false, percent: 20, label: 'სასწრაფო ვადა' },
    discounts: [],
    extras: [],
  });
  assert.equal(validateCalculatorConfig(config), true);
  assert.deepEqual(calculateEstimate(config, { serviceId: 'sticker-design', quantity: 4, changes: 0, rush: false, selectedExtras: [] }), { min: 140, max: 140 });
  config.services.at(-1)!.enabled = false;
  assert.throws(() => calculateEstimate(config, { serviceId: 'sticker-design', quantity: 1, changes: 0, rush: false, selectedExtras: [] }));
});
