import { test, expect } from '@playwright/test';

/**
 * Proves the CRM `marked_duplicate` terminal state renders correctly. The
 * duplicate-candidate package ("Hero's engine") and its canonical target
 * ('aeolipile') are staged by `db:seed:research`. Marking it a duplicate must:
 * set status marked_duplicate, show "Decision recorded", show the duplicate
 * target slug + the corrected explanatory sentence, hide the decision form, and
 * show NO canonical-record link (the duplicate's subject was not promoted).
 */
test('mark_duplicate renders a terminal state with the duplicate target and no form', async ({ page }) => {
  await page.goto('/crm');
  await page.getByRole('link', { name: "Hero's engine (provisional record)" }).first().click();
  await expect(page.getByRole('heading', { name: "Hero's engine (provisional record)" })).toBeVisible();

  const status = page.getByTestId('pkg-status');
  if ((await status.textContent())?.trim() !== 'marked_duplicate') {
    await page.locator('input[name="duplicateOfSlug"]').fill('aeolipile');
    await page.getByRole('button', { name: 'Mark duplicate' }).click();
    await expect(page.getByTestId('pkg-status')).toHaveText('marked_duplicate');
  }

  // Decision recorded, form gone.
  await expect(page.getByTestId('decision-recorded')).toBeVisible();
  await expect(page.getByText('Decision recorded.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve as submitted' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mark duplicate' })).toHaveCount(0);
  await expect(page.getByTestId('approve-holds')).toHaveCount(0);

  // Duplicate target + corrected sentence visible.
  const dup = page.getByTestId('duplicate-target');
  await expect(dup).toBeVisible();
  await expect(dup).toContainText('aeolipile');
  await expect(
    page.getByText(
      'This package’s subject was not promoted. The duplicate was recorded, but no entities or relationships were merged.',
    ),
  ).toBeVisible();

  // No canonical-record link for a duplicate package.
  await expect(page.getByRole('link', { name: /view canonical record/ })).toHaveCount(0);
});
