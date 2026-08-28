import type {
  VisualCardComponentStyleOverrides,
  VisualCardRegionId,
} from "@/lib/visual-card-layout-contract";

type RegionThemeContract = {
  effectiveBackground: string;
  effectiveText: string;
};

/**
 * Region colours always resolve from the existing Layout Style / Shared
 * Variables contract. Component overrides select semantic roles; they never
 * persist a resolved theme colour or arbitrary CSS.
 */
export const VISUAL_CARD_REGION_THEME_CONTRACT: Record<VisualCardRegionId, RegionThemeContract> = {
  "total-frame": {
    effectiveBackground: "var(--tradepro-shared-workspace-bg, var(--tradepro-panel-bg, #ffffff))",
    effectiveText: "var(--tradepro-shared-workspace-text, var(--tradepro-panel-text, #0f172a))",
  },
  topbar: {
    effectiveBackground: "var(--tradepro-shared-topbar-bg, var(--tradepro-client-topbar-bg, var(--tradepro-shell-from, #0f172a)))",
    effectiveText: "var(--tradepro-shared-topbar-text, var(--tradepro-client-topbar-text, var(--tradepro-shell-text, #ffffff)))",
  },
  workspace: {
    effectiveBackground: "var(--tradepro-shared-workspace-bg, var(--tradepro-panel-bg, #ffffff))",
    effectiveText: "var(--tradepro-shared-workspace-text, var(--tradepro-panel-text, #0f172a))",
  },
  title: {
    effectiveBackground: "var(--tradepro-shared-title-bg, var(--tradepro-panel-title-bg, #8e2e62))",
    effectiveText: "var(--tradepro-shared-title-text, var(--tradepro-panel-title-text, #ffffff))",
  },
  "table-shell": {
    effectiveBackground: "var(--tradepro-shared-workspace-bg, var(--tradepro-panel-frame-bg, var(--tradepro-panel-bg, #ffffff)))",
    effectiveText: "var(--tradepro-shared-workspace-text, var(--tradepro-panel-frame-text, var(--tradepro-panel-text, #0f172a)))",
  },
  "table-header": {
    effectiveBackground: "var(--tradepro-shared-table-header-bg, var(--tradepro-panel-table-bg, #ffffff))",
    effectiveText: "var(--tradepro-shared-table-header-text, var(--tradepro-panel-table-text, #0f172a))",
  },
  content: {
    effectiveBackground: "var(--tradepro-shared-list-bg, var(--tradepro-product-market-content-bg, var(--tradepro-panel-list-bg, #ffffff)))",
    effectiveText: "var(--tradepro-shared-list-text, var(--tradepro-product-market-content-text, var(--tradepro-panel-list-text, #0f172a)))",
  },
  "large-card": {
    effectiveBackground: "var(--tradepro-product-market-large-card-bg, var(--tradepro-panel-card-bg, #ffffff))",
    effectiveText: "var(--tradepro-product-market-large-card-text, var(--tradepro-panel-card-text, #0f172a))",
  },
  "small-card": {
    effectiveBackground: "var(--tradepro-panel-card-bg, #ffffff)",
    effectiveText: "var(--tradepro-panel-card-text, #0f172a)",
  },
  footer: {
    effectiveBackground: "var(--tradepro-shared-footer-bg, var(--tradepro-client-footer-bg, var(--tradepro-shell-to, #0f172a)))",
    effectiveText: "var(--tradepro-shared-footer-text, var(--tradepro-client-footer-text, var(--tradepro-shell-text, #ffffff)))",
  },
};

const COMPONENT_RUNTIME_ATTRIBUTES = [
  "data-visual-card-runtime-component-style",
  "data-visual-card-runtime-background",
  "data-visual-card-runtime-text",
  "data-visual-card-runtime-padding-top",
  "data-visual-card-runtime-padding-right",
  "data-visual-card-runtime-padding-bottom",
  "data-visual-card-runtime-padding-left",
  "data-visual-card-runtime-gap",
  "data-visual-card-runtime-font-family",
  "data-visual-card-runtime-font-size",
  "data-visual-card-runtime-font-weight",
  "data-visual-card-runtime-line-height",
  "data-visual-card-runtime-letter-spacing",
  "data-visual-card-runtime-border-style",
  "data-visual-card-runtime-border-width",
  "data-visual-card-runtime-border-color",
  "data-visual-card-runtime-radius",
  "data-visual-card-runtime-shadow",
  "data-visual-card-annotation-visibility",
  "data-visual-card-annotation-mode",
] as const;

const COMPONENT_RUNTIME_PROPERTIES = [
  "--visual-card-component-background",
  "--visual-card-component-text",
  "--visual-card-component-padding-top",
  "--visual-card-component-padding-right",
  "--visual-card-component-padding-bottom",
  "--visual-card-component-padding-left",
  "--visual-card-component-gap",
  "--visual-card-component-font-family",
  "--visual-card-component-font-size",
  "--visual-card-component-font-weight",
  "--visual-card-component-line-height",
  "--visual-card-component-letter-spacing",
  "--visual-card-component-border-style",
  "--visual-card-component-border-width",
  "--visual-card-component-border-color",
  "--visual-card-component-radius",
  "--visual-card-component-shadow",
  "--tradepro-hover-capsule-bg",
  "--tradepro-hover-capsule-text",
] as const;

const COMPONENT_RUNTIME_PREVIOUS_INLINE_STYLES = new WeakMap<HTMLElement, Map<string, string>>();

function setVisualCardComponentRuntimeProperty(target: HTMLElement, property: string, value: string) {
  let previous = COMPONENT_RUNTIME_PREVIOUS_INLINE_STYLES.get(target);
  if (!previous) {
    previous = new Map();
    COMPONENT_RUNTIME_PREVIOUS_INLINE_STYLES.set(target, previous);
  }
  if (!previous.has(property)) previous.set(
    property,
    typeof target.style.getPropertyValue === "function" ? target.style.getPropertyValue(property) : "",
  );
  target.style.setProperty(property, value);
}

function resolveBackgroundRole(
  role: NonNullable<NonNullable<VisualCardComponentStyleOverrides["surface"]>["backgroundRole"]>,
  contract: RegionThemeContract,
) {
  if (role === "muted") return `color-mix(in srgb, ${contract.effectiveBackground} 88%, ${contract.effectiveText} 12%)`;
  if (role === "primary") return "var(--tradepro-shared-action-bg, var(--tradepro-panel-action-bg, #d94a87))";
  if (role === "secondary") return `var(--tradepro-shared-title-bg, var(--tradepro-panel-title-bg, ${contract.effectiveBackground}))`;
  if (role === "transparent") return "transparent";
  return contract.effectiveBackground;
}

function resolveTextRole(
  role: NonNullable<NonNullable<VisualCardComponentStyleOverrides["surface"]>["textRole"]>,
  contract: RegionThemeContract,
) {
  if (role === "muted") return `color-mix(in srgb, ${contract.effectiveText} 68%, transparent)`;
  if (role === "on-primary") return "var(--tradepro-shared-action-text, var(--tradepro-panel-action-text, #ffffff))";
  if (role === "on-secondary") return `var(--tradepro-shared-title-text, var(--tradepro-panel-title-text, ${contract.effectiveText}))`;
  return contract.effectiveText;
}

function resolveBorderRole(
  role: NonNullable<NonNullable<VisualCardComponentStyleOverrides["border"]>["colorRole"]>,
  contract: RegionThemeContract,
) {
  if (role === "muted") return `color-mix(in srgb, ${contract.effectiveText} 14%, transparent)`;
  if (role === "primary") return "var(--tradepro-shared-action-bg, var(--tradepro-panel-action-bg, #d94a87))";
  if (role === "secondary") return `var(--tradepro-shared-title-bg, var(--tradepro-panel-title-bg, ${contract.effectiveText}))`;
  return `color-mix(in srgb, ${contract.effectiveText} 28%, transparent)`;
}

function resolveShadowRole(
  role: NonNullable<NonNullable<VisualCardComponentStyleOverrides["border"]>["shadow"]>,
  contract: RegionThemeContract,
) {
  if (role === "none") return "none";
  if (role === "sm") return `0 0.125rem 0.5rem color-mix(in srgb, ${contract.effectiveText} 10%, transparent)`;
  if (role === "lg") return `0 1rem 2.25rem color-mix(in srgb, ${contract.effectiveText} 22%, transparent)`;
  return `var(--tradepro-layout-shadow, 0 0.5rem 1.25rem color-mix(in srgb, ${contract.effectiveText} 16%, transparent))`;
}

const FONT_FAMILY_VALUES = {
  body: "var(--tradepro-page-font-family, var(--tradepro-global-font-family, inherit))",
  heading: "var(--tradepro-shared-title-font-family, var(--tradepro-global-font-family, inherit))",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
} as const;

export function clearVisualCardComponentStyleRuntime(target: HTMLElement) {
  COMPONENT_RUNTIME_ATTRIBUTES.forEach((attribute) => target.removeAttribute(attribute));
  const previous = COMPONENT_RUNTIME_PREVIOUS_INLINE_STYLES.get(target);
  previous?.forEach((value, property) => {
    if (value) target.style.setProperty(property, value);
    else target.style.removeProperty(property);
  });
  COMPONENT_RUNTIME_PREVIOUS_INLINE_STYLES.delete(target);
}

export function applyVisualCardComponentStyleRuntime(
  target: HTMLElement,
  regionId: VisualCardRegionId,
  overrides?: VisualCardComponentStyleOverrides,
) {
  if (!overrides) return;
  const contract = VISUAL_CARD_REGION_THEME_CONTRACT[regionId];
  target.setAttribute("data-visual-card-runtime-component-style", "true");

  const backgroundRole = overrides.surface?.backgroundRole;
  const textRole = overrides.surface?.textRole;
  if (backgroundRole) {
    const value = resolveBackgroundRole(backgroundRole, contract);
    target.setAttribute("data-visual-card-runtime-background", backgroundRole);
    setVisualCardComponentRuntimeProperty(target, "--visual-card-component-background", value);
  }
  const pairedTextRole = textRole
    || (backgroundRole === "primary" ? "on-primary" : undefined)
    || (backgroundRole === "secondary" ? "on-secondary" : undefined);
  if (pairedTextRole || backgroundRole) {
    const value = pairedTextRole ? resolveTextRole(pairedTextRole, contract) : contract.effectiveText;
    target.setAttribute("data-visual-card-runtime-text", textRole || "auto");
    setVisualCardComponentRuntimeProperty(target, "--visual-card-component-text", value);
  }
  if (backgroundRole || textRole) {
    setVisualCardComponentRuntimeProperty(target, "--tradepro-hover-capsule-bg", backgroundRole ? resolveBackgroundRole(backgroundRole, contract) : contract.effectiveBackground);
    setVisualCardComponentRuntimeProperty(target, "--tradepro-hover-capsule-text", pairedTextRole ? resolveTextRole(pairedTextRole, contract) : contract.effectiveText);
  }

  const padding = overrides.spacing?.padding;
  (["top", "right", "bottom", "left"] as const).forEach((side) => {
    const value = padding?.[side];
    if (value === undefined) return;
    target.setAttribute(`data-visual-card-runtime-padding-${side}`, String(value));
    setVisualCardComponentRuntimeProperty(target, `--visual-card-component-padding-${side}`, `${value}px`);
  });
  if (overrides.spacing?.gapPx !== undefined) {
    target.setAttribute("data-visual-card-runtime-gap", String(overrides.spacing.gapPx));
    setVisualCardComponentRuntimeProperty(target, "--visual-card-component-gap", `${overrides.spacing.gapPx}px`);
  }

  const typography = overrides.typography;
  if (typography?.familyRole) {
    target.setAttribute("data-visual-card-runtime-font-family", typography.familyRole);
    setVisualCardComponentRuntimeProperty(target, "--visual-card-component-font-family", FONT_FAMILY_VALUES[typography.familyRole]);
  }
  if (typography?.sizePx !== undefined) {
    target.setAttribute("data-visual-card-runtime-font-size", String(typography.sizePx));
    setVisualCardComponentRuntimeProperty(target, "--visual-card-component-font-size", `${typography.sizePx}px`);
  }
  if (typography?.weight !== undefined) {
    target.setAttribute("data-visual-card-runtime-font-weight", String(typography.weight));
    setVisualCardComponentRuntimeProperty(target, "--visual-card-component-font-weight", String(typography.weight));
  }
  if (typography?.lineHeight !== undefined) {
    target.setAttribute("data-visual-card-runtime-line-height", String(typography.lineHeight));
    setVisualCardComponentRuntimeProperty(target, "--visual-card-component-line-height", String(typography.lineHeight));
  }
  if (typography?.letterSpacingEm !== undefined) {
    target.setAttribute("data-visual-card-runtime-letter-spacing", String(typography.letterSpacingEm));
    setVisualCardComponentRuntimeProperty(target, "--visual-card-component-letter-spacing", `${typography.letterSpacingEm}em`);
  }

  const border = overrides.border;
  if (border?.style) {
    target.setAttribute("data-visual-card-runtime-border-style", border.style);
    setVisualCardComponentRuntimeProperty(target, "--visual-card-component-border-style", border.style);
  }
  if (border?.widthPx !== undefined) {
    target.setAttribute("data-visual-card-runtime-border-width", String(border.widthPx));
    setVisualCardComponentRuntimeProperty(target, "--visual-card-component-border-width", `${border.widthPx}px`);
  }
  if (border?.colorRole) {
    target.setAttribute("data-visual-card-runtime-border-color", border.colorRole);
    setVisualCardComponentRuntimeProperty(target, "--visual-card-component-border-color", resolveBorderRole(border.colorRole, contract));
  }
  if (border?.radiusPx !== undefined) {
    target.setAttribute("data-visual-card-runtime-radius", String(border.radiusPx));
    setVisualCardComponentRuntimeProperty(target, "--visual-card-component-radius", `${border.radiusPx}px`);
  }
  if (border?.shadow) {
    target.setAttribute("data-visual-card-runtime-shadow", border.shadow);
    setVisualCardComponentRuntimeProperty(target, "--visual-card-component-shadow", resolveShadowRole(border.shadow, contract));
  }

  if (overrides.annotation?.visibility) {
    target.setAttribute("data-visual-card-annotation-visibility", overrides.annotation.visibility);
  }
  if (overrides.annotation?.mode) {
    target.setAttribute("data-visual-card-annotation-mode", overrides.annotation.mode);
  }
}
