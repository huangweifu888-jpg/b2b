const ELIGIBLE_PAGE_STATUSES = new Set(["complete", "pilot-complete"]);

export const RESPONSIVE_AUDIT_INTENTIONAL_ISOLATION_PAGE_IDS = Object.freeze([
  "auth-callback",
  "auth-error",
  "client-logout-callback",
  "client-preview-frame",
  "client-preview-site",
]);

export function registeredResponsiveSourceTemplateKey(page) {
  return `${page.sourceScope}:${page.template}`;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function representativeRank(page) {
  return [
    page.regionStrategy === "runtime-auto" ? 0 : 1,
    page.status === "complete" ? 0 : 1,
    String(page.route || "").includes(":") ? 1 : 0,
    String(page.route || "").length,
    String(page.id || ""),
  ];
}

function compareRepresentative(left, right) {
  const leftRank = representativeRank(left);
  const rightRank = representativeRank(right);
  for (let index = 0; index < leftRank.length; index += 1) {
    const leftValue = leftRank[index];
    const rightValue = rightRank[index];
    if (typeof leftValue === "number" && typeof rightValue === "number" && leftValue !== rightValue) {
      return leftValue - rightValue;
    }
    const compared = compareText(String(leftValue), String(rightValue));
    if (compared) return compared;
  }
  return 0;
}

/**
 * Selects one deterministic real page for every adopted source-shell/template
 * combination. The registry remains the only target inventory; adding a new
 * populated combination automatically expands the browser matrix.
 */
export function selectRegisteredResponsiveAuditPages(pages, intentionalIsolationPageIds = []) {
  if (!Array.isArray(pages)) throw new TypeError("Page Factory registry pages must be an array");
  const isolated = new Set(intentionalIsolationPageIds);
  const eligible = pages.filter((page) => page
    && ELIGIBLE_PAGE_STATUSES.has(page.status)
    && !isolated.has(page.id));
  const expectedKeys = new Set(eligible.map(registeredResponsiveSourceTemplateKey));
  const selectedByKey = new Map();

  for (const page of [...eligible].sort((left, right) => {
    const keyComparison = compareText(
      registeredResponsiveSourceTemplateKey(left),
      registeredResponsiveSourceTemplateKey(right),
    );
    return keyComparison || compareRepresentative(left, right);
  })) {
    const key = registeredResponsiveSourceTemplateKey(page);
    if (!selectedByKey.has(key)) selectedByKey.set(key, page);
  }

  const selected = [...selectedByKey.values()];
  const selectedKeys = new Set(selected.map(registeredResponsiveSourceTemplateKey));
  if (selectedKeys.size !== expectedKeys.size || [...expectedKeys].some((key) => !selectedKeys.has(key))) {
    throw new Error("Registry-derived responsive representatives do not cover every adopted source/template combination");
  }
  return selected;
}

/** Keeps the existing three-source semantic-collapse coverage registry-driven. */
export function selectRegisteredResponsiveSemanticPages(pages, intentionalIsolationPageIds = []) {
  const isolated = new Set(intentionalIsolationPageIds);
  const semanticTabs = new Set(["modules", "layout", "service"]);
  return pages.filter((page) => {
    if (!page || !ELIGIBLE_PAGE_STATUSES.has(page.status) || isolated.has(page.id) || page.template !== "reference") {
      return false;
    }
    const [, rawSearch = ""] = String(page.route || "").split("?", 2);
    return semanticTabs.has(new URLSearchParams(rawSearch).get("tab"));
  }).sort((left, right) => compareText(String(left.id || ""), String(right.id || "")));
}
