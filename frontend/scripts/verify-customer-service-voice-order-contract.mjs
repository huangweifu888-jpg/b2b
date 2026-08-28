import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export * from "./src/lib/customer-service-voice-material-order.ts";`,
    resolveDir: process.cwd(),
    sourcefile: "customer-service-voice-order-contract-entry.ts",
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
  { assetId: "voice-16", fileName: "16.first.wav", createdAt: "2026-08-24T08:00:00.000Z", systemManaged: false },
  { assetId: "voice-18", fileName: "18.latest.wav", createdAt: "2026-08-20T08:00:00.000Z", systemManaged: false },
  { assetId: "voice-17", fileName: "17.middle.wav", createdAt: "2026-08-23T08:00:00.000Z", systemManaged: false },
];

assert.deepEqual(
  contract.orderUploadedVoiceMaterialsNewestFirst(sourceItems).map((item) => item.assetId),
  ["voice-18", "voice-17", "voice-16"],
  "新增朗音必须按16+永久编号倒序显示",
);
const sharedLibrary = [
  { assetId: "system-12", fileName: "12.germany.wav", createdAt: "2026-08-23T08:00:00.000Z", systemManaged: true },
  { assetId: "system-01", fileName: "01.xushi.wav", createdAt: "2026-08-23T08:00:00.000Z", systemManaged: true },
  { assetId: "system-02", fileName: "02.buchang.wav", createdAt: "2026-08-23T08:00:00.000Z", systemManaged: true },
  { assetId: "uploaded-17", fileName: "17.custom.wav", createdAt: "2026-08-24T08:00:00.000Z", systemManaged: false },
  { assetId: "uploaded-16", fileName: "16.custom.wav", createdAt: "2026-08-25T08:00:00.000Z", systemManaged: false },
];
assert.deepEqual(
  contract.orderCustomerServiceVoiceLibrary(sharedLibrary).map((item) => item.assetId),
  ["uploaded-17", "uploaded-16", "system-12", "system-02", "system-01"],
  "系统01-12与新增16+必须按最新大号优先合并排序",
);
assert.equal(contract.CUSTOMER_SERVICE_FIXED_VOICE_SEQUENCE_END, 12);
assert.equal(contract.CUSTOMER_SERVICE_NEW_VOICE_SEQUENCE_START, 16);
assert.equal(contract.resolveStoredVoiceMaterialSequence("03.yingsou-nansheng.wav"), 3);
assert.equal(contract.resolveStoredVoiceMaterialSequence("12.guben-nansheng.wav"), 12);
assert.equal(contract.resolveStoredVoiceMaterialSequence("18.custom.wav"), 18);
assert.equal(contract.resolveStoredVoiceMaterialSequence("voice-upload.wav"), undefined);
assert.equal(contract.formatCustomerServiceVoiceLibraryDisplayFileName("12.germany.wav", 12), "12.germany.wav");
assert.equal(contract.formatCustomerServiceVoiceLibraryDisplayFileName("18.custom.wav", 18), "18.custom.wav");

const productMarketSource = await readFile("src/pages/ProductMarket.tsx", "utf8");
assert.match(productMarketSource, /systemVoiceSequence \|\| resolveStoredVoiceMaterialSequence\(asset\.fileName\)/u, "上传声音必须读取稳定文件编号");
assert.match(productMarketSource, /CUSTOMER_SERVICE_NEW_VOICE_SEQUENCE_START - 1/u, "新声音必须从保留区后的16开始编号");
assert.doesNotMatch(productMarketSource, /systemVoiceSequence \|\| index \+ 1/u, "声音分类与筛选不得按列表位置重新编号");
assert.match(productMarketSource, /voiceSequence: resolveStoredVoiceMaterialSequence\(preset\.localAsset\.fileName\)/u, "系统提醒声音必须进入共享编号排序");
assert.match(productMarketSource, /compareNewestLargeSequenceFirst/u, "朗音与提醒声音分组内必须读取共享最新大号优先排序");

const maleFiltered = contract.orderCustomerServiceVoiceLibrary(sharedLibrary.filter((item) => (
  item.assetId === "system-12" || item.assetId === "uploaded-17"
)));
assert.deepEqual(
  maleFiltered.map((item) => contract.resolveStoredVoiceMaterialSequence(item.fileName)),
  [17, 12],
  "声音分类筛选后必须保留原文件编号，不能重排为01、02",
);

console.log("客服朗音素材排序契约通过：系统01-12固定，新声音沿用16+文件名前缀，素材库按最新大号优先且分类筛选不重编号。");
