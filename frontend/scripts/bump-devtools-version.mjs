import { readFile, writeFile } from "node:fs/promises";
import { calculateDevtoolsSourceFingerprint, changelogFile, ensureDevtoolsStore, snapshotDevtoolsRelease, today, usage, versionFile } from "./devtools-version-utils.mjs";

const args = process.argv.slice(2);
const valuesFor = (name) => args.flatMap((value, index) => value === name && args[index + 1] ? [args[index + 1].trim()] : []);
const oneValue = (name) => valuesFor(name)[0] || "";
const title = oneValue("--title");
const summary = oneValue("--summary");
const lessons = valuesFor("--lesson");
const verification = valuesFor("--verified");

if (!title || !summary || !lessons.length || !verification.length) {
  throw new Error(`${usage()}\n--lesson 与 --verified 可以重复传入多次。`);
}

await ensureDevtoolsStore();
const current = JSON.parse(await readFile(versionFile, "utf8"));
const currentSequence = Number(current.sequence || String(current.version || "").replace(/^W/, ""));
if (!Number.isInteger(currentSequence) || currentSequence < 1) {
  throw new Error("当前 VERSION.json 不是有效的 W 版本，不能自动递增。");
}

const sequence = currentSequence + 1;
const version = `W${sequence}`;
const updatedAt = today();
const next = {
  ...current,
  version,
  sequence,
  layoutRevision: sequence,
  updatedAt,
  title,
  summary,
  learningRules: lessons,
  verification,
  sourceFingerprint: await calculateDevtoolsSourceFingerprint(),
};
await writeFile(versionFile, `${JSON.stringify(next, null, 2)}\n`, "utf8");

const changeEntry = [
  `## ${version} - ${updatedAt}`,
  "",
  `**${title}**`,
  "",
  `- ${summary}`,
  "",
  "**本次经验规则**",
  "",
  ...lessons.map((lesson) => `- ${lesson}`),
  "",
  "**本地验证**",
  "",
  ...verification.map((item) => `- ${item}`),
  "",
].join("\n");
const changelog = await readFile(changelogFile, "utf8");
await writeFile(changelogFile, changelog.replace("# Changelog\n", `# Changelog\n\n${changeEntry}`), "utf8");
await snapshotDevtoolsRelease(next);

console.log(`已生成 ${version}：${title}，并保存本地源码快照。`);
