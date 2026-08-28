import mediaContractData from "@website-style/media-optimization-contract.json";

import type { MaterialAssetKind } from "@/lib/material-assets";

type MediaKindRule = {
  label: string;
  acceptedMimeTypes: readonly string[];
  preferredMimeTypes: readonly string[];
  acceptedExtensions: readonly string[];
  mimeByExtension: Readonly<Record<string, string>>;
  maxUploadBytes: number;
  warningBytes: number;
  deliveryBudgetBytes: number;
  maxWidth?: number;
  maxHeight?: number;
  maxDurationSeconds?: number;
};

type MediaOptimizationContract = {
  version: string;
  ownership: "shared-first";
  policy: "media-upload-and-delivery";
  kinds: Record<MaterialAssetKind, MediaKindRule>;
  avatar: {
    width: number;
    height: number;
    imageOutputMimeType: "image/webp";
    imageQuality: number;
    videoOutputMimeType: "video/webm";
    videoFrameRate: number;
    videoBitsPerSecond: number;
    maxDurationSeconds: number;
  };
  storageLifecycle: {
    originalRetention: "temporary-until-verified";
    removeOriginalAfterVerification: true;
    editableSourceRetention: "explicit-opt-in-only";
    minimumSavingsRatio: number;
    deduplicateBy: "sha256";
    deduplicateScope: "material-library";
    reuseExistingAsset: true;
    derivativeStorage: "regenerable-cache";
    failurePolicy: "keep-current-revision";
  };
  optimization: {
    image: {
      mode: "automatic-on-upload";
      convertMimeTypes: readonly string[];
      outputMimeType: "image/webp";
      outputExtension: ".webp";
      quality: number;
      encoderMethod: number;
      preserveAnimatedImages: boolean;
    };
    video: {
      mode: "preferred-delivery-format";
      outputMimeType: "video/mp4";
      codec: "h264";
      posterMimeType: "image/webp";
      transcodeWhenRuntimeAvailable: boolean;
      browserTranscode: false;
    };
    structuredMedia: {
      mode: "preserve-structure";
      formats: readonly string[];
      examples: readonly string[];
    };
  };
  delivery: {
    responsiveImageWidths: readonly number[];
    imageLoading: "lazy-below-fold";
    imageDecoding: "async";
    videoPreload: "metadata";
    videoPosterRequired: boolean;
    videoPlaysInline: boolean;
    immutableRevisionUrls: boolean;
    avatarFirstPaint: {
      id: "bundled-first-decode-gated-never-empty-v1";
      policy: "01-12>bundled-local-portrait-first>saved-media-ready-gate>saved-material-replaces>decode-error-to-bundled>never-empty";
      scope: "customer-service-experts-01-12";
      firstPaintSource: "bundled-local-portrait";
      savedImageActivation: "decode-ready";
      savedVideoPoster: "bundled-local-portrait";
      decodeFailureFallback: "bundled-local-portrait";
      terminalFallback: "vector-illustration";
      neverEmpty: true;
    };
  };
};

export type MediaUploadInspection = {
  kind: MaterialAssetKind | null;
  mimeType: string;
  errors: string[];
  warnings: string[];
  width?: number;
  height?: number;
  durationSeconds?: number;
};

export type MediaTransferBudget = {
  id: `${MaterialAssetKind}-transfer`;
  label: string;
  unit: "KB";
  warning: number;
  limit: number;
  owner: "media-optimization-contract";
};

export const MEDIA_OPTIMIZATION_CONTRACT = mediaContractData as MediaOptimizationContract;

export const MEDIA_TRANSFER_BUDGETS: readonly MediaTransferBudget[] = Object.freeze(
  (Object.entries(MEDIA_OPTIMIZATION_CONTRACT.kinds) as [MaterialAssetKind, MediaKindRule][])
    .map(([kind, rule]) => Object.freeze({
      id: `${kind}-transfer` as const,
      label: `单${rule.label}资源`,
      unit: "KB" as const,
      warning: rule.warningBytes / 1024,
      limit: rule.deliveryBudgetBytes / 1024,
      owner: "media-optimization-contract" as const,
    })),
);

const MIME_BY_EXTENSION = Object.fromEntries(
  (Object.entries(MEDIA_OPTIMIZATION_CONTRACT.kinds) as [MaterialAssetKind, MediaKindRule][])
    .flatMap(([, rule]) => Object.entries(rule.mimeByExtension)),
) as Record<string, string>;

function fileExtension(fileName: string) {
  return fileName.match(/\.[^.]+$/)?.[0]?.toLowerCase() || "";
}

export function resolveMediaUploadMimeType(file: Pick<File, "name" | "type">) {
  const declared = file.type.trim().toLowerCase();
  if (declared && declared !== "application/octet-stream") return declared;
  return MIME_BY_EXTENSION[fileExtension(file.name)] || "";
}

export function resolveMediaUploadKind(file: Pick<File, "name" | "type">): MaterialAssetKind | null {
  const mimeType = resolveMediaUploadMimeType(file);
  return (Object.entries(MEDIA_OPTIMIZATION_CONTRACT.kinds) as [MaterialAssetKind, MediaKindRule][])
    .find(([, rule]) => rule.acceptedMimeTypes.includes(mimeType) || rule.acceptedExtensions.includes(fileExtension(file.name)))?.[0] || null;
}

export function normalizeMediaUploadFileType(file: File) {
  const mimeType = resolveMediaUploadMimeType(file);
  if (!mimeType || file.type.trim().toLowerCase() === mimeType) return file;
  return new File([file], file.name, { type: mimeType, lastModified: file.lastModified });
}

export function getMediaUploadAccept(kinds: readonly MaterialAssetKind[]) {
  return kinds.flatMap((kind) => MEDIA_OPTIMIZATION_CONTRACT.kinds[kind].acceptedExtensions).join(",");
}

function loadVisualMetadata(file: File, kind: "image" | "video") {
  return new Promise<{ width: number; height: number; durationSeconds?: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    if (kind === "image") {
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("图片内容无法读取"));
      };
      image.src = objectUrl;
      return;
    }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const result = { width: video.videoWidth, height: video.videoHeight, durationSeconds: video.duration };
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
      resolve(result);
    };
    video.onerror = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
      reject(new Error("视频内容无法读取"));
    };
    video.src = objectUrl;
  });
}

export async function inspectMediaUploadFile(file: File, expectedKind?: MaterialAssetKind): Promise<MediaUploadInspection> {
  const kind = resolveMediaUploadKind(file);
  const mimeType = resolveMediaUploadMimeType(file);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!kind) {
    return { kind: null, mimeType, errors: ["格式不在共享媒体规则内"], warnings };
  }
  const rule = MEDIA_OPTIMIZATION_CONTRACT.kinds[kind];
  const extension = fileExtension(file.name);
  if (!rule.acceptedMimeTypes.includes(mimeType) || !rule.acceptedExtensions.includes(extension)) {
    errors.push(`${rule.label}仅支持 ${rule.acceptedExtensions.join("、")}`);
  } else if (rule.mimeByExtension[extension] !== mimeType) {
    errors.push(`${rule.label}扩展名与文件类型不一致`);
  }
  if (expectedKind && expectedKind !== kind) errors.push(`当前位置只允许${MEDIA_OPTIMIZATION_CONTRACT.kinds[expectedKind].label}`);
  if (file.size <= 0) errors.push("文件内容为空");
  if (file.size > rule.maxUploadBytes) errors.push(`${rule.label}不能超过 ${(rule.maxUploadBytes / 1024 / 1024).toFixed(0)}MB`);
  if (file.size > rule.warningBytes) warnings.push(`${rule.label}超过推荐传输体积，建议压缩后上传`);
  if (!rule.preferredMimeTypes.includes(mimeType)) warnings.push(`${rule.label}优先使用 ${rule.preferredMimeTypes.join(" / ")}`);

  const inspection: MediaUploadInspection = { kind, mimeType, errors, warnings };
  if ((kind === "image" || kind === "video") && errors.length === 0) {
    try {
      const metadata = await loadVisualMetadata(file, kind);
      inspection.width = metadata.width;
      inspection.height = metadata.height;
      inspection.durationSeconds = metadata.durationSeconds;
      if (rule.maxWidth && metadata.width > rule.maxWidth) errors.push(`${rule.label}宽度不能超过 ${rule.maxWidth}px`);
      if (rule.maxHeight && metadata.height > rule.maxHeight) errors.push(`${rule.label}高度不能超过 ${rule.maxHeight}px`);
      if (rule.maxDurationSeconds && (metadata.durationSeconds || 0) > rule.maxDurationSeconds) errors.push(`${rule.label}时长不能超过 ${rule.maxDurationSeconds} 秒`);
    } catch (reason) {
      errors.push(reason instanceof Error ? reason.message : "媒体内容无法读取");
    }
  }
  return inspection;
}

export async function assertMediaUploadFile(file: File, expectedKind?: MaterialAssetKind) {
  const inspection = await inspectMediaUploadFile(file, expectedKind);
  if (inspection.errors.length) throw new Error(inspection.errors.join("；"));
  return inspection;
}
