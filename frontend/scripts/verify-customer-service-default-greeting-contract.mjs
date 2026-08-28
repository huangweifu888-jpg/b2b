import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export * from "./src/lib/customer-service-default-greeting.ts";`,
    resolveDir: process.cwd(),
    sourcefile: "customer-service-default-greeting-entry.ts",
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
const fixtures = [
  ["identity", "蓄势专家", "professional", "您好，我是蓄势专家，机会判断交我！"],
  ["content", "布场专家", "cute", "嗨呀，我是布场专家，内容点亮交我！"],
  ["trust", "营搜专家", "elegant", "幸会，我是营搜专家，信任建立交我！"],
  ["recommend", "占新专家", "tech", "收到，我是占新专家，推荐匹配交我！"],
  ["deepen", "圈养专家", "friendly", "嗨喽，我是圈养专家，社媒互动交我！"],
  ["portrait", "锁客专家", "friendly", "你好，我是锁客专家，客户画像交我！"],
  ["lead", "精投专家", "strong", "来啦，我是精投专家，获客投放交我！"],
  ["convert", "承转专家", "professional", "放心，我是承转专家，成交推进交我！"],
  ["fulfillment", "强链专家", "strong", "稳住，我是强链专家，履约交付交我！"],
  ["care", "深养专家", "elegant", "暖心，我是深养专家，客户关怀交我！"],
  ["decision", "驭数专家", "tech", "明白，我是驭数专家，数据决策交我！"],
  ["operations", "固本专家", "professional", "好的，我是固本专家，经营闭环交我！"],
];

const greetings = fixtures.map(([categoryKey, name, style, expected], index) => {
  const greeting = contract.buildCustomerServiceDefaultGreeting({
    id: `expert-${categoryKey}`,
    name,
    categoryKey,
    style,
    order: index + 1,
  });
  assert.equal(greeting, expected, `${name}默认招呼必须读取稳定性格模板`);
  assert.equal(Array.from(greeting).length, 17, `${name}默认招呼必须严格为17个字符`);
  const nameCharacters = Array.from(name);
  const spokenName = nameCharacters.length <= 4
    ? nameCharacters.join("")
    : `${nameCharacters.slice(0, 3).join("")}…`;
  assert.ok(greeting.includes(spokenName), `${name}默认招呼必须包含当前专家名称或其规范省略形式`);
  return greeting;
});
assert.equal(new Set(greetings).size, fixtures.length, "12位专家必须使用不同招呼语气");

const longNameGreeting = contract.buildCustomerServiceDefaultGreeting(
  { id: "expert-long", name: "蓄势专家", categoryKey: "identity", style: "professional", order: 1 },
  "邱杨邱杨邱杨",
);
assert.equal(Array.from(longNameGreeting).length, 17);
assert.ok(longNameGreeting.includes("邱杨邱…"), "长名称必须以三字加省略号进入17字招呼");

const shortNameGreeting = contract.buildCustomerServiceDefaultGreeting(
  { id: "expert-short", name: "蓄势专家", categoryKey: "identity", style: "professional", order: 1 },
  "小美",
);
assert.equal(shortNameGreeting, "您好，我是小美，机会判断交我就行！");
assert.equal(Array.from(shortNameGreeting).length, 17);

const [storeSource, expertContractSource, productMarketSource, aiChatSource, sidebarSource] = await Promise.all([
  readFile("src/lib/product-market-store.ts", "utf8"),
  readFile("src/lib/customer-service-expert-contract.ts", "utf8"),
  readFile("src/pages/ProductMarket.tsx", "utf8"),
  readFile("src/pages/AIChat.tsx", "utf8"),
  readFile("src/components/Sidebar.tsx", "utf8"),
]);

assert.match(storeSource, /greeting:\s*buildCustomerServiceDefaultGreeting/u, "专家预设必须读取17字默认招呼");
assert.match(expertContractSource, /customGreetingText\s*\|\|\s*buildCustomerServiceDefaultGreeting/u, "手动招呼必须优先于默认招呼");
assert.match(productMarketSource, /selectedAvatarCustomGreetingTextDraft/u, "编辑器必须区分手动招呼与默认招呼");
assert.match(productMarketSource, /buildCustomerServiceDefaultGreeting\(selectedAvatarPreset, selectedAvatarDisplayNameDraft\)/u, "名称变化必须刷新默认招呼");
assert.match(aiChatSource, /greeting:\s*expertProfile\.greetingText/u, "发布站点快照必须读取共享招呼");
assert.match(sidebarSource, /greeting:\s*selectedCategoryExpertProfile\?\.greetingDisplay/u, "侧栏专家弹窗必须读取共享招呼");

console.log("客服默认招呼契约通过：12位专家按名称和性格生成不同的17字符招呼，自定义内容优先。 ");
