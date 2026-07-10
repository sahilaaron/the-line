import { expect, test } from '@playwright/test';
import { enterYear, gotoLine, returnToLine, YOL_YEARS } from './helpers';

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
for (const year of YOL_YEARS) {
  test(`${year}: no synthetic content ever renders`, async ({ page }) => {
    await gotoLine(page);
    const yol = await enterYear(page, year, { source: 'database' });

    const text = await yol.innerText();
    expect(text).not.toMatch(/SYNTHETIC/i);
    expect(text).not.toMatch(/synth-/i);

    await returnToLine(page, year);
  });
}
