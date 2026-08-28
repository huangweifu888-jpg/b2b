import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const overrides = await readFile(resolve(root, "src/lib/page-layout-overrides.ts"), "utf8");

for (const text of [
  "PAGE_CONTENT_VARIABLE_PREFIXES",
  "function sanitizePageContentProfile",
  "Business\n * values, form fields, records and downstream-created content",
  "sanitizePageContentProfile(profile)",
  "findPageFactoryPage(pathname, search)",
  'factoryPage.status === "complete" || factoryPage.status === "pilot-complete"',
  "REQUIRED_SHARED_FRAME_VARIABLES",
  'tradeproPageSharedVariablesIntegrity = "complete"',
  "missingSharedFrameVariables",
]) {
  if (!overrides.includes(text)) throw new Error(`内容安全同步合同缺失：${text}`);
}

console.log("内容安全同步合同通过：内容设计仅保存表现令牌，不保存或覆盖业务记录、表单和下游新增内容。");
