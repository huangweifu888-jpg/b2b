import { readFile } from "node:fs/promises";

import { ensureDevtoolsStore, snapshotDevtoolsRelease, versionFile } from "./devtools-version-utils.mjs";

const replace = process.argv.includes("--replace");
await ensureDevtoolsStore();
const versionInfo = JSON.parse(await readFile(versionFile, "utf8"));
const releaseDirectory = await snapshotDevtoolsRelease(versionInfo, { replace });
console.log(`已保存 ${versionInfo.version} 本地源码快照：${releaseDirectory}`);
