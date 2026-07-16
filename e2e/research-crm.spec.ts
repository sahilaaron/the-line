import { test, expect } from '@playwright/test';

/**
 * Approval flow through the Research Studio graph workspace: open the Steam
 * Engine package as a graph, approve excluding the QA-held relationship, and
 * confirm the private canonical record. Seeded by db:seed:e2e. This spec OWNS
 * the steam-engine package (mutation); the edit spec uses a distinct package.
 * Resilient to a retry that finds it already promoted.
 */
test('graph review -> approve excluding QA-held item -> private canonical record', async ({ page }) => {
  await page.goto('/crm');
  await expect(page.getByRole('heading', { name: 'Research Studio' })).toBeVisible();

  await page.getByRole('link', { name: 'Steam engine (provisional record)' }).first().click();
  await expect(page.getByTestId('graph-canvas')).toBeVisible();

  const status = page.getByTestId('pkg-status');
  if ((await status.textContent())?.trim() !== 'promoted') {
    // rel-newcomen is QA-held from seeding; approve_with_holds excludes held items.
    await page.getByTestId('approve-holds').click();
    await expect(page.getByTestId('pkg-status')).toHaveText('promoted');
  }

  await page.getByRole('link', { name: /view canonical record/ }).click();
  await expect(page.getByTestId('entity-privacy')).toHaveText('private — not published');
  await expect(page.getByText('improved_by')).toBeVisible();
  await expect(page.getByText('Thomas Newcomen')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Provenance' })).toBeVisible();
});
