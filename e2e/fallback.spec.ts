import { expect, test } from '@playwright/test';
import {
  activePoint,
  enterYear,
  gotoLine,
  returnToLine,
  settle,
} from './helpers';

/**
 * Empty / unavailable database: the client must fall back to the isolated
 * prototype registry, mark the source `fallback`, keep the whole loop
 * working, and never leak an internal (path / SQL / stack) to the screen.
 *
 * We force the fallback deterministically by intercepting the read endpoint
 * with the same typed envelope an unseeded database produces
 * (`{ status: 'not_found' }`). This exercises the exact client contract in
 * `useYolData` without depending on server DB state, which keeps the spec
 * stable on every runner. (The server-side empty/error envelopes are proven
 * separately by the route + read-model unit tests.)
 */
test.beforeEach(async ({ page }) => {
  await page.route('**/api/yol/**', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'not_found' }),
    })
  );
});

test('unavailable database: fallback content, full loop, no leaked internals', async ({
  page,
}) => {
  await gotoLine(page);
  const yol = await enterYear(page, '1969', { source: 'fallback' });

  // the loop still works on fallback content
  const initial = await activePoint(page);
  await page.mouse.move(
    page.viewportSize()!.width / 2,
    page.viewportSize()!.height / 2
  );
  await page.mouse.wheel(0, 600);
  await settle(page);
  expect(await activePoint(page)).not.toBe(initial);

  await page.keyboard.press('ArrowRight');
  await settle(page);

  // no internal detail is exposed to the public experience
  const text = (await yol.innerText()).toLowerCase();
  for (const leak of ['sql', 'select ', 'stack', '/sessions/', 'econn', 'pglite']) {
    expect(text).not.toContain(leak);
  }
  // the diagnostic fallback note is debug-only, never shown here
  await expect(page.locator('.yw-source-note')).toHaveCount(0);

  // and return still lands on 1969
  await returnToLine(page, '1969');
});
