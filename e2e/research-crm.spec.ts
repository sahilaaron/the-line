import { test, expect } from '@playwright/test';

/**
 * Research CRM proof: manual input already captured by db:seed:research; this
 * spec drives the human half of the daily flow through the UI — dashboard ->
 * package review -> approve excluding the QA-held item -> private canonical
 * record with provenance. Prerequisite: `npm run db:seed:research` has seeded
 * the throwaway PGlite dir (the CI e2e job does this, mirroring the YoL suite).
 *
 * The seeded package sits at qa_complete with a QA hold on `rel-newcomen`.
 * This spec is resilient to a retry that finds the package already promoted.
 */
test('manual input -> run -> staged package -> QA hold -> approval -> private canonical record', async ({ page }) => {
  await page.goto('/crm');
  await expect(page.getByRole('heading', { name: 'Research Control' })).toBeVisible();

  // Open the package awaiting review.
  await page.getByRole('link', { name: 'Steam engine (provisional record)' }).first().click();
  await expect(page.getByRole('heading', { name: 'Steam engine (provisional record)' })).toBeVisible();

  const status = page.getByTestId('pkg-status');
  if ((await status.textContent())?.trim() !== 'promoted') {
    // The QA hold pre-checks rel-newcomen; approve excluding held items.
    const holdBox = page.locator('input[name="held"][value="rel-newcomen"]');
    await expect(holdBox).toBeChecked();
    await page.getByTestId('approve-holds').click();
    await expect(page.getByTestId('pkg-status')).toHaveText('promoted');
  }

  // Provenance link to the private canonical record.
  await page.getByRole('link', { name: /view canonical record/ }).click();
  await expect(page.getByTestId('entity-privacy')).toHaveText('private — not published');

  // Accepted relationship present; held "replaced -> Newcomen" excluded.
  await expect(page.getByText('improved_by')).toBeVisible();
  await expect(page.getByText('Thomas Newcomen')).toHaveCount(0);

  // Time associations and claims/sources are shown as canonical proof.
  await expect(page.getByRole('heading', { name: 'Time associations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Provenance' })).toBeVisible();
});
