import { expect, type Page } from '@playwright/test';

/**
 * Shared journey helpers for the local-timeline YoL suite.
 *
 * The parent Line -> descent -> YoL grammar is unchanged from earlier
 * cycles; what changed is the YoL itself (a nested local timeline, not the
 * old stacked article). These helpers encode the hard-won timing rules:
 *  - wait on the experience MODE flipping to `yol`, never on yol-title
 *    visibility (the hidden overlay layer hides by opacity, so Playwright
 *    would consider it "visible");
 *  - Earth clicks can be intercepted by theme-orb labels, so retry them;
 *  - after wheel/arrow input, wait for the soft snap before asserting the
 *    discrete active point.
 */

export const YOL_YEARS = ['1769', '1969'] as const;

/** Parent-Line anchors, oldest first — mirrors src/data/anchors.ts labels. */
export const ANCHOR_LABELS = [
  'c. 10,000 BCE',
  '1450',
  '1769',
  '1969',
  '2026',
] as const;

export async function gotoLine(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('year-label')).toHaveText('2026', {
    timeout: 30_000,
  });
}

/**
 * Deterministic parent-Line navigation for TEST SETUP: step anchor by
 * anchor with the arrow keys in whichever direction the target lies,
 * polling for each expected anchor label. Works both backward and forward
 * (scrollBackTo can only travel earlier). Wheel BEHAVIOUR stays covered by
 * parent-line.spec.ts — this helper is positioning, not wheel coverage.
 */
export async function goToAnchor(page: Page, label: string): Promise<void> {
  const target = ANCHOR_LABELS.indexOf(label as (typeof ANCHOR_LABELS)[number]);
  if (target < 0) throw new Error(`unknown anchor label: ${label}`);
  // arrow input is deliberately swallowed while a transition lock is held
  // (e.g. immediately after a return) — wait until the Line is interactive
  await expect(page.locator('.experience')).toHaveAttribute('data-mode', 'line');
  await expect(page.locator('.experience')).toHaveAttribute('data-locked', 'false', {
    timeout: 15_000,
  });
  for (let guard = 0; guard < ANCHOR_LABELS.length * 2; guard++) {
    const text = (await page.getByTestId('year-label').textContent())?.trim() ?? '';
    const current = ANCHOR_LABELS.indexOf(text as (typeof ANCHOR_LABELS)[number]);
    if (current === target) break;
    if (current < 0) throw new Error(`unrecognised anchor label on screen: "${text}"`);
    const dir = target > current ? 1 : -1;
    const expected = ANCHOR_LABELS[current + dir];
    await page.keyboard.press(dir > 0 ? 'ArrowRight' : 'ArrowLeft');
    await expect(page.getByTestId('year-label')).toHaveText(expected, {
      timeout: 5_000,
    });
  }
  await expect(page.getByTestId('year-label')).toHaveText(label);
  await page.waitForTimeout(600); // let the snap settle under the lens
}

/** Travel backward along the parent Line until `label` is under the lens. */
export async function scrollBackTo(
  page: Page,
  label: string,
  maxTries = 60
): Promise<void> {
  for (let i = 0; i < maxTries; i++) {
    const current = (await page.getByTestId('year-label').textContent())?.trim();
    if (current === label) break;
    await page.mouse.wheel(0, 240); // wheel down = earlier on the parent Line
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(700); // let the snap settle under the lens
  await expect(page.getByTestId('year-label')).toHaveText(label);
}

/** Descend into the year currently under the lens (retrying the Earth click). */
export async function descend(page: Page): Promise<void> {
  const vp = page.viewportSize()!;
  await expect(async () => {
    await page.mouse.click(vp.width / 2, vp.height * 0.34);
    // the .experience root carries data-mode; the locator only matches once
    // the scene has actually committed to the YoL world
    await expect(page.locator('[data-mode="yol"]')).toBeVisible({
      timeout: 3_000,
    });
  }).toPass({ timeout: 25_000 });
  // mode flips to `yol` at the mid-transition swap while the input lock is
  // still engaged; local navigation is only ready once the lock releases
  await expect(page.locator('.experience')).toHaveAttribute(
    'data-locked',
    'false',
    { timeout: 15_000 }
  );
  await expect(page.getByTestId('yol-page')).toBeVisible({ timeout: 15_000 });
}

/** Full entry: travel to `label`, descend, and settle the arrival. */
export async function enterYear(
  page: Page,
  label: string,
  opts: { source?: 'database' | 'fallback' } = {}
) {
  await goToAnchor(page, label);
  await descend(page);
  const yol = page.getByTestId('yol-page');
  await expect(yol).toHaveAttribute('data-year', label);
  if (opts.source) {
    await expect(yol).toHaveAttribute('data-source', opts.source, {
      timeout: 15_000,
    });
  }
  await page.waitForTimeout(1200); // arrival choreography (chips/stations)
  return yol;
}

/** The id of the currently active local-timeline point. */
export async function activePoint(page: Page): Promise<string> {
  return (
    (await page.getByTestId('yol-page').getAttribute('data-active-point')) ?? ''
  );
}

/** Nudge the local timeline earlier by one wheel gesture and let it snap. */
export async function wheelEarlier(page: Page): Promise<void> {
  const vp = page.viewportSize()!;
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.mouse.wheel(0, 600); // down = earlier
  await settle(page);
}

/** Wait for the local snap to resolve to a discrete point. */
export async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(1000);
}

/** Return to the parent Line, tolerating the transition lock swallowing clicks. */
export async function returnToLine(page: Page, expectYear: string): Promise<void> {
  await expect(async () => {
    await page.getByTestId('return-btn').click();
    await expect(page.getByTestId('yol-ui')).toHaveClass(/hidden/, {
      timeout: 3_000,
    });
  }).toPass({ timeout: 20_000 });
  await expect(page.getByTestId('year-label')).toHaveText(expectYear);
  // the ascent lock releases after the label is already correct; wait for
  // it so the caller's next input (arrows, Earth click) always counts
  await expect(page.locator('.experience')).toHaveAttribute('data-locked', 'false', {
    timeout: 15_000,
  });
}
