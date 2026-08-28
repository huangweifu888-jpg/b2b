import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { join, relative } from "node:path";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
const collectSourceFiles = (directory) => readdirSync(directory).flatMap((entry) => {
  const absolutePath = join(directory, entry);
  return statSync(absolutePath).isDirectory() ? collectSourceFiles(absolutePath) : [absolutePath];
});

const core = read("src/lib/factory-platform-blueprint.ts");
const governance = read("src/lib/factory-platform-blueprint-governance.ts");
const developmentPhases = read("src/lib/factory-platform-development-phases.ts");
const productMarket = read("src/pages/ProductMarket.tsx");
const blueprint = read("src/components/product-market/FactoryPlatformBlueprint.tsx");
const executionDesk = read("src/components/product-market/FactoryExecutionDesk.tsx");
const developmentGuide = read("src/components/product-market/ProductMarketDevelopmentGuidePanel.tsx");
const specification = read("src/lib/factory-platform-specification.ts");

const governanceValues = [
  "FACTORY_PLATFORM_BUSINESS_BOUNDARIES",
  "FACTORY_PLATFORM_FOUNDATIONS",
  "FACTORY_PLATFORM_PRIORITY_PROGRAMS",
  "FACTORY_PLATFORM_COMMERCIAL_PACKAGES",
  "FACTORY_PLATFORM_DEVELOPMENT_GATES",
  "FACTORY_PLATFORM_APPLICATION_CONTRACT_FIELDS",
  "FACTORY_PLATFORM_CONTINUOUS_DEVELOPMENT_SEQUENCE",
  "FACTORY_PLATFORM_EXECUTION_WORKSTREAMS",
  "FACTORY_PLATFORM_CORE_OBJECTS",
  "FACTORY_PLATFORM_CORE_EVENTS",
  "FACTORY_PLATFORM_GOLDEN_FLOWS",
  "FACTORY_PLATFORM_INDUSTRY_PACKS",
  "FACTORY_PLATFORM_COUNTRY_PACKS",
  "FACTORY_PLATFORM_IMPLEMENTATION_STAGES",
  "FACTORY_PLATFORM_PORTABILITY_RULES",
  "FACTORY_PLATFORM_ENDPOINT_RESPONSIBILITIES",
  "FACTORY_PLATFORM_SALES_VALUE_PROPOSITIONS",
  "FACTORY_PLATFORM_DIFFERENTIATORS",
  "FACTORY_PLATFORM_OPERATING_LOOP",
];

for (const value of governanceValues) {
  assert.match(
    governance,
    new RegExp(`export const ${value}\\b`, "u"),
    `Governance module lost its owned value export: ${value}`,
  );
  assert.doesNotMatch(
    core,
    new RegExp(`(?:export const|export \\{[^}]*\\b)${value}\\b`, "u"),
    `Factory-platform core must not expose the governance value: ${value}`,
  );
}

assert.match(
  developmentPhases,
  /export const FACTORY_PLATFORM_DEVELOPMENT_PHASES\b/u,
  "The lightweight phase module must own FACTORY_PLATFORM_DEVELOPMENT_PHASES.",
);
assert.ok(
  governance.includes("FACTORY_PLATFORM_DEVELOPMENT_PHASES")
    && governance.includes('from "./factory-platform-development-phases"'),
  "Governance must re-export the shared lightweight development phases.",
);
assert.doesNotMatch(
  core,
  /(?:export const|export \{[^}]*\b)FACTORY_PLATFORM_DEVELOPMENT_PHASES\b/u,
  "Factory-platform core must not expose development phase values.",
);

for (const token of [
  "export const FACTORY_PLATFORM_CATEGORY_KEYS",
  "export const FACTORY_PLATFORM_CATEGORIES",
  "export const FACTORY_PLATFORM_SOCIAL_WORKSPACES",
  "export function getFactoryPlatformCategory",
  "export function getFactoryPlatformApplication",
]) {
  assert.ok(core.includes(token), `Factory-platform core lost an ordinary-shell contract: ${token}`);
}

assert.match(
  governance,
  /import \{[\s\S]*?FACTORY_PLATFORM_CATEGORY_KEYS,[\s\S]*?type FactoryPlatformAudience,[\s\S]*?type FactoryPlatformCategoryKey,[\s\S]*?type FactoryPlatformPhaseId,[\s\S]*?\} from "\.\/factory-platform-blueprint";/u,
  "Governance data may depend on the lightweight core value and types only.",
);
assert.doesNotMatch(
  core,
  /factory-platform-blueprint-governance/u,
  "The ordinary-shell core must not import or value-re-export governance data.",
);

const sourceFiles = collectSourceFiles(sourceRoot)
  .filter((path) => /\.[cm]?[jt]sx?$/u.test(path));
const governanceImporters = sourceFiles
  .filter((path) => readFileSync(path, "utf8").includes("@/lib/factory-platform-blueprint-governance"))
  .map((path) => relative(sourceRoot, path).replaceAll("\\", "/"))
  .sort();
assert.deepEqual(
  governanceImporters,
  [
    "components/product-market/FactoryExecutionDesk.tsx",
    "components/product-market/FactoryPlatformBlueprint.tsx",
    "lib/factory-platform-specification.ts",
  ],
  "Only the three reviewed lazy Blueprint consumers may import heavy governance data.",
);

for (const ordinaryConsumer of [
  "src/components/ExternalDevtoolsMenu.tsx",
  "src/components/Sidebar.tsx",
  "src/lib/global-responsive-page-contract.ts",
  "src/lib/page-layout-lock.ts",
  "src/lib/page-route-label.ts",
  "src/lib/platform-modules.ts",
  "src/lib/product-market-store.ts",
  "src/pages/SocialMedia.tsx",
]) {
  assert.ok(
    !read(ordinaryConsumer).includes("factory-platform-blueprint-governance"),
    `Ordinary runtime consumer must stay on the lightweight core: ${ordinaryConsumer}`,
  );
}

assert.match(
  productMarket,
  /import\("@\/components\/product-market\/FactoryPlatformBlueprint"\)/u,
  "FactoryPlatformBlueprint must remain behind ProductMarket's lazy route boundary.",
);
assert.match(
  productMarket,
  /import\("@\/components\/product-market\/ProductMarketDevelopmentGuidePanel"\)/u,
  "ProductMarketDevelopmentGuidePanel must remain behind ProductMarket's lazy route boundary.",
);
assert.ok(
  blueprint.includes('from "@/lib/factory-platform-blueprint-governance"')
    && blueprint.includes('from "@/lib/factory-platform-specification"')
    && blueprint.includes('from "@/components/product-market/FactoryExecutionDesk"'),
  "The lazy Blueprint component must own its governance, specification and execution consumers.",
);
assert.ok(
  executionDesk.includes('from "@/lib/factory-platform-blueprint-governance"')
    && specification.includes('from "@/lib/factory-platform-blueprint-governance"')
    && developmentGuide.includes('from "@/lib/factory-platform-development-phases"')
    && !developmentGuide.includes('from "@/lib/factory-platform-blueprint-governance"'),
  "Heavy Blueprint consumers must use governance while the development guide stays on lightweight phase metadata.",
);
assert.ok(
  developmentGuide.includes('getFactoryPlatformCategory } from "@/lib/factory-platform-blueprint"')
    && !developmentGuide.includes('import("@/lib/factory-platform-blueprint")'),
  "The development guide must use the existing core query without a second dynamic core request.",
);

const coreRawBytes = Buffer.byteLength(core);
const governanceRawBytes = Buffer.byteLength(governance);
const governanceGzipBytes = gzipSync(governance, { level: 9 }).byteLength;
assert.ok(coreRawBytes < 70_000, "Factory-platform ordinary core must remain below 70 KB source.");
assert.ok(governanceRawBytes >= 50_000, "The lazy governance split must defer at least 50 KB source.");
assert.ok(governanceGzipBytes >= 15_000, "The lazy governance split must defer meaningful compressed source.");

console.log(
  `Factory-platform governance lazy contract verified: eager core ${coreRawBytes} raw bytes; ${governanceRawBytes} raw / ${governanceGzipBytes} gzip source bytes deferred to three reviewed heavy consumers while phase metadata stays lightweight.`,
);
