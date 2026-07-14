import { test, expect } from '@playwright/test';

/**
 * Cycle 8B — Research Studio proof. The CRM demo is seeded by db:seed:e2e
 * (Steam Engine + Hero's Engine packages, both awaiting review).
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
  // central node + a candidate node render
  await expect(page.getByTestId('node-central')).toBeVisible();
  await expect(page.getByTestId('node-watt')).toBeVisible();
  // a labelled, directional edge is present (forward label from the registry)
  await expect(page.getByText('was improved by').first()).toBeVisible();

  // selecting a node opens the inspector with its details
  await page.getByTestId('node-central').click();
  await expect(page.getByTestId('inspector-title')).toBeVisible();
  await expect(page.getByTestId('inspector')).toContainText('slug');

  // accessible table fallback represents the same graph
  await page.getByTestId('toggle-table').click();
  await expect(page.getByTestId('graph-table')).toBeVisible();
  await expect(page.getByTestId('graph-table')).toContainText('was improved by');
});

test('editing a candidate invalidates QA and blocks approval', async ({ page }) => {
  await page.goto('/crm');
  await page.getByRole('link', { name: 'Steam engine (provisional record)' }).first().click();
  await page.getByTestId('node-glasgow').click();
  await page.getByTestId('edit-node-label').fill('University of Glasgow (edited in Studio)');
  await page.getByTestId('save-node').click();
  // QA-invalidation banner appears; package reverts to qa_pending
  await expect(page.getByTestId('qa-invalidated')).toBeVisible();
  await expect(page.getByTestId('pkg-status')).toHaveText('qa_pending');
});
