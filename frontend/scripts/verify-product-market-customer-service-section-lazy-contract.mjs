import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const productMarket = read("src/pages/ProductMarket.tsx");
const serviceSection = read("src/components/product-market/ProductMarketCustomerServiceSection.tsx");
const sharedLoader = read("src/lib/product-market-customer-service-section-loader.ts");
const routePreload = read("src/lib/route-preload.ts");
const learning = read("src/lib/performance-experience-learning.ts");
const packageJson = JSON.parse(read("package.json"));
const gates = read("scripts/run-development-standard-gates.mjs");

assert.match(
  productMarket,
  /import type \{[\s\S]*?ProductMarketCustomerServiceSectionProps[\s\S]*?ProductMarketCustomerServiceResponsiveMode as DefaultDialogResponsiveMode[\s\S]*?\} from "@\/components\/product-market\/ProductMarketCustomerServiceSection";/u,
  "ProductMarket may retain only the service-section prop and responsive types on its eager path.",
);
assert.doesNotMatch(
  productMarket,
  /import \{ SortableCustomerServiceSection \} from "@\/components\/product-market\/ProductMarketCustomerServiceSection";/u,
  "ProductMarket must not statically import the service-section implementation.",
);
assert.match(
  productMarket,
  /import \{[\s\S]*?loadProductMarketCustomerServiceSection,[\s\S]*?preloadProductMarketCustomerServiceSection,[\s\S]*?\} from "@\/lib\/product-market-customer-service-section-loader";/u,
  "ProductMarket must consume the shared Service lazy/preload entry.",
);
assert.match(
  sharedLoader,
  /loadLazyModule\([\s\S]*?import\("@\/components\/product-market\/ProductMarketCustomerServiceSection"\)[\s\S]*?"product-market-customer-service-section"/u,
  "The service-section implementation must use the shared recoverable lazy loader.",
);
assert.match(
  sharedLoader,
  /if \(customerServiceSectionPromise\) return customerServiceSectionPromise;[\s\S]*?customerServiceSectionPromise = undefined;[\s\S]*?throw error;/u,
  "The service-section loader must be single-flight and release failures for retry.",
);
assert.doesNotMatch(
  productMarket,
  /let productMarketCustomerServiceSectionPromise|function loadProductMarketCustomerServiceSection\(/u,
  "ProductMarket must not keep a second Service lazy request cache.",
);
assert.match(
  productMarket,
  /const LazyProductMarketCustomerServiceSection = lazy\(async \(\) => \(\{[\s\S]*?loadProductMarketCustomerServiceSection\(\)[\s\S]*?SortableCustomerServiceSection/u,
  "The extracted service shell must remain behind one React.lazy component.",
);
assert.match(
  productMarket,
  /function SortableCustomerServiceSection\(props: ProductMarketCustomerServiceSectionProps\)[\s\S]*?<Suspense[\s\S]*?data-product-market-customer-service-section-loader="loading"[\s\S]*?<LazyProductMarketCustomerServiceSection \{\.\.\.props\} \/>/u,
  "The eager wrapper must contain only a geometry-preserving Suspense shell around the lazy component.",
);
assert.doesNotMatch(
  productMarket,
  /function getResponsiveCustomerServiceSectionTitle/u,
  "Responsive service-section title work must not remain in ProductMarket.",
);
assert.equal(
  (productMarket.match(/<SortableCustomerServiceSection\b/gu) || []).length,
  3,
  "All three service sections must continue to use the shared sortable shell.",
);
for (const sectionId of ["service-select-avatar", "service-avatar-customize", "service-reminder-sound"]) {
  assert.ok(productMarket.includes(`getTempCustomerServiceSection("${sectionId}")`), `Service section call lost: ${sectionId}`);
}
assert.match(
  productMarket,
  /<TabsTrigger[\s\S]{0,160}?value="service"[\s\S]{0,440}?onPointerEnter=\{preloadProductMarketCustomerServiceSection\}[\s\S]{0,220}?onPointerDown=\{preloadProductMarketCustomerServiceSection\}[\s\S]{0,220}?onFocus=\{preloadProductMarketCustomerServiceSection\}/u,
  "The Service entry must preload its sortable shell on pointer and keyboard intent.",
);
assert.match(
  productMarket,
  /typeof window !== "undefined"[\s\S]{0,220}?window\.location\.pathname[\s\S]{0,180}?endsWith\("\/product-market"\)[\s\S]{0,180}?window\.location\.search[\s\S]{0,180}?=== "service"[\s\S]{0,120}?preloadProductMarketCustomerServiceSection\(\);/u,
  "A direct Service route must begin preloading before the first ProductMarket render.",
);
assert.match(
  routePreload,
  /match\[1\] === "productMarket"[\s\S]{0,180}?get\("tab"\)\?\.toLowerCase\(\) === "service"[\s\S]{0,220}?preloadProductMarketCustomerServiceSectionForRoute\(\)\.catch/u,
  "Sidebar route intent must preload the Service-only sortable shell.",
);
assert.match(
  routePreload,
  /function preloadProductMarketCustomerServiceSectionForRoute\(\)[\s\S]*?import\("@\/lib\/product-market-customer-service-section-loader"\)[\s\S]*?loadProductMarketCustomerServiceSection\(\)[\s\S]*?routePreloads\.delete\(PRODUCT_MARKET_SERVICE_PRELOAD_KEY\)/u,
  "The Sidebar must defer the shared Service loader itself and release failed route intent for retry.",
);
assert.doesNotMatch(
  routePreload,
  /^import \{[^\n]*ProductMarketCustomerServiceSection[^\n]*\} from "@\/lib\/product-market-customer-service-section-loader";/mu,
  "Ordinary routes must not eagerly download the Service loader through the shared Sidebar.",
);
assert.doesNotMatch(
  routePreload,
  /import\("@\/components\/product-market\/ProductMarketCustomerServiceSection"\)/u,
  "Route intent must reuse the shared Service loader instead of starting a second import.",
);
for (const token of [
  'id: "tab-exclusive-control-boundary"',
  "侧栏进入客服音效会与页面 lazy 共享 single-flight Promise",
  "直接目标路由在 ProductMarket 求值时提前预热",
  "失败预热可释放并走共享恢复",
]) {
  assert.ok(learning.includes(token), `Optimization Loading Experience evidence is missing: ${token}`);
}

for (const token of [
  "function getResponsiveCustomerServiceSectionTitle(",
  "useSortable({ id: section.id })",
  'className="template-config-service-section"',
  'data-shared-large-card-surface="true"',
  'data-responsive-structure-item="service-section"',
  "data-shared-sortable-card",
  "data-shared-sortable-card-rail",
  "data-shared-sortable-capsule-title",
  "data-shared-sortable-capsule-description",
  "onMoveUp={() => onMove(section.id, \"up\")}",
  "onMoveDown={() => onMove(section.id, \"down\")}",
  "{children}",
]) {
  assert.ok(serviceSection.includes(token), `Lazy service-section module lost shared/DnD contract: ${token}`);
}

const rawBytes = Buffer.byteLength(serviceSection);
const gzipBytes = gzipSync(serviceSection, { level: 9 }).byteLength;
assert.ok(rawBytes >= 5_000 && gzipBytes >= 1_600, "The deferred service-section shell must remain a meaningful lazy boundary.");
assert.equal(
  packageJson.scripts["verify:product-market-customer-service-section-lazy"],
  "node scripts/verify-product-market-customer-service-section-lazy-contract.mjs",
  "Package scripts must expose the focused service-section lazy gate.",
);
assert.ok(
  gates.includes('"verify-product-market-customer-service-section-lazy-contract.mjs"'),
  "Development Standard gates must run the service-section lazy contract.",
);

console.log(`ProductMarket customer-service section lazy contract verified: ${rawBytes} raw / ${gzipBytes} gzip source bytes deferred from ordinary tabs.`);
