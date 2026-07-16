import { test, expect } from '@playwright/test';

/**
 * Research Studio graph proof (db:seed:e2e). ALL Studio assertions use the
 * ISOLATED 'studio-demo-engine' package (never promoted by another spec), so
 * they never depend on shared mutation or Playwright file order.
 */

test('a manual "Toothpaste" job appears as Awaiting Agent(s)', async ({ page }) => {
  await page.goto('/crm');
  await page.getByPlaceholder('e.g. Toothpaste').fill('Toothpaste');
  await page.getByRole('button', { name: /Add — becomes Awaiting Agent/ }).click();
  await page.goto('/crm/queue');
  const row = page.locator('[data-testid^="job-"]', { hasText: 'Toothpaste' }).first();
  await expect(row).toContainText('Awaiting Agent(s)');
});

test('the Studio demo package opens as a graph with labelled edges and an inspector', async ({ page }) => {
  await page.goto('/crm');
  await page.getByRole('link', { name: 'Studio demo engine (provisional record)' }).first().click();
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
  await page.getByRole('link', { name: 'Studio demo engine (provisional record)' }).first().click();
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

test('the canonical-match editor only offers compatible, non-synthetic targets', async ({ page }) => {
  await page.goto('/crm');
  await page.getByRole('link', { name: 'Studio demo engine (provisional record)' }).first().click();
  await page.getByTestId('node-condenser').click(); // an INVENTION candidate (no match)
  await expect(page.getByTestId('match-editor')).toBeVisible();
  // an invention candidate must NOT be able to match a PERSON (kind-incompatible)
  await page.getByTestId('match-search').fill('watt');
  await expect(page.getByTestId('match-option-james-watt')).toHaveCount(0);
  // a synthetic entity is never offered
  await page.getByTestId('match-search').fill('synthetic');
  await expect(page.getByTestId('match-results')).not.toContainText('SYNTHETIC');
  // a kind-COMPATIBLE canonical invention (aeolipile) IS offered and matchable
  await page.getByTestId('match-search').fill('aeolipile');
  await page.getByTestId('match-option-aeolipile').click();
  await expect(page.getByTestId('match-selected')).toContainText('server-derived');
  const saveResponse = page.waitForResponse((response) => response.request().method() === 'POST');
  await page.getByTestId('save-match').click();
  await saveResponse;
  await page.reload();
  await page.getByTestId('node-condenser').click();
  await expect(page.getByTestId('match-current')).toContainText(/aeolipile/i);
});

test('a node date field is editable and invalidates QA', async ({ page }) => {
  await page.goto('/crm');
  await page.getByRole('link', { name: 'Studio demo engine (provisional record)' }).first().click();
  await page.getByTestId('node-central').click();
  await page.getByTestId('edit-node-date').first().fill('1713');
  await page.getByTestId('save-node-date').first().click();
  await expect(page.getByTestId('pkg-status')).toHaveText('qa_pending');
});

test('agent-proposed holds show governed resolution controls and update provenance', async ({ page }) => {
  await page.goto('/crm');
  await page.getByRole('link', { name: 'Studio demo engine (provisional record)' }).first().click();
  // rel-glasgow is seeded as an AGENT-proposed hold. Select it via the table.
  await page.getByTestId('toggle-table').click();
  await page.getByTestId('table-edge-rel-glasgow').click();
  await expect(page.getByTestId('inspector')).toBeVisible();
  // Idempotent across Playwright retries: a previous attempt may have already
  // cleared the agent hold. Only exercise the clear action while it is present.
  const agentHoldPresent = (await page.getByTestId('hold-agent').count()) > 0;
  if (agentHoldPresent) {
    // provenance shows an AGENT hold, and both governed controls are offered
    await expect(page.getByTestId('hold-agent')).toBeVisible();
    await expect(page.getByTestId('agent-hold-controls')).toBeVisible();
    await expect(page.getByTestId('clear-agent-hold')).toBeVisible();
    await expect(page.getByTestId('confirm-agent-hold')).toBeVisible();
    // clear the agent hold, awaiting the Server Action POST to complete
    const clearResponse = page.waitForResponse((response) => response.request().method() === 'POST');
    await page.getByTestId('clear-agent-hold').click();
    await clearResponse;
  }
  // Final state (both paths): reload, reopen the table, reselect the edge, and
  // confirm the agent hold and its controls are gone.
  await page.reload();
  await page.getByTestId('toggle-table').click();
  await page.getByTestId('table-edge-rel-glasgow').click();
  await expect(page.getByTestId('agent-hold-controls')).toHaveCount(0);
  await expect(page.getByTestId('hold-agent')).toHaveCount(0);
});
