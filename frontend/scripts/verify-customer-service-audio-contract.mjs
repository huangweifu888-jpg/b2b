import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { build } from "esbuild";

const frontendRoot = process.cwd();
const repositoryRoot = resolve(frontendRoot, "..");
const workspaceRoot = resolve(repositoryRoot, "..");
const configuredPathRegistry = (process.env.B2B_PATH_REGISTRY_FILE || "").trim();
const pathRegistryPath = configuredPathRegistry
  ? isAbsolute(configuredPathRegistry)
    ? configuredPathRegistry
    : resolve(workspaceRoot, configuredPathRegistry)
  : resolve(workspaceRoot, "local-data", "config", "path-registry.json");
let pathRegistry = {};
try {
  pathRegistry = JSON.parse(await readFile(pathRegistryPath, "utf8"));
} catch {
  // The checked-in workspace-relative default remains the only fallback. The
  // verifier never creates private storage or mutates the operator registry.
}
const configuredAssetRoot = typeof pathRegistry.assetResourceRoot === "string"
  ? pathRegistry.assetResourceRoot.trim()
  : "";
const privateAssetRoot = configuredAssetRoot
  ? isAbsolute(configuredAssetRoot)
    ? resolve(configuredAssetRoot)
    : resolve(workspaceRoot, configuredAssetRoot)
  : resolve(workspaceRoot, "local-data", "objects", "asset-private");
const privateVoiceManifestPath = resolve(privateAssetRoot, "_customer_service_voice_manifest.json");

assert.ok(
  relative(repositoryRoot, privateAssetRoot).startsWith(".."),
  "朗音素材根目录必须位于源码仓之外的私有素材库",
);

function readPcmWaveMetadata(wave, fileName) {
  assert.ok(wave.length >= 44, `${fileName}不是完整的 WAV 文件`);
  assert.equal(wave.subarray(0, 4).toString("ascii"), "RIFF", `${fileName}缺少RIFF头`);
  assert.equal(wave.subarray(8, 12).toString("ascii"), "WAVE", `${fileName}缺少WAVE头`);
  let format;
  let dataBytes;
  for (let offset = 12; offset + 8 <= wave.length;) {
    const chunkName = wave.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = wave.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    assert.ok(chunkStart + chunkSize <= wave.length, `${fileName}包含越界的 ${chunkName} 块`);
    if (chunkName === "fmt ") {
      assert.ok(chunkSize >= 16, `${fileName}的 fmt 块不完整`);
      format = {
        audioFormat: wave.readUInt16LE(chunkStart),
        channels: wave.readUInt16LE(chunkStart + 2),
        sampleRate: wave.readUInt32LE(chunkStart + 4),
        byteRate: wave.readUInt32LE(chunkStart + 8),
        bitDepth: wave.readUInt16LE(chunkStart + 14),
      };
    } else if (chunkName === "data") {
      dataBytes = chunkSize;
    }
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }
  assert.ok(format, `${fileName}缺少 fmt 块`);
  assert.ok(typeof dataBytes === "number" && dataBytes > 0, `${fileName}缺少有效 data 块`);
  return { ...format, dataBytes, durationSeconds: dataBytes / format.byteRate };
}

const bundle = await build({
  stdin: {
    contents: `
      export * from "./src/lib/customer-service-audio-roster.ts";
      export * from "./src/lib/customer-service-voice.ts";
      export * from "./src/lib/customer-service-reminder-sound.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "customer-service-audio-contract-entry.ts",
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
const roster = contract.CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER;
const voices = contract.CUSTOMER_SERVICE_VOICE_PRESETS;
const reminders = contract.CUSTOMER_SERVICE_REMINDER_SOUND_PRESETS;
const expectedStageNames = ["蓄势", "布场", "营搜", "占新", "圈养", "锁客", "精投", "承转", "强链", "深养", "驭数", "固本"];
assert.deepEqual(roster.map((item) => item.shortName), expectedStageNames, "专家01-12必须读取左侧栏业务阶段名称");
assert.deepEqual(
  roster.map((item) => item.expertName),
  expectedStageNames.map((name) => `${name}专家`),
  "专家完整名称必须与同号左侧栏阶段一致",
);

assert.equal(roster.length, 12, "专家音频名册必须严格为12位");
assert.equal(voices.length, 12, "专家朗音必须严格为12种");
assert.equal(reminders.length, 12, "专家提醒音必须严格为12种");

const expectedAnimations = [
  "pulse",
  "float",
  "bounce",
  "glow",
  "flip-roll",
  "spin-slow",
  "breathe",
  "sway",
  "heartbeat",
  "wobble",
  "wave",
  "tilt",
];
assert.deepEqual(
  roster.map((item) => item.animationStyleKey),
  expectedAnimations,
  "01-12专家效果必须按共享顺序逐项匹配",
);

for (const [label, values] of [
  ["专家ID", roster.map((item) => item.avatarId)],
  ["朗音key", voices.map((item) => item.key)],
  ["朗音本地素材ID", voices.map((item) => item.localAsset?.assetId)],
  ["朗音本地文件", voices.map((item) => item.localAsset?.fileName)],
  ["朗音本地地址", voices.map((item) => item.localAsset?.url)],
  ["提醒音key", reminders.map((item) => item.key)],
  ["提醒音声学参数", reminders.map((item) => [item.frequency, item.endFrequency, item.duration, item.oscillator, item.detune || 0].join("|"))],
  ["提醒音本地文件", reminders.map((item) => item.localAsset?.fileName)],
  ["提醒音本地地址", reminders.map((item) => item.localAsset?.url)],
]) {
  assert.equal(new Set(values).size, 12, `${label}必须一一唯一`);
}

const zodiacReminderNames = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];

roster.forEach((expert, index) => {
  const expectedNumber = String(index + 1).padStart(2, "0");
  const expectedGender = index % 3 === 2 ? "male" : "female";
  const voice = voices[index];
  const reminder = reminders[index];
  assert.equal(expert.orderLabel, expectedNumber, `专家${index + 1}编号错误`);
  assert.equal(expert.gender, expectedGender, `专家${expectedNumber}未遵循女、女、男循环`);
  assert.equal(expert.animationStyleKey, expectedAnimations[index], `专家${expectedNumber}效果映射错误`);
  assert.equal(voice.key, expert.voiceStyleKey, `专家${expectedNumber}朗音映射错误`);
  assert.equal(voice.gender, expectedGender, `朗音${expectedNumber}性别错误`);
  assert.match(voice.label, new RegExp(`^${expectedNumber}\\.${expert.shortName}`), `朗音${expectedNumber}缺少专家名称`);
  assert.equal(voice.localAsset?.assetId, `customer-service-voice-expert-${expectedNumber}`, `朗音${expectedNumber}私有素材ID错误`);
  assert.equal(voice.localAsset?.fileName, voice.storageFileName, `朗音${expectedNumber}本地文件名与存储契约不一致`);
  assert.match(voice.localAsset?.fileName || "", new RegExp(`^${expectedNumber}\\..+\\.wav$`), `朗音${expectedNumber}本地文件缺少编号`);
  assert.equal(
    voice.localAsset?.url,
    `/api/v1/local-dev/material-assets/${voice.localAsset?.assetId}/content`,
    `朗音${expectedNumber}必须通过私有素材接口读取`,
  );
  assert.equal(voice.localAsset?.mimeType, "audio/wav", `朗音${expectedNumber}必须使用 WAV 格式`);
  assert.equal(voice.localAsset?.source, "local-private-tts", `朗音${expectedNumber}必须标记为私有本地合成素材`);
  assert.equal(Array.from(voice.localAsset?.transcript || "").length, 17, `朗音${expectedNumber}试听文案必须严格为17字`);
  const expertNameCharacters = Array.from(expert.expertName);
  const spokenExpertName = expertNameCharacters.length <= 4
    ? expertNameCharacters.join("")
    : `${expertNameCharacters.slice(0, 3).join("")}…`;
  assert.ok(
    (voice.localAsset?.transcript || "").includes(spokenExpertName),
    `朗音${expectedNumber}试听文案缺少专家名称`,
  );
  assert.ok(!voice.localAsset?.url.startsWith("/assets/"), `朗音${expectedNumber}不得暴露为公共静态资源`);
  assert.equal(reminder.key, expert.reminderStyleKey, `专家${expectedNumber}提醒音映射错误`);
  assert.equal(reminder.label, `${expectedNumber}.${zodiacReminderNames[index]}声音`, `提醒音${expectedNumber}未遵循生肖命名`);
  assert.equal(
    reminder.coverAsset?.url,
    `/assets/customer-service/reminder-covers/zodiac-250/${reminder.localAsset?.fileName?.replace(/\.wav$/u, ".webp")}`,
    `提醒音${expectedNumber}生肖封面地址错误`,
  );
  assert.equal(reminder.localAsset?.source, "original-generated", `提醒音${expectedNumber}必须登记为原创本地音频`);
  assert.equal(reminder.localAsset?.mimeType, "audio/wav", `提醒音${expectedNumber}必须使用浏览器通用 WAV 格式`);
  assert.match(reminder.localAsset?.fileName || "", new RegExp(`^${expectedNumber}-.*\\.wav$`), `提醒音${expectedNumber}本地文件缺少编号`);
  assert.equal(reminder.localAsset?.url, `/assets/customer-service/reminder-tones/${reminder.localAsset?.fileName}`, `提醒音${expectedNumber}本地地址错误`);
  assert.equal(contract.getDefaultVoiceStyleForAvatar(expert.avatarId), voice.key);
  assert.equal(contract.getDefaultVoiceGenderForAvatar(expert.avatarId), expectedGender);
  assert.equal(contract.resolveCustomerServiceReminderStyle(expert.avatarId), reminder.key);
});

const styledReminderOverride = {
  soundStyle: "expert-reminder-01",
  soundAssetId: "legacy-flat-a",
  soundAssetFileName: "legacy-flat-a.wav",
  soundAssetsByStyle: {
    "expert-reminder-01": { assetId: "slot-a", fileName: "slot-a.wav", mimeType: "audio/wav" },
  },
};
assert.equal(
  contract.resolveCustomerServiceReminderAssetRef(styledReminderOverride, "expert-reminder-01").assetId,
  "slot-a",
  "The selected replacement slot must resolve its own asset",
);
assert.deepEqual(
  contract.resolveCustomerServiceReminderAssetRef(styledReminderOverride, "expert-reminder-02"),
  {},
  "An unmodified reminder slot must not inherit another slot's flat compatibility asset",
);
const legacyFlatReminderOverride = {
  soundStyle: "expert-reminder-02",
  soundAssetId: "legacy-flat-b",
  soundAssetFileName: "legacy-flat-b.wav",
};
assert.equal(
  contract.resolveCustomerServiceReminderAssetRef(legacyFlatReminderOverride, "expert-reminder-02").assetId,
  "legacy-flat-b",
  "A matching legacy flat reminder asset must remain compatible",
);
assert.deepEqual(
  contract.resolveCustomerServiceReminderAssetRef(legacyFlatReminderOverride, "expert-reminder-01"),
  {},
  "A legacy flat reminder asset must not leak into a different style",
);
assert.equal(
  contract.resolveCustomerServiceReminderMigrationStyle(roster[0].avatarId, "expert-reminder-12"),
  "expert-reminder-12",
  "The local-asset contract upgrade must preserve an existing numbered selection",
);
assert.equal(
  contract.resolveCustomerServiceReminderMigrationStyle(roster[0].avatarId, "crisp"),
  roster[0].reminderStyleKey,
  "A six-style legacy selection must migrate to the expert's numbered reminder",
);
assert.equal(
  contract.CUSTOMER_SERVICE_VOICE_CONTRACT_VERSION,
  "expert-voice-local-assets-v2",
  "朗音本地素材必须使用 v2 契约",
);
const migratedNumberedVoice = contract.resolveCustomerServiceVoiceMigrationPreset(
  roster[0].avatarId,
  "expert-12",
);
assert.equal(
  migratedNumberedVoice.key,
  "expert-12",
  "v1→v2 升级必须保留已有的 expert-12 编号朗音选择",
);
assert.equal(
  migratedNumberedVoice.gender,
  "male",
  "保留 expert-12 时必须同时保留该编号的男声契约",
);

const reminderHashes = [];
for (const reminder of reminders) {
  const wave = await readFile(`public${reminder.localAsset.url}`);
  reminderHashes.push(createHash("sha256").update(wave).digest("hex"));
  assert.equal(wave.subarray(0, 4).toString("ascii"), "RIFF", `${reminder.localAsset.fileName}缺少RIFF头`);
  assert.equal(wave.subarray(8, 12).toString("ascii"), "WAVE", `${reminder.localAsset.fileName}缺少WAVE头`);
  assert.equal(wave.readUInt16LE(20), 1, `${reminder.localAsset.fileName}必须为PCM`);
  assert.equal(wave.readUInt16LE(22), 1, `${reminder.localAsset.fileName}必须为单声道`);
  assert.equal(wave.readUInt32LE(24), 32_000, `${reminder.localAsset.fileName}采样率必须为32000Hz`);
  assert.equal(wave.readUInt16LE(34), 16, `${reminder.localAsset.fileName}必须为16位音频`);
  assert.ok(wave.length >= 20_000 && wave.length <= 50_000, `${reminder.localAsset.fileName}应保持短促且适合网页加载`);
}
assert.equal(new Set(reminderHashes).size, 12, "All twelve local reminder files must have different audio data");

const privateVoiceManifest = JSON.parse(await readFile(privateVoiceManifestPath, "utf8"));
assert.equal(
  privateVoiceManifest.contractVersion,
  contract.CUSTOMER_SERVICE_VOICE_CONTRACT_VERSION,
  "私有朗音清单与前端朗音契约版本不一致",
);
assert.match(
  privateVoiceManifest.syntheticDisclosure || "",
  /本地合成语音/u,
  "私有朗音清单必须披露本地合成属性",
);
assert.ok(Array.isArray(privateVoiceManifest.items), "私有朗音清单缺少 items 数组");
assert.equal(privateVoiceManifest.items.length, 12, "私有朗音清单必须严格登记12项");
for (const [label, values] of [
  ["私有清单素材ID", privateVoiceManifest.items.map((item) => item.assetId)],
  ["私有清单文件名", privateVoiceManifest.items.map((item) => item.fileName)],
  ["私有清单地址", privateVoiceManifest.items.map((item) => item.url)],
  ["私有清单sha256", privateVoiceManifest.items.map((item) => item.sha256)],
]) {
  assert.equal(new Set(values).size, 12, `${label}必须一一唯一`);
}

const voiceHashes = [];
for (const [index, voice] of voices.entries()) {
  const expectedNumber = String(index + 1).padStart(2, "0");
  const manifestItem = privateVoiceManifest.items[index];
  assert.equal(manifestItem.styleKey, voice.key, `私有朗音${expectedNumber}顺序或 styleKey 错误`);
  assert.equal(manifestItem.gender, voice.gender, `私有朗音${expectedNumber}性别错误`);
  assert.equal(manifestItem.assetId, voice.localAsset.assetId, `私有朗音${expectedNumber}素材ID错误`);
  assert.equal(manifestItem.fileName, voice.localAsset.fileName, `私有朗音${expectedNumber}文件名错误`);
  assert.equal(manifestItem.url, voice.localAsset.url, `私有朗音${expectedNumber}地址错误`);
  assert.equal(manifestItem.transcript, voice.localAsset.transcript, `私有朗音${expectedNumber}试听文案与前端契约不一致`);
  assert.equal(manifestItem.synthetic, true, `私有朗音${expectedNumber}必须披露为合成语音`);
  assert.equal(manifestItem.systemManaged, true, `私有朗音${expectedNumber}必须标记为受保护的系统默认素材`);
  assert.equal(
    manifestItem.distributionScope,
    "local-private-material-library",
    `私有朗音${expectedNumber}不得登记为公共分发素材`,
  );
  assert.equal(manifestItem.sampleRate, 22_050, `私有朗音${expectedNumber}清单采样率错误`);
  assert.equal(manifestItem.channels, 1, `私有朗音${expectedNumber}清单声道数错误`);
  assert.equal(manifestItem.bitDepth, 16, `私有朗音${expectedNumber}清单位深错误`);

  const voiceFilePath = resolve(privateAssetRoot, "files", manifestItem.fileName);
  assert.ok(
    !relative(resolve(privateAssetRoot, "files"), voiceFilePath).startsWith(".."),
    `私有朗音${expectedNumber}文件路径越过私有素材目录`,
  );
  const wave = await readFile(voiceFilePath);
  const metadata = readPcmWaveMetadata(wave, manifestItem.fileName);
  assert.equal(metadata.audioFormat, 1, `${manifestItem.fileName}必须为PCM`);
  assert.equal(metadata.channels, 1, `${manifestItem.fileName}必须为单声道`);
  assert.equal(metadata.sampleRate, 22_050, `${manifestItem.fileName}采样率必须为22050Hz`);
  assert.equal(metadata.bitDepth, 16, `${manifestItem.fileName}必须为16位音频`);
  assert.ok(
    metadata.durationSeconds >= 2 && metadata.durationSeconds <= 12,
    `${manifestItem.fileName}时长必须在2至12秒之间`,
  );
  assert.ok(
    Math.abs(Number(manifestItem.durationSeconds) - metadata.durationSeconds) <= 0.01,
    `${manifestItem.fileName}实际时长与私有清单不一致`,
  );
  const digest = createHash("sha256").update(wave).digest("hex");
  voiceHashes.push(digest);
  assert.equal(digest, manifestItem.sha256, `${manifestItem.fileName}实际摘要与私有清单不一致`);
}
assert.equal(new Set(voiceHashes).size, 12, "12个私有本地朗音文件必须具有不同音频数据");

for (const legacyVoiceKey of Object.keys(contract.LEGACY_CUSTOMER_SERVICE_VOICE_STYLE_ALIAS_MAP)) {
  const gender = legacyVoiceKey.endsWith("-male") ? "male" : "female";
  assert.equal(contract.getCustomerServiceVoicePreset(legacyVoiceKey, gender).gender, gender);
}
for (const legacyReminder of contract.LEGACY_CUSTOMER_SERVICE_REMINDER_SOUND_PRESETS) {
  assert.equal(contract.getCustomerServiceReminderPreset(legacyReminder.key)?.key, legacyReminder.key);
}

const [widgetSource, siteBuilderSource, storeSource, clickSoundSource, productMarketSource, voicePreviewRuntimeSource, aiChatSource, voiceGeneratorSource, materialApiSource, aiHubSource] = await Promise.all([
  readFile("src/components/AIServiceWidget.tsx", "utf8"),
  readFile("src/lib/ai-site-builder.ts", "utf8"),
  readFile("src/lib/product-market-store.ts", "utf8"),
  readFile("src/lib/click-sound.ts", "utf8"),
  readFile("src/pages/ProductMarket.tsx", "utf8"),
  readFile("src/lib/customer-service-voice-preview-runtime.ts", "utf8"),
  readFile("src/pages/AIChat.tsx", "utf8"),
  readFile("scripts/generate-customer-service-voice-assets.py", "utf8"),
  readFile(resolve(repositoryRoot, "backend", "routers", "local_dev.py"), "utf8"),
  readFile(resolve(repositoryRoot, "backend", "services", "aihub.py"), "utf8"),
]);
const sharedStyleSource = await readFile("src/index.css", "utf8");
assert.match(widgetSource, /resolveVoicePresetAssetFromOverrides/u, "应用内客服必须解析专家上传的朗音素材");
assert.match(widgetSource, /if \(uploadedVoiceUrl\)/u, "应用内客服必须优先播放专家上传的朗音素材");
assert.match(
  widgetSource,
  /normalizedText === localVoiceAsset\.transcript/u,
  "应用内客服只有在文字与本地样音文案完全一致时才允许播放固定样音",
);
const widgetUploadedVoiceBranch = widgetSource.indexOf("if (uploadedVoiceUrl)");
const widgetLocalVoiceBranch = widgetSource.indexOf("const localVoiceAsset = effectiveVoicePreset.localAsset");
const widgetGeneratedVoiceBranch = widgetSource.indexOf("const generated = await aiProviderApi.generateAudio", widgetLocalVoiceBranch);
assert(
  widgetUploadedVoiceBranch >= 0
    && widgetUploadedVoiceBranch < widgetLocalVoiceBranch
    && widgetLocalVoiceBranch < widgetGeneratedVoiceBranch,
  "应用内朗音必须按上传替换、本地完全匹配样音、动态TTS的顺序播放",
);
assert.match(widgetSource, /preservesPitch = true/u, "应用内朗音加速时必须保留原始男女音高");
assert.doesNotMatch(widgetSource, /preservesPitch = false/u, "应用内朗音不得因加速抬高男性音高");
assert.match(widgetSource, /playGreetingSound\(\)/u, "专家出现时必须触发对应提醒音");
assert.match(widgetSource, /playExpertAppearanceSound\(requestedExpertId\)/u, "指定专家出现时必须触发该专家提醒音");
assert.match(widgetSource, /playExpertAppearanceSound\(pendingExpert\.id\)/u, "切换专家时必须触发新专家提醒音");
assert.match(widgetSource, /const expertReminderAsset = resolveReminderSoundAssetFields\(expertOverride, expertStyle\)/u, "Expert switching must resolve the target expert's replacement slot");
assert.match(widgetSource, /readCustomerServiceMedia\(expertReminderAsset\.assetId\)/u, "Expert switching must load the target expert's replacement sound");
assert.match(widgetSource, /playClickSoundWithConfig\("click"/u, "消息发送时必须触发对应提醒音");
assert.match(widgetSource, /resolveCustomerServiceExpertSequenceMatch\(avatarPreset\.id/u, "应用内客服必须统一解析当前专家的编号匹配");
assert.match(widgetSource, /resolveCustomerServiceExpertSequenceMatch\(expertId, expertOverride/u, "专家出现时必须按目标专家编号解析提醒音");
assert.match(widgetSource, /style: avatar\.soundStyle/u, "消息发送提醒音必须复用当前专家的编号提醒音");
const reminderResetBranch = widgetSource.indexOf("if (active) setUploadedReminderSoundUrl(null)");
const reminderAssetReadBranch = widgetSource.indexOf("readCustomerServiceMedia(effectiveReminderSoundAsset.assetId)", reminderResetBranch);
assert(
  reminderResetBranch >= 0 && reminderResetBranch < reminderAssetReadBranch,
  "切换专家时必须先清空上一位专家的上传提醒音，再异步读取新编号素材",
);
assert.match(clickSoundSource, /getCustomerServiceReminderPreset\(styleKey\)\?\.localAsset/u, "应用内默认提醒音必须优先读取本地文件");
assert.match(clickSoundSource, /new Audio\(localAsset\.url\)/u, "应用内必须使用本地提醒音文件播放");
assert.match(clickSoundSource, /audio\.play\(\)\.catch\(fallbackToSynthetic\)/u, "A missing local reminder file must fall back to synthesis");
assert.match(productMarketSource, /data-customer-service-reminder-local-file/u, "提醒音选择卡必须登记本地文件");
assert.match(productMarketSource, /data-customer-service-shared-slider="volume"/u, "Customer-service volume must use the shared slider contract");
assert.match(productMarketSource, /data-customer-service-shared-slider="voice-rate"/u, "Customer-service voice rate must use the shared slider contract");
assert.match(productMarketSource, /data-customer-service-reminder-style/u, "Reminder cards must expose their stable numbered style key");
assert.match(productMarketSource, /aria-pressed=\{selected\}/u, "Reminder cards must expose their selected state accessibly");
assert.match(productMarketSource, /borderColor: selected \? "var\(--tradepro-shared-selection-outline\)"/u, "Selected reminder cards must read the shared right-selection outline");
assert.match(productMarketSource, /backgroundColor: selected \? "var\(--tradepro-shared-selection-bg\)"/u, "Selected reminder cards must read the shared right-selection background");
const reminderSelectionStyleStart = sharedStyleSource.indexOf('.template-config-service-sound-choice[data-shared-small-card-surface="true"][data-selected="true"]');
const reminderSelectionStyleEnd = sharedStyleSource.indexOf("}", reminderSelectionStyleStart);
const reminderSelectionStyle = sharedStyleSource.slice(reminderSelectionStyleStart, reminderSelectionStyleEnd + 1);
assert.ok(reminderSelectionStyleStart >= 0, "Selected reminder cards must own a stable shared CSS selector");
assert.match(reminderSelectionStyle, /background-color: var\(--tradepro-shared-selection-bg\)/u, "Selected reminder CSS must use the right-selection background token");
assert.match(reminderSelectionStyle, /border-color: var\(--tradepro-shared-selection-outline\)/u, "Selected reminder CSS must use the right-selection outline token");
assert.match(reminderSelectionStyle, /color: var\(--tradepro-shared-selection-text\)/u, "Selected reminder CSS must use the right-selection text token");
assert.match(productMarketSource, /data-customer-service-reminder-replace/u, "The per-style replacement entry must have a stable UI marker");
assert.match(productMarketSource, /playReminderSoundChoicePreview\(preset\.key, presetPreview\?\.url\)/u, "A replaced reminder card must preview its replacement asset first");
assert.match(productMarketSource, /selectedReminderSoundPlaybackUrl/u, "提醒音设置必须支持直接试听本地文件与替换文件");
assert.match(productMarketSource, /清除后恢复本地默认/u, "替换说明必须明确清除后回退本地文件");
assert.match(productMarketSource, /data-customer-service-voice-style/u, "朗音状态卡必须登记稳定编号 key");
assert.match(productMarketSource, /data-customer-service-voice-local-file/u, "朗音状态卡必须登记本地文件");
assert.match(productMarketSource, /data-customer-service-voice-source/u, "朗音状态卡必须区分本地与替换来源");
assert.match(productMarketSource, /data-customer-service-voice-replace/u, "朗音替换入口必须提供稳定标记");
assert.match(productMarketSource, /data-customer-service-voice-preview/u, "朗音试听入口必须提供稳定标记");
assert.match(
  productMarketSource,
  /resolveCustomerServiceExpertSequenceMatch\(csAvatarId, undefined\)\.voiceStyleKey/u,
  "男女声切换必须优先恢复当前专家自己的编号朗音",
);
assert.match(productMarketSource, /data-customer-service-expert-voice-style/u, "专家卡必须公开编号朗音匹配结果");
assert.match(productMarketSource, /data-customer-service-expert-animation-style/u, "专家卡必须公开编号效果匹配结果");
assert.match(productMarketSource, /data-customer-service-expert-reminder-style/u, "专家卡必须公开编号提醒音匹配结果");
assert.match(
  productMarketSource,
  /previewText === presetPreview\.localAsset\?\.transcript/u,
  "朗音设置只有在试听文字与本地样音文案完全一致时才允许播放固定样音",
);
const productVoicePreviewStart = productMarketSource.indexOf("const playVoiceRatePreview = useCallback");
const productVoicePreviewEnd = productMarketSource.indexOf("\n  useEffect(() => () => {", productVoicePreviewStart);
assert(
  productVoicePreviewStart >= 0 && productVoicePreviewEnd > productVoicePreviewStart,
  "朗音试听必须保持可独立审计的交互边界",
);
const productVoicePreviewSource = productMarketSource.slice(productVoicePreviewStart, productVoicePreviewEnd);
assert.doesNotMatch(
  productMarketSource,
  /from "@\/lib\/(?:ai-provider-api|customer-service-browser-voice)"/u,
  "远程 TTS 与浏览器朗读兜底不得静态进入产品市场首包",
);
assert.match(
  voicePreviewRuntimeSource,
  /let resolvedPreviewUrl = options\.directPreviewUrl \|\| options\.localPreviewUrl/u,
  "朗音试听必须按上传替换、本地完全匹配样音、动态TTS的顺序解析",
);
assert.match(productVoicePreviewSource, /await import\("@\/lib\/customer-service-voice-preview-runtime"\)/u, "朗音运行时必须只在用户发起试听后加载");
assert.doesNotMatch(productMarketSource, /import\("@\/lib\/(?:ai-provider-api|customer-service-browser-voice)"\)/u, "页面入口不得直接持有远程 TTS 或浏览器朗读分包");
assert.match(voicePreviewRuntimeSource, /await import\("\.\/ai-provider-api"\)/u, "动态 TTS 必须只在本地素材无法命中后加载");
assert.match(voicePreviewRuntimeSource, /await import\("\.\/customer-service-browser-voice"\)/u, "浏览器朗读必须只在音频播放失败后加载");
assert.match(voicePreviewRuntimeSource, /if \(browserFallbackPromise\) return browserFallbackPromise/u, "浏览器朗读回退必须合并音频错误事件与播放拒绝");
assert.match(voicePreviewRuntimeSource, /audio\.onerror = \(\) => \{[\s\S]*fallbackToBrowserVoice\(\)/u, "播放中断必须进入同一个浏览器朗读回退");
assert.match(voicePreviewRuntimeSource, /if \(!options\.isCurrent\(\)\) return/u, "共享朗音运行时必须拒绝迟到请求");
assert.match(productVoicePreviewSource, /voicePreviewRequestRevisionRef\.current === requestRevision/u, "异步朗音结果必须绑定当前试听请求");
assert.match(productMarketSource, /window\.speechSynthesis\.cancel\(\)/u, "停止试听必须同步取消浏览器朗读且不得反向加载兜底分包");
const productUploadedVoiceBranch = productVoicePreviewSource.indexOf("const directPreviewUrl =");
const productLocalVoiceBranch = productVoicePreviewSource.indexOf("const localPreviewUrl = previewText === presetPreview.localAsset?.transcript");
const productRuntimeBranch = productVoicePreviewSource.indexOf('await import("@/lib/customer-service-voice-preview-runtime")', productLocalVoiceBranch);
assert(
  productUploadedVoiceBranch >= 0
    && productUploadedVoiceBranch < productLocalVoiceBranch
    && productLocalVoiceBranch < productRuntimeBranch,
  "朗音设置入口必须先解析上传替换与本地精确样音，再加载共享运行时",
);
assert.match(voicePreviewRuntimeSource, /preservesPitch = true/u, "朗音试听加速时必须保留原始男女音高");
assert.doesNotMatch(voicePreviewRuntimeSource, /preservesPitch = false/u, "朗音试听不得因加速抬高男性音高");
const uploadedVoiceBranch = siteBuilderSource.indexOf("if (cs.uploadedVoiceDataUrl)");
const browserVoiceBranch = siteBuilderSource.indexOf("if (window.speechSynthesis && window.SpeechSynthesisUtterance && profile)");
assert(uploadedVoiceBranch >= 0 && uploadedVoiceBranch < browserVoiceBranch, "发布站点必须优先播放上传朗音，再回退浏览器朗读");
const localReminderBranch = siteBuilderSource.indexOf("profile && profile.localAsset && profile.localAsset.url");
const syntheticReminderBranch = siteBuilderSource.indexOf("var AudioContextConstructor = window.AudioContext || window.webkitAudioContext");
assert(localReminderBranch >= 0 && localReminderBranch < syntheticReminderBranch, "发布站点必须优先播放本地提醒音，再回退合成音");
assert.match(storeSource, /legacyFlatVoiceAsset/u, "旧 flat 朗音资产必须迁移到编号朗音槽位");
assert.match(storeSource, /\[migrationStyle\]: legacyFlatVoiceAsset/u, "旧朗音资产迁移必须保留原素材引用");
assert.match(
  storeSource,
  /const migrationPreset = resolveCustomerServiceVoiceMigrationPreset\(avatarId, next\.voiceStyleKey\)/u,
  "v1→v2 迁移必须通过编号保留解析器处理已有朗音选择",
);
assert.match(storeSource, /next\.voiceStyleKey = migrationPreset\.key/u, "v1→v2 迁移必须写回保留后的编号朗音");
assert.match(
  storeSource,
  /next\.voiceContractVersion = CUSTOMER_SERVICE_VOICE_CONTRACT_VERSION/u,
  "v1→v2 迁移必须在保留编号后升级契约版本",
);
assert.match(storeSource, /CUSTOMER_SERVICE_EXPERT_SEQUENCE_CONTRACT_VERSION/u, "编号自动匹配必须具有独立迁移契约");
assert.match(storeSource, /expert-sequence-auto-match-v2/u, "旧的编号错配必须通过 v2 契约重新归一化");
assert.match(storeSource, /\[defaultStyle\]: activeVoiceAsset/u, "旧活动朗音存在上传素材时必须迁移到专家正确编号");
assert.match(storeSource, /\[defaultReminderStyle\]: activeReminderAsset/u, "旧活动提醒音存在上传素材时必须迁移到专家正确编号");
assert.match(storeSource, /next\.animationStyle = next\.animationStyle \|\| getDefaultCustomerServiceAnimationForAvatar\(avatarId\)/u, "编号迁移必须保留用户已选效果");
assert.match(storeSource, /next\.soundStyle = defaultReminderStyle/u, "旧配置必须按专家编号迁移提醒音");
assert.match(
  storeSource,
  /const previousNormalized = previousCleaned[\s\S]+\.\.\.previousNormalized,[\s\S]+\.\.\.override,/u,
  "当前会话写入前必须先迁移旧专家配置，再叠加用户本次明确修改",
);
assert.match(aiChatSource, /resolveCustomerServiceExpertSequenceMatch\(avatarEntry\.id/u, "发布站点快照必须复用编号匹配契约");
assert.match(voiceGeneratorSource, /OUTPUT_DIRECTORY = MATERIAL_ASSET_FILE_ROOT/u, "朗音生成器必须写入私有素材文件目录");
assert.match(voiceGeneratorSource, /MANIFEST_PATH = MATERIAL_ASSET_ROOT/u, "朗音生成器必须把清单保存在私有素材根目录");
assert.match(voiceGeneratorSource, /"distributionScope": "local-private-material-library"/u, "朗音生成器必须登记私有分发范围");
assert.match(voiceGeneratorSource, /"systemManaged": True/u, "朗音生成器必须把默认样音标记为系统受保护素材");
assert.match(voiceGeneratorSource, /preserve_existing = bool/u, "朗音生成器默认必须保留现有受保护 WAV");
assert.match(voiceGeneratorSource, /"--force"/u, "朗音生成器只能通过显式 --force 重建默认样音");
assert.match(voiceGeneratorSource, /_parse_local_tts_helper_result/u, "朗音生成器必须读取实际语音包的性别结果");
assert.match(voiceGeneratorSource, /if actual_gender != gender/u, "朗音生成器必须拒绝与编号性别不符的语音包");
assert.match(aiHubSource, /Where-Object \{\{[\s\S]*GetAttribute\('Gender'\) -eq \$genderName/u, "本地语音脚本必须先按实际性别硬过滤语音包");
assert.match(aiHubSource, /if \(!string\.Equals\(gender, genderName,[\s\S]*\)\) continue;/u, "本地语音助手必须跳过性别不符的语音包");
assert.match(aiHubSource, /LOCAL_TTS_RESULT/u, "本地语音助手必须回报实际性别与音色名称");
assert.match(materialApiSource, /canReplace=True/u, "素材 API 必须允许系统素材与普通素材一样原位替换");
assert.match(materialApiSource, /canDelete=usage_count == 0/u, "素材 API 删除只应受实际引用数量约束");
assert.doesNotMatch(productMarketSource, /系统默认本地样音不可删除/u, "素材界面不得再以系统身份限制删除");

console.log("客服音频共享契约通过：12位专家的朗音、效果、出现提醒与发送提醒均按编号匹配，逐项替换及旧配置迁移有效。");
