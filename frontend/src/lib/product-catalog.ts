import { safeSetLocalStorage } from "./storage-guards";

export type ProductFlagState = {
  recommended: boolean;
  hot: boolean;
  published: boolean;
};

export type ProductTranslationState = "translated" | "partial" | "missing";

export type ProductAttribute = {
  id: string;
  name: string;
  value: string;
};

export type ProductAttachment = {
  id: string;
  name: string;
  url: string;
  note: string;
};

export type ProductImage = {
  id: string;
  url: string;
  alt: string;
};

export type ProductRecord = {
  id: string;
  category: string;
  title: string;
  slug: string;
  brand: string;
  keywords: string[];
  attributes: ProductAttribute[];
  images: ProductImage[];
  videoUrl: string;
  highlights: string;
  content: string;
  seoTitle: string;
  seoKeywords: string;
  seoDescription: string;
  attachments: ProductAttachment[];
  flags: ProductFlagState;
  sort: number;
  quality: number;
  translationStatus: ProductTranslationState;
  createdAt: string;
  updatedAt: string;
};

export type ProductCatalogState = {
  categories: string[];
  brandOptions: string[];
  attributeTemplate: string[];
  products: ProductRecord[];
};

const STORAGE_PREFIX = "tradepro.productCatalog:";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function defaultAttributes(): ProductAttribute[] {
  return [
    { id: uid("attr"), name: "品牌", value: "Machina Global" },
    { id: uid("attr"), name: "产地", value: "China" },
    { id: uid("attr"), name: "出货时间", value: "15-25 days" },
    { id: uid("attr"), name: "供应能力", value: "5000 sets / month" },
    { id: uid("attr"), name: "价格", value: "USD 199" },
    { id: uid("attr"), name: "划线价", value: "USD 239" },
    { id: uid("attr"), name: "单位", value: "set" },
    { id: uid("attr"), name: "最小起订量", value: "10" },
  ];
}

function makeProduct(seed: {
  id: string;
  category: string;
  title: string;
  brand: string;
  quality: number;
  translationStatus: ProductTranslationState;
  flags: ProductFlagState;
  sort: number;
}): ProductRecord {
  const createdAt = nowIso();
  const slug = slugify(seed.title);
  return {
    id: seed.id,
    category: seed.category,
    title: seed.title,
    slug,
    brand: seed.brand,
    keywords: [seed.title, `${seed.title} supplier`, `${seed.title} manufacturer`].slice(0, 5),
    attributes: defaultAttributes(),
    images: [
      { id: uid("img"), url: "", alt: `${seed.title} main image` },
      { id: uid("img"), url: "", alt: `${seed.title} detail image 1` },
      { id: uid("img"), url: "", alt: `${seed.title} detail image 2` },
    ],
    videoUrl: "",
    highlights: `${seed.title} supports B2B export sales, stable quality delivery, and multi-market deployment.`,
    content:
      `${seed.title} is designed for overseas B2B buyers and supports long-form product content editing. ` +
      `You can describe application scenarios, specifications, factory strength, delivery capability, and service process here.`,
    seoTitle: seed.title,
    seoKeywords: `${seed.title}, ${seed.category}, ${seed.brand}`,
    seoDescription: `${seed.title} from ${seed.brand}. Explore specifications, applications, and inquiry details.`,
    attachments: [],
    flags: seed.flags,
    sort: seed.sort,
    quality: seed.quality,
    translationStatus: seed.translationStatus,
    createdAt,
    updatedAt: createdAt,
  };
}

export function createDefaultProductCatalogState(): ProductCatalogState {
  return {
    categories: ["工业设备", "阀门配件", "新能源产品", "包装机械", "LED 照明"],
    brandOptions: ["Machina Global", "Atlas Industrial", "OEM"],
    attributeTemplate: ["品牌", "产地", "出货时间", "供应能力", "价格", "划线价", "单位", "最小起订量"],
    products: [
      makeProduct({
        id: "P-1001",
        category: "工业设备",
        title: "High Pressure Ball Valve",
        brand: "Atlas Industrial",
        quality: 92,
        translationStatus: "translated",
        flags: { recommended: true, hot: true, published: true },
        sort: 120,
      }),
      makeProduct({
        id: "P-1002",
        category: "新能源产品",
        title: "Monocrystalline Solar Panel 550W",
        brand: "Machina Global",
        quality: 88,
        translationStatus: "partial",
        flags: { recommended: true, hot: false, published: true },
        sort: 96,
      }),
      makeProduct({
        id: "P-1003",
        category: "包装机械",
        title: "Automatic Carton Sealing Machine",
        brand: "OEM",
        quality: 74,
        translationStatus: "missing",
        flags: { recommended: false, hot: false, published: false },
        sort: 60,
      }),
    ],
  };
}

function storageKey(scopeId: string) {
  return `${STORAGE_PREFIX}${scopeId || "client:draft"}`;
}

function normalizeProduct(record: ProductRecord): ProductRecord {
  const title = record.title.trim();
  const slug = record.slug.trim() || slugify(title);
  const now = nowIso();
  return {
    ...record,
    title,
    slug,
    brand: record.brand.trim(),
    category: record.category.trim(),
    keywords: record.keywords.map((item) => item.trim()).filter(Boolean).slice(0, 5),
    attributes: record.attributes.map((item) => ({
      ...item,
      name: item.name.trim(),
      value: item.value.trim(),
    })),
    images: record.images.map((item, index) => ({
      ...item,
      alt: item.alt.trim() || `${title || "Product"} image ${index + 1}`,
    })),
    attachments: record.attachments.map((item) => ({
      ...item,
      name: item.name.trim(),
      note: item.note.trim(),
      url: item.url.trim(),
    })),
    updatedAt: now,
  };
}

function normalizeCatalogState(state: ProductCatalogState): ProductCatalogState {
  return {
    categories: Array.from(new Set(state.categories.map((item) => item.trim()).filter(Boolean))),
    brandOptions: Array.from(new Set(state.brandOptions.map((item) => item.trim()).filter(Boolean))),
    attributeTemplate: Array.from(new Set(state.attributeTemplate.map((item) => item.trim()).filter(Boolean))),
    products: state.products.map(normalizeProduct).sort((a, b) => b.sort - a.sort || b.updatedAt.localeCompare(a.updatedAt)),
  };
}

export function cloneProductCatalogState(state: ProductCatalogState) {
  return normalizeCatalogState(structuredClone(state));
}

export function getProductCatalogState(scopeId: string): ProductCatalogState {
  try {
    const raw = window.localStorage.getItem(storageKey(scopeId));
    if (!raw) return createDefaultProductCatalogState();
    return normalizeCatalogState({
      ...createDefaultProductCatalogState(),
      ...JSON.parse(raw),
    } as ProductCatalogState);
  } catch {
    return createDefaultProductCatalogState();
  }
}

export function saveProductCatalogState(state: ProductCatalogState, scopeId: string) {
  const normalized = normalizeCatalogState(state);
  safeSetLocalStorage(storageKey(scopeId), JSON.stringify(normalized), { compact: true });
  window.dispatchEvent(
    new CustomEvent("product-catalog-updated", {
      detail: { scopeId, storageKey: storageKey(scopeId) },
    })
  );
}

export function createEmptyProduct(nextId?: string): ProductRecord {
  const createdAt = nowIso();
  return {
    id: nextId || `P-${Math.floor(Math.random() * 9000 + 1000)}`,
    category: "",
    title: "",
    slug: "",
    brand: "",
    keywords: [],
    attributes: defaultAttributes(),
    images: [
      { id: uid("img"), url: "", alt: "" },
      { id: uid("img"), url: "", alt: "" },
      { id: uid("img"), url: "", alt: "" },
    ],
    videoUrl: "",
    highlights: "",
    content: "",
    seoTitle: "",
    seoKeywords: "",
    seoDescription: "",
    attachments: [],
    flags: { recommended: false, hot: false, published: false },
    sort: 0,
    quality: 0,
    translationStatus: "missing",
    createdAt,
    updatedAt: createdAt,
  };
}

export function duplicateProduct(product: ProductRecord): ProductRecord {
  const duplicated = structuredClone(product);
  duplicated.id = `P-${Math.floor(Math.random() * 9000 + 1000)}`;
  duplicated.title = `${product.title} Copy`;
  duplicated.slug = slugify(duplicated.title);
  duplicated.createdAt = nowIso();
  duplicated.updatedAt = duplicated.createdAt;
  duplicated.images = duplicated.images.map((item) => ({ ...item, id: uid("img") }));
  duplicated.attributes = duplicated.attributes.map((item) => ({ ...item, id: uid("attr") }));
  duplicated.attachments = duplicated.attachments.map((item) => ({ ...item, id: uid("file") }));
  return duplicated;
}

export function buildProductBlockSnapshot(state: ProductCatalogState) {
  return state.products
    .filter((item) => item.flags.published)
    .sort((a, b) => b.sort - a.sort || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      title: item.title,
      body: item.highlights || item.seoDescription || item.content.slice(0, 180),
      image: item.images[0]?.url || "",
      value: item.category,
      link: `#product-${item.slug || slugify(item.title)}`,
    }));
}
