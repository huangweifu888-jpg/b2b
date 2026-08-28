import { RESPONSIVE_SHELL_FACTORY_DEFAULT } from "./responsive-shell-contract";

export const SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT = {
  version: "1.0.0",
  tokenSource: "layout-style",
  large: {
    region: "large-card",
    label: "大卡片",
    markerPlacement: "card-center",
  },
  small: {
    region: "small-card",
    label: "小卡片",
  },
} as const;

export type SharedLayoutStyleCardRegion = "large-card" | "small-card";

/**
 * Attribute-only card discovery changes must reach both FactoryPage and the
 * ResponsivePageHost template projection.  Keeping this list beside the
 * semantic resolver prevents one runtime from refreshing while the other
 * keeps a stale large/small palette assignment.
 */
export const SHARED_LAYOUT_STYLE_CARD_REGION_DISCOVERY_MUTATION_ATTRIBUTES = [
  "class",
  "style",
  "hidden",
  "aria-hidden",
  "aria-busy",
  "data-state",
  "data-loading",
  "data-page-route-loading",
  "data-development-standard-frame-region",
  "data-page-factory-region",
  "data-page-card-size",
  "data-page-card-role",
  "data-shared-large-card-surface",
  "data-shared-small-card-surface",
  "data-page-layout-card",
  "data-slot",
  "data-social-content-card",
  "data-tradepro-card-content",
  "data-page-factory-responsive-grid",
  "data-responsive-capacity-grid",
] as const;

type SharedLayoutStyleCardSemanticElement = {
  getAttribute(name: string): string | null;
};

const resolveExplicitSharedLayoutStyleCardRegion = (
  element: SharedLayoutStyleCardSemanticElement,
): SharedLayoutStyleCardRegion | null => {
  for (const attribute of [
    "data-development-standard-frame-region",
    "data-page-factory-region",
  ] as const) {
    const value = element.getAttribute(attribute);
    if (value === "large-card" || value === "small-card") return value;
  }

  const pageCardSize = element.getAttribute("data-page-card-size");
  if (pageCardSize === "large" || pageCardSize === "small") return `${pageCardSize}-card`;

  if (element.getAttribute("data-shared-small-card-surface") === "true") return "small-card";
  if (element.getAttribute("data-shared-large-card-surface") === "true") return "large-card";
  return null;
};

/**
 * Resolves one card's effective shared Layout Style region. Authored semantic
 * attributes always win; responsive grouping is only a legacy fallback for a
 * card that has no large/small meaning of its own.
 */
export function resolveSharedLayoutStyleCardRegion(
  element: SharedLayoutStyleCardSemanticElement,
  groupedCardCount: number,
): SharedLayoutStyleCardRegion {
  return resolveExplicitSharedLayoutStyleCardRegion(element)
    ?? (groupedCardCount > 1 ? "small-card" : "large-card");
}

export const SHARED_LAYOUT_STYLE_LARGE_CARD_PROPS = {
  "data-page-factory-region": SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT.large.region,
  "data-page-card-size": "large",
  "data-development-standard-frame-region": SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT.large.region,
  "data-development-standard-frame-label": SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT.large.label,
  "data-development-standard-marker-placement": SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT.large.markerPlacement,
  "data-shared-large-card-surface": "true",
  "data-shared-card-token-source": SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT.tokenSource,
} as const;

export const SHARED_LAYOUT_STYLE_SMALL_CARD_PROPS = {
  "data-page-factory-region": SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT.small.region,
  "data-page-card-size": "small",
  "data-development-standard-frame-region": SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT.small.region,
  "data-development-standard-frame-label": SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT.small.label,
  "data-shared-small-card-surface": "true",
  "data-shared-card-token-source": SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT.tokenSource,
} as const;

export const SHARED_LAYOUT_STYLE_REGION_CONTRACT = {
  version: "1.0.0",
  tokenSource: SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT.tokenSource,
  regions: ["body", "title-2", "table-shell", "table-header", "content", "large-card", "small-card", "footer"] as const,
} as const;

export type SharedLayoutStyleRegion = (typeof SHARED_LAYOUT_STYLE_REGION_CONTRACT.regions)[number];

const SHARED_LAYOUT_STYLE_REGION_PROPS: Record<SharedLayoutStyleRegion, Readonly<Record<string, string>>> = {
  body: {
    "data-shared-region-token-source": SHARED_LAYOUT_STYLE_REGION_CONTRACT.tokenSource,
  },
  "title-2": {
    "data-responsive-shared-surface": "title-2",
    "data-responsive-shared-surface-plugin": RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedSurfaces.plugin,
    "data-shared-region-token-source": SHARED_LAYOUT_STYLE_REGION_CONTRACT.tokenSource,
  },
  "table-shell": {
    "data-page-table-shell": "true",
    "data-shared-region-token-source": SHARED_LAYOUT_STYLE_REGION_CONTRACT.tokenSource,
  },
  "table-header": {
    "data-page-table-header": "true",
    "data-responsive-shared-surface": "table-header",
    "data-responsive-shared-surface-plugin": RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedSurfaces.plugin,
    "data-shared-region-token-source": SHARED_LAYOUT_STYLE_REGION_CONTRACT.tokenSource,
  },
  content: {
    "data-shared-content-surface": "true",
    "data-shared-region-token-source": SHARED_LAYOUT_STYLE_REGION_CONTRACT.tokenSource,
  },
  "large-card": {
    "data-page-card-size": "large",
    "data-shared-large-card-surface": "true",
    "data-shared-card-token-source": SHARED_LAYOUT_STYLE_REGION_CONTRACT.tokenSource,
    "data-shared-region-token-source": SHARED_LAYOUT_STYLE_REGION_CONTRACT.tokenSource,
  },
  "small-card": {
    "data-page-card-size": "small",
    "data-shared-small-card-surface": "true",
    "data-shared-card-token-source": SHARED_LAYOUT_STYLE_REGION_CONTRACT.tokenSource,
    "data-shared-region-token-source": SHARED_LAYOUT_STYLE_REGION_CONTRACT.tokenSource,
  },
  footer: {
    "data-shared-footer-region": "true",
    "data-shared-region-token-source": SHARED_LAYOUT_STYLE_REGION_CONTRACT.tokenSource,
  },
};

/**
 * Returns the shared Layout Style attributes for one canonical Page Factory
 * region.  FactoryPage and ResponsivePageHost both consume this resolver so a
 * runtime-projected legacy page and an authored factory page cannot drift into
 * two different visual contracts.
 */
export function resolveSharedLayoutStyleRegionProps(region: string): Readonly<Record<string, string>> {
  return SHARED_LAYOUT_STYLE_REGION_CONTRACT.regions.includes(region as SharedLayoutStyleRegion)
    ? SHARED_LAYOUT_STYLE_REGION_PROPS[region as SharedLayoutStyleRegion]
    : {};
}
