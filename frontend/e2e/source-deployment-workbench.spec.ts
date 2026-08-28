import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type WorkspacePayload = {
  softwareRoot: string;
  sourceRoot: string;
  localDataRoot: string;
  localRuntimeRoot: string;
  deploymentRoleDefinitionsRoot: string;
  deploymentProfilesRoot: string;
  globalReleaseFlowFile: string;
  roleDefinitions: Array<{
    id: string;
    rulePath: string;
    artifactRoot: string;
  }>;
  globalReleaseFlow: {
    sourceFile?: string;
    steps: Array<{
      order: number;
      title: string;
    }>;
  };
  deploymentProfiles: Array<{
    serverCount: number;
    assignments: Array<{
      server: string;
      roles: string[];
    }>;
  }>;
  moduleArchitecture?: ModuleArchitecturePayload;
  module_architecture?: ModuleArchitecturePayload;
};

type ModuleArchitecturePayload = {
  available?: boolean;
  sourceFile?: string;
  contractVersion?: string;
  productSourceOfTruth?: {
    file?: string;
    categoryCount?: number;
    applicationCount?: number;
  };
  technicalCatalogFile?: string;
  categoriesRoot?: string;
  migrationPhase?: {
    id?: string;
    implementationMovesAllowed?: boolean;
    legacyAdaptersRequired?: boolean;
    nextGate?: string;
  };
  categories?: Array<{
    id?: string;
    directory?: string;
    physicalState?: string;
  }>;
  legacyMappings?: Array<{
    legacyModuleId?: string;
    targetId?: string;
  }>;
  pilotApplications?: Array<{
    id?: string;
    implementationMoved?: boolean;
  }>;
  compositions?: Array<{
    id?: string;
    file?: string;
    mode?: string;
  }>;
  resolvedPaths?: {
    contractFile?: string;
    productSourceOfTruth?: string;
    technicalCatalog?: string;
    categoriesRoot?: string;
    compositionsById?: Record<string, string>;
    pilotManifestById?: Record<string, string>;
  };
  errors?: string[];
};

const GUIDE_SECTIONS = [
  ["directory", "directory-rules"],
  ["roles", "role-rules"],
  ["package", "release-package"],
  ["flow", "release-flow"],
  ["profiles", "server-profiles"],
  ["principles", "management-principles"],
] as const;

const MODE_CONTENT = {
  developer: "[data-source-developer]",
  visual: "[data-visual-deployment-canvas]",
  contract: "[data-shared-deployment-contract]",
} as const;

function versionArtifactRoot(artifactRoot: string) {
  const separator = artifactRoot.includes("\\") ? "\\" : "/";
  return `${artifactRoot.replace(/[\\/]+$/u, "")}${separator}<version>`;
}

function assertWorkspacePayload(workspace: WorkspacePayload) {
  expect(workspace.roleDefinitions.map((role) => role.id)).toEqual(["01", "02", "03", "04", "05", "06", "07"]);
  expect(workspace.globalReleaseFlow.steps.map((step) => step.order)).toEqual([1, 2, 3, 4, 5, 6]);
  expect(workspace.deploymentProfiles.map((profile) => profile.serverCount)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  for (const path of [
    workspace.softwareRoot,
    workspace.sourceRoot,
    workspace.localDataRoot,
    workspace.localRuntimeRoot,
    workspace.deploymentRoleDefinitionsRoot,
    workspace.deploymentProfilesRoot,
    workspace.globalReleaseFlowFile,
  ]) {
    expect(path).toBeTruthy();
  }

  const architecture = workspace.moduleArchitecture || workspace.module_architecture;
  if (architecture) {
    expect(architecture.available).toBe(true);
    expect(architecture.contractVersion).toBeTruthy();
    expect(architecture.productSourceOfTruth?.file).toBeTruthy();
    expect(architecture.technicalCatalogFile).toBeTruthy();
    expect(architecture.categoriesRoot).toBeTruthy();
    expect(architecture.categories?.length).toBe(architecture.productSourceOfTruth?.categoryCount);
    expect(architecture.pilotApplications?.length).toBeGreaterThan(0);
    expect(architecture.compositions?.length).toBeGreaterThan(0);
    expect(architecture.errors || []).toEqual([]);
  }
}

function moduleArchitectureOf(workspace: WorkspacePayload) {
  return workspace.moduleArchitecture || workspace.module_architecture;
}

function currentModuleArchitectureFixture(sourceRoot: string): ModuleArchitecturePayload {
  const contractFile = resolve(process.cwd(), "..", "modules", "module-architecture.json");
  const contract = JSON.parse(readFileSync(contractFile, "utf8")) as ModuleArchitecturePayload & {
    shellCompositionsRoot?: Record<string, string>;
  };
  const resolveSourcePath = (path?: string) => path ? resolve(sourceRoot, path) : undefined;
  const compositionsById = Object.fromEntries((contract.compositions || []).flatMap((composition) =>
    composition.id && composition.file ? [[composition.id, resolveSourcePath(composition.file)!]] : [],
  ));
  const pilotManifestById = Object.fromEntries((contract.pilotApplications || []).flatMap((pilot) => {
    const item = pilot as typeof pilot & { manifest?: string };
    return item.id && item.manifest ? [[item.id, resolveSourcePath(item.manifest)!]] : [];
  }));

  return {
    ...contract,
    available: true,
    sourceFile: contractFile,
    errors: [],
    resolvedPaths: {
      contractFile,
      productSourceOfTruth: resolveSourcePath(contract.productSourceOfTruth?.file),
      technicalCatalog: resolveSourcePath(contract.technicalCatalogFile),
      categoriesRoot: resolveSourcePath(contract.categoriesRoot),
      compositionsById,
      pilotManifestById,
    },
  };
}

async function mockCurrentModuleArchitecture(page: Page) {
  const response = await page.request.get("http://127.0.0.1:8000/api/v1/local-dev/workspace");
  expect(response.ok()).toBeTruthy();
  const workspace = await response.json() as WorkspacePayload;
  const payload: WorkspacePayload = {
    ...workspace,
    moduleArchitecture: currentModuleArchitectureFixture(workspace.sourceRoot),
  };
  await page.route("**/api/v1/local-dev/workspace", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(payload),
    });
  });
  return payload;
}

async function openWorkbench(page: Page) {
  // Register the listener before navigation so assertions use the real workspace response that bootstraps the page.
  const workspaceResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/v1/local-dev/workspace") && response.request().method() === "GET" && response.ok(),
  );
  await page.goto("/zb/code-editor", { waitUntil: "domcontentloaded" });
  const workspaceResponse = await workspaceResponsePromise;
  expect(workspaceResponse.status()).toBe(200);
  const workspace = (await workspaceResponse.json()) as WorkspacePayload;
  assertWorkspacePayload(workspace);
  await expect(page.locator("[data-development-workbench]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-global-release-flow]")).toContainText("源码与部署中心全局六步发布流程", { timeout: 60_000 });
  return workspace;
}

async function expectNoHorizontalOverflow(page: Page, contentSelector: string) {
  const layout = await page.evaluate((selector) => {
    const root = document.querySelector<HTMLElement>("[data-development-workbench]");
    const handbook = document.querySelector<HTMLElement>("[data-deployment-handbook]");
    const content = document.querySelector<HTMLElement>(selector);
    return {
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      rootOverflow: root ? root.scrollWidth - root.clientWidth : 999,
      handbookOverflow: handbook ? handbook.scrollWidth - handbook.clientWidth : 999,
      contentOverflow: content ? content.scrollWidth - content.clientWidth : 999,
    };
  }, contentSelector);

  expect(layout.documentOverflow).toBeLessThanOrEqual(1);
  expect(layout.rootOverflow).toBeLessThanOrEqual(1);
  expect(layout.handbookOverflow).toBeLessThanOrEqual(1);
  expect(layout.contentOverflow).toBeLessThanOrEqual(1);
}

async function activateResponsiveControl(page: Page, selector: string) {
  await page.locator(selector).evaluate((element: HTMLButtonElement) => element.click());
}

test.describe("source deployment workbench", () => {
  test("renders the API-backed guide, role rules, release flow, and all server profiles", async ({ page }) => {
    const workspace = await openWorkbench(page);

    const handbook = page.locator("[data-deployment-handbook]");
    await expect(handbook).toBeVisible();
    const architectureSection = page.locator("[data-module-architecture]");
    await expect(architectureSection).toBeVisible();
    const architecture = moduleArchitectureOf(workspace);
    if (architecture) {
      await expect(architectureSection).toHaveAttribute("data-module-architecture-status", "ready");
      await expect(page.locator("[data-module-category]")).toHaveCount(architecture.categories?.length || 0);
      await expect(page.locator("[data-module-legacy-mapping]")).toHaveCount(architecture.legacyMappings?.length || 0);
      await expect(page.locator("[data-module-pilot]")).toHaveCount(architecture.pilotApplications?.length || 0);
      await expect(page.locator("[data-module-composition]")).toHaveCount(architecture.compositions?.length || 0);
      await expect(page.locator('[data-module-architecture-path="product-source"]')).toContainText(architecture.productSourceOfTruth?.file || "");
      await expect(page.locator('[data-module-architecture-path="technical-catalog"]')).toContainText(architecture.technicalCatalogFile || "");
      await expect(page.locator('[data-module-architecture-path="categories-root"]')).toContainText(architecture.categoriesRoot || "");
      await expect(page.locator("[data-module-implementation-moves-allowed]")).toHaveText(architecture.migrationPhase?.implementationMovesAllowed ? "是" : "否");
      await expect(page.locator("[data-module-legacy-adapters-required]")).toHaveText(architecture.migrationPhase?.legacyAdaptersRequired ? "必须保留" : "不要求");
      for (const category of architecture.categories || []) {
        const categoryCard = page.locator(`[data-module-category="${category.id}"]`);
        await expect(categoryCard).toContainText(category.directory || category.id || "");
        await expect(categoryCard).toHaveAttribute("data-module-category-state", category.physicalState || "unknown");
      }
      for (const pilot of architecture.pilotApplications || []) {
        await expect(page.locator(`[data-module-pilot="${pilot.id}"]`)).toHaveAttribute("data-module-implementation-moved", String(pilot.implementationMoved ?? false));
      }
    } else {
      await expect(architectureSection).toHaveAttribute("data-module-architecture-status", "legacy-fallback");
      await expect(page.locator("[data-module-architecture-fallback]")).toBeVisible();
    }
    await expect(page.locator("[data-handbook-tab]")).toHaveCount(GUIDE_SECTIONS.length);
    await expect(page.locator('[data-guide-path="software-root"]')).toHaveText(workspace.softwareRoot);
    await expect(page.locator('[data-guide-path="directory-platform-source"]')).toHaveText(workspace.sourceRoot);
    await expect(page.locator('[data-guide-path="directory-local-data"]')).toHaveText(workspace.localDataRoot);
    await expect(page.locator('[data-guide-path="directory-local-runtime"]')).toHaveText(workspace.localRuntimeRoot);
    await expect(page.locator('[data-guide-path="role-definitions-root"]')).toHaveText(workspace.deploymentRoleDefinitionsRoot);
    await expect(page.locator('[data-guide-path="deployment-profiles-root"]')).toHaveText(workspace.deploymentProfilesRoot);
    await expect(page.locator('[data-guide-path="global-release-flow-file"]')).toHaveText(workspace.globalReleaseFlowFile);

    for (const [chapter, section] of GUIDE_SECTIONS) {
      await page.locator(`[data-handbook-tab="${chapter}"]`).click();
      await expect(page.locator(`[data-deployment-guide-section="${section}"]`)).toBeVisible();
    }

    await page.locator('[data-handbook-tab="roles"]').click();
    await expect(page.locator("[data-handbook-role]")).toHaveCount(workspace.roleDefinitions.length);
    for (const role of workspace.roleDefinitions) {
      await expect(page.locator(`[data-guide-path="role-${role.id}-rule"]`)).toHaveText(role.rulePath);
      await expect(page.locator(`[data-guide-path="role-${role.id}-artifact"]`)).toHaveText(role.artifactRoot);
    }

    await page.locator('[data-handbook-tab="package"]').click();
    const selectedRole = workspace.roleDefinitions.find((role) => role.id === "01");
    expect(selectedRole).toBeTruthy();
    await expect(page.locator('[data-guide-path="selected-version-artifact-root"]')).toHaveText(versionArtifactRoot(selectedRole!.artifactRoot));
    await expect(page.locator("[data-handbook-package-role]")).toHaveCount(workspace.roleDefinitions.length);
    for (const role of workspace.roleDefinitions) {
      await expect(page.locator(`[data-guide-path="package-role-${role.id}"]`)).toHaveText(versionArtifactRoot(role.artifactRoot));
    }

    await page.locator('[data-handbook-tab="flow"]').click();
    const flowSource = workspace.globalReleaseFlow.sourceFile || workspace.globalReleaseFlowFile;
    await expect(page.locator('[data-guide-path="release-flow-source"]')).toHaveText(flowSource);
    await expect(page.locator("[data-handbook-flow-step]")).toHaveCount(workspace.globalReleaseFlow.steps.length);
    await expect(page.locator("[data-global-release-step]")).toHaveCount(workspace.globalReleaseFlow.steps.length);
    for (const step of workspace.globalReleaseFlow.steps) {
      await expect(page.locator(`[data-handbook-flow-step="${step.order}"]`)).toContainText(step.title);
      await expect(page.locator(`[data-global-release-step="${step.order}"]`)).toContainText(step.title);
    }

    await page.locator('[data-handbook-tab="profiles"]').click();
    await expect(page.locator("[data-handbook-profile]")).toHaveCount(workspace.deploymentProfiles.length);
    for (const profile of workspace.deploymentProfiles) {
      const profileCard = page.locator(`[data-handbook-profile="${profile.serverCount}"]`);
      for (const assignment of profile.assignments) {
        await expect(profileCard).toContainText(assignment.server);
        await expect(profileCard).toContainText(assignment.roles.join(" + "));
      }
    }

    await page.locator('[data-workbench-mode-tab="visual"]').click();
    await expect(page.locator("[data-server-profile]")).toHaveCount(workspace.deploymentProfiles.length);
    for (const profile of workspace.deploymentProfiles) {
      await page.locator(`[data-server-profile="${profile.serverCount}"]`).click();
      const selectedProfile = page.locator(`[data-selected-server-profile="${profile.serverCount}"]`);
      await expect(selectedProfile).toBeVisible();
      await expect(selectedProfile.locator("[data-server-assignment]")).toHaveCount(profile.assignments.length);
      for (const assignment of profile.assignments) {
        const assignmentCard = selectedProfile.locator("[data-server-assignment]").filter({ hasText: assignment.server });
        await expect(assignmentCard).toHaveAttribute("data-server-assignment", assignment.server);
        for (const role of assignment.roles) {
          await expect(assignmentCard.getByRole("button", { name: role, exact: true })).toBeVisible();
        }
      }
    }
  });

  test("keeps developer, visual, and shared-contract modes inside a 390px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const workspace = await openWorkbench(page);

    await expectNoHorizontalOverflow(page, "[data-module-architecture]");
    await expect(page.locator('[data-module-architecture-mode-guidance="developer"]')).toBeVisible();

    for (const [chapter, section] of GUIDE_SECTIONS) {
      await page.locator(`[data-handbook-tab="${chapter}"]`).click();
      const sectionSelector = `[data-deployment-guide-section="${section}"]`;
      await expect(page.locator(sectionSelector)).toBeVisible();
      await expectNoHorizontalOverflow(page, sectionSelector);
    }
    await expectNoHorizontalOverflow(page, MODE_CONTENT.developer);

    await activateResponsiveControl(page, '[data-workbench-mode-tab="visual"]');
    await expect(page.locator('[data-module-architecture-mode-guidance="visual"]')).toBeVisible();
    await expectNoHorizontalOverflow(page, "[data-module-architecture]");
    const largestProfile = workspace.deploymentProfiles.at(-1)!;
    await activateResponsiveControl(page, `[data-server-profile="${largestProfile.serverCount}"]`);
    await expect(page.locator(`[data-selected-server-profile="${largestProfile.serverCount}"]`)).toBeVisible();
    await expectNoHorizontalOverflow(page, MODE_CONTENT.visual);

    await activateResponsiveControl(page, '[data-workbench-mode-tab="contract"]');
    await expect(page.locator('[data-module-architecture-mode-guidance="contract"]')).toBeVisible();
    await expectNoHorizontalOverflow(page, "[data-module-architecture]");
    await expect(page.locator(MODE_CONTENT.contract)).toBeVisible();
    await expectNoHorizontalOverflow(page, MODE_CONTENT.contract);
  });

  test("renders the current 12-category module contract without 390px overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const expectedWorkspace = await mockCurrentModuleArchitecture(page);
    const workspace = await openWorkbench(page);
    const architecture = moduleArchitectureOf(workspace)!;

    expect(architecture.contractVersion).toBe(moduleArchitectureOf(expectedWorkspace)?.contractVersion);
    await expect(page.locator("[data-module-architecture]")).toHaveAttribute("data-module-architecture-status", "ready");
    await expect(page.locator("[data-module-category]")).toHaveCount(12);
    await expect(page.locator("[data-module-legacy-mapping]")).toHaveCount(11);
    await expect(page.locator("[data-module-pilot]")).toHaveCount(1);
    await expect(page.locator("[data-module-composition]")).toHaveCount(5);
    await expect(page.locator('[data-module-category="deepen"]')).toHaveAttribute("data-module-category-state", "pilot-manifest");
    await expect(page.locator('[data-module-pilot="deepen.social-matrix"]')).toHaveAttribute("data-module-implementation-moved", "false");

    for (const mode of ["developer", "visual", "contract"] as const) {
      await activateResponsiveControl(page, `[data-workbench-mode-tab="${mode}"]`);
      await expect(page.locator(`[data-module-architecture-mode-guidance="${mode}"]`)).toBeVisible();
      await expectNoHorizontalOverflow(page, "[data-module-architecture]");
    }
  });
});
