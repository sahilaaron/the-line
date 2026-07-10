import { expect, test } from '@playwright/test';
import { enterField, enterYear, gotoLine, returnToLine } from './helpers';

/**
 * Synthetic exclusion at the public boundary.
 *
 * When the database also holds synthetic stress rows (every one prefixed
 * `synth-` / `SYNTHETIC:`, `isSynthetic = true`), the read model excludes
 * them, so NONE of that text may ever reach the rendered YoL. The CI e2e
 * database is seeded with `db:seed:synthetic` precisely so this assertion
 * has teeth; with a plain seed it still holds (trivially).
 *
 * The authoritative exclusion boundary is unit-tested in
 * src/db/queries/yol-read-model.test.ts; this spec guards the whole render
 * path end to end.
 */
test('1969 YoL: no synthetic content ever renders', async ({ page }) => {
  await gotoLine(page);
  const yol = await enterYear(page, '1969', { source: 'database' });

  const text = await yol.innerText();
  expect(text).not.toMatch(/SYNTHETIC/i);
  expect(text).not.toMatch(/synth-/i);

  await returnToLine(page, '1969');
});

test('1769 Historical Field: no synthetic content ever renders', async ({ page }) => {
  await gotoLine(page);
  await enterField(page);

  const text = await page.getByTestId('historical-field').innerText();
  expect(text).not.toMatch(/SYNTHETIC/i);
  expect(text).not.toMatch(/synth-/i);

  await returnToLine(page, '1769');
});
