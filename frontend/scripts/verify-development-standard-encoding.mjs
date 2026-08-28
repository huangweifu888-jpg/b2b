import { readFileSync, readdirSync } from "node:fs";

const contractScripts = readdirSync("scripts")
  .filter((file) => /^verify-.+-contract\.mjs$/u.test(file))
  .map((file) => `scripts/${file}`);

const files = [...new Set([
  "src/lib/new-content-plugin-guide.ts",
  "src/lib/page-composition-impact-map.ts",
  "src/lib/layout-screenshot-regressions.ts",
  "src/lib/layout-migration-assistant.ts",
  "src/lib/page-composition-audit.ts",
  "src/lib/layout-frame-contract.ts",
  "src/lib/product-market-theme-palettes.json",
  "src/lib/product-market-theme-palettes.ts",
  "src/lib/color-contrast.ts",
  "src/components/product-market/DevelopmentStandardApplyConsole.tsx",
  "src/components/product-market/ProductMarketDevelopmentGuidePanel.tsx",
  "scripts/verify-product-market-theme-accessibility.mjs",
  "scripts/run-development-standard-gates.mjs",
  "scripts/verify-development-standard-encoding.mjs",
  ...contractScripts,
])];

// U+FFFD and C1 controls catch invalid UTF-8. The remaining signatures are
// multi-character fragments repeatedly produced when Chinese UTF-8 is saved
// through a legacy code page. Deliberately avoid matching isolated accented
// Latin characters, which can be valid names or examples.
const suspiciousMojibake = /(?:[\u0080-\u009f]|\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|\u00e2(?:\u20ac|\u2122|\u0153|\u201c|\u201d|\u2013|\u2014)|\u00f0\u0178|\u951b\u6c33|\u9225\u6ec0|\u5bee\u20ac|\u934f\u53d8\u97e9|\u741b\u3125\u5534|\u93cd\u56ec\ue57d)/u;

for (const file of files) {
  const source = readFileSync(file, "utf8");
  if (source.includes("\uFFFD") || suspiciousMojibake.test(source)) {
    throw new Error(`开发规范模块包含疑似乱码：${file}`);
  }
}

console.log(`开发规范中文编码验证通过：${files.length} 个关键文件。`);
