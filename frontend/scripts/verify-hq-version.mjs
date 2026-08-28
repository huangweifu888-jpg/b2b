import { readFile } from "node:fs/promises";
import { fingerprintSources, manifestFile, readTrackedSources, softwareVersionFile } from "./hq-version-utils.mjs";

const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
const currentSources = await readTrackedSources();
const currentFingerprint = fingerprintSources(currentSources);
const versionSource = await readFile(softwareVersionFile, "utf8");

if (!/^H38\d{3,}$/.test(String(manifest.version || "")) || !Number.isInteger(manifest.sequence) || manifest.version !== `H${manifest.sequence}`) {
  throw new Error("总部版本必须从 H38606 会话封口基线连续自动推进。");
}
if (manifest.sourceFingerprint !== currentFingerprint) {
  throw new Error("受跟踪源码已有变动但总部版本尚未推进；请通过 npm run build 自动生成下一条总部 H 版本记录。");
}
if (!versionSource.includes(`HQ_SOFTWARE_VERSION = \"${manifest.version}\"`) || !versionSource.includes(`HQ_SOFTWARE_VERSION_NUMBER = ${manifest.sequence}`) || !versionSource.includes(`HQ_SOURCE_FINGERPRINT = \"${manifest.sourceFingerprint}\"`)) {
  throw new Error("总部版本显示常量与自动版本清单不一致。");
}
if (!Array.isArray(manifest.verification) || !manifest.verification.length || !manifest.restorePoint?.version || manifest.restorePoint.version !== manifest.version) {
  throw new Error("总部版本记录必须包含验证结论与同版本恢复点。");
}
if (!Array.isArray(manifest.changedFiles)) {
  throw new Error("总部版本记录必须包含受跟踪源码变更清单。");
}
if (!String(manifest.summary || "").trim() || !String(manifest.title || "").trim()) {
  throw new Error("总部版本记录必须包含更新标题与变更说明。");
}

console.log(`总部 ${manifest.version} 自动源码版本记录、验证结论与恢复点已验证。`);
