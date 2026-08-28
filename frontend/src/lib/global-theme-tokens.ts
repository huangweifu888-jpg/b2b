import type { LayoutCustomStyle, SidebarStyle } from "@/lib/product-market-store";
import { resolveAccessibleTextColor } from "@/lib/color-contrast";

/** The CSS custom properties that every global theme preview may temporarily override. */
export const GLOBAL_THEME_TOKEN_NAMES = [
  "--tradepro-shell-from",
  "--tradepro-shell-via",
  "--tradepro-shell-to",
  "--tradepro-shell-text",
  "--tradepro-shell-highlight",
  "--tradepro-shell-border",
  "--tradepro-shell-active-text",
  "--tradepro-shared-selection-bg",
  "--tradepro-shared-selection-text",
  "--tradepro-shared-selection-outline",
  "--tradepro-panel-bg",
  "--tradepro-panel-text",
  "--tradepro-panel-frame-bg",
  "--tradepro-panel-frame-text",
  "--tradepro-panel-title-bg",
  "--tradepro-panel-title-text",
  "--tradepro-panel-title-2-bg",
  "--tradepro-panel-title-2-text",
  "--tradepro-panel-title-2-primary",
  "--tradepro-panel-title-2-primary-text",
  "--tradepro-panel-title-2-border",
  "--tradepro-panel-action-bg",
  "--tradepro-panel-action-text",
  "--tradepro-panel-card-bg",
  "--tradepro-panel-card-text",
  "--tradepro-panel-table-bg",
  "--tradepro-panel-table-text",
  "--tradepro-panel-list-bg",
  "--tradepro-panel-list-text",
  "--tradepro-product-market-content-bg",
  "--tradepro-product-market-content-text",
  "--tradepro-product-market-large-card-bg",
  "--tradepro-product-market-large-card-text",
  "--tradepro-layout-frame-radius",
  "--tradepro-layout-table-header-radius",
  "--tradepro-layout-card-radius",
  "--tradepro-layout-space",
  "--tradepro-layout-shadow",
  "--tradepro-client-topbar-bg",
  "--tradepro-client-topbar-text",
  "--tradepro-client-footer-bg",
  "--tradepro-client-footer-text",
] as const;

export type GlobalThemeTokenName = (typeof GLOBAL_THEME_TOKEN_NAMES)[number];
export type GlobalThemeTokens = Record<GlobalThemeTokenName, string>;
export type GlobalFooterTheme = {
  background: string;
  text: string;
};

/**
 * One semantic contract for selectable shared surfaces. A selected surface
 * must advertise the control role as well as its current state so the visual
 * developer, accessibility tree and runtime parity scanner read the same
 * source of truth.
 */
export const SHARED_SELECTION_SURFACE_CONTRACT = {
  controlAttribute: "data-shared-selection-control",
  selectedAttribute: "data-selected",
  pressedAttribute: "aria-pressed",
  backgroundToken: "--tradepro-shared-selection-bg",
  textToken: "--tradepro-shared-selection-text",
  outlineToken: "--tradepro-shared-selection-outline",
} as const;

export function isSharedSelectionSurfaceActive(element: HTMLElement) {
  if (element.getAttribute(SHARED_SELECTION_SURFACE_CONTRACT.controlAttribute) !== "true") return false;
  return element.getAttribute(SHARED_SELECTION_SURFACE_CONTRACT.selectedAttribute) === "true"
    || element.getAttribute(SHARED_SELECTION_SURFACE_CONTRACT.pressedAttribute) === "true"
    || ["active", "checked", "selected"].includes(element.dataset.state || "");
}

/** Interactive shared choices expose one boolean state to CSS, the visual
 * developer and assistive technology. A mismatch must fail the global gate. */
export function hasSharedSelectionSurfaceStateParity(element: HTMLElement) {
  if (element.getAttribute(SHARED_SELECTION_SURFACE_CONTRACT.controlAttribute) !== "true") return false;
  const selected = element.getAttribute(SHARED_SELECTION_SURFACE_CONTRACT.selectedAttribute);
  if (selected !== "true" && selected !== "false") return false;
  if (element.matches("button, [role='button']")) {
    return element.getAttribute(SHARED_SELECTION_SURFACE_CONTRACT.pressedAttribute) === selected;
  }
  return true;
}

/**
 * High-contrast warm fallback shared by the two selected-state ownership zones.
 * The left and right fields remain independently configurable, while factory
 * defaults intentionally start from the same clear, bright text colour.
 */
export const LEFT_SELECTED_TEXT_FALLBACK = "#FFFFCC";
export const RIGHT_SELECTED_TEXT_FALLBACK = "#FFFFCC";
export const PREVIOUS_RIGHT_SELECTED_TEXT_FALLBACKS = ["#EEFFFF", "#FFFCEB"] as const;

/** Upgrades only the short-lived former factory default; custom colours stay intact. */
export function normalizeRightSelectedTextPreference(value: string | undefined) {
  const normalized = value?.trim();
  return PREVIOUS_RIGHT_SELECTED_TEXT_FALLBACKS.includes(
    normalized?.toUpperCase() as (typeof PREVIOUS_RIGHT_SELECTED_TEXT_FALLBACKS)[number],
  )
    ? RIGHT_SELECTED_TEXT_FALLBACK
    : normalized;
}

/** Keeps saved colours intact while preventing low-contrast foregrounds at runtime. */
export function resolveAccessibleThemeTextColor(
  background: string | undefined,
  preferredText: string | undefined,
  fallback = "#0F172A",
  light = "#F8FAFC",
  minimumContrast = 4.5
) {
  return resolveAccessibleTextColor(background, preferredText, fallback, light, minimumContrast);
}

/**
 * The global footer follows the sidebar gradient end unless the user has made
 * an explicit footer-only choice. Legacy `footerBgColor`/`footerTextColor`
 * fields stay readable for old theme payloads, but they no longer mask the
 * shared sidebar contract at runtime.
 */
export function resolveGlobalFooterTheme(
  layout: LayoutCustomStyle,
  sidebar: SidebarStyle,
): GlobalFooterTheme {
  const sidebarStart = sidebar.bgFrom || "#4a1834";
  const sidebarEnd = sidebar.bgTo || sidebar.bgVia || sidebarStart || "#2a0d1d";
  const sidebarText = resolveAccessibleThemeTextColor(sidebarStart, sidebar.textColor || "#fff7fb");
  return {
    background: layout.clientFooterOverrideBgColor?.trim() || sidebarEnd,
    text: layout.clientFooterOverrideTextColor?.trim() || sidebarText,
  };
}

/**
 * Resolves the actual runtime CSS tokens used by both the application shell
 * and product-market theme hover previews. Keeping this in one place prevents
 * a preview palette from drifting away from a globally-applied palette.
 */
export function resolveGlobalThemeTokens(layout: LayoutCustomStyle, sidebar: SidebarStyle): GlobalThemeTokens {
  const panelBackground = layout.contentBgColor || "#ffffff";
  const panelText = resolveAccessibleThemeTextColor(panelBackground, layout.contentTextColor);
  const cardBackground = layout.clientFeatureCardBgColor || layout.clientCardBgColor || "#ffffff";
  const cardText = resolveAccessibleThemeTextColor(cardBackground, layout.clientFeatureCardTextColor || layout.clientCardTextColor || panelText);
  const tableBackground = layout.clientSecondaryListBgColor || "#ffffff";
  const tableText = resolveAccessibleThemeTextColor(tableBackground, layout.clientSecondaryListTextColor || panelText);
  const frameBackground = layout.clientSecondaryPageBgColor || "#ffffff";
  const frameText = resolveAccessibleThemeTextColor(frameBackground, layout.clientSecondaryPageTextColor || panelText);
  const contentBackground = layout.clientSecondaryContentBgColor || layout.clientSecondaryPageBgColor || cardBackground;
  const contentText = resolveAccessibleThemeTextColor(contentBackground, layout.clientSecondaryContentTextColor || layout.clientSecondaryPageTextColor || cardText);
  const largeCardBackground = layout.clientLargeCardBgColor || cardBackground;
  const largeCardText = resolveAccessibleThemeTextColor(largeCardBackground, layout.clientLargeCardTextColor || cardText);
  const cornerRadius = {
    square: "0px",
    soft: "0.75rem",
    round: "1.5rem",
  } as const;
  const spacing = {
    compact: "0.5rem",
    standard: "0.75rem",
    relaxed: "1rem",
  } as const;
  const elevation = {
    flat: "none",
    soft: "0 0.25rem 0.75rem color-mix(in srgb, var(--tradepro-panel-text, #0f172a) 12%, transparent)",
    raised: "0 0.625rem 1.5rem color-mix(in srgb, var(--tradepro-panel-text, #0f172a) 18%, transparent)",
  } as const;
  const sidebarStart = sidebar.bgFrom || "#4a1834";
  const sidebarMiddle = sidebar.bgVia || sidebarStart || "#3a1229";
  const sidebarEnd = sidebar.bgTo || sidebarMiddle || "#2a0d1d";
  const sidebarText = resolveAccessibleThemeTextColor(sidebarStart, sidebar.textColor || "#fff7fb");
  const sidebarSelectionBackground = sidebar.borderColor || sidebar.activeHighlight || sidebarStart;
  const sidebarSelectionText = resolveAccessibleThemeTextColor(
    sidebarSelectionBackground,
    sidebar.activeHighlight || sidebarText,
    "#000000",
    LEFT_SELECTED_TEXT_FALLBACK,
  );
  const titleBackground = layout.clientSecondaryTitleBgColor || "#8e2e62";
  const title2Background = layout.themePanelBgColor || layout.clientSecondaryPageBgColor || "#fce8f1";
  const title2Text = resolveAccessibleThemeTextColor(title2Background, layout.themePanelTextColor || layout.contentTextColor);
  const actionBackground = layout.themePanelButtonColor || "#d94a87";
  const actionText = resolveAccessibleThemeTextColor(actionBackground, layout.headerButtonTextColor || "#ffffff");
  // Right-side project pages and standard dialogs share their own selected
  // state. Old drafts retain the former sidebar colours until the new right
  // selection fields are saved, so upgrading a source never repaints it.
  const selectionBackground = layout.rightSelectedFrameColor?.trim() || sidebar.borderColor || actionBackground;
  const selectionText = resolveAccessibleThemeTextColor(
    selectionBackground,
    normalizeRightSelectedTextPreference(layout.rightSelectedTextColor) || sidebar.activeHighlight || actionText,
    "#000000",
    RIGHT_SELECTED_TEXT_FALLBACK,
  );
  const topbarBackground = layout.clientTopbarOverrideBgColor || sidebarStart;
  const footerTheme = resolveGlobalFooterTheme(layout, sidebar);

  return {
    "--tradepro-shell-from": sidebarStart,
    "--tradepro-shell-via": sidebarMiddle,
    "--tradepro-shell-to": sidebarEnd,
    "--tradepro-shell-text": sidebarText,
    "--tradepro-shell-highlight": sidebar.activeHighlight || "#d94a87",
    "--tradepro-shell-border": sidebar.borderColor || "#e67aae",
    "--tradepro-shell-active-text": sidebarSelectionText,
    "--tradepro-shared-selection-bg": selectionBackground,
    "--tradepro-shared-selection-text": selectionText,
    "--tradepro-shared-selection-outline": `color-mix(in srgb, ${selectionBackground} 76%, ${selectionText} 24%)`,
    "--tradepro-panel-bg": panelBackground,
    "--tradepro-panel-text": panelText,
    "--tradepro-panel-frame-bg": frameBackground,
    "--tradepro-panel-frame-text": frameText,
    "--tradepro-panel-title-bg": titleBackground,
    "--tradepro-panel-title-text": resolveAccessibleThemeTextColor(titleBackground, layout.clientSecondaryTitleTextColor || "#ffffff"),
    "--tradepro-panel-title-2-bg": title2Background,
    "--tradepro-panel-title-2-text": title2Text,
    "--tradepro-panel-title-2-primary": actionBackground,
    "--tradepro-panel-title-2-primary-text": actionText,
    "--tradepro-panel-title-2-border": title2Text,
    "--tradepro-panel-action-bg": actionBackground,
    "--tradepro-panel-action-text": actionText,
    "--tradepro-panel-card-bg": cardBackground,
    "--tradepro-panel-card-text": cardText,
    "--tradepro-panel-table-bg": tableBackground,
    "--tradepro-panel-table-text": tableText,
    "--tradepro-panel-list-bg": cardBackground,
    "--tradepro-panel-list-text": cardText,
    "--tradepro-product-market-content-bg": contentBackground,
    "--tradepro-product-market-content-text": contentText,
    "--tradepro-product-market-large-card-bg": largeCardBackground,
    "--tradepro-product-market-large-card-text": largeCardText,
    "--tradepro-layout-frame-radius": cornerRadius[layout.frameCornerRadius || "round"],
    "--tradepro-layout-table-header-radius": cornerRadius[layout.tableHeaderCornerRadius || "soft"],
    "--tradepro-layout-card-radius": cornerRadius[layout.cardCornerRadius || "soft"],
    "--tradepro-layout-space": spacing[layout.frameDensity || "standard"],
    "--tradepro-layout-shadow": elevation[layout.frameElevation || "flat"],
    "--tradepro-client-topbar-bg": topbarBackground,
    "--tradepro-client-topbar-text": resolveAccessibleThemeTextColor(topbarBackground, layout.clientTopbarOverrideTextColor || sidebarText),
    "--tradepro-client-footer-bg": footerTheme.background,
    "--tradepro-client-footer-text": footerTheme.text,
  };
}

export function applyGlobalThemeTokens(root: HTMLElement, tokens: GlobalThemeTokens) {
  GLOBAL_THEME_TOKEN_NAMES.forEach((name) => root.style.setProperty(name, tokens[name]));
}
