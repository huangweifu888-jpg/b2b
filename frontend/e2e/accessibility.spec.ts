import { expect, test } from '@playwright/test';

test('Chinese document metadata, keyboard focus, and mobile viewport remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('#root')).toBeVisible();

  const ariaControls = page.locator('[aria-label], [aria-labelledby]');
  await expect(ariaControls).not.toHaveCount(0);

  const firstKeyboardControl = page
    .locator('button:visible, a[href]:visible, input:visible, select:visible, textarea:visible, [tabindex]:visible')
    .first();
  await expect(firstKeyboardControl).toBeVisible();
  await firstKeyboardControl.focus();
  await expect(firstKeyboardControl).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveCount(1);
});
