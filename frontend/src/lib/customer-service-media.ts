import { uploadMaterialAsset, deleteMaterialAsset, listMaterialAssets, type MaterialAssetItem } from "./material-assets";
import { localDevFetch } from "./local-dev";

export type CustomerServiceMediaRecord = {
  id: string;
  kind: "image" | "video" | "audio";
  mimeType: string;
  blob: Blob;
  createdAt: number;
  fileName?: string;
  publicUrl?: string;
};

export type CustomerServiceLocalMaterialReference = {
  materialId: string;
  localUrl: string;
};

const materialMediaCache = new Map<string, CustomerServiceMediaRecord>();
const materialMediaReadInFlight = new Map<string, Promise<CustomerServiceMediaRecord>>();
const materialMediaPreviewUrlCache = new Map<string, string>();
const materialAssetFileNameCache = new Map<string, MaterialAssetItem>();
const materialAssetIdCache = new Map<string, MaterialAssetItem>();
let materialAssetFileNameCachePromise: Promise<void> | null = null;
const CUSTOMER_SERVICE_MEDIA_CACHE_LIMIT = 48;

function normalizeMaterialFileName(fileName?: string | null) {
  return typeof fileName === "string" ? fileName.trim().toLowerCase() : "";
}

function shouldReplaceMaterialAssetCacheEntry(
  current: MaterialAssetItem | undefined,
  next: MaterialAssetItem
) {
  if (!current) return true;
  const currentTs = Date.parse(current.updatedAt || current.createdAt || "");
  const nextTs = Date.parse(next.updatedAt || next.createdAt || "");
  if (Number.isFinite(currentTs) && Number.isFinite(nextTs) && nextTs !== currentTs) {
    return nextTs > currentTs;
  }
  return next.assetId > current.assetId;
}

function rememberMaterialAsset(item: MaterialAssetItem) {
  materialAssetIdCache.set(item.assetId, item);
  const normalizedFileName = normalizeMaterialFileName(item.fileName);
  if (!normalizedFileName) return;
  const current = materialAssetFileNameCache.get(normalizedFileName);
  if (shouldReplaceMaterialAssetCacheEntry(current, item)) {
    materialAssetFileNameCache.set(normalizedFileName, item);
  }
}

async function ensureMaterialAssetFileNameCache() {
  if (materialAssetFileNameCachePromise) {
    await materialAssetFileNameCachePromise;
    return;
  }
  materialAssetFileNameCachePromise = (async () => {
    try {
      const response = await listMaterialAssets();
      for (const item of response.items || []) {
        rememberMaterialAsset(item);
      }
    } finally {
      materialAssetFileNameCachePromise = null;
    }
  })();
  await materialAssetFileNameCachePromise;
}

function isLocalMaterialContentUrl(url: string) {
  return url.startsWith("/api/v1/local-dev/material-assets/") && url.includes("/content");
}

function mediaRequestCache(url: string): RequestCache {
  return url.includes("?v=") ? "force-cache" : "no-cache";
}

async function resolveMaterialAssetPublicUrl(assetId: string, fallbackUrl?: string) {
  const cached = materialAssetIdCache.get(assetId)?.publicUrl;
  if (cached) return cached;
  try {
    await ensureMaterialAssetFileNameCache();
  } catch {
    // A metadata outage must not make a previously valid stable asset unreadable.
  }
  return materialAssetIdCache.get(assetId)?.publicUrl
    || fallbackUrl
    || `/api/v1/local-dev/material-assets/${encodeURIComponent(assetId)}/content`;
}

function cacheCustomerServiceMedia(record: CustomerServiceMediaRecord) {
  materialMediaCache.delete(record.id);
  materialMediaCache.set(record.id, record);
  while (materialMediaCache.size > CUSTOMER_SERVICE_MEDIA_CACHE_LIMIT) {
    const oldestAssetId = materialMediaCache.keys().next().value as string | undefined;
    if (!oldestAssetId) break;
    materialMediaCache.delete(oldestAssetId);
    revokeCustomerServiceMediaPreview(oldestAssetId);
  }
}

export function isCustomerServiceVideoMimeType(mimeType?: string | null) {
  return typeof mimeType === "string" && mimeType.startsWith("video/");
}

export function isCustomerServiceAudioMimeType(mimeType?: string | null) {
  return typeof mimeType === "string" && mimeType.startsWith("audio/");
}

function resolveCustomerServiceMediaKind(mimeType?: string | null): "image" | "video" | "audio" {
  if (isCustomerServiceAudioMimeType(mimeType)) return "audio";
  return isCustomerServiceVideoMimeType(mimeType) ? "video" : "image";
}

export async function saveCustomerServiceMedia(file: File) {
  const saved = await uploadMaterialAsset(file);
  const kind = resolveCustomerServiceMediaKind(saved.mediaMimeType);
  const normalizedFileName = normalizeMaterialFileName(saved.fileName);
  materialMediaReadInFlight.delete(saved.assetId);
  cacheCustomerServiceMedia({
    id: saved.assetId,
    kind,
    mimeType: saved.mediaMimeType,
    blob: file,
    createdAt: Date.now(),
    fileName: saved.fileName,
    publicUrl: saved.publicUrl,
  });
  if (normalizedFileName) {
    rememberMaterialAsset({
      assetId: saved.assetId,
      fileName: saved.fileName,
      kind,
      mimeType: saved.mediaMimeType,
      sizeBytes: file.size,
      createdAt: saved.createdAt,
      publicUrl: saved.publicUrl,
      storagePath: saved.storagePath,
      applyCount: 0,
      usageCount: 0,
      canDelete: true,
      usageLabels: [],
    });
  }
  return {
    assetId: saved.assetId,
    mediaKind: kind,
    mediaMimeType: saved.mediaMimeType,
    publicUrl: saved.publicUrl,
  };
}

function readCustomerServiceMediaSingleFlight(
  assetId: string,
  load: () => Promise<CustomerServiceMediaRecord>,
) {
  const cached = materialMediaCache.get(assetId);
  if (cached) return Promise.resolve(cached);
  const activeRead = materialMediaReadInFlight.get(assetId);
  if (activeRead) return activeRead;

  const pendingRead: Promise<CustomerServiceMediaRecord> = load()
    .then((record) => {
      // An explicit invalidate/remove may retire this request while the fetch
      // is still in progress. Only the current owner may repopulate the cache.
      if (materialMediaReadInFlight.get(assetId) === pendingRead) {
        cacheCustomerServiceMedia(record);
      }
      return record;
    })
    .finally(() => {
      if (materialMediaReadInFlight.get(assetId) === pendingRead) {
        materialMediaReadInFlight.delete(assetId);
      }
    });
  materialMediaReadInFlight.set(assetId, pendingRead);
  return pendingRead;
}

export async function readCustomerServiceMedia(assetId?: string | null) {
  if (!assetId) return null;
  return readCustomerServiceMediaSingleFlight(assetId, async () => {
    const publicUrl = await resolveMaterialAssetPublicUrl(assetId);
    const response = await localDevFetch(publicUrl, { cache: mediaRequestCache(publicUrl) });
    if (!response.ok) {
      throw new Error(`Failed to read customer service media: ${response.status}`);
    }
    const blob = await response.blob();
    const record: CustomerServiceMediaRecord = {
      id: assetId,
      kind: resolveCustomerServiceMediaKind(blob.type),
      mimeType: blob.type || "application/octet-stream",
      blob,
      createdAt: Date.now(),
      publicUrl: response.url,
    };
    return record;
  });
}

export function resolveCustomerServiceLocalMaterialReference(
  materialId?: string | null,
  bundledLocalUrl?: string | null,
): CustomerServiceLocalMaterialReference | null {
  const normalizedMaterialId = materialId?.trim();
  if (!normalizedMaterialId) return null;
  return {
    materialId: normalizedMaterialId,
    localUrl: bundledLocalUrl?.trim()
      || `/api/v1/local-dev/material-assets/${encodeURIComponent(normalizedMaterialId)}/content`,
  };
}

/**
 * Resolve the same stable browser URL for every projection of one saved
 * customer-service asset. The URL remains valid until an explicit replace or
 * remove invalidates it, so a Sidebar remount cannot flash through a revoked
 * blob URL while the Customer Service expert picker still owns the material.
 */
export async function readCustomerServiceMediaPreview(
  materialReference?: CustomerServiceLocalMaterialReference | null,
) {
  if (!materialReference) return null;
  const { materialId, localUrl } = materialReference;
  const media = await readCustomerServiceMediaSingleFlight(materialId, async () => {
    const resolvedLocalUrl = isLocalMaterialContentUrl(localUrl)
      ? await resolveMaterialAssetPublicUrl(materialId, localUrl)
      : localUrl;
    const response = resolvedLocalUrl.startsWith("/api/v1/local-dev/")
      ? await localDevFetch(resolvedLocalUrl, { cache: mediaRequestCache(resolvedLocalUrl) })
      : await fetch(resolvedLocalUrl, { cache: "force-cache" });
    if (!response.ok) {
      throw new Error(`Failed to read customer service local portrait: ${response.status}`);
    }
    const blob = await response.blob();
    return {
      id: materialId,
      kind: resolveCustomerServiceMediaKind(blob.type),
      mimeType: blob.type || "image/*",
      blob,
      createdAt: Date.now(),
      publicUrl: response.url,
    };
  });
  const cachedUrl = materialMediaPreviewUrlCache.get(media.id);
  if (cachedUrl) return { media, url: cachedUrl };
  const url = URL.createObjectURL(media.blob);
  materialMediaPreviewUrlCache.set(media.id, url);
  return { media, url };
}

function revokeCustomerServiceMediaPreview(assetId: string) {
  const previewUrl = materialMediaPreviewUrlCache.get(assetId);
  if (!previewUrl) return;
  materialMediaPreviewUrlCache.delete(assetId);
  URL.revokeObjectURL(previewUrl);
}

/** Drop a cached blob after the asset has been replaced in storage under the same ID. */
export function invalidateCustomerServiceMedia(assetId?: string | null) {
  if (!assetId) return;
  revokeCustomerServiceMediaPreview(assetId);
  materialMediaReadInFlight.delete(assetId);
  const cachedRecord = materialMediaCache.get(assetId);
  const cachedAsset = materialAssetIdCache.get(assetId);
  materialMediaCache.delete(assetId);
  materialAssetIdCache.delete(assetId);
  const cachedFileName = cachedRecord?.fileName || cachedAsset?.fileName;
  if (cachedFileName) {
    materialAssetFileNameCache.delete(normalizeMaterialFileName(cachedFileName));
  }
}

export async function removeCustomerServiceMedia(assetId?: string | null) {
  if (!assetId) return;
  revokeCustomerServiceMediaPreview(assetId);
  materialMediaReadInFlight.delete(assetId);
  const cachedRecord = materialMediaCache.get(assetId);
  const cachedAsset = materialAssetIdCache.get(assetId);
  materialMediaCache.delete(assetId);
  materialAssetIdCache.delete(assetId);
  const cachedFileName = cachedRecord?.fileName || cachedAsset?.fileName;
  if (cachedFileName) {
    materialAssetFileNameCache.delete(normalizeMaterialFileName(cachedFileName));
  }
  try {
    await deleteMaterialAsset(assetId);
  } catch {
    // When an asset is already referenced elsewhere, UI clearing should still proceed.
  }
}

export async function findMaterialAssetByFileName(fileName?: string | null) {
  const normalizedFileName = normalizeMaterialFileName(fileName);
  if (!normalizedFileName) return null;
  const cached = materialAssetFileNameCache.get(normalizedFileName);
  if (cached) return cached;
  await ensureMaterialAssetFileNameCache();
  return materialAssetFileNameCache.get(normalizedFileName) || null;
}
