import { expect, test, type Page } from '@playwright/test';

/**
 * Core loop: 2026 → scroll back to 1969 → click Earth → descend → YoL →
 * return → Line View at 1969. Also guards the transition against rapid input.
 */

async function scrollBackTo(page: Page, label: string, maxTries = 40) {
  for (let i = 0; i < maxTries; i++) {
    const current = await page.getByTestId('year-label').textContent();
    if (current?.trim() === label) return;
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(90);
  }
  // allow snapping to settle
  await page.waitForTimeout(800);
  await expect(page.getByTestId('year-label')).toHaveText(label);
}

test('core loop: line → 1969 → descent → YoL → return', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('year-label')).toHaveText('2026', {
    timeout: 30_000,
  });

  // wheel up must stay capped at 2026
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(600);
  await expect(page.getByTestId('year-label')).toHaveText('2026');

  // travel backward to 1969
  await scrollBackTo(page, '1969');
  await page.waitForTimeout(700); // let snap settle under the lens

  // click the Temporal Earth (screen centre, ~34vh) — twice, rapidly:
  // the second click must be swallowed by the transition lock
  const viewport = page.viewportSize()!;
  const earthX = viewport.width / 2;
  const earthY = viewport.height * 0.34;
  await page.mouse.click(earthX, earthY);
  await page.waitForTimeout(120);
  await page.mouse.click(earthX, earthY);

  // arrive in the 1969 Year on Line scene
  await expect(page.getByTestId('yol-title')).toHaveText('1969', {
    timeout: 15_000,
  });
  await expect(page.getByTestId('yol-ui')).not.toHaveClass(/hidden/);

  // wheel input must be ignored inside YoL
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(300);
  await expect(page.getByTestId('yol-title')).toHaveText('1969');

  // return to the Line at 1969
  await page.getByTestId('return-btn').click();
  await expect(page.getByTestId('yol-ui')).toHaveClass(/hidden/, {
    timeout: 15_000,
  });
  await expect(page.getByTestId('year-label')).toHaveText('1969');
});

test('arrow keys step between anchors', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('year-label')).toHaveText('2026', {
    timeout: 30_000,
  });

  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(900);
  await expect(page.getByTestId('year-label')).toHaveText('1969');

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(900);
  await expect(page.getByTestId('year-label')).toHaveText('2026');

  // capped at the newest anchor
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(600);
  await expect(page.getByTestId('year-label')).toHaveText('2026');
});

test('descent is 1969-only elsewhere', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('year-label')).toHaveText('2026', {
    timeout: 30_000,
  });
  await page.waitForTimeout(1500); // let the canvas + event system settle

  const viewport = page.viewportSize()!;
  await page.mouse.click(viewport.width / 2, viewport.height * 0.34);
  await expect(page.getByTestId('notice')).not.toHaveClass(/hidden/);
  await expect(page.getByTestId('yol-ui')).toHaveClass(/hidden/);
});

test('debug mode exposes tuning and metrics', async ({ page }) => {
  await page.goto('/?debug=1');
  await expect(page.getByTestId('debug-panel')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId('metric-mode')).toHaveText('line');
});
