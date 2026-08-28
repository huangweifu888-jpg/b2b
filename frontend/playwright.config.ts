import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.B2B_E2E_BASE_URL || 'http://127.0.0.1:4173';
const channel = process.env.B2B_E2E_CHANNEL === 'chrome' || (process.platform === 'win32' && !process.env.CI)
  ? 'chrome'
  : undefined;
const focusedFullWorkspaceContracts = [
  'accessibility.spec.ts',
  'mobile-app-frame.spec.ts',
  'shared-visual-parity.spec.ts',
  'three-source-global-frame-parity.spec.ts',
];
const runsFocusedFullWorkspaceContract = process.argv.some((argument) =>
  focusedFullWorkspaceContracts.some((testFile) => argument.includes(testFile)),
);
const ciTestIgnore = process.env.CI
  ? [
      // Generated candidates, local workbench integration and Windows image baselines.
      '**/developer-global-frame-all-pages.spec.ts',
      '**/responsive-shared-visual-baseline.spec.ts',
      '**/source-deployment-workbench.spec.ts',
      // Full-workspace acceptance specifications. These depend on the supervised
      // local API or platform-specific geometry and remain part of the Windows
      // source-workspace suite instead of the repository-only Linux PR gate.
      '**/global-responsive-deep.spec.ts',
      '**/global-styler-marketing-proof-flow.spec.ts',
      '**/shared-existing-workspace-footer.spec.ts',
      '**/shared-existing-workspace-frame.spec.ts',
      ...(runsFocusedFullWorkspaceContract
        ? []
        : [
            '**/accessibility.spec.ts',
            '**/mobile-app-frame.spec.ts',
            '**/shared-visual-parity.spec.ts',
            '**/three-source-global-frame-parity.spec.ts',
          ]),
    ]
  : [];

export default defineConfig({
  testDir: './e2e',
  testIgnore: ciTestIgnore,
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, channel, trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  webServer: process.env.B2B_E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev -- --host 127.0.0.1 --port 4173', url: baseURL, reuseExistingServer: !process.env.CI },
});
