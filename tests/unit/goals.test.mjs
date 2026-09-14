import test from 'node:test';
import assert from 'node:assert/strict';
import { goalPreset, weekKey } from '../../dist/assets/core/analytics.js';

test('goal difficulty presets increase monotonically', () => {
  const easy = goalPreset('easy');
  const normal = goalPreset('normal');
  const hard = goalPreset('hard');
  const extreme = goalPreset('extreme');
  assert.ok(easy.weeklyCalories < normal.weeklyCalories);
  assert.ok(normal.weeklyCalories < hard.weeklyCalories);
  assert.ok(hard.weeklyCalories < extreme.weeklyCalories);
  assert.ok((easy.categorySets.back ?? 0) <= (normal.categorySets.back ?? 0));
  assert.ok((normal.categorySets.back ?? 0) <= (hard.categorySets.back ?? 0));
});

test('weekKey uses Monday as the weekly boundary', () => {
  assert.equal(weekKey(new Date('2026-09-14T12:00:00')), '2026-09-14');
  assert.equal(weekKey(new Date('2026-09-20T12:00:00')), '2026-09-14');
  assert.equal(weekKey(new Date('2026-09-21T12:00:00')), '2026-09-21');
});
