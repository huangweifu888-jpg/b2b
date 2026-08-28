import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const frontendRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(frontendRoot, "..");
const readFrontend = (path) => readFileSync(resolve(frontendRoot, path), "utf8");
const readRepository = (path) => readFileSync(resolve(repositoryRoot, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(`媒体优化契约失败：${message}`);
};

const contract = JSON.parse(readRepository("shared/contracts/media-optimization-contract.json"));
const developerContract = JSON.parse(readRepository("shared/contracts/developer-optimization-contract.json"));
const adapter = readFrontend("src/lib/media-optimization-contract.ts");
const materialAssets = readFrontend("src/lib/material-assets.ts");
const normalizer = readFrontend("src/lib/customer-service-material-normalizer.ts");
const customerServiceMedia = readFrontend("src/lib/customer-service-media.ts");
const productMarket = readFrontend("src/pages/ProductMarket.tsx");
const companyInfo = readFrontend("src/pages/CompanyInfo.tsx");
const iconSetting = readFrontend("src/components/content-plugins/ContentPluginIconSetting.tsx");
const picker = readFrontend("src/components/product-market/CustomerServiceMaterialPickerDialog.tsx");
const qualityCenter = readFrontend("src/components/product-market/PerformanceQualityReleaseWorkbench.tsx");
const sharedContractWorkbench = readFrontend("src/components/product-market/DeveloperSharedContractWorkbench.tsx");
const avatarRenderer = readFrontend("src/components/customer-service/CustomerServiceAvatarMedia.tsx");
const categoryContract = readFrontend("src/lib/product-market-category-contract.ts");
const backend = readRepository("backend/routers/local_dev.py");
const aiHub = readRepository("backend/services/aihub.py");
const mediaService = readRepository("backend/services/media_optimization.py");
const backendRequirements = readRepository("backend/requirements.txt");
const optimizerTool = readRepository("tools/optimize_media_assets.py");
const developerScopeE2e = readFrontend("e2e/developer-application-scope-flow.spec.ts");

assert(contract.ownership === "shared-first" && contract.policy === "media-upload-and-delivery", "必须由一份共享合同拥有上传与交付规则");
assert(contract.version === "2026.08.28.1", "媒体契约必须推进到统一生命周期版本");
assert(contract.storageLifecycle?.originalRetention === "temporary-until-verified", "原文件只能临时保留到验证完成");
assert(contract.storageLifecycle?.removeOriginalAfterVerification === true, "验证成功后必须删除临时原件");
assert(contract.storageLifecycle?.editableSourceRetention === "explicit-opt-in-only", "可编辑源文件只能显式保留");
assert(contract.storageLifecycle?.minimumSavingsRatio === 0.1, "小于 10% 的节省不得生成重复文件");
assert(contract.storageLifecycle?.deduplicateBy === "sha256" && contract.storageLifecycle?.reuseExistingAsset === true, "素材库必须按 SHA-256 复用相同内容");
assert(contract.storageLifecycle?.derivativeStorage === "regenerable-cache", "派生尺寸必须是可重建缓存");
assert(contract.storageLifecycle?.failurePolicy === "keep-current-revision", "优化失败必须继续使用当前版本");
assert(contract.optimization?.image?.mode === "automatic-on-upload" && contract.optimization.image.outputMimeType === "image/webp", "PNG/JPEG 必须统一自动选择 WebP 正式文件");
assert(contract.optimization?.video?.browserTranscode === false, "不得继续使用会产生无限时长的浏览器 WebM 转码");
assert(contract.optimization?.structuredMedia?.mode === "preserve-structure", "SVG/Lottie/CSS 必须保持结构而非生成重复视频");
const expectedAvatarFirstPaint = {
  id: "bundled-first-decode-gated-never-empty-v1",
  policy: "01-12>bundled-local-portrait-first>saved-media-ready-gate>saved-material-replaces>decode-error-to-bundled>never-empty",
  scope: "customer-service-experts-01-12",
  firstPaintSource: "bundled-local-portrait",
  savedImageActivation: "decode-ready",
  savedVideoPoster: "bundled-local-portrait",
  decodeFailureFallback: "bundled-local-portrait",
  terminalFallback: "vector-illustration",
  neverEmpty: true,
};
assert(Object.entries(expectedAvatarFirstPaint).every(([key, value]) => contract.delivery?.avatarFirstPaint?.[key] === value), "专家头像首屏、解码门控与永不留空字段必须由媒体契约完整统一拥有");
for (const kind of ["image", "video", "audio"]) {
  const rule = contract.kinds[kind];
  assert(rule && rule.maxUploadBytes > 0 && rule.warningBytes < rule.maxUploadBytes, `${kind} 大小规则无效`);
  assert(rule.warningBytes <= rule.deliveryBudgetBytes && rule.deliveryBudgetBytes <= rule.maxUploadBytes, `${kind} 警戒、交付与上传上限顺序无效`);
  assert(rule.acceptedExtensions.every((extension) => rule.mimeByExtension[extension]), `${kind} 扩展名必须显式映射 MIME`);
  assert(Object.values(rule.mimeByExtension).every((mimeType) => rule.acceptedMimeTypes.includes(mimeType)), `${kind} MIME 映射漂移`);
}
assert(developerContract.mediaContract === "media-optimization-contract.json", "开发器合同必须引用媒体合同");
assert(!developerContract.budgets.some((budget) => ["image-transfer", "video-transfer", "audio-transfer"].includes(budget.id)), "开发器合同不得复制媒体体积预算");
assert(developerContract.gates.includes("media-policy") && developerContract.gates.includes("responsive"), "质量门禁必须包含媒体与响应式");
for (const token of [
  '@website-style/media-optimization-contract.json',
  "rule.mimeByExtension[extension] !== mimeType",
  "loadVisualMetadata",
  "assertMediaUploadFile",
  "getMediaUploadAccept",
  "MEDIA_TRANSFER_BUDGETS",
  "storageLifecycle",
  "avatarFirstPaint",
]) assert(adapter.includes(token), `前端共享适配器缺少 ${token}`);
assert(backend.includes('image_rule.get("warningBytes")'), "后端图片优化建议必须直接读取媒体合同警戒值");
assert(materialAssets.includes("await assertMediaUploadFile(normalizedFile, expectedKind)"), "所有素材上传必须经过统一预检");
for (const token of ["inspectMaterialAssetOptimization", "runMaterialAssetOptimization", "deduplicated", "originalRetained"]) {
  assert(materialAssets.includes(token), `素材 API 缺少统一优化证据 ${token}`);
}
assert(normalizer.includes("avatarRule.imageOutputMimeType") && normalizer.includes("videoBitsPerSecond"), "头像转换必须读取共享输出格式与码率");
assert(normalizer.includes("Number.isFinite(video.duration)") && normalizer.includes("optimization.video.browserTranscode"), "头像视频必须拒绝无限时长并服从服务端转码边界");
for (const [name, source] of [["ProductMarket", productMarket], ["CompanyInfo", companyInfo], ["ContentPluginIconSetting", iconSetting], ["CustomerServiceMaterialPickerDialog", picker]]) {
  assert(!/accept=(?:\"|\{[^\n]*\")?(?:image|video|audio)\/\*/.test(source), `${name} 仍使用媒体通配 accept`);
  assert(source.includes("getMediaUploadAccept"), `${name} 未读取共享 accept`);
}
assert(iconSetting.includes('uploadMaterialAsset(file, "image")'), "图标上传必须强制 image 类型");
for (const token of [
  "MEDIA_OPTIMIZATION_CONTRACT_PATH",
  "_material_asset_upload_policy",
  "_material_asset_signature_matches",
  "_material_asset_validate_content",
  "_material_asset_probe_metadata",
  "_material_asset_metadata_policy_issues",
  "_probe_iso_bmff_video_metadata",
  "_probe_webm_video_metadata",
  "_probe_video_with_ffprobe",
  '"-protocol_whitelist"',
  '"file,pipe"',
  "timeout=_MEDIA_METADATA_PROBE_TIMEOUT_SECONDS",
  "_material_asset_verify_image_with_pillow",
  "_read_material_asset_upload",
  "_write_material_asset_content_atomic",
  "_material_asset_revision_relative_path",
  "_remove_material_asset_file_if_unreferenced",
  "_material_asset_prepare_durable_content",
  "_material_asset_file_matches",
  "_material_asset_find_reusable_content",
  "_material_asset_optimization_report",
  "run_material_asset_optimization",
  "candidate.relative_to(root)",
  '"media-policy"',
  '"responsive-contract"',
]) assert(backend.includes(token), `后端统一策略缺少 ${token}`);
assert(backend.includes("_material_asset_file_matches(relative_path, content_hash, expected_size_bytes)") && backend.includes("str(entry.get(\"assetId\") or \"\").strip() != normalized_asset_id"), "去重复用必须复核实际字节，删除必须统一使用规范化素材编号");
for (const token of ["optimize_media_content", "originalRetained", "minimumSavingsRatio", "kept-no-size-benefit", "ImageOps.exif_transpose"]) {
  assert(mediaService.includes(token), `后端优化服务缺少 ${token}`);
}
assert(backendRequirements.includes("Pillow>=11.0.0"), "后端干净环境必须显式安装 Pillow");
assert(optimizerTool.includes("--apply") && optimizerTool.includes("source.unlink()"), "存量素材工具必须支持预览后原子替换且不永久保留原件");
assert(backend.match(/_material_asset_validate_content\([^)]*resolved_mime_type[^)]*rule\)/g)?.length >= 2, "upload and replace APIs must both enforce server-side media metadata");
assert(backend.match(/_material_asset_revision_relative_path\(/g)?.length >= 3, "upload and replace storage paths must include their content revision");
for (const token of ["over-width-limit", "over-height-limit", "over-duration-limit", "metadata-unreadable"]) {
  assert(backend.includes(token), `media audit is missing ${token}`);
}
for (const token of [
  "_material_asset_revision(item)",
  'item.get("contentHash") or item.get("updatedAt")',
  'cache_control = "private, max-age=31536000, immutable"',
  'content_disposition_type="inline"',
]) assert(backend.includes(token), `backend immutable material URL is missing ${token}`);
assert(customerServiceMedia.includes("materialAssetIdCache")
  && customerServiceMedia.includes("resolveMaterialAssetPublicUrl")
  && customerServiceMedia.includes('return url.includes("?v=") ? "force-cache" : "no-cache"')
  && !customerServiceMedia.includes('cache: "no-store"'), "customer-service preview must consume revision URLs and keep ETag revalidation");
for (const token of ["data-media-optimization-policy", "data-media-optimization-audit", "data-responsive-verification-matrix"]) {
  assert(qualityCenter.includes(token), `质量中心缺少 ${token}`);
}
for (const token of ["data-media-optimization-contract-version", "data-media-original-retention", "data-media-avatar-first-paint", "data-media-avatar-never-empty", "原件临时", "SHA-256 去重"]) {
  assert(qualityCenter.includes(token), `质量中心缺少统一媒体生命周期证据 ${token}`);
}
for (const token of ["data-media-optimization-contract", "data-shared-media-resource-contract", "data-media-avatar-first-paint", "data-media-avatar-never-empty", "data-media-avatar-saved-image-activation", "contractVersions", "media: MEDIA_OPTIMIZATION_CONTRACT.version", "优化内置测试素材", "runMaterialAssetOptimization"]) {
  assert(sharedContractWorkbench.includes(token), `共享契约器缺少媒体版本或执行证据 ${token}`);
}
for (const token of ["MEDIA_OPTIMIZATION_CONTRACT.delivery.avatarFirstPaint", "data-media-avatar-first-paint-policy", "data-media-avatar-never-empty", "decoding={MEDIA_OPTIMIZATION_CONTRACT.delivery.imageDecoding}", "preload={MEDIA_OPTIMIZATION_CONTRACT.delivery.videoPreload}", "playsInline={MEDIA_OPTIMIZATION_CONTRACT.delivery.videoPlaysInline}"]) {
  assert(avatarRenderer.includes(token), `共享头像渲染器未消费媒体交付契约 ${token}`);
}
for (const token of ["installMediaOptimizationMock", 'data-media-optimization-contract", "2026.08.28.1"', 'data-media-avatar-first-paint", "bundled-first-decode-gated-never-empty-v1"', "优化内置测试素材", "9/9 已符合"]) {
  assert(developerScopeE2e.includes(token), `开发器媒体契约缺少真实作用域交互测试 ${token}`);
}
assert(categoryContract.includes("MEDIA_OPTIMIZATION_CONTRACT.delivery.avatarFirstPaint.policy"), "产品市场头像首屏规则不得复制第二份字符串");
const optimizedAvatarRoot = resolve(frontendRoot, "public/assets/customer-service-local-materials");
const optimizedAvatarFiles = readdirSync(optimizedAvatarRoot);
assert(optimizedAvatarFiles.length === 9 && optimizedAvatarFiles.every((name) => name.endsWith(".webp")), "首批 9 张专家头像必须只保留 WebP 正式文件");
assert(optimizedAvatarFiles.every((name) => statSync(resolve(optimizedAvatarRoot, name)).size > 0), "优化后的专家头像不得为空");
assert(aiHub.includes('"mimeType": "audio/wav"') && aiHub.includes('"contentHash": content_hash') && aiHub.includes("_material_asset_public_url(asset_id, content_hash)"), "本地 TTS 写入素材库时必须保留规范 MIME、内容哈希和 revision URL");

console.log("媒体优化契约通过：临时原件、WebP、SHA-256 去重、可重建缓存、存量测试与永不留空交付已统一接线。");
