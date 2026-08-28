import { expect, test } from '@playwright/test';

test('application shell renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#root')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Internal Server Error');
});

test('social-media route renders in the browser', async ({ page }) => {
  await page.goto('/social');
  await expect(page.locator('#root')).toBeVisible();
  await expect(page.locator('body')).toContainText('社交媒体');
});
