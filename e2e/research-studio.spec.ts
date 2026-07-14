import { test, expect } from '@playwright/test';

/**
 * Research Studio graph proof (db:seed:e2e). The read-only graph assertions use
 * the steam-engine package (safe even if the approval spec promoted it). The
 * EDIT scenario uses the ISOLATED 'studio-demo-engine' package so it never
 * depends on shared mutation or Playwright file order.
 */

test('a manual "Toothpaste" job appears as Awaiting Agent(s)', async ({ page }) => {
  await page.goto('/crm');
  await page.getByPlaceholder('e.g. Toothpaste').fill('Toothpaste');
  await page.getByRole('button', { name: /Add — becomes Awaiting Agent/ }).click();
  await page.goto('/crm/queue');
  const row = page.locator('[data-testid^="job-"]', { hasText: 'Toothpaste' }).first();
  await expect(row).toContainText('Awaiting Agent(s)');
});

test('the Steam Engine package opens as a graph with labelled edges and an inspector', async ({ page }) => {
  await page.goto('/crm');
  await page.getByRole('link', { name: 'Steam engine (provisional record)' }).first().click();
  await expect(page.getByTestId('graph-canvas')).toBeVisible();
  await expect(page.getByTestId('node-central')).toBeVisible();
  await expect(page.getByTestId('node-watt')).toBeVisible();
  await expect(page.getByText('was improved by').first()).toBeVisible();

  await page.getByTestId('node-central').click();
  await expect(page.getByTestId('inspector-title')).toBeVisible();
  await expect(page.getByTestId('inspector')).toContainText('slug');

  await page.getByTestId('toggle-table').click();
  await expect(page.getByTestId('graph-table')).toBeVisible();
  await expect(page.getByTestId('graph-table')).toContainText('was improved by');
});

test('the chronology toggle visibly repositions nodes', async ({ page }) => {
  await page.goto('/crm');
  await page.getByRole('link', { name: 'Steam engine (provisional record)' }).first().click();
  await expect(page.getByTestId('node-central')).toBeVisible();
  const box = async () => (await page.getByTestId('node-central').boundingBox())!;
  const before = await box();
  await page.getByTestId('toggle-chronology').click();
  await page.waitForTimeout(400);
  const after = await box();
  // a real re-layout visibly MOVES nodes (the focal node's earliest year is
  // ~1712, so chronology places it far from the radial origin).
  expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(20);
  // deterministic: toggling back returns it near the radial position.
  await page.getByTestId('toggle-chronology').click();
  await page.waitForTimeout(400);
  const back = await box();
  expect(Math.abs(back.x - before.x) + Math.abs(back.y - before.y)).toBeLessThan(20);
});

test('editing an isolated candidate invalidates QA and blocks approval', async ({ page }) => {
  await page.goto('/crm');
  await page.getByRole('link', { name: 'Studio demo engine (provisional record)' }).first().click();
  await page.getByTestId('node-glasgow').click();
  await page.getByTestId('edit-node-label').fill('University of Glasgow (edited in Studio)');
  await page.getByTestId('save-node').click();
  await expect(page.getByTestId('qa-invalidated')).toBeVisible();
  await expect(page.getByTestId('pkg-status')).toHaveText('qa_pending');
});

test('an edge inspector shows accurate human/QA hold provenance', async ({ page }) => {
  await page.goto('/crm');
  await page.getByRole('link', { name: 'Studio demo engine (provisional record)' }).first().click();
  // rel-newcomen is QA-held by the fixture QA. Select it via the accessible table.
  await page.getByTestId('toggle-table').click();
  await page.getByTestId('table-edge-rel-newcomen').click();
  await expect(page.getByTestId('inspector')).toBeVisible();
  await expect(page.getByTestId('hold-qa')).toBeVisible();
  // the QA hold is shown as a QA hold — NOT mislabelled and not a human hold
  await expect(page.getByTestId('hold-human')).toHaveCount(0);
});

test('an edge inspector shows sources and dates', async ({ page }) => {
  await page.goto('/crm');
  await page.getByRole('link', { name: 'Studio demo engine (provisional record)' }).first().click();
  await page.getByTestId('toggle-table').click();
  await page.getByTestId('table-edge-rel-watt').click(); // has a claim -> src-hills citation
  await expect(page.getByTestId('edge-sources')).toBeVisible();
  await expect(page.getByTestId('edge-sources')).toContainText('Hills');
  await expect(page.getByTestId('edge-dates')).toBeVisible();
});

test('synthetic candidates require explicit developer mode', async ({ page }) => {
  await page.goto('/crm');
  await page.getByRole('link', { name: 'Studio demo engine (provisional record)' }).first().click();
  await expect(page.getByTestId('graph-canvas')).toBeVisible();
  // NORMAL view: no dev toggle and no synthetic node anywhere (even in the table).
  await expect(page.getByTestId('dev-badge')).toHaveCount(0);
  await page.getByTestId('toggle-table').click();
  await expect(page.getByTestId('table-node-synthnode')).toHaveCount(0);
  // DEVELOPER view (server-authorized via ?dev=1): the synthetic node is present.
  const url = page.url();
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'dev=1');
  await expect(page.getByTestId('dev-badge')).toBeVisible();
  await page.getByTestId('filter-synthetic').check();
  await expect(page.getByTestId('node-synthnode')).toBeVisible();
});

test('the canonical-match editor selects a real entity with a controlled status', async ({ page }) => {
  await page.goto('/crm');
  await page.getByRole('link', { name: 'Studio demo engine (provisional record)' }).first().click();
  await page.getByTestId('node-condenser').click(); // a new candidate (no match)
  await expect(page.getByTestId('match-editor')).toBeVisible();
  // search narrows the canonical entity picker, then pick a real entity + status
  await page.getByTestId('match-search').fill('watt');
  await page.getByTestId('match-entity-select').selectOption({ index: 1 }); // first canonical match after the search filter
  await page.getByTestId('match-status-select').selectOption('canonical_incomplete');
  await page.getByTestId('save-match').click();
  // the inspector reflects the real match with a link to the canonical record
  await page.getByTestId('node-condenser').click();
  await expect(page.getByTestId('match-current')).toContainText('James Watt');
});

test('a node date field is editable and invalidates QA', async ({ page }) => {
  await page.goto('/crm');
  await page.getByRole('link', { name: 'Studio demo engine (provisional record)' }).first().click();
  await page.getByTestId('node-central').click();
  await page.getByTestId('edit-node-date').first().fill('1713');
  await page.getByTestId('save-node-date').first().click();
  await expect(page.getByTestId('pkg-status')).toHaveText('qa_pending');
});
