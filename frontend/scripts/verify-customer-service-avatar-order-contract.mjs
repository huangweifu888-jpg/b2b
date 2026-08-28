import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export * from "./src/lib/customer-service-avatar-material-order.ts";`,
    resolveDir: process.cwd(),
    sourcefile: "customer-service-avatar-order-entry.ts",
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  logLevel: "silent",
});

const encoded = Buffer.from(bundle.outputFiles[0].text).toString("base64");
const contract = await import(`data:text/javascript;base64,${encoded}`);
const sourceItems = [
  { assetId: "avatar-16", fileName: "16.first.png", createdAt: "2026-08-24T10:00:00Z" },
  { assetId: "avatar-18", fileName: "18.latest.png", createdAt: "2026-08-20T10:00:00Z" },
  { assetId: "avatar-17", fileName: "17.middle.png", createdAt: "2026-08-23T10:00:00Z" },
  { assetId: "legacy", fileName: "legacy.png", createdAt: "2026-08-25T10:00:00Z" },
];
const ordered = contract.orderUploadedAvatarMaterialsNewestFirst(sourceItems);

assert.deepEqual(
  ordered.map((item) => item.assetId),
  ["avatar-18", "avatar-17", "avatar-16", "legacy"],
  "头像必须按永久存储编号倒序，未编号旧素材排在编号素材之后",
);
assert.deepEqual(sourceItems.map((item) => item.assetId), [
  "avatar-16",
  "avatar-18",
  "avatar-17",
  "legacy",
], "排序不得改写素材源数组");
assert.equal(contract.CUSTOMER_SERVICE_FIXED_EXPERT_SEQUENCE_END, 12);
assert.equal(contract.CUSTOMER_SERVICE_RESERVED_AVATAR_SEQUENCE_END, 15);
assert.equal(contract.CUSTOMER_SERVICE_NEW_AVATAR_SEQUENCE_START, 16);
assert.equal(contract.resolveStoredAvatarMaterialSequence("01.expert.png"), 1);
assert.equal(contract.resolveStoredAvatarMaterialSequence("15.backup.webm"), 15);
assert.equal(contract.resolveStoredAvatarMaterialSequence("18.latest.png"), 18);
assert.equal(contract.resolveStoredAvatarMaterialSequence("portrait.png"), undefined);
assert.equal(contract.formatUploadedAvatarDisplayFileName("18.latest.png", 18), "18.latest");
assert.equal(contract.formatUploadedAvatarDisplayFileName("portrait.png", 16), "16.portrait");

const productMarketSource = await readFile("src/pages/ProductMarket.tsx", "utf8");
assert.match(productMarketSource, /resolveAvatarMaterialDisplaySequence\(asset\.fileName\)/u, "头像弹窗必须读取稳定素材编号");
assert.match(productMarketSource, /avatar\.expertOrder \|\| resolveStoredAvatarMaterialSequence/u, "内置专家与备用头像必须读取固定编号");
assert.match(productMarketSource, /qionyun:\s*4/u, "旧版QionYun头像必须固定映射到04占新专家");
assert.doesNotMatch(productMarketSource, /avatarSequence:\s*materialPickerTarget[\s\S]{0,120}index \+ 1/u, "头像编号不得再使用当前列表位置");
assert.doesNotMatch(productMarketSource, /avatarSequence:\s*storedEntries\.length/u, "新增素材不得推动内置01–15编号");
assert.match(productMarketSource, /compareNewestLargeSequenceFirst/u, "全部专家分组内必须读取共享最新大号优先排序");

const femaleFiltered = ordered.filter((item) => item.assetId === "avatar-17");
assert.equal(
  contract.formatUploadedAvatarDisplayFileName(
    femaleFiltered[0].fileName,
    contract.resolveStoredAvatarMaterialSequence(femaleFiltered[0].fileName),
  ),
  "17.middle",
  "筛选后必须继续显示文件名前缀编号，不能重新编号为01",
);

console.log("客服头像排序契约通过：专家01-12、备用13-15固定，新素材沿用16+文件名前缀且筛选不重编号。");
