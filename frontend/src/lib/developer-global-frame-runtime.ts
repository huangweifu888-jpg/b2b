import {
  buildDeveloperGlobalFrameAdapterRootSelector,
  findDeveloperGlobalFrameAdapterByProfilePageId,
  type DeveloperGlobalFrameAdapterRegistration,
} from "@/lib/developer-global-frame-adapter-registry";
import {
  resolveDeveloperGlobalFrameProfilePageId,
  type DeveloperGlobalFrameAdapterResolution,
} from "@/lib/developer-global-frame-adapter-resolution";
import {
  validateDeveloperGlobalFrameSection,
  type DeveloperGlobalFrameRegion,
  type DeveloperGlobalFrameRegionTokens,
  type DeveloperGlobalFrameSection,
} from "@/lib/developer-global-frame-draft";
import {
  existingWorkspaceBodyMarkerHitAreaMatchesGeometry,
  findExistingWorkspaceBodyMarkerHitArea,
  findExistingWorkspaceBodyMarkerHost,
} from "@/lib/layout-frame-contract";

export const DEVELOPER_GLOBAL_FRAME_RUNTIME_ATTRIBUTE = "data-developer-global-frame-runtime" as const;
export const DEVELOPER_GLOBAL_FRAME_RUNTIME_REGION_ATTRIBUTE = "data-developer-global-frame-runtime-region" as const;
const DEVELOPER_GLOBAL_FRAME_ANNOTATION_REGIONS = new Set<DeveloperGlobalFrameRegion>([
  "workspace",
  "title",
  "table-shell",
  "table-header",
  "content",
]);

export const DEVELOPER_GLOBAL_FRAME_RUNTIME_TOKEN_ALLOWLIST = Object.freeze({
  topbar: ["background_color", "foreground_color", "border_color", "font_family", "font_size", "font_weight", "letter_spacing", "line_height", "padding_top", "padding_right", "padding_bottom", "padding_left", "gap"],
  workspace: ["background_color", "foreground_color", "border_color", "border_width", "border_radius", "box_shadow", "font_family", "font_size", "font_weight", "letter_spacing", "line_height", "padding_top", "padding_right", "padding_bottom", "padding_left", "gap", "annotation_visible", "annotation_offset", "annotation_font_size"],
  title: ["background_color", "foreground_color", "border_color", "border_width", "border_radius", "box_shadow", "font_family", "font_size", "font_weight", "letter_spacing", "line_height", "padding_top", "padding_right", "padding_bottom", "padding_left", "gap", "annotation_visible", "annotation_offset", "annotation_font_size"],
  "table-shell": ["background_color", "foreground_color", "border_color", "border_width", "border_radius", "box_shadow", "padding_top", "padding_right", "padding_bottom", "padding_left", "gap", "annotation_visible", "annotation_offset", "annotation_font_size"],
  "table-header": ["background_color", "foreground_color", "border_color", "border_width", "border_radius", "box_shadow", "font_family", "font_size", "font_weight", "letter_spacing", "line_height", "padding_top", "padding_right", "padding_bottom", "padding_left", "gap", "annotation_visible", "annotation_offset", "annotation_font_size"],
  content: ["background_color", "foreground_color", "border_color", "border_width", "border_radius", "box_shadow", "font_family", "font_size", "font_weight", "letter_spacing", "line_height", "padding_top", "padding_right", "padding_bottom", "padding_left", "gap", "right_inset", "annotation_visible", "annotation_offset", "annotation_font_size"],
  footer: ["background_color", "foreground_color", "border_color", "font_family", "font_size", "font_weight", "letter_spacing", "line_height", "padding_top", "padding_right", "padding_bottom", "padding_left", "gap"],
  scrollbar: ["scrollbar_gutter", "scrollbar_width"],
} satisfies Record<DeveloperGlobalFrameRegion, readonly (keyof DeveloperGlobalFrameRegionTokens)[]>);

export type DeveloperGlobalFrameRuntimeApplication = {
  registration: DeveloperGlobalFrameAdapterRegistration;
  section: DeveloperGlobalFrameSection;
};

export type DeveloperGlobalFrameTemplateRuntimeApplication = {
  resolution: DeveloperGlobalFrameAdapterResolution;
  section: DeveloperGlobalFrameSection;
};

export type DeveloperGlobalFrameCanonicalNodes = {
  workspace: HTMLElement;
  bodyMarkerHost: HTMLElement;
  bodyMarkerHitArea: HTMLElement;
  bridge: HTMLElement | null;
  title: HTMLElement;
  tableShell: HTMLElement;
  tableHeader: HTMLElement;
  content: HTMLElement;
  scrollbar: HTMLElement;
};

function uniqueElement(scope: ParentNode, selector: string) {
  const matches = scope.querySelectorAll<HTMLElement>(selector);
  return matches.length === 1 ? matches[0] : null;
}

export function resolveDeveloperGlobalFrameRuntimeApplication(
  value: unknown,
  registration: DeveloperGlobalFrameAdapterRegistration,
): DeveloperGlobalFrameRuntimeApplication | null {
  const validation = validateDeveloperGlobalFrameSection(value);
  if (!validation.valid) return null;
  const section = value as DeveloperGlobalFrameSection;
  if (section.source_scope !== registration.sourceScope
    || section.contract_version !== registration.supportedContractVersion) return null;
  const adapter = section.adapters.find((entry) => entry.page_id === registration.profilePageId);
  const target = section.target_matrix.find((entry) => entry.page_id === registration.profilePageId);
  if (!adapter || !target
    || adapter.role !== registration.role
    || target.adapter_role !== registration.role
    || adapter.reads_profile_version !== section.profile_version
    || target.reads_profile_version !== section.profile_version
    || adapter.owns_structure !== true
    || adapter.allowed_overrides.length !== 0
    || target.compatibility !== "compatible") return null;
  if (findDeveloperGlobalFrameAdapterByProfilePageId(adapter.page_id)?.pageFactoryId !== registration.pageFactoryId) return null;
  return { registration, section };
}

export function resolveDeveloperGlobalFrameTemplateRuntimeApplication(
  value: unknown,
  resolution: DeveloperGlobalFrameAdapterResolution,
): DeveloperGlobalFrameTemplateRuntimeApplication | null {
  const validation = validateDeveloperGlobalFrameSection(value);
  if (!validation.valid) return null;
  const section = value as DeveloperGlobalFrameSection;
  const profilePageId = resolveDeveloperGlobalFrameProfilePageId(resolution);
  const adapter = section.adapters.find((entry) => entry.page_id === profilePageId);
  const target = section.target_matrix.find((entry) => entry.page_id === profilePageId);
  const expectedRole = resolution.explicitRegistration?.role ?? "consumer";
  if (!adapter || !target
    || adapter.role !== expectedRole
    || target.adapter_role !== expectedRole
    || target.source_scope !== resolution.sourceScope
    || adapter.reads_profile_version !== section.profile_version
    || target.reads_profile_version !== section.profile_version
    || adapter.owns_structure !== true
    || adapter.allowed_overrides.length !== 0
    || target.compatibility !== "compatible") return null;
  return { resolution, section };
}

export function inspectDeveloperGlobalFrameCanonicalRoot(
  root: HTMLElement,
  registration: DeveloperGlobalFrameAdapterRegistration,
  options: { requireMarkerGeometry?: boolean } = {},
): DeveloperGlobalFrameCanonicalNodes | null {
  if (!root.matches(buildDeveloperGlobalFrameAdapterRootSelector(registration))
    || root.dataset.pageFactoryRegion !== "body"
    || root.dataset.developmentStandardFrameRegion !== "body") return null;
  const bridge = registration.selectors.bridge ? uniqueElement(root, registration.selectors.bridge) : null;
  if (registration.selectors.bridge && !bridge) return null;
  const regionParent = bridge ?? root;
  const title = uniqueElement(regionParent, registration.selectors.title);
  const tableShell = uniqueElement(regionParent, registration.selectors.tableShell);
  if (!title || !tableShell) return null;
  const tableHeader = uniqueElement(tableShell, registration.selectors.tableHeader);
  const content = uniqueElement(tableShell, registration.selectors.content);
  if (!tableHeader || !content || !content.hasAttribute("data-page-list-scroll-owner")) return null;
  const scrollOwners = root.querySelectorAll<HTMLElement>("[data-page-list-scroll-owner]");
  if (scrollOwners.length !== 1 || scrollOwners[0] !== content) return null;
  const bodyMarkerHost = findExistingWorkspaceBodyMarkerHost(root);
  const bodyMarkerHitArea = findExistingWorkspaceBodyMarkerHitArea(root);
  if (!bodyMarkerHost || !bodyMarkerHitArea) return null;
  if (options.requireMarkerGeometry !== false && !existingWorkspaceBodyMarkerHitAreaMatchesGeometry(root)) return null;
  return { workspace: root, bodyMarkerHost, bodyMarkerHitArea, bridge, title, tableShell, tableHeader, content, scrollbar: content };
}

function toLength(value: string | number | undefined) {
  if (typeof value === "number") return Number.isFinite(value) && Math.abs(value) <= 4096 ? `${value}px` : null;
  return typeof value === "string" && value.length <= 120 ? value : null;
}

function toScalar(value: string | number | undefined) {
  if (typeof value === "number") return Number.isFinite(value) && Math.abs(value) <= 10000 ? String(value) : null;
  return typeof value === "string" && value.length <= 120 ? value : null;
}

function toText(value: string | number | undefined) {
  return typeof value === "string" && value.length <= 200
    ? value
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : null;
}

function paddingValue(tokens: DeveloperGlobalFrameRegionTokens) {
  const values = [tokens.padding_top, tokens.padding_right, tokens.padding_bottom, tokens.padding_left].map(toLength);
  return values.every((value): value is string => Boolean(value)) ? values.join(" ") : null;
}

function commonRegionVariables(region: DeveloperGlobalFrameRegion, tokens: DeveloperGlobalFrameRegionTokens) {
  const prefix = `--developer-global-frame-${region}`;
  const variables: Record<string, string> = {};
  const add = (name: string, value: string | null) => { if (value !== null) variables[name] = value; };
  add(`${prefix}-bg`, toText(tokens.background_color));
  add(`${prefix}-text`, toText(tokens.foreground_color));
  add(`${prefix}-border`, toText(tokens.border_color));
  add(`${prefix}-border-width`, toLength(tokens.border_width));
  add(`${prefix}-radius`, toLength(tokens.border_radius));
  add(`${prefix}-shadow`, toText(tokens.box_shadow));
  add(`${prefix}-font-family`, toText(tokens.font_family));
  add(`${prefix}-font-size`, toLength(tokens.font_size));
  add(`${prefix}-font-weight`, toScalar(tokens.font_weight));
  add(`${prefix}-letter-spacing`, typeof tokens.letter_spacing === "number" ? `${tokens.letter_spacing}em` : toLength(tokens.letter_spacing));
  add(`${prefix}-line-height`, toScalar(tokens.line_height));
  add(`${prefix}-padding`, paddingValue(tokens));
  add(`${prefix}-padding-top`, toLength(tokens.padding_top));
  add(`${prefix}-padding-right`, toLength(tokens.padding_right));
  add(`${prefix}-padding-bottom`, toLength(tokens.padding_bottom));
  add(`${prefix}-padding-left`, toLength(tokens.padding_left));
  add(`${prefix}-gap`, toLength(tokens.gap));
  add(`${prefix}-right-inset`, toLength(tokens.right_inset));
  if (DEVELOPER_GLOBAL_FRAME_ANNOTATION_REGIONS.has(region)) {
    const annotationFontSize = toLength(tokens.annotation_font_size);
    add("--developer-global-frame-runtime-annotation-offset", toLength(tokens.annotation_offset));
    add("--developer-global-frame-runtime-annotation-font-size", annotationFontSize);
    add("--tradepro-context-marker-font-size", annotationFontSize);
    add("--tradepro-vertical-context-marker-font-size", annotationFontSize);
  }
  return variables;
}

function establishedVariables(region: DeveloperGlobalFrameRegion, tokens: DeveloperGlobalFrameRegionTokens) {
  const variables: Record<string, string> = {};
  const add = (name: string, value: string | null) => { if (value !== null) variables[name] = value; };
  const background = toText(tokens.background_color);
  const foreground = toText(tokens.foreground_color);
  const border = toText(tokens.border_color);
  const radius = toLength(tokens.border_radius);
  const padding = paddingValue(tokens);
  const gap = toLength(tokens.gap);
  const fontFamily = toText(tokens.font_family);
  const fontSize = toLength(tokens.font_size);
  const fontWeight = toScalar(tokens.font_weight);
  const lineHeight = toScalar(tokens.line_height);
  if (region === "topbar") {
    add("--tradepro-client-topbar-bg", background); add("--tradepro-shared-topbar-bg", background);
    add("--tradepro-client-topbar-text", foreground); add("--tradepro-shared-topbar-text", foreground);
    add("--tradepro-shared-topbar-border", border);
  } else if (region === "workspace") {
    add("--tradepro-shared-workspace-bg", background); add("--tradepro-shared-workspace-text", foreground);
  } else if (region === "title") {
    add("--tradepro-shared-title-bg", background); add("--tradepro-shared-title-text", foreground);
    add("--tradepro-shared-title-border", border); add("--tradepro-shared-title-divider-color", border);
    add("--tradepro-shared-title-padding", padding); add("--tradepro-shared-title-radius", radius);
  } else if (region === "table-shell") {
    add("--tradepro-panel-frame-bg", background); add("--tradepro-panel-frame-text", foreground);
    add("--tradepro-shared-table-shell-padding", padding); add("--tradepro-shared-table-shell-bottom-radius", radius);
    add("--tradepro-layout-shadow", toText(tokens.box_shadow));
  } else if (region === "table-header") {
    add("--tradepro-shared-table-header-bg", background); add("--tradepro-shared-table-header-text", foreground);
    add("--tradepro-shared-table-header-border", border); add("--tradepro-shared-table-header-radius", radius);
    add("--tradepro-shared-table-header-padding", padding); add("--tradepro-shared-table-header-gap", gap);
    add("--tradepro-shared-table-header-font-family", fontFamily);
    add("--tradepro-shared-table-header-font-size", fontSize);
    add("--tradepro-shared-table-header-font-weight", fontWeight);
    add("--tradepro-shared-table-header-line-height", lineHeight);
  } else if (region === "content") {
    add("--tradepro-shared-list-bg", background); add("--tradepro-shared-list-text", foreground);
    add("--tradepro-shared-list-border", border); add("--tradepro-shared-list-padding", padding);
    add("--tradepro-shared-list-gap", gap); add("--tradepro-shared-list-edge-inset", toLength(tokens.right_inset));
  } else if (region === "footer") {
    add("--tradepro-client-footer-bg", background); add("--tradepro-shared-footer-bg", background);
    add("--tradepro-client-footer-text", foreground); add("--tradepro-shared-footer-text", foreground);
    add("--tradepro-shared-footer-border", border); add("--tradepro-shared-footer-padding", padding);
  } else if (region === "scrollbar") {
    add("--tradepro-shared-list-scrollbar-lane", toLength(tokens.scrollbar_width));
    add("--developer-global-frame-scrollbar-gutter", toText(tokens.scrollbar_gutter));
  }
  return variables;
}

function variablesForRegion(region: DeveloperGlobalFrameRegion, tokens: DeveloperGlobalFrameRegionTokens) {
  return { ...commonRegionVariables(region, tokens), ...establishedVariables(region, tokens) };
}

/**
 * Template projection is the safe, page-factory-wide form of the global
 * frame. It consumes only canonical semantic regions already present in a
 * page; it never creates wrappers, moves content or claims page business DOM.
 */
export function applyDeveloperGlobalFrameTemplateRuntimeProfile(
  section: DeveloperGlobalFrameSection,
  root: HTMLElement,
) {
  const validation = validateDeveloperGlobalFrameSection(section);
  if (!validation.valid) return () => {};
  const touched = new Map<HTMLElement, { styles: Map<string, string>; attributes: Map<string, string | null> }>();
  const stateFor = (element: HTMLElement) => {
    const existing = touched.get(element);
    if (existing) return existing;
    const next = { styles: new Map<string, string>(), attributes: new Map<string, string | null>() };
    touched.set(element, next);
    return next;
  };
  const setAttribute = (element: HTMLElement, name: string, value: string) => {
    const state = stateFor(element);
    if (!state.attributes.has(name)) state.attributes.set(name, element.getAttribute(name));
    element.setAttribute(name, value);
  };
  const setVariables = (element: HTMLElement, variables: Record<string, string>) => {
    const state = stateFor(element);
    for (const [name, value] of Object.entries(variables)) {
      if (!state.styles.has(name)) state.styles.set(name, element.style.getPropertyValue(name));
      element.style.setProperty(name, value);
    }
  };
  const documentRoot = root.ownerDocument.documentElement;
  setAttribute(root, "data-developer-global-frame-template-runtime", "applied");
  setAttribute(root, "data-developer-global-frame-template-profile-version", section.profile_version);
  setAttribute(documentRoot, "data-developer-global-frame-template-runtime", "applied");
  setAttribute(documentRoot, "data-developer-global-frame-template-profile-version", section.profile_version);
  for (const region of section.regions) {
    const variables = variablesForRegion(region, section.region_tokens[region]);
    setVariables(root, variables);
    setVariables(documentRoot, variables);
  }
  return () => {
    for (const [element, state] of touched) {
      for (const [name, previous] of state.styles) {
        if (previous) element.style.setProperty(name, previous);
        else element.style.removeProperty(name);
      }
      for (const [name, previous] of state.attributes) {
        if (previous === null) element.removeAttribute(name);
        else element.setAttribute(name, previous);
      }
    }
  };
}

function variablesForWorkspaceMarkerHost(tokens: DeveloperGlobalFrameRegionTokens) {
  const variables: Record<string, string> = {};
  const add = (name: string, value: string | null) => { if (value !== null) variables[name] = value; };
  const annotationFontSize = toLength(tokens.annotation_font_size);
  add("--developer-global-frame-runtime-annotation-offset", toLength(tokens.annotation_offset));
  add("--developer-global-frame-runtime-annotation-font-size", annotationFontSize);
  add("--tradepro-context-marker-font-size", annotationFontSize);
  add("--tradepro-vertical-context-marker-font-size", annotationFontSize);
  add("--tradepro-hover-capsule-bg", toText(tokens.foreground_color));
  add("--tradepro-hover-capsule-text", toText(tokens.background_color));
  return variables;
}

type RuntimeElements = DeveloperGlobalFrameCanonicalNodes & { topbar: HTMLElement; footer: HTMLElement };

export function applyDeveloperGlobalFrameRuntimeProfile(
  application: DeveloperGlobalFrameRuntimeApplication,
  elements: RuntimeElements,
) {
  const touched = new Map<HTMLElement, { styles: Map<string, string>; attributes: Map<string, string | null> }>();
  const stateFor = (element: HTMLElement) => {
    const existing = touched.get(element);
    if (existing) return existing;
    const next = { styles: new Map<string, string>(), attributes: new Map<string, string | null>() };
    touched.set(element, next);
    return next;
  };
  const setAttribute = (element: HTMLElement, name: string, value: string) => {
    const state = stateFor(element);
    if (!state.attributes.has(name)) state.attributes.set(name, element.getAttribute(name));
    element.setAttribute(name, value);
  };
  const setVariables = (element: HTMLElement, variables: Record<string, string>) => {
    const state = stateFor(element);
    for (const [name, value] of Object.entries(variables)) {
      if (!state.styles.has(name)) state.styles.set(name, element.style.getPropertyValue(name));
      element.style.setProperty(name, value);
    }
  };

  const regionElements: Record<DeveloperGlobalFrameRegion, HTMLElement> = {
    topbar: elements.topbar,
    workspace: elements.workspace,
    title: elements.title,
    "table-shell": elements.tableShell,
    "table-header": elements.tableHeader,
    content: elements.content,
    footer: elements.footer,
    scrollbar: elements.scrollbar,
  };
  setAttribute(elements.workspace, DEVELOPER_GLOBAL_FRAME_RUNTIME_ATTRIBUTE, "applied");
  setAttribute(elements.workspace, "data-developer-global-frame-profile-version", application.section.profile_version);
  setAttribute(elements.workspace, "data-developer-global-frame-profile-page-id", application.registration.profilePageId);
  setAttribute(elements.workspace, "data-developer-global-frame-adapter", application.registration.domAdapterId);
  if (elements.bridge) setAttribute(elements.bridge, "data-developer-global-frame-bridge", application.registration.domAdapterId);
  for (const region of application.section.regions) {
    const element = regionElements[region];
    const tokens = application.section.region_tokens[region];
    if (region === "scrollbar") setAttribute(element, "data-developer-global-frame-runtime-scrollbar", "true");
    else setAttribute(element, DEVELOPER_GLOBAL_FRAME_RUNTIME_REGION_ATTRIBUTE, region);
    if (DEVELOPER_GLOBAL_FRAME_ANNOTATION_REGIONS.has(region) && typeof tokens.annotation_visible === "boolean") {
      setAttribute(element, "data-developer-global-frame-annotation-visible", tokens.annotation_visible ? "true" : "false");
      if (region === "workspace") {
        setAttribute(elements.bodyMarkerHost, "data-developer-global-frame-annotation-visible", tokens.annotation_visible ? "true" : "false");
      }
    }
    setVariables(element, variablesForRegion(region, tokens));
    if (region === "workspace") setVariables(elements.bodyMarkerHost, variablesForWorkspaceMarkerHost(tokens));
  }
  return () => {
    for (const [element, state] of touched) {
      for (const [name, previous] of state.styles) {
        if (previous) element.style.setProperty(name, previous);
        else element.style.removeProperty(name);
      }
      for (const [name, previous] of state.attributes) {
        if (previous === null) element.removeAttribute(name);
        else element.setAttribute(name, previous);
      }
    }
  };
}
