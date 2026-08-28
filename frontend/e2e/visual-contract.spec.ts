import { expect, test, type Page } from '@playwright/test';

const bannerRoute = '/zb/client-source/company-info?tab=banner&siteId=verification-temp';

async function waitForSharedPage(page: Page) {
  await expect(page.locator('[data-page-layout-frame]')).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('[data-page-route-error]')).toHaveCount(0);
  await expect(page.locator('[data-visual-card-developer-launcher]')).toBeVisible({ timeout: 45_000 });
  if (new URL(page.url()).searchParams.get('tab') === 'banner') {
    await expect(page.locator('[data-page-content-kind="banner"]')).toBeVisible({ timeout: 60_000 });
  }
}

async function openVisualEditor(page: Page) {
  await page.locator('[data-visual-card-developer-launcher]').click();
  await expect(page.locator('[data-visual-card-editor-dock]')).toBeVisible({ timeout: 45_000 });
}

test.describe('shared visual contract regression', () => {
  test.describe('Windows snapshot baselines', () => {
    test.skip(Boolean(process.env.CI), 'Snapshot baselines are committed for Windows only.');
  test('首页大图共享框架保持稳定', async ({ page }) => {
    await page.goto(bannerRoute);
    await waitForSharedPage(page);
    await expect(page.locator('[data-page-layout-frame]')).toHaveScreenshot('homepage-banner-frame.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01,
    });
  });

  test('首页大图真实上下移动悬停保持稳定', async ({ page }) => {
    await page.goto(bannerRoute);
    await waitForSharedPage(page);
    await openVisualEditor(page);
    await page.getByRole('button', { name: '当前页面', exact: true }).click();
    await page.getByRole('button', { name: /06 内容/ }).click();
    await page.getByRole('button', { name: '插件', exact: true }).click();
    await page.locator('[data-visual-plugin-select="move"]').click();
    await page.getByRole('button', { name: '悬停', exact: true }).click();
    await expect(page.locator('[data-visual-plugin-preview-id="move"]')).toHaveAttribute('data-visual-plugin-preview-state', 'hover');
    await expect(page.locator('[data-visual-card-editor-dock]')).toHaveScreenshot('homepage-banner-move-hover.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01,
    });
  });

  test('窄屏可视化自动换行且不挤出视口', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(bannerRoute);
    await waitForSharedPage(page);
    await openVisualEditor(page);
    const dock = page.locator('[data-visual-card-editor-dock]');
    const box = await dock.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    await expect(dock).toHaveScreenshot('homepage-banner-mobile-visual.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01,
    });
  });

  });

  for (const runtime of [
    { label: '代理端', route: '/dl/product-market?tab=operations&siteId=verification-temp' },
    { label: '客户端', route: '/product-market?tab=operations&siteId=verification-temp' },
  ]) {
    test(`${runtime.label}只读检查不可反向写入`, async ({ page }) => {
      await page.goto(runtime.route);
      await waitForSharedPage(page);
      await openVisualEditor(page);
      await expect(page.locator('[data-visual-card-permission]')).toHaveAttribute('data-visual-card-permission', 'read-only');
      await expect(page.locator('[data-visual-card-save-style]')).toBeDisabled();
      await page.locator('[data-visual-card-application-scope="global"]').click();
      await expect(page.locator('[data-visual-card-sync-global]')).toBeDisabled();
    });
  }
});
