import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const playwrightCli = require.resolve("@playwright/test/cli");
const focusedPattern = [
  "attribute-only small-card discovery",
  "attribute-only large and small card changes",
  "selection and document theme mutations",
  "Operations theme and batch selection",
  "Operations and Modules small cards",
  "通用编辑弹窗",
  "移动导航抽屉",
  "客服专家与提醒声音",
  "素材筛选与开发器导航",
  "版面与主题字体选项",
  "客服提醒声音在修改提醒音控件",
  "当前专家真人朗音自定义字段",
  "开关客音与客服音效",
].join("|");

const result = spawnSync(process.execPath, [
  playwrightCli,
  "test",
  "e2e/shared-live-surfaces.spec.ts",
  "--grep",
  focusedPattern,
], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

console.log("Shared Developer/live-surface focused runtime contract passed.");
