import {
  DEFAULT_FEMALE_VOICE_OVERRIDE_ID,
  DEFAULT_MALE_VOICE_OVERRIDE_ID,
  getProductMarketCatalogDefaultPaths,
  getProductMarketCatalogProducts,
  type ExportableConfig,
  type ProductMarketCatalogScope,
} from "@/lib/product-market-store";
import {
  CUSTOMER_SERVICE_VOICE_PRESETS,
  getCustomerServiceVoicePreset,
  getDefaultVoiceGenderForAvatar,
} from "@/lib/customer-service-voice";
import { safeSetLocalStorage } from "./storage-guards";
import { dedupeProductOrderPaths } from "./product-market-order-contract";

export type ProductMarketScope = "hq" | "agency" | "client" | "agency_source" | "client_source";
export const PRODUCT_MARKET_CONFIG_EVENT = "product-market-config-updated";

type StoredProductMarketConfigCacheEntry = {
  raw: string;
  config: ExportableConfig | null;
};

// Route shells, Sidebar and Product Market all consume the same stored source
// snapshot. Keep one normalized canonical copy per unchanged raw value, while
// returning a fresh clone so a caller can never mutate the cached contract.
const storedProductMarketConfigCache = new Map<string, StoredProductMarketConfigCacheEntry>();

function cloneProductMarketConfig(config: ExportableConfig | null) {
  if (!config) return null;
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(config);
  }
  return JSON.parse(JSON.stringify(config)) as ExportableConfig;
}

function cacheStoredProductMarketConfig(key: string, raw: string, config: ExportableConfig | null) {
  storedProductMarketConfigCache.set(key, {
    raw,
    config: cloneProductMarketConfig(config),
  });
}

function syncStoredProductMarketConfigCache(key: string, expectedRaw: string, config: ExportableConfig) {
  try {
    const storedRaw = localStorage.getItem(key);
    if (storedRaw === expectedRaw) {
      cacheStoredProductMarketConfig(key, storedRaw, config);
      return;
    }
  } catch {
    // A successful write remains authoritative even when storage cannot be
    // read back in the current browser mode. The next read rebuilds the cache.
  }
  storedProductMarketConfigCache.delete(key);
}

export function normalizeProductMarketSiteId(siteId?: string | null) {
  return siteId?.trim() || "";
}

export function currentProductMarketConfigKey(scope: ProductMarketScope, siteId?: string | null) {
  const normalizedSiteId = normalizeProductMarketSiteId(siteId);
  if (normalizedSiteId) {
    return `product-market-config:site:${normalizedSiteId}:current`;
  }
  return `product-market-config:${scope}:current`;
}

export function defaultProductMarketConfigKey(scope: ProductMarketScope, siteId?: string | null) {
  const normalizedSiteId = normalizeProductMarketSiteId(siteId);
  if (normalizedSiteId) {
    return `product-market-config:site:${normalizedSiteId}:default`;
  }
  return `product-market-config:${scope}:default`;
}

function normalizeVoiceOverrideForStorage<T extends Record<string, unknown>>(avatarId: string, override: T): T {
  const next = { ...override } as T & {
    voiceGender?: string;
    voiceStyleKey?: string;
    voiceRate?: number;
    voiceAssetId?: string;
    voiceAssetMimeType?: string;
    voiceAssetFileName?: string;
    femaleVoiceAssetId?: string;
    femaleVoiceAssetMimeType?: string;
    femaleVoiceAssetFileName?: string;
    maleVoiceAssetId?: string;
    maleVoiceAssetMimeType?: string;
    maleVoiceAssetFileName?: string;
    voiceAssetsByStyle?: Record<string, unknown>;
    displayName?: string;
    greetingText?: string;
  };
  const exactPreset = typeof next.voiceStyleKey === "string"
    ? CUSTOMER_SERVICE_VOICE_PRESETS.find((preset) => preset.key === next.voiceStyleKey)
    : undefined;
  const explicitGender =
    next.voiceGender === "male" || next.voiceGender === "female"
      ? next.voiceGender
      : undefined;
  const resolvedGender = explicitGender || exactPreset?.gender || getDefaultVoiceGenderForAvatar(avatarId);
  if (exactPreset) {
    const resolvedPreset =
      explicitGender && explicitGender !== exactPreset.gender
        ? getCustomerServiceVoicePreset(undefined, explicitGender)
        : getCustomerServiceVoicePreset(exactPreset.key, resolvedGender);
    next.voiceStyleKey = resolvedPreset.key;
    next.voiceGender = resolvedPreset.gender;
    if (typeof next.voiceRate !== "number" || !Number.isFinite(next.voiceRate)) {
      next.voiceRate = resolvedPreset.rate;
    }
  } else if (explicitGender) {
    const resolvedPreset = getCustomerServiceVoicePreset(next.voiceStyleKey, explicitGender);
    next.voiceStyleKey = resolvedPreset.key;
    next.voiceGender = resolvedPreset.gender;
    if (typeof next.voiceRate !== "number" || !Number.isFinite(next.voiceRate)) {
      next.voiceRate = resolvedPreset.rate;
    }
  }
  // Dialog drafts represent an untouched expert name / greeting as an empty
  // string. The source API correctly drops those optional values, so remove
  // the same empty carriers before comparing a source draft. Real custom
  // text remains intact and continues to be persisted.
  if (typeof next.displayName === "string" && next.displayName.trim()) {
    next.displayName = next.displayName.trim();
  } else {
    delete next.displayName;
  }
  if (typeof next.greetingText === "string" && next.greetingText.trim()) {
    next.greetingText = next.greetingText.trim();
  } else {
    delete next.greetingText;
  }
  delete next.voiceAssetId;
  delete next.voiceAssetMimeType;
  delete next.voiceAssetFileName;
  if (avatarId === DEFAULT_FEMALE_VOICE_OVERRIDE_ID || avatarId === DEFAULT_MALE_VOICE_OVERRIDE_ID) {
    // Old clients populated this fallback carrier automatically during an
    // upload. A default is now valid only when explicitly style-scoped.
    delete next.femaleVoiceAssetId;
    delete next.femaleVoiceAssetMimeType;
    delete next.femaleVoiceAssetFileName;
    delete next.maleVoiceAssetId;
    delete next.maleVoiceAssetMimeType;
    delete next.maleVoiceAssetFileName;
  }
  return next;
}

function normalizeProductStyleForStorage(style?: ExportableConfig["products"][number]["customStyle"]) {
  if (!style) return undefined;
  const next = { ...style };
  // These five values are a runtime projection of activeTheme + product
  // status. The source API correctly omits them from a draft, then the store
  // recreates them on import. Keeping them in the comparison therefore makes
  // a status-only batch action look like an unrelated failed save.
  delete next.bgColor;
  delete next.borderColor;
  delete next.fontColor;
  delete next.buttonColor;
  delete next.nameFontColor;
  return Object.keys(next).length ? next : undefined;
}

function normalizeProductMarketConfig(config: ExportableConfig): ExportableConfig {
  const next: ExportableConfig = { ...config };
  const productOrder = Array.isArray(next.productOrder)
    ? next.productOrder.filter((path): path is string => typeof path === "string")
    : [];
  next.productOrder = dedupeProductOrderPaths(productOrder);
  if (next.products?.length) {
    // The source-template API omits an optional empty child customLabel while
    // local editing preserves it.  Treat an empty value as the visible default
    // label before storing or comparing so a semantic no-op never becomes a
    // false "draft read-back differs" failure.
    next.products = next.products.map((product) => ({
      ...product,
      customLabel: product.customLabel?.trim() || product.label,
      customStyle: normalizeProductStyleForStorage(product.customStyle),
      children: product.children?.map((child) => ({
        ...child,
        customLabel: child.customLabel?.trim() || child.label,
        customStyle: normalizeProductStyleForStorage(child.customStyle),
      })),
    }));
  }
  if (next.csAvatarOverrides && typeof next.csAvatarOverrides === "object") {
    next.csAvatarOverrides = Object.fromEntries(
      Object.entries(next.csAvatarOverrides).map(([key, value]) => [
        key,
        value && typeof value === "object"
          ? normalizeVoiceOverrideForStorage(key, value as Record<string, unknown>)
          : value,
      ])
    );
  }
  return next;
}

/**
 * A persisted snapshot and the value read back from it must use precisely the
 * same contract shape.  Client-source content has an additional migration
 * layer (the eight website content programs), so applying it only on reads
 * made an icon upload look like a failed save even though localStorage had
 * accepted the write.
 */
export function normalizeProductMarketConfigForStorage(config: ExportableConfig): ExportableConfig {
  const voiceNormalized = normalizeProductMarketConfig(config);
  return voiceNormalized.catalogScope === "client_source"
    ? normalizeClientSourceContentContract(voiceNormalized)
    : voiceNormalized;
}

function serializeCatalogProducts(scope: ProductMarketCatalogScope): ExportableConfig["products"] {
  return getProductMarketCatalogProducts(scope).map((product) => ({
    label: product.label,
    path: product.path,
    status: product.status,
    customLabel: product.customLabel,
    description: product.description,
    customStyle: product.customStyle ? { ...product.customStyle } : undefined,
    children: product.children?.map((child) => ({ ...child })),
  }));
}

export const CLIENT_SOURCE_CONTENT_PROGRAMS = [
  { path: "/products", legacyPath: "/website-content/products", label: "产品中心", iconName: "Package", sectionKey: "products", legacyLabels: ["产品内容", "产品管理"], children: [{ label: "产品明细", path: "/products?tab=list&mode=detail" }, { label: "产品模板", path: "/products?tab=article&mode=template" }, { label: "产品AI快发", path: "/products?tab=article&mode=ai" }, { label: "产品分类", path: "/products?tab=category" }] },
  { path: "/news", legacyPath: "/website-content/news", label: "新闻中心", iconName: "Newspaper", sectionKey: "news", legacyLabels: [], children: [{ label: "新闻明细", path: "/news?tab=list" }, { label: "新闻模板", path: "/news?tab=template" }, { label: "新闻AI快发", path: "/news?tab=ai" }, { label: "新闻分类", path: "/news?tab=category" }] },
  { path: "/cases", legacyPath: "/website-content/cases", label: "工程案例", iconName: "HardHat", sectionKey: "cases", legacyLabels: ["案例视频"], children: [{ label: "案例明细", path: "/cases?tab=list" }, { label: "案例模板", path: "/cases?tab=template" }, { label: "案例AI快发", path: "/cases?tab=ai" }, { label: "案例分类", path: "/cases?tab=category" }] },
  { path: "/videos", legacyPath: "/website-content/videos", label: "企业视频", iconName: "Video", sectionKey: "videos", legacyLabels: [], children: [{ label: "视频明细", path: "/videos?tab=list" }, { label: "视频模板", path: "/videos?tab=template" }, { label: "视频AI快发", path: "/videos?tab=ai" }, { label: "视频分类", path: "/videos?tab=category" }] },
  { path: "/blog", legacyPath: "/website-content/blog", label: "博客中心", iconName: "BookOpen", sectionKey: "blog", legacyLabels: ["博客优化"], children: [{ label: "博客明细", path: "/blog?tab=list" }, { label: "博客模板", path: "/blog?tab=template" }, { label: "博客AI快发", path: "/blog?tab=ai" }, { label: "博客分类", path: "/blog?tab=category" }] },
  { path: "/company-info?tab=about", legacyPath: "/website-content/company", label: "公司介绍", iconName: "Building2", sectionKey: "company", legacyLabels: ["关于我们", "企业资料"], children: [{ label: "工厂生产", path: "/company-info?tab=factory" }, { label: "公司风采", path: "/company-info?tab=gallery" }] },
  { path: "/company-info?tab=service", legacyPath: "/website-content/service", label: "服务保障", iconName: "ShieldCheck", sectionKey: "service", legacyLabels: ["企业信任"], children: [{ label: "FAQ", path: "/company-info?tab=faq" }, { label: "展会活动", path: "/company-info?tab=exhibition" }, { label: "物流货运", path: "/company-info?tab=logistics" }] },
  { path: "/company-info?tab=im", legacyPath: "/website-content/contact", label: "联系我们", iconName: "MessageCircle", sectionKey: "contact", legacyLabels: [], children: [{ label: "联系我们", path: "/company-info?tab=im&mode=contact" }, { label: "IM 客服", path: "/company-info?tab=im" }] },
] as const;
const CLIENT_SOURCE_CONTENT_CONTRACT_VERSION = 2;
type ClientSourceContentContractConfig = ExportableConfig & {
  clientSourceContentContractVersion?: number;
};

/**
 * Client-source pages can mount without visiting 产品市场 first. Normalize the
 * saved contract at the read boundary so Sidebar, Operations and Page Lock
 * always receive the same real editor-route records.
 */
export function normalizeClientSourceContentContract(config: ExportableConfig): ExportableConfig {
  if (!config.products?.length) return config;

  const contractConfig = config as ClientSourceContentContractConfig;
  // Versioned migration repairs programme shape (missing records, legacy
  // names and old child routes). It must never treat a missing version as
  // permission to replace an administrator's explicit 开通／取消／隐藏 choice.
  // The status belongs to Operations and remains the single source of truth.
  const requiresContentUpgrade = contractConfig.clientSourceContentContractVersion !== CLIENT_SOURCE_CONTENT_CONTRACT_VERSION;
  const legacyShadowPaths = new Set(CLIENT_SOURCE_CONTENT_PROGRAMS.map((program) => program.legacyPath));
  const shadowProducts = config.products.some((product) => legacyShadowPaths.has(product.path));
  const shadowCustomProducts = (config.customProducts || []).some((product) => legacyShadowPaths.has(product.path));
  let changed = shadowProducts || shadowCustomProducts || requiresContentUpgrade;

  const products = config.products
    .filter((product) => !legacyShadowPaths.has(product.path))
    .map((product) => {
      const program = CLIENT_SOURCE_CONTENT_PROGRAMS.find((item) => item.path === product.path);
      if (!program) return product;
      const currentLabel = (product.customLabel || product.label || "").trim();
      // Only a registered old title may reopen a programme. A missing
      // contract version is common in an exported live snapshot, so using it
      // as an activation signal made a confirmed batch hide return to active
      // after a route change.
      const isLegacyProgram = program.legacyLabels.some((label) => label === currentLabel);
      const existingChildren = new Map((product.children || []).map((child) => [child.path, child] as const));
      const hasLegacyChildren = program.children.some((child) => !existingChildren.has(child.path));
      const shouldNormalizeProgramShape = isLegacyProgram || (requiresContentUpgrade && hasLegacyChildren);
      // API serialization drops optional empty child labels.  Persist the
      // displayed child label explicitly for every source-program child so
      // local storage, the source draft, Sidebar and the verification read
      // all compare the same canonical shape.  A real custom child label is
      // kept; an empty one means "use the default label".
      const nextChildren = shouldNormalizeProgramShape
        ? program.children.map((child) => {
          const existing = existingChildren.get(child.path);
          return {
            ...child,
            status: existing?.status || "active",
            customLabel: existing?.customLabel?.trim() || child.label,
            description: existing?.description || `二级栏目：${child.label}`,
            customStyle: existing?.customStyle,
          };
        })
        : (product.children || []).map((child) => ({
          ...child,
          customLabel: child.customLabel?.trim() || child.label,
        }));
      const childrenChanged = JSON.stringify(nextChildren || []) !== JSON.stringify(product.children || []);
      const labelChanged = isLegacyProgram && product.customLabel !== program.label;
      // Shape upgrades may run for an old snapshot, but they cannot change a
      // saved programme status. This is what keeps batch hide persistent for
      // 产品中心、工程案例、服务保障、新闻中心、企业视频、博客中心、公司介绍和联系我们.
      const statusChanged = isLegacyProgram && product.status !== "active";
      if (!labelChanged && !childrenChanged && !statusChanged) return product;
      changed = true;
      return {
        ...product,
        customLabel: isLegacyProgram ? program.label : product.customLabel,
        // Only a registered legacy record is reopened. A later hide/cancel
        // remains an explicit administrator decision even when this snapshot
        // has not yet received the content-contract version marker.
        status: isLegacyProgram ? "active" : product.status,
        children: nextChildren,
      };
    });

  const factoryProducts = getProductMarketCatalogProducts("client_source");
  const customProducts = (config.customProducts || []).filter((product) => !legacyShadowPaths.has(product.path));
  CLIENT_SOURCE_CONTENT_PROGRAMS.forEach((program) => {
    if (products.some((product) => product.path === program.path)) return;
    const factoryProduct = factoryProducts.find((product) => product.path === program.path);
    // Some real content editors are intentionally outside the factory
    // catalogue.  The source contract must still materialise them itself so
    // Column Configuration, Operations, Sidebar and Page Lock share the same
    // complete navigation projection.
    const baseProduct = factoryProduct || {
      label: program.label,
      path: program.path,
      status: "active" as const,
      description: `${program.label}内容管理`,
      customStyle: { iconName: program.iconName },
    };
    products.push({
      label: baseProduct.label,
      path: baseProduct.path,
      status: "active",
      customLabel: program.label,
      description: baseProduct.description,
      customStyle: {
        ...(baseProduct.customStyle ? { ...baseProduct.customStyle } : {}),
        iconName: baseProduct.customStyle?.iconName || program.iconName,
      },
      children: program.children.map((child) => ({
        ...child,
        status: "active",
        customLabel: child.label,
        description: `二级栏目：${child.label}`,
      })),
    });
    if (!customProducts.some((product) => product.path === program.path)) {
      customProducts.push({
        label: program.label,
        path: program.path,
        iconName: program.iconName,
        children: program.children.map((child) => ({ label: child.label, path: child.path })),
      });
    }
    changed = true;
  });

  const moduleCategoryAssignments = { ...(config.moduleCategoryAssignments || {}) };
  CLIENT_SOURCE_CONTENT_PROGRAMS.forEach((program) => {
    if (moduleCategoryAssignments[program.path] !== "content") {
      moduleCategoryAssignments[program.path] = "content";
      changed = true;
    }
  });
  legacyShadowPaths.forEach((path) => {
    if (path in moduleCategoryAssignments) {
      delete moduleCategoryAssignments[path];
      changed = true;
    }
  });

  const requestedProductOrder = config.productOrder || [];
  let productOrder = dedupeProductOrderPaths(
    requestedProductOrder.filter((path) => !legacyShadowPaths.has(path)),
  );
  if (productOrder.length !== requestedProductOrder.length) changed = true;
  const missingOrderPaths = products.map((product) => product.path).filter((path) => !productOrder.includes(path));
  if (missingOrderPaths.length) {
    productOrder = [...productOrder, ...missingOrderPaths];
    changed = true;
  }

  if (!changed) return config;
  return {
    ...config,
    clientSourceContentContractVersion: CLIENT_SOURCE_CONTENT_CONTRACT_VERSION,
    products,
    customProducts,
    productOrder,
    moduleCategoryAssignments,
  };
}

/**
 * Legacy source snapshots were created before a source catalogue was stored
 * on the snapshot itself.  Client source keeps its existing website catalogue;
 * headquarters and agency source are intentionally rebased once so neither
 * can display customer-website applications as its own platform catalogue.
 */
function ensureCatalogScope(config: ExportableConfig, scope: ProductMarketCatalogScope) {
  const catalogueMatchesScope =
    scope === "client_source" ||
    (config.catalogScope === scope &&
      config.products?.length === getProductMarketCatalogProducts(scope).length &&
      config.products.every((product) => getProductMarketCatalogProducts(scope).some((catalogueProduct) => catalogueProduct.path === product.path)));
  if (catalogueMatchesScope) {
    return scope === "client_source" ? normalizeClientSourceContentContract(config) : config;
  }
  if (scope === "client_source") {
    return normalizeClientSourceContentContract({ ...config, catalogScope: scope });
  }
  const products = serializeCatalogProducts(scope);
  return {
    ...config,
    catalogScope: scope,
    products,
    productOrder: products.map((product) => product.path),
    customDefaultPaths: getProductMarketCatalogDefaultPaths(scope),
    customProducts: [],
  };
}

function readAndAlignCatalogScope(key: string, scope: ProductMarketCatalogScope) {
  const config = readStoredProductMarketConfig(key);
  if (!config) return null;
  const aligned = ensureCatalogScope(config, scope);
  if (aligned !== config) {
    seedStoredProductMarketConfig(key, aligned);
  }
  return aligned;
}

export function readStoredProductMarketConfig(key: string): ExportableConfig | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
    if (!raw) {
      storedProductMarketConfigCache.delete(key);
      return null;
    }
    const cached = storedProductMarketConfigCache.get(key);
    if (cached?.raw === raw) {
      return cloneProductMarketConfig(cached.config);
    }
    const parsed = JSON.parse(raw) as ExportableConfig;
    if (!parsed?.products) {
      cacheStoredProductMarketConfig(key, raw, null);
      return null;
    }
    const voiceNormalized = normalizeProductMarketConfig(parsed);
    // Direct project routes must repair an old source snapshot before their
    // first render; visiting 栏目配置 is no longer required to run migration.
    const normalized = voiceNormalized.catalogScope === "client_source"
      ? normalizeClientSourceContentContract(voiceNormalized)
      : voiceNormalized;
    const normalizedRaw = JSON.stringify(normalized);
    if (normalizedRaw !== JSON.stringify(parsed)) {
      const saved = safeSetLocalStorage(key, normalizedRaw, { compact: true });
      if (saved) syncStoredProductMarketConfigCache(key, normalizedRaw, normalized);
      else storedProductMarketConfigCache.delete(key);
    } else {
      cacheStoredProductMarketConfig(key, raw, normalized);
    }
    return cloneProductMarketConfig(normalized);
  } catch {
    if (raw) storedProductMarketConfigCache.delete(key);
    return null;
  }
}

export function writeStoredProductMarketConfig(key: string, config: ExportableConfig) {
  const normalized = normalizeProductMarketConfigForStorage(config);
  const normalizedRaw = JSON.stringify(normalized);
  const saved = safeSetLocalStorage(key, normalizedRaw, { compact: true });
  if (!saved) {
    storedProductMarketConfigCache.delete(key);
    throw new Error(`product-market config save failed: ${key}`);
  }
  syncStoredProductMarketConfigCache(key, normalizedRaw, normalized);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PRODUCT_MARKET_CONFIG_EVENT, { detail: { key } }));
  }
}

function seedStoredProductMarketConfig(key: string, config: ExportableConfig) {
  const normalized = normalizeProductMarketConfigForStorage(config);
  const normalizedRaw = JSON.stringify(normalized);
  const saved = safeSetLocalStorage(key, normalizedRaw, { compact: true });
  if (saved) syncStoredProductMarketConfigCache(key, normalizedRaw, normalized);
  else storedProductMarketConfigCache.delete(key);
  return normalized;
}

function sortProductMarketConfigValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortProductMarketConfigValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortProductMarketConfigValue(item)])
    );
  }
  return value;
}

/**
 * Compare saved snapshots by their shared-contract meaning, not transport
 * property order. The source API parses and serializes JSON before returning
 * a draft, so a raw JSON.stringify comparison can report a false mismatch
 * even when every persisted setting is identical.
 */
export function productMarketConfigSignature(config: ExportableConfig | null) {
  try {
    return config
      ? JSON.stringify(sortProductMarketConfigValue(normalizeProductMarketConfigForStorage(config)))
      : "";
  } catch {
    return "";
  }
}

export function relevantProductMarketStorageKeys(siteId?: string | null) {
  const normalizedSiteId = normalizeProductMarketSiteId(siteId);
  const keys = [
    currentProductMarketConfigKey("hq"),
    defaultProductMarketConfigKey("hq"),
    currentProductMarketConfigKey("agency_source"),
    defaultProductMarketConfigKey("agency_source"),
    currentProductMarketConfigKey("agency"),
    defaultProductMarketConfigKey("agency"),
    currentProductMarketConfigKey("client_source"),
    defaultProductMarketConfigKey("client_source"),
    currentProductMarketConfigKey("client"),
    defaultProductMarketConfigKey("client"),
  ];

  if (normalizedSiteId) {
    keys.unshift(
      currentProductMarketConfigKey("client", normalizedSiteId),
      defaultProductMarketConfigKey("client", normalizedSiteId),
      currentProductMarketConfigKey("agency", normalizedSiteId),
      defaultProductMarketConfigKey("agency", normalizedSiteId)
    );
  }

  return Array.from(new Set(keys));
}

export function readScopedProductMarketConfig(scope: ProductMarketScope, siteId?: string | null) {
  return (
    readStoredProductMarketConfig(currentProductMarketConfigKey(scope, siteId)) ||
    readStoredProductMarketConfig(defaultProductMarketConfigKey(scope, siteId)) ||
    readStoredProductMarketConfig(currentProductMarketConfigKey(scope)) ||
    readStoredProductMarketConfig(defaultProductMarketConfigKey(scope))
  );
}

function ensureSourceTemplateProductMarketConfig(
  scope: "client_source" | "agency_source",
  fallbackScopes: Array<"hq" | "client" | "agency">
) {
  const existing =
    readStoredProductMarketConfig(defaultProductMarketConfigKey(scope)) ||
    readStoredProductMarketConfig(currentProductMarketConfigKey(scope));
  if (existing) {
    return existing;
  }

  const seed =
    fallbackScopes
      .map((fallbackScope) =>
        readStoredProductMarketConfig(defaultProductMarketConfigKey(fallbackScope)) ||
        readStoredProductMarketConfig(currentProductMarketConfigKey(fallbackScope))
      )
      .find(Boolean) || null;

  if (!seed) {
    return null;
  }

  seedStoredProductMarketConfig(defaultProductMarketConfigKey(scope), seed);
  seedStoredProductMarketConfig(currentProductMarketConfigKey(scope), seed);
  return seed;
}

export function readClientTemplateProductMarketConfig() {
  const existing = (
    // 栏目配置保存的是源端的当前共享契约。项目页、左栏和页面锁定器
    // 必须先读取它；默认快照只用于当前契约尚不存在时的首次兜底。
    readAndAlignCatalogScope(currentProductMarketConfigKey("client_source"), "client_source") ||
    readAndAlignCatalogScope(defaultProductMarketConfigKey("client_source"), "client_source")
  );
  if (existing) return existing;
  const seeded = ensureSourceTemplateProductMarketConfig("client_source", ["hq"]);
  if (!seeded) return null;
  const aligned = ensureCatalogScope(seeded, "client_source");
  seedStoredProductMarketConfig(defaultProductMarketConfigKey("client_source"), aligned);
  seedStoredProductMarketConfig(currentProductMarketConfigKey("client_source"), aligned);
  return aligned;
}

export function readAgencyTemplateProductMarketConfig() {
  const existing = (
    readAndAlignCatalogScope(currentProductMarketConfigKey("agency_source"), "agency_source") ||
    readAndAlignCatalogScope(defaultProductMarketConfigKey("agency_source"), "agency_source")
  );
  if (existing) return existing;
  const seeded = ensureSourceTemplateProductMarketConfig("agency_source", ["hq"]);
  if (!seeded) return null;
  const aligned = ensureCatalogScope(seeded, "agency_source");
  seedStoredProductMarketConfig(defaultProductMarketConfigKey("agency_source"), aligned);
  seedStoredProductMarketConfig(currentProductMarketConfigKey("agency_source"), aligned);
  return aligned;
}

export function readHeadquartersProductMarketConfig() {
  return (
    readAndAlignCatalogScope(currentProductMarketConfigKey("hq"), "hq") ||
    readAndAlignCatalogScope(defaultProductMarketConfigKey("hq"), "hq")
  );
}

export function readClientPlanProductMarketConfig(siteId?: string | null) {
  return (
    readStoredProductMarketConfig(currentProductMarketConfigKey("client", siteId)) ||
    readStoredProductMarketConfig(defaultProductMarketConfigKey("client", siteId)) ||
    readStoredProductMarketConfig(currentProductMarketConfigKey("client")) ||
    readStoredProductMarketConfig(defaultProductMarketConfigKey("client")) ||
    readClientTemplateProductMarketConfig()
  );
}

export function readAgencyPlanProductMarketConfig(siteId?: string | null) {
  return (
    readStoredProductMarketConfig(currentProductMarketConfigKey("agency", siteId)) ||
    readStoredProductMarketConfig(defaultProductMarketConfigKey("agency", siteId)) ||
    readStoredProductMarketConfig(currentProductMarketConfigKey("agency")) ||
    readStoredProductMarketConfig(defaultProductMarketConfigKey("agency")) ||
    readAgencyTemplateProductMarketConfig()
  );
}
