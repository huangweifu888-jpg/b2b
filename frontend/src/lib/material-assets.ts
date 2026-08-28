import { localDevFetch } from "./local-dev";
import { assertMediaUploadFile, normalizeMediaUploadFileType } from "./media-optimization-contract";

export type MaterialAssetKind = "image" | "video" | "audio";

export type MaterialAssetOptimizationMetadata = {
  status: string;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  spaceSavedBytes: number;
  savingsRatio: number;
  originalMimeType: string;
  outputMimeType: string;
  originalRetained: false;
  reusedAssetId?: string;
};

export type MaterialAssetItem = {
  assetId: string;
  fileName: string;
  kind: MaterialAssetKind;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt?: string | null;
  publicUrl: string;
  storagePath: string;
  applyCount: number;
  usageCount: number;
  systemManaged?: boolean;
  canReplace?: boolean;
  canDelete: boolean;
  usageLabels: string[];
  contentHash?: string | null;
  optimization?: MaterialAssetOptimizationMetadata | null;
};

export type MaterialAssetListResponse = {
  items: MaterialAssetItem[];
};

export type MaterialAssetUploadResponse = {
  assetId: string;
  fileName: string;
  mediaKind: MaterialAssetKind;
  mediaMimeType: string;
  createdAt: string;
  publicUrl: string;
  storagePath: string;
  deduplicated: boolean;
  optimization?: MaterialAssetOptimizationMetadata | null;
};

export type MaterialAssetOptimizationAuditItem = {
  assetId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  safeTestAsset: boolean;
  eligible: boolean;
  status: "candidate" | "compliant" | "issue";
  optimizationStatus: string;
  optimizedFileName?: string;
  optimizedMimeType?: string;
  optimizedSizeBytes: number;
  spaceSavedBytes: number;
  savingsRatio: number;
  error?: string;
};

export type MaterialAssetOptimizationReport = {
  contractVersion: string;
  policy: string;
  storageLifecycle: {
    originalRetention: string;
    removeOriginalAfterVerification: boolean;
    minimumSavingsRatio: number;
    deduplicateBy: string;
    derivativeStorage: string;
    failurePolicy: string;
  };
  summary: {
    assetCount: number;
    compliantCount: number;
    candidateCount: number;
    issueCount: number;
    currentBytes: number;
    optimizedBytes: number;
    potentialSavedBytes: number;
  };
  items: MaterialAssetOptimizationAuditItem[];
  run: {
    dryRun: boolean;
    safeTestAssetsOnly: boolean;
    optimizedCount: number;
    deduplicatedCount: number;
    savedBytes: number;
  };
};

export type MaterialAssetApplyResponse = {
  assetId: string;
  applyCount: number;
};

export async function listMaterialAssets() {
  const response = await localDevFetch("/api/v1/local-dev/material-assets");
  return (await response.json()) as MaterialAssetListResponse;
}

export async function inspectMaterialAssetOptimization() {
  const response = await localDevFetch("/api/v1/local-dev/material-assets/optimization");
  return (await response.json()) as MaterialAssetOptimizationReport;
}

export async function runMaterialAssetOptimization(input: {
  dryRun?: boolean;
  assetIds?: string[];
  safeTestAssetsOnly?: boolean;
} = {}) {
  const response = await localDevFetch("/api/v1/local-dev/material-assets/optimization", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dryRun: input.dryRun ?? true,
      assetIds: input.assetIds ?? [],
      safeTestAssetsOnly: input.safeTestAssetsOnly ?? true,
    }),
  });
  return (await response.json()) as MaterialAssetOptimizationReport;
}

export async function uploadMaterialAsset(file: File, expectedKind?: MaterialAssetKind) {
  const normalizedFile = normalizeMediaUploadFileType(file);
  await assertMediaUploadFile(normalizedFile, expectedKind);
  const formData = new FormData();
  formData.append("file", normalizedFile);
  const response = await localDevFetch("/api/v1/local-dev/material-assets", {
    method: "POST",
    body: formData,
  });
  return (await response.json()) as MaterialAssetUploadResponse;
}

/** Replace stored bytes in place. Asset ID and every existing reference stay intact. */
export async function replaceMaterialAsset(assetId: string, file: File, expectedKind?: MaterialAssetKind) {
  const normalizedFile = normalizeMediaUploadFileType(file);
  await assertMediaUploadFile(normalizedFile, expectedKind);
  const formData = new FormData();
  formData.append("file", normalizedFile);
  const response = await localDevFetch(`/api/v1/local-dev/material-assets/${encodeURIComponent(assetId)}`, {
    method: "PUT",
    body: formData,
  });
  return (await response.json()) as MaterialAssetItem;
}

export async function deleteMaterialAsset(assetId: string) {
  const response = await localDevFetch(`/api/v1/local-dev/material-assets/${encodeURIComponent(assetId)}`, {
    method: "DELETE",
  });
  return response.json();
}

export async function recordMaterialAssetApply(assetId: string) {
  const response = await localDevFetch(`/api/v1/local-dev/material-assets/${encodeURIComponent(assetId)}/apply`, {
    method: "POST",
  });
  return (await response.json()) as MaterialAssetApplyResponse;
}

export async function syncMaterialAssetUsage(
  sources: { sourceKey: string; sourceLabel: string; assetIds: string[] }[],
  sourceNamespace = "product-market"
) {
  const response = await localDevFetch("/api/v1/local-dev/material-assets/usage-sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceNamespace, sources }),
  });
  return response.json();
}
