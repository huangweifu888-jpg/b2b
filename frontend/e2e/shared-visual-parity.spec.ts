import { expect, test } from '@playwright/test';

const registeredPages = [
  { id: 'homepage-banner', route: '/zb/client-source/company-info?tab=banner&siteId=verification-temp', ready: '[data-page-content-kind="banner"] [data-page-list-item]' },
  { id: 'product-recommend', route: '/zb/client-source/company-info?tab=recommend&siteId=verification-temp', ready: '[data-company-info-tab="recommend"] [data-page-list]' },
  { id: 'domain-register', route: '/zb/client-source/site-settings?tab=domain-register&siteId=verification-temp', ready: '[data-page-list]' },
  { id: 'domain-binding', route: '/zb/client-source/site-settings?tab=domain-binding&siteId=verification-temp', ready: '[data-page-list]' },
  { id: 'domain-transfer', route: '/zb/client-source/site-settings?tab=domain-transfer&siteId=verification-temp', ready: '[data-page-list]' },
  { id: 'crm-summary', route: '/zb/client-source/customers?tab=summary&siteId=verification-temp', ready: '[data-page-list-item]' },
  { id: 'product-market-operations', route: '/zb/client-source/product-market?tab=operations&siteId=verification-temp', ready: '[data-product-market-card]' },
  { id: 'product-market-modules', route: '/zb/client-source/product-market?tab=modules&siteId=verification-temp', ready: '[data-product-market-settings-page-content="true"]' },
  { id: 'product-market-layout', route: '/zb/client-source/product-market?tab=layout&siteId=verification-temp', ready: '[data-product-market-settings-page-content="true"]' },
  { id: 'product-market-service', route: '/zb/client-source/product-market?tab=service&siteId=verification-temp', ready: '[data-product-market-settings-page-content="true"]' },
] as const;

test.describe.configure({ mode: 'serial' });

test.describe('registered shared visual parity', () => {
  for (const target of registeredPages) {
    test(`${target.id} 读取共享视觉契约`, async ({ page }) => {
      await page.goto(target.route, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const unavailable = page.locator('[data-client-project-unavailable]');
      await expect.poll(async () => (
        await page.locator('[data-page-layout-frame]').count()
        + await unavailable.count()
        + await page.locator('[data-page-route-error]').count()
      ), { timeout: 60_000 }).toBeGreaterThan(0);
      if (await unavailable.count()) {
        await expect(unavailable).toBeVisible();
        return;
      }
      await expect(page.locator('[data-page-layout-frame]').first()).toBeVisible({ timeout: 60_000 });
      await expect(page.locator(target.ready).first()).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('[data-page-route-error]')).toHaveCount(0);

      if (target.id === 'product-market-modules') {
        const hierarchyTexts = page.locator('[data-shared-module-hierarchy-rail="flat"] > .product-module-hierarchy-text');
        await expect(hierarchyTexts.first()).toBeVisible({ timeout: 60_000 });
        await expect.poll(async () => hierarchyTexts.evaluateAll((elements) => {
          const resolveValue = (property: 'height' | 'fontSize' | 'fontWeight', value: string) => {
            const probe = document.createElement('span');
            probe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none';
            probe.style[property] = value;
            document.body.appendChild(probe);
            const resolved = getComputedStyle(probe)[property];
            probe.remove();
            return resolved.replace(/\s+/g, ' ').trim().toLowerCase();
          };
          const visibleElements = elements.filter((element) => {
            const style = getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden';
          });
          return visibleElements.length > 0 && visibleElements.every((element) => {
            const style = getComputedStyle(element);
            return (
              style.height.replace(/\s+/g, ' ').trim().toLowerCase() === resolveValue('height', '1.5rem')
              && style.fontSize.replace(/\s+/g, ' ').trim().toLowerCase() === resolveValue('fontSize', 'var(--tradepro-shared-plugin-font-size, 0.75rem)')
              && style.fontWeight.replace(/\s+/g, ' ').trim().toLowerCase() === resolveValue('fontWeight', 'var(--tradepro-global-font-weight, 400)')
            );
          });
        }), {
          message: 'module hierarchy styling must settle after its deferred stylesheet loads',
          timeout: 15_000,
        }).toBe(true);
      }

      await page.mouse.move(0, 0);
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });

      const report = await page.evaluate(() => {
        const visible = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((element) => {
          const style = getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });
        const visibleTableHeaderEdgeCells = (header: HTMLElement) => {
          if (header.tagName !== 'THEAD') return null;
          const cells = Array.from(header.querySelectorAll<HTMLElement>(':scope > tr > :is(th, td)')).filter((cell) => {
            const style = getComputedStyle(cell);
            const rect = cell.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
          });
          if (cells.length === 0) return null;
          return { first: cells[0], last: cells[cells.length - 1] };
        };
        const resolveValue = (property: 'backgroundColor' | 'borderColor' | 'boxShadow' | 'borderRadius' | 'color' | 'fontFamily' | 'fontSize' | 'fontWeight' | 'height', value: string) => {
          const probe = document.createElement('span');
          probe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none';
          probe.style[property] = value;
          document.body.appendChild(probe);
          const resolved = getComputedStyle(probe)[property];
          probe.remove();
          return resolved.replace(/\s+/g, ' ').trim().toLowerCase();
        };
        const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();
        const issues: string[] = [];
        const sharedThemePaletteKeys = ['rose', 'orange', 'indigoGreen', 'tealRose', 'limeTea', 'dark', 'light'];
        const hasSameKeys = (keys: string[]) => keys.length === sharedThemePaletteKeys.length && sharedThemePaletteKeys.every((key) => keys.includes(key));
        const html = document.documentElement;
        if (html.dataset.tradeproPageLayout !== 'active') issues.push('shared page layout gate');
        if (html.dataset.tradeproPageSharedVariables !== 'true') issues.push('shared variables gate');
        if (html.dataset.visualResponsiveContract !== 'true') issues.push('responsive gate');

        const layoutPaletteKeys = visible('[data-product-market-palette-key]').map((element) => element.dataset.productMarketPaletteKey || '');
        if (layoutPaletteKeys.length && !hasSameKeys(layoutPaletteKeys)) issues.push(`layout theme palette mismatch: ${layoutPaletteKeys.join(',')}`);
        if (visible('[data-product-market-palette-key]').some((element) => element.dataset.sharedThemePalettePolicy !== 'immutable-factory-preview')) {
          issues.push('layout theme palette is not factory immutable');
        }
        const operationPaletteKeys = visible('[data-product-market-theme-section] [data-shared-theme-palette-key]').map((element) => element.dataset.sharedThemePaletteKey || '');
        if (operationPaletteKeys.length && !hasSameKeys(operationPaletteKeys)) issues.push(`operations theme palette mismatch: ${operationPaletteKeys.join(',')}`);
        if (visible('[data-product-market-theme-section] button[data-shared-theme-palette-key]').some((element) => element.dataset.sharedThemePalettePolicy !== 'immutable-factory-preview')) {
          issues.push('operations theme palette is not factory immutable');
        }
        const layoutThemeStatus = document.querySelector<HTMLElement>('[data-layout-theme-status]');
        if (layoutThemeStatus && (
          layoutThemeStatus.dataset.sharedThemePaletteAppearance !== 'operations-theme-switch'
          || layoutThemeStatus.dataset.sharedThemePalettePolicy !== 'immutable-factory-preview'
        )) {
          issues.push('layout theme status does not use the operations palette surface');
        }
        const expandedThemeToggle = document.querySelector<HTMLElement>('[data-shared-theme-palette-appearance="expanded-theme-toggle"]');
        if (expandedThemeToggle && expandedThemeToggle.dataset.sharedThemePalettePolicy !== 'immutable-factory-preview') {
          issues.push('expanded theme toggle is not factory immutable');
        }
        const serviceThemeStatus = document.querySelector<HTMLElement>('[data-service-theme-status]');
        if (serviceThemeStatus && serviceThemeStatus.dataset.sharedThemePaletteAppearance !== 'operations-theme-switch') {
          issues.push('service theme status does not use the operations palette surface');
        }
        const serviceControls = visible('[data-service-shared-color-contract="true"] [data-template-config-service-control="true"]');
        if (document.querySelector('[data-service-shared-color-contract="true"]') && !serviceControls.length) issues.push('service header missing shared-colour controls');
        if (serviceControls.length) {
          const expectedServiceControlBg = resolveValue('backgroundColor', 'var(--tradepro-shared-list-bg, var(--tradepro-panel-list-bg))');
          const expectedServiceControlText = resolveValue('color', 'var(--tradepro-shared-list-text, var(--tradepro-panel-list-text))');
          const expectedServiceControlBorder = resolveValue('borderColor', 'var(--tradepro-shared-list-border, var(--tradepro-shell-border))');
          if (serviceControls.some((control) => {
            const style = getComputedStyle(control);
            return normalize(style.backgroundColor) !== expectedServiceControlBg || normalize(style.color) !== expectedServiceControlText || normalize(style.borderColor) !== expectedServiceControlBorder;
          })) issues.push('service controls do not use shared list colours');
        }
        const sharedStatusKeys = ['active', 'inactive', 'hidden'];
        const hasAllStatusKeys = (keys: string[]) => sharedStatusKeys.every((key) => keys.includes(key));
        const expectedStatusFactoryRoles: Record<string, string> = { active: 'palette-primary', inactive: 'high-red', hidden: 'dark-gray' };
        const layoutStatusCardElements = visible('[data-layout-status-settings] [data-shared-status-card-source="product-card-colors"]');
        const layoutStatusCards = layoutStatusCardElements.map((element) => element.dataset.sharedStatusCard || '');
        if (document.querySelector('[data-layout-status-settings]') && !hasAllStatusKeys(layoutStatusCards)) issues.push(`layout status card source mismatch: ${layoutStatusCards.join(',')}`);
        if (layoutStatusCardElements.some((element) => expectedStatusFactoryRoles[element.dataset.sharedStatusCard || ''] !== element.dataset.sharedStatusCardFactoryRole)) issues.push('layout status cards do not use factory status roles');
        const operationStatusControlElements = visible('[data-product-market-status-control][data-shared-status-card-source="product-card-colors"]');
        const operationStatusControls = operationStatusControlElements.map((element) => element.dataset.productMarketStatusControl || '');
        if (document.querySelector('[data-product-market-card]') && !hasAllStatusKeys(operationStatusControls)) issues.push(`operations status card source mismatch: ${operationStatusControls.join(',')}`);
        if (operationStatusControlElements.some((element) => expectedStatusFactoryRoles[element.dataset.productMarketStatusControl || ''] !== element.dataset.sharedStatusCardFactoryRole)) issues.push('operations status cards do not use factory status roles');
        for (const card of visible('[data-product-market-card][data-shared-status-card-source="product-card-colors"]')) {
          const cardStyle = getComputedStyle(card);
          const resolveAtCard = (scope: HTMLElement, property: 'backgroundColor' | 'borderColor' | 'color', value: string) => {
            const probe = document.createElement('span');
            probe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none';
            probe.style[property] = value;
            scope.appendChild(probe);
            const resolved = getComputedStyle(probe)[property];
            probe.remove();
            return normalize(resolved);
          };
          const expectedCardBackground = resolveAtCard(card, 'backgroundColor', 'var(--product-market-card-bg)');
          const expectedCardBorder = resolveAtCard(card, 'borderColor', 'var(--product-market-card-border)');
          const expectedCardText = resolveAtCard(card, 'color', 'var(--product-market-card-name-color)');
          const status = card.dataset.sharedStatusCard || '';
          const selectedControl = card.querySelector<HTMLElement>(`[data-product-market-status-control="${status}"]`);
          const statusBadge = card.querySelector<HTMLElement>(`[data-product-market-status-badge="${status}"]`);
          const controlStyle = selectedControl ? getComputedStyle(selectedControl) : null;
          const badgeStyle = statusBadge ? getComputedStyle(statusBadge) : null;
          if (
            !expectedCardBackground
            || !expectedCardBorder
            || !expectedCardText
            || normalize(cardStyle.backgroundColor) !== expectedCardBackground
            || normalize(cardStyle.borderTopColor) !== expectedCardBorder
            || normalize(cardStyle.color) !== expectedCardText
            || !controlStyle
            || !selectedControl
            || normalize(controlStyle.backgroundColor) !== resolveAtCard(selectedControl, 'backgroundColor', 'var(--product-market-status-bg)')
            || normalize(controlStyle.color) !== resolveAtCard(selectedControl, 'color', 'var(--product-market-status-text)')
            || !badgeStyle
            || !statusBadge
            || normalize(badgeStyle.backgroundColor) !== resolveAtCard(statusBadge, 'backgroundColor', 'var(--product-market-status-bg)')
            || normalize(badgeStyle.color) !== resolveAtCard(statusBadge, 'color', 'var(--product-market-status-text)')
          ) {
            issues.push('operations status card colours do not project to the final UI');
            break;
          }
        }
        if (layoutPaletteKeys.length && document.querySelector('[data-theme-editor-default-source="neutral-white-black"]')?.getAttribute('data-theme-editor-default-source') !== 'neutral-white-black') {
          issues.push('new theme does not use neutral white black');
        }
        const globalFontSettings = document.querySelector<HTMLElement>('.layout-global-font-settings');
        if (globalFontSettings) {
          const resolveAtFontSettings = (property: 'backgroundColor' | 'color', value: string) => {
            const probe = document.createElement('span');
            probe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none';
            probe.style[property] = value;
            globalFontSettings.appendChild(probe);
            const resolved = getComputedStyle(probe)[property];
            probe.remove();
            return normalize(resolved);
          };
          const selectedBackground = resolveAtFontSettings('backgroundColor', 'var(--pm-layout-font-choice-selected-bg)');
          const selectedText = resolveAtFontSettings('color', 'var(--pm-layout-font-choice-selected-text)');
          const choices = visible('button[data-layout-global-font-choice]');
          const selectedChoices = choices.filter((choice) => choice.dataset.layoutGlobalFontSelected === 'true');
          if (
            selectedChoices.length !== 3
            || selectedChoices.some((choice) => {
              const style = getComputedStyle(choice);
              return normalize(style.backgroundColor) !== selectedBackground || normalize(style.color) !== selectedText;
            })
          ) issues.push('global font selected choices do not use the shared action colours');
        }

        const owners = visible('[data-product-market-scroll-list], [data-page-list-scroll-owner]');
        if (owners.length > 1) issues.push(`multiple scroll owners: ${owners.length}`);

        const expectedShadow = resolveValue('boxShadow', 'var(--tradepro-layout-shadow, none)');
        const expectedRadius = resolveValue('borderRadius', 'var(--tradepro-layout-card-radius, 0.75rem)');
        const expectedHeaderRadius = resolveValue('borderRadius', 'var(--tradepro-layout-table-header-radius, 0.75rem)');
        const expectedFont = resolveValue('fontFamily', 'var(--tradepro-global-font-family, system-ui, sans-serif)');
        const cards = visible('[data-product-market-card], [data-page-list-item]');
        for (const card of cards) {
          const style = getComputedStyle(card);
          if (normalize(style.boxShadow) !== expectedShadow || normalize(style.boxShadow).includes('inset')) {
            issues.push(`private card shadow: ${style.boxShadow}`);
            break;
          }
          const radiusTarget = card.tagName === 'TR' ? card.firstElementChild as HTMLElement | null : card;
          if (radiusTarget && normalize(getComputedStyle(radiusTarget).borderTopLeftRadius) !== expectedRadius) {
            issues.push(`private card radius: ${getComputedStyle(radiusTarget).borderTopLeftRadius}`);
            break;
          }
          if (normalize(style.fontFamily) !== expectedFont) {
            issues.push(`private card font: ${style.fontFamily}`);
            break;
          }
        }

        for (const shell of visible('[data-product-market-table-shell="true"], [data-page-content-stack="table"]')) {
          const style = getComputedStyle(shell);
          if (parseFloat(style.borderTopLeftRadius) > 0 || parseFloat(style.borderTopRightRadius) > 0) {
            issues.push(`table shell top corners: ${style.borderRadius}`);
            break;
          }
        }

        for (const header of visible('[data-page-table-header], [data-product-market-table-header]')) {
          const style = getComputedStyle(header);
          if (normalize(style.boxShadow) !== expectedShadow || normalize(style.boxShadow).includes('inset')) {
            issues.push(`private table-header shadow: ${style.boxShadow}`);
            break;
          }
          if (style.transform !== 'none' || /(^|,\s*)(all|transform)(,|$)/.test(style.transitionProperty)) {
            issues.push(`unstable table-header hover: ${style.transitionProperty}/${style.transform}`);
            break;
          }
          if (header.tagName === 'THEAD') {
            const edgeCells = visibleTableHeaderEdgeCells(header);
            if (!edgeCells) {
              issues.push('table-header visible edge cells missing');
              break;
            }
            const firstStyle = getComputedStyle(edgeCells.first);
            const lastStyle = getComputedStyle(edgeCells.last);
            if ([firstStyle.borderTopLeftRadius, firstStyle.borderBottomLeftRadius, lastStyle.borderTopRightRadius, lastStyle.borderBottomRightRadius].some((value) => normalize(value) !== expectedHeaderRadius)) {
              issues.push('table-header outer corners');
              break;
            }
          }
        }

        const expectedPluginHeight = resolveValue('height', 'var(--tradepro-shared-plugin-control-size, 2rem)');
        for (const plugin of visible("button[data-content-plugin-control]:not([data-content-plugin-control^='status-'])")) {
          const style = getComputedStyle(plugin);
          if (normalize(style.height) !== expectedPluginHeight) {
            issues.push(`plugin height: ${style.height}`);
            break;
          }
          if (normalize(style.fontFamily) !== expectedFont) {
            issues.push(`plugin font: ${style.fontFamily}`);
            break;
          }
        }

        const expectedHierarchyPillHeight = resolveValue('height', '1.5rem');
        const expectedHierarchyPillFontSize = resolveValue('fontSize', 'var(--tradepro-shared-plugin-font-size, 0.75rem)');
        const expectedHierarchyPillFontWeight = resolveValue('fontWeight', 'var(--tradepro-global-font-weight, 400)');
        for (const pill of visible('[data-shared-module-hierarchy-rail="flat"] > .product-module-hierarchy-text')) {
          const style = getComputedStyle(pill);
          if (
            normalize(style.height) !== expectedHierarchyPillHeight
            || normalize(style.fontSize) !== expectedHierarchyPillFontSize
            || normalize(style.fontWeight) !== expectedHierarchyPillFontWeight
          ) {
            issues.push(`hierarchy pill: ${style.height}/${style.fontSize}/${style.fontWeight}`);
            break;
          }
        }

        for (const row of visible('.product-module-root-card [data-template-module-split], .product-module-child-card [data-template-module-split]')) {
          const settingsCapsule = row.querySelector<HTMLElement>(':scope > .adaptive-work-matrix-function');
          const editorCapsule = row.querySelector<HTMLElement>(':scope > .adaptive-work-matrix-edit');
          const settingsStyle = settingsCapsule ? getComputedStyle(settingsCapsule) : null;
          const editorStyle = editorCapsule ? getComputedStyle(editorCapsule) : null;
          if (
            !settingsStyle
            || !editorStyle
            || settingsStyle.borderTopWidth !== '0px'
            || normalize(settingsStyle.backgroundColor) !== 'rgba(0, 0, 0, 0)'
            || Number.parseFloat(settingsStyle.borderRadius) !== 0
            || editorStyle.borderTopWidth !== '0px'
            || normalize(editorStyle.backgroundColor) !== 'rgba(0, 0, 0, 0)'
            || Number.parseFloat(editorStyle.paddingLeft) !== 0
            || Number.parseFloat(editorStyle.paddingRight) !== 0
          ) {
            issues.push('module editor capsules');
            break;
          }
        }

        const expectedLargeCardFontSize = resolveValue('fontSize', 'var(--tradepro-shared-large-card-font-size, 0.875rem)');
        const expectedLargeCardFontWeight = resolveValue('fontWeight', 'var(--tradepro-shared-large-card-font-weight, 400)');
        const expectedLargeCardBackground = resolveValue('backgroundColor', 'var(--tradepro-product-market-large-card-bg, #ffffff)');
        const expectedLargeCardColor = resolveValue('color', 'var(--tradepro-product-market-large-card-text, #0f172a)');
        const expectedLargeCardBorder = resolveValue('borderColor', 'color-mix(in srgb, var(--tradepro-product-market-large-card-text, #0f172a) 18%, transparent)');
        const resolveAt = (scope: HTMLElement, property: 'backgroundColor' | 'borderColor' | 'color', value: string) => {
          const probe = document.createElement('span');
          probe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none';
          probe.style[property] = value;
          scope.appendChild(probe);
          const resolved = getComputedStyle(probe)[property];
          probe.remove();
          return resolved;
        };
        const largeCardSurfaces = visible('[data-shared-large-card-surface="true"]');
        if (document.querySelector('[data-product-market-workspace]') && !largeCardSurfaces.length) issues.push('missing complete large-card surface');
        for (const surface of largeCardSurfaces) {
          const style = getComputedStyle(surface);
          const scopedLargeCardBackground = resolveAt(surface, 'backgroundColor', 'var(--tradepro-product-market-large-card-bg, #ffffff)');
          const scopedLargeCardColor = resolveAt(surface, 'color', 'var(--tradepro-product-market-large-card-text, #0f172a)');
          const scopedLargeCardBorder = resolveAt(surface, 'borderColor', 'color-mix(in srgb, var(--tradepro-product-market-large-card-text, #0f172a) 18%, transparent)');
          if (
            normalize(style.backgroundColor) !== normalize(scopedLargeCardBackground)
            || normalize(style.color) !== normalize(scopedLargeCardColor)
            || normalize(style.borderColor) !== normalize(scopedLargeCardBorder)
          ) {
            issues.push(`large-card surface: ${style.backgroundColor}/${style.color}/${style.borderColor} expected ${scopedLargeCardBackground}/${scopedLargeCardColor}/${scopedLargeCardBorder}`);
            break;
          }
        }
        const largeCardTexts = visible('[data-shared-large-card-text]');
        if (document.querySelector('[data-layout-fine-editor]')) {
          for (const card of visible('.layout-section-card[data-development-standard-frame-region="large-card"]')) {
            const style = getComputedStyle(card);
            if (
              normalize(style.backgroundColor) !== expectedLargeCardBackground
              || normalize(style.color) !== expectedLargeCardColor
              || normalize(style.fontFamily) !== expectedFont
              || normalize(style.fontSize) !== expectedLargeCardFontSize
              || normalize(style.fontWeight) !== expectedLargeCardFontWeight
            ) {
              issues.push(`layout large-card typography: ${style.backgroundColor}/${style.color}/${style.fontSize}`);
              break;
            }
            if (card.querySelectorAll('[data-shared-large-card-text]').length < 2) {
              issues.push('missing layout large-card typography fields');
              break;
            }
          }
        }
        if (document.querySelector('[data-page-content-kind="banner"]')) {
          for (const card of visible('[data-page-content-kind="banner"] [data-development-standard-frame-region="large-card"]')) {
            if (card.querySelectorAll('[data-shared-large-card-text]').length < 3) issues.push('missing large-card typography fields');
          }
        }
        // Layout uses one outer sortable capsule. Its direct function carrier
        // is transparent and keeps only one thin semantic segment divider.
        for (const carrier of visible('.layout-section-card .layout-section-matrix-function')) {
          const style = getComputedStyle(carrier);
          const dividerWidths = [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth]
            .map((width) => Number.parseFloat(width));
          const hasSingleSemanticDivider = dividerWidths.filter((width) => Math.abs(width - 1) <= 0.01).length === 1
            && dividerWidths.every((width) => Math.abs(width) <= 0.01 || Math.abs(width - 1) <= 0.01);
          if (
            normalize(style.backgroundColor) !== 'rgba(0, 0, 0, 0)'
            || !hasSingleSemanticDivider
            || Number.parseFloat(style.borderRadius) !== 0
            || normalize(style.boxShadow) !== 'none'
          ) {
            issues.push(`layout sortable carrier: ${style.backgroundColor}/${style.borderWidth}/${style.borderRadius}/${style.boxShadow}`);
            break;
          }
        }
        // Customer Service registers the rail itself as the large-card
        // surface. Hover/focus is cleared before this scan so only its resting
        // shared colours are compared.
        for (const rail of visible('[data-shared-service-section-large-card="true"]')) {
          const style = getComputedStyle(rail);
          if (
            normalize(style.backgroundColor) !== expectedLargeCardBackground
            || normalize(style.color) !== expectedLargeCardColor
            || normalize(style.borderColor) !== expectedLargeCardBorder
          ) {
            issues.push(`service large-card rail: ${style.backgroundColor}/${style.color}/${style.borderColor}`);
            break;
          }
        }
        for (const text of largeCardTexts) {
          const style = getComputedStyle(text);
          if (normalize(style.fontFamily) !== expectedFont || normalize(style.fontSize) !== expectedLargeCardFontSize || normalize(style.fontWeight) !== expectedLargeCardFontWeight) {
            issues.push(`large-card typography: ${style.fontSize}/${style.fontWeight}`);
            break;
          }
        }

        const expectedSmallCardBackground = resolveValue('backgroundColor', 'var(--tradepro-panel-card-bg, #ffffff)');
        const expectedSmallCardColor = resolveValue('color', 'var(--tradepro-panel-card-text, #0f172a)');
        const expectedSelectedSmallCardBackground = resolveValue('backgroundColor', 'var(--tradepro-shared-selection-bg)');
        const expectedSelectedSmallCardColor = resolveValue('color', 'var(--tradepro-shared-selection-text)');
        const expectedSelectedSmallCardOutline = resolveValue('borderColor', 'var(--tradepro-shared-selection-outline)');
        const expectedSmallCardFontSize = resolveValue('fontSize', 'var(--tradepro-shared-small-card-font-size, 0.75rem)');
        const expectedSmallCardFontWeight = resolveValue('fontWeight', 'var(--tradepro-shared-small-card-font-weight, 400)');
        const activeSelectionOwner = (element: HTMLElement) => {
          const owner = element.closest<HTMLElement>('[data-shared-selection-control="true"]');
          if (!owner) return null;
          const state = owner.dataset.state || '';
          return owner.dataset.selected === 'true'
            || owner.getAttribute('aria-pressed') === 'true'
            || ['active', 'checked', 'selected'].includes(state)
            ? owner
            : null;
        };
        const smallCardTexts = visible('[data-shared-small-card-text]');
        if (document.querySelector('[data-template-module-table-header="true"]')) {
          for (const card of visible('[data-development-standard-frame-region="small-card"]')) {
            if (!card.querySelector('[data-shared-small-card-text]')) issues.push('missing small-card typography fields');
          }
        }
        if (document.querySelector('[data-layout-fine-editor]')) {
          const editor = document.querySelector<HTMLElement>('[data-layout-fine-editor-contract="two-pane"]');
          const preview = editor?.querySelector<HTMLElement>('[data-layout-fine-preview]');
          const controls = editor?.querySelector<HTMLElement>('[data-layout-fine-controls][data-layout-settings-pane="true"]');
          if (!editor || !preview || !controls) {
            issues.push('missing shared fine-layout two-pane contract');
          } else {
            const controlsStyle = getComputedStyle(controls);
            const dividerStyle = getComputedStyle(editor, '::before');
            const previewRect = preview.getBoundingClientRect();
            const controlsRect = controls.getBoundingClientRect();
            if (controlsStyle.borderTopWidth !== '0px' || controlsStyle.borderRadius !== '0px' || controlsStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') issues.push(`legacy fine settings frame: ${controlsStyle.borderTopWidth}/${controlsStyle.borderRadius}/${controlsStyle.backgroundColor}`);
            if (dividerStyle.display === 'none' || Number.parseFloat(dividerStyle.width) < 1) issues.push('missing fine-layout divider');
            if (Math.abs(previewRect.top - controlsRect.top) > 1 || Math.abs(previewRect.bottom - controlsRect.bottom) > 1) issues.push('misaligned fine-layout panes');
          }
        }
        for (const text of smallCardTexts) {
          const style = getComputedStyle(text);
          const expectedTextColor = activeSelectionOwner(text)
            ? expectedSelectedSmallCardColor
            : expectedSmallCardColor;
          if (
            normalize(style.color) !== expectedTextColor
            || normalize(style.fontFamily) !== expectedFont
            || normalize(style.fontSize) !== expectedSmallCardFontSize
            || normalize(style.fontWeight) !== expectedSmallCardFontWeight
          ) {
            issues.push(`small-card typography: ${style.color}/${style.fontSize}/${style.fontWeight}`);
            break;
          }
        }
        for (const status of visible('[data-customer-service-avatar-status]')) {
          const style = getComputedStyle(status);
          if (normalize(style.backgroundColor) !== expectedSmallCardBackground || normalize(style.color) !== expectedSmallCardColor) {
            issues.push(`service avatar status small-card source: ${style.backgroundColor}/${style.color}`);
            break;
          }
        }
        for (const preview of visible('[data-shared-small-card-surface="true"].template-config-service-avatar-preview')) {
          const style = getComputedStyle(preview);
          if (normalize(style.backgroundColor) !== expectedSmallCardBackground || normalize(style.color) !== expectedSmallCardColor) {
            issues.push(`service avatar preview small-card source: ${style.backgroundColor}/${style.color}`);
            break;
          }
        }
        for (const serviceCard of visible(':is(.template-config-service-voice-field, .template-config-service-sound-choice, .template-config-service-sound-note)[data-shared-small-card-surface="true"]')) {
          const style = getComputedStyle(serviceCard);
          const selected = Boolean(activeSelectionOwner(serviceCard));
          const expectedBackground = selected ? expectedSelectedSmallCardBackground : expectedSmallCardBackground;
          const expectedColor = selected ? expectedSelectedSmallCardColor : expectedSmallCardColor;
          if (normalize(style.backgroundColor) !== expectedBackground) {
            issues.push(`service editor small-card source: ${style.backgroundColor}/${style.color}`);
            break;
          }
          if (
            normalize(style.color) !== expectedColor
            || (selected && normalize(style.borderColor) !== expectedSelectedSmallCardOutline)
          ) {
            issues.push(`service editor small-card text: ${style.color}`);
            break;
          }
        }

        // Silent cards retain their shared-contract semantics but intentionally
        // suppress duplicate visible labels when one representative is enough.
        const markers = visible('[data-development-standard-frame-region]')
          .filter((marker) => (
            marker.dataset.developmentStandardMarker !== 'silent'
            && marker.dataset.sharedSmallCardMarkerEffective !== 'silent'
          ));
        for (const expandedShell of Array.from(document.querySelectorAll<HTMLElement>('[data-product-market-table-shell][data-product-market-table-header-mode="expanded"]'))) {
          if (!expandedShell.querySelector('[data-template-config-table-palette], [data-template-config-service-header]')) continue;
          const delegatedContent = expandedShell.querySelector<HTMLElement>('[data-page-list-scroll-owner][data-development-standard-frame-region="content"]');
          const firstCardContent = expandedShell.querySelector<HTMLElement>('[data-development-standard-frame-region="content"][data-development-standard-marker-placement="content-card-start"]');
          if (
            delegatedContent?.dataset.developmentStandardMarkerPlacement !== 'content-delegated'
            || !firstCardContent?.querySelector('[data-shared-large-card-surface="true"]')
          ) {
            issues.push('expanded header content marker must begin at the first large card');
          }
        }
        const layoutStatusMarkerCards = visible('[data-layout-status-settings] [data-shared-status-card][data-shared-status-card-source="product-card-colors"]');
        if (layoutStatusMarkerCards.length && (
          layoutStatusMarkerCards[0].dataset.sharedSmallCardMarkerEffective !== 'representative'
          || layoutStatusMarkerCards.slice(1).some((card) => card.dataset.sharedSmallCardMarkerEffective !== 'silent')
        )) {
          issues.push('missing layout status small-card marker: only the first card may be representative and the rest must be silent');
        }
        if (document.querySelector('[data-page-content-kind="banner"]')) {
          const requiredMarkers = [
            { label: '主体', regions: ['body', 'workspace'] },
            { label: '表内', regions: ['table-shell'] },
            { label: '内容', regions: ['content'] },
            { label: '表头', regions: ['table-header'] },
            { label: '大卡片', regions: ['large-card'] },
            { label: '尾栏', regions: ['footer'] },
          ];
          for (const required of requiredMarkers) {
            if (!markers.some((marker) => required.regions.includes(marker.dataset.developmentStandardFrameRegion || ''))) {
              issues.push(`missing context marker: ${required.label}`);
            }
          }
          const requiredPlacements = [
            { region: 'table-shell', placement: 'frame-start' },
            { region: 'content', placement: 'content-start' },
            { region: 'large-card', placement: 'card-center' },
          ];
          for (const required of requiredPlacements) {
            const marker = markers.find((item) => item.dataset.developmentStandardFrameRegion === required.region);
            if (marker?.dataset.developmentStandardMarkerPlacement !== required.placement) {
              issues.push(`marker placement: ${required.region}/${required.placement}`);
            }
          }
        }

        const expectedMarkerFont = resolveValue('fontFamily', 'var(--tradepro-context-marker-font-family, system-ui, sans-serif)');
        const expectedMarkerSize = resolveValue('fontSize', 'var(--tradepro-context-marker-font-size, 0.625rem)');
        const expectedMarkerWeight = resolveValue('fontWeight', 'var(--tradepro-context-marker-font-weight, 700)');
        const expectedVerticalMarkerFont = resolveValue('fontFamily', 'var(--tradepro-vertical-context-marker-font-family, var(--tradepro-context-marker-font-family, system-ui, sans-serif))');
        const expectedVerticalMarkerSize = resolveValue('fontSize', 'var(--tradepro-vertical-context-marker-font-size, var(--tradepro-context-marker-font-size, 0.625rem))');
        const expectedVerticalMarkerWeight = resolveValue('fontWeight', 'var(--tradepro-vertical-context-marker-font-weight, var(--tradepro-context-marker-font-weight, 700))');
        const expectedTableShellMarkerLeft = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--responsive-table-shell-marker-left-inset'));
        for (const marker of markers) {
          const region = marker.dataset.developmentStandardFrameRegion || '';
          const label = marker.dataset.developmentStandardFrameLabel || '';
          const workspaceBody = marker.matches('[data-product-market-workspace][data-development-standard-frame-region="body"]');
          const pseudoTarget = workspaceBody
            ? marker.closest<HTMLElement>('.app-main, .app-main-roomy')
            : marker.tagName === 'THEAD'
              ? marker.querySelector<HTMLElement>('tr > th:first-child')
              : marker.tagName === 'TR' && region === 'large-card'
                ? marker.querySelector<HTMLElement>('td:first-child')
                : marker;
          if (!pseudoTarget) {
            issues.push(`marker anchor: ${label || region}`);
            continue;
          }
          const style = getComputedStyle(pseudoTarget, '::after');
          const titleMarkerUsesSharedLabel = ["title", "title-1", "title-2"].includes(region)
            && style.content.includes("标题");
          if (!label || (!style.content.includes(label) && !titleMarkerUsesSharedLabel)) {
            issues.push(`marker content: ${label || region}/${style.content}`);
            continue;
          }
          if (marker.dataset.developmentStandardMarkerVisibility === 'always' && (style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity) === 0)) {
            issues.push(`marker visibility: ${label || region}`);
            continue;
          }
          if (workspaceBody) {
            const hostGutter = marker.getBoundingClientRect().left - pseudoTarget.getBoundingClientRect().left;
            if (
              marker.dataset.developmentStandardMarkerPlacement !== 'body-left-outer-gutter'
              || !Number.isFinite(Number.parseFloat(style.left))
              || Number.parseFloat(style.left) < 0
              || hostGutter < 15
            ) {
              issues.push(`body marker left outer gutter: ${style.left}/${style.right}/${hostGutter}`);
              continue;
            }
            if (window.innerWidth <= 639 && marker.dataset.developmentStandardMarkerVisibility !== 'always' && style.display !== 'none') {
              issues.push(`body marker compact visibility: ${style.display}`);
              continue;
            }
          }
          if (region === 'table-shell') {
            const markerLeft = Number.parseFloat(style.left);
            if (!Number.isFinite(expectedTableShellMarkerLeft) || !Number.isFinite(markerLeft) || Math.abs(markerLeft - expectedTableShellMarkerLeft) > 0.75) {
              issues.push(`table-shell marker shared inset: ${style.left}/${expectedTableShellMarkerLeft}`);
            }
          }
          const markerFont = workspaceBody ? expectedVerticalMarkerFont : expectedMarkerFont;
          const markerSize = workspaceBody ? expectedVerticalMarkerSize : expectedMarkerSize;
          const markerWeight = workspaceBody ? expectedVerticalMarkerWeight : expectedMarkerWeight;
          if (normalize(style.fontFamily) !== markerFont || normalize(style.fontSize) !== markerSize || normalize(style.fontWeight) !== markerWeight) {
            issues.push(`marker typography: ${label}`);
            continue;
          }
          const shouldBeVertical = ['body', 'workspace', 'table-shell', 'content'].includes(region);
          if ((shouldBeVertical && (style.writingMode !== 'vertical-rl' || style.textOrientation !== 'upright')) || (!shouldBeVertical && style.writingMode !== 'horizontal-tb')) {
            issues.push(`marker direction: ${label}/${style.writingMode}/${style.textOrientation}`);
          }
          if (region === 'large-card') {
            const markerLayer = Number.parseInt(style.zIndex, 10) || 0;
            const highestChildLayer = Array.from(marker.querySelectorAll<HTMLElement>('*'))
              .reduce((highest, child) => Math.max(highest, Number.parseInt(getComputedStyle(child).zIndex, 10) || 0), 0);
            if (markerLayer <= highestChildLayer) issues.push(`marker layer: ${markerLayer}/${highestChildLayer}`);
          }
        }

        return { issues, cardCount: cards.length, markerCount: markers.length, scrollOwnerCount: owners.length };
      });

      expect(report.issues, `${target.id}: ${report.issues.join('; ')}`).toEqual([]);

      if (target.id === 'product-market-operations') {
        const card = page.locator('[data-product-market-card][data-shared-status-card-source="product-card-colors"]').first();
        const currentStatus = await card.getAttribute('data-shared-status-card');
        const nextStatus = currentStatus === 'hidden' ? 'inactive' : 'hidden';
        await card.locator(`[data-product-market-status-control="${nextStatus}"]`).click();
        await expect(card).toHaveAttribute('data-shared-status-card', nextStatus);
        await expect.poll(() => card.evaluate((element, status) => {
          const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
          const resolveAt = (scope: HTMLElement, property: 'backgroundColor' | 'borderColor' | 'color', value: string) => {
            const probe = document.createElement('span');
            probe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none';
            probe.style[property] = value;
            scope.appendChild(probe);
            const resolved = getComputedStyle(probe)[property];
            probe.remove();
            return normalize(resolved);
          };
          const cardStyle = getComputedStyle(element);
          const selectedControl = element.querySelector<HTMLElement>(`[data-product-market-status-control="${status}"]`);
          const statusBadge = element.querySelector<HTMLElement>(`[data-product-market-status-badge="${status}"]`);
          const controlStyle = selectedControl ? getComputedStyle(selectedControl) : null;
          const badgeStyle = statusBadge ? getComputedStyle(statusBadge) : null;
          return Boolean(
            selectedControl
            && controlStyle
            && statusBadge
            && badgeStyle
            && normalize(cardStyle.backgroundColor) === resolveAt(element, 'backgroundColor', 'var(--product-market-card-bg)')
            && normalize(cardStyle.borderTopColor) === resolveAt(element, 'borderColor', 'var(--product-market-card-border)')
            && normalize(cardStyle.color) === resolveAt(element, 'color', 'var(--product-market-card-name-color)')
            && normalize(controlStyle.backgroundColor) === resolveAt(selectedControl, 'backgroundColor', 'var(--product-market-status-bg)')
            && normalize(controlStyle.color) === resolveAt(selectedControl, 'color', 'var(--product-market-status-text)')
            && normalize(badgeStyle.backgroundColor) === resolveAt(statusBadge, 'backgroundColor', 'var(--product-market-status-bg)')
            && normalize(badgeStyle.color) === resolveAt(statusBadge, 'color', 'var(--product-market-status-text)')
          );
        }, nextStatus), {
          message: 'changing a status must project all four factory colours after React commits the update',
          timeout: 10_000,
        }).toBe(true);
      }

      if (target.id === 'product-market-layout') {
        const choices = page.locator('button[data-layout-global-font-choice]');
        const choiceCount = await choices.count();
        if (choiceCount > 0) {
          const unselected = page.locator('button[data-layout-global-font-choice][data-layout-global-font-selected="false"]').first();
          const fallbackChoice = choices.nth(Math.min(1, choiceCount - 1));
          const candidate = await unselected.count() ? unselected : fallbackChoice;
          const choiceKind = await candidate.getAttribute('data-layout-global-font-choice');
          const choiceValue = await candidate.getAttribute('data-layout-global-font-value');
          expect(choiceKind).toBeTruthy();
          expect(choiceValue).toBeTruthy();
          const choice = page.locator(
            `button[data-layout-global-font-choice="${choiceKind}"][data-layout-global-font-value="${choiceValue}"]`
          );
          await expect(choice).toHaveCount(1);
          await choice.click();
          await expect(choice).toHaveAttribute('data-layout-global-font-selected', 'true');
          await page.mouse.move(0, 0);
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          await expect.poll(() => choice.evaluate((element) => {
            const settings = element.closest<HTMLElement>('.layout-global-font-settings')!;
            const resolveAt = (property: 'backgroundColor' | 'color', value: string) => {
              const probe = document.createElement('span');
              probe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none';
              probe.style[property] = value;
              settings.appendChild(probe);
              const resolved = getComputedStyle(probe)[property];
              probe.remove();
              return resolved.replace(/\s+/g, ' ').trim().toLowerCase();
            };
            const style = getComputedStyle(element);
            const background = style.backgroundColor.replace(/\s+/g, ' ').trim().toLowerCase();
            const color = style.color.replace(/\s+/g, ' ').trim().toLowerCase();
            return background === resolveAt('backgroundColor', 'var(--pm-layout-font-choice-selected-bg)')
              && color === resolveAt('color', 'var(--pm-layout-font-choice-selected-text)');
          }), {
            message: 'selected font colours must settle on the shared layout variables',
            timeout: 10_000,
          }).toBe(true);
        }

        const themeEditorTrigger = page.locator('button[data-theme-editor-default-source="neutral-white-black"]');
        await expect(themeEditorTrigger).toBeVisible();
        await themeEditorTrigger.click();
        const themeEditorDialog = page.locator('[role="dialog"][data-shared-dialog-contract="theme-editor"]');
        await expect(themeEditorDialog).toBeVisible();
        const themeEditorGeometry = await themeEditorDialog.evaluate((dialog) => {
          const rect = dialog.getBoundingClientRect();
          const style = getComputedStyle(dialog);
          const probe = document.createElement('span');
          probe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:var(--tradepro-shared-editor-wide-width);height:var(--tradepro-shared-editor-wide-height);visibility:hidden;pointer-events:none';
          dialog.appendChild(probe);
          const probeStyle = getComputedStyle(probe);
          const expectedWidth = Number.parseFloat(probeStyle.width);
          const expectedHeight = Number.parseFloat(probeStyle.height);
          probe.remove();
          return {
            width: rect.width,
            height: rect.height,
            contractWidth: style.getPropertyValue('--tradepro-shared-editor-wide-width').trim(),
            contractHeight: style.getPropertyValue('--tradepro-shared-editor-wide-height').trim(),
            legacyPrivateWidth: style.getPropertyValue('--visual-responsive-dialog-width').trim(),
            expectedWidth,
            expectedHeight,
          };
        });
        expect(themeEditorGeometry.contractWidth).toBe('90vw');
        expect(themeEditorGeometry.contractHeight).toBe('85dvh');
        expect(themeEditorGeometry.legacyPrivateWidth).toBe('');
        expect(themeEditorGeometry.width).toBeCloseTo(themeEditorGeometry.expectedWidth, 0);
        expect(themeEditorGeometry.height).toBeCloseTo(themeEditorGeometry.expectedHeight, 0);
        await page.keyboard.press('Escape');
        await expect(themeEditorDialog).toBeHidden();
      }

      if (target.id === 'product-market-service') {
        const voiceEnable = page.locator('[data-template-config-service-control="true"] [data-content-plugin-control="toggle"][aria-label*="启用真人朗音"]').first();
        await expect(voiceEnable).toBeVisible();
        if (await voiceEnable.getAttribute('aria-pressed') !== 'true') await voiceEnable.click();
        await expect(voiceEnable).toHaveAttribute('aria-pressed', 'true');
        const materialTrigger = page.locator('.template-config-service-voice-upload').first();
        await expect(materialTrigger).toBeVisible();
        await materialTrigger.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
        await materialTrigger.click();
        const materialDialog = page.locator('[role="dialog"][data-shared-dialog-contract="material-picker"]');
        await expect(materialDialog).toBeVisible();
        const materialDialogGeometry = await materialDialog.evaluate((dialog) => {
          const rect = dialog.getBoundingClientRect();
          const style = getComputedStyle(dialog);
          const probe = document.createElement('span');
          probe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:var(--tradepro-shared-editor-wide-width);visibility:hidden;pointer-events:none';
          dialog.appendChild(probe);
          const expectedWidth = Number.parseFloat(getComputedStyle(probe).width);
          probe.remove();
          return {
            width: rect.width,
            viewportWidth: window.innerWidth,
            contractWidth: style.getPropertyValue('--tradepro-shared-editor-wide-width').trim(),
            legacyPrivateWidth: style.getPropertyValue('--visual-responsive-dialog-width').trim(),
            expectedWidth,
          };
        });
        expect(materialDialogGeometry.contractWidth).toBe('90vw');
        expect(materialDialogGeometry.legacyPrivateWidth).toBe('');
        expect(materialDialogGeometry.width).toBeCloseTo(materialDialogGeometry.expectedWidth, 0);
        await expect(materialDialog).toHaveAttribute('data-resizable-window', 'true');
        const materialDragHandle = materialDialog.locator('[data-drag-handle]');
        const materialResizeHandle = materialDialog.locator('[data-shared-resize-handle="true"]');
        await expect(materialDragHandle).toBeVisible();
        await expect(materialResizeHandle).toBeVisible();
        const beforeDrag = await materialDialog.boundingBox();
        const dragHandleBox = await materialDragHandle.boundingBox();
        expect(beforeDrag).not.toBeNull();
        expect(dragHandleBox).not.toBeNull();
        await page.mouse.move((dragHandleBox?.x || 0) + 24, (dragHandleBox?.y || 0) + 18);
        await page.mouse.down();
        await page.mouse.move((dragHandleBox?.x || 0) + 56, (dragHandleBox?.y || 0) + 42);
        await page.mouse.up();
        const afterDrag = await materialDialog.boundingBox();
        expect(afterDrag?.x || 0).toBeGreaterThan((beforeDrag?.x || 0) + 12);
        expect(afterDrag?.y || 0).toBeGreaterThan((beforeDrag?.y || 0) + 12);
        const beforeResize = await materialDialog.boundingBox();
        const resizeHandleBox = await materialResizeHandle.boundingBox();
        expect(beforeResize).not.toBeNull();
        expect(resizeHandleBox).not.toBeNull();
        await page.mouse.move((resizeHandleBox?.x || 0) + 18, (resizeHandleBox?.y || 0) + 18);
        await page.mouse.down();
        await page.mouse.move((resizeHandleBox?.x || 0) - 38, (resizeHandleBox?.y || 0) - 26);
        await page.mouse.up();
        const afterResize = await materialDialog.boundingBox();
        expect(afterResize?.width || 0).toBeLessThan((beforeResize?.width || 0) - 18);
        expect(afterResize?.height || 0).toBeLessThan((beforeResize?.height || 0) - 12);
        await page.keyboard.press('Escape');
      }

      const tableHeader = page.locator('[data-page-table-header], [data-product-market-table-header]').first();
      if (await tableHeader.isVisible()) {
        const before = await tableHeader.boundingBox();
        await tableHeader.hover();
        const after = await tableHeader.boundingBox();
        expect(after?.x).toBeCloseTo(before?.x || 0, 1);
        expect(after?.y).toBeCloseTo(before?.y || 0, 1);
        expect(after?.width).toBeCloseTo(before?.width || 0, 1);
        expect(after?.height).toBeCloseTo(before?.height || 0, 1);
      }

      if (target.id === 'homepage-banner') {
        const placementGeometry = await page.evaluate(() => {
          const shell = document.querySelector<HTMLElement>('[data-page-content-kind="banner"][data-development-standard-frame-region="table-shell"]');
          const content = shell?.querySelector<HTMLElement>('[data-development-standard-frame-region="content"]');
          const shellStyle = shell && getComputedStyle(shell, '::after');
          const contentStyle = content && getComputedStyle(content, '::after');
          return {
            shellTop: parseFloat(shellStyle?.top || '0'),
            contentTop: parseFloat(contentStyle?.top || '0'),
          };
        });
        expect(placementGeometry.contentTop).toBeGreaterThan(placementGeometry.shellTop + 40);

        const largeCard = page.locator('tr[data-development-standard-frame-region="large-card"]').first();
        await largeCard.scrollIntoViewIfNeeded();
        const largeCardBox = await largeCard.boundingBox();
        expect(largeCardBox).not.toBeNull();
        await page.mouse.move((largeCardBox?.x || 0) + 4, (largeCardBox?.y || 0) + (largeCardBox?.height || 0) / 2);
        const markerStyle = await largeCard.locator('td').first().evaluate((cell) => {
          const style = getComputedStyle(cell, '::after');
          return { display: style.display, left: style.left, top: style.top, transform: style.transform };
        });
        expect(markerStyle.display).not.toBe('none');
        expect(markerStyle.left).not.toBe('8px');
        expect(markerStyle.top).not.toBe('4px');
        expect(markerStyle.transform).not.toBe('none');

        const editButton = largeCard.locator('[data-content-plugin-control="edit"]');
        await editButton.click();
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();
        const enabledPlugin = dialog.locator('[data-banner-edit-enabled-plugin][data-content-plugin-control="toggle"]');
        await expect(enabledPlugin).toBeVisible();
        const initialEnabledState = await enabledPlugin.getAttribute('aria-pressed');
        await enabledPlugin.click();
        await expect(enabledPlugin).toHaveAttribute('aria-pressed', initialEnabledState === 'true' ? 'false' : 'true');
        const enabledPluginStyle = await enabledPlugin.evaluate((control) => {
          const style = getComputedStyle(control);
          return { height: style.height, fontFamily: style.fontFamily };
        });
        expect(enabledPluginStyle.height).toBe(await page.evaluate(() => {
          const probe = document.createElement('button');
          probe.style.height = 'var(--tradepro-shared-plugin-control-size, 2rem)';
          document.body.appendChild(probe);
          const height = getComputedStyle(probe).height;
          probe.remove();
          return height;
        }));
        expect(enabledPluginStyle.fontFamily).not.toBe('');
        await page.keyboard.press('Escape');
      }
    });
  }
});
