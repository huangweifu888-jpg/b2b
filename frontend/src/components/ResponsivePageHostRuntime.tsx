import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  GLOBAL_RESPONSIVE_PAGE_FACTORY_DEFAULT,
  resolveGlobalResponsiveContainerStage,
  resolveGlobalResponsivePageTemplate,
} from "@/lib/global-responsive-page-contract";
import { ADAPTIVE_STRUCTURE_FACTORY_DEFAULT, type AdaptiveStructureRole } from "@/lib/adaptive-structure-contract";
import { SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT } from "@/lib/shared-adaptive-surface-contract";
import { SHARED_WINDOW_FACTORY_DEFAULT, SHARED_WINDOW_REGISTRY } from "@/lib/shared-window-contract";
import {
  DEVELOPER_GLOBAL_BATCH_RELEASE_EVENT,
  DEVELOPER_GLOBAL_BATCH_RELEASE_STORAGE_KEY,
  readDeveloperGlobalLocalBatchRelease,
} from "@/lib/developer-global-batch-release";
import {
  isDeveloperGlobalFrameCompatibleTarget,
  resolveDeveloperGlobalFrameAdapterForRoute,
} from "@/lib/developer-global-frame-adapter-resolution";
import { applyDeveloperGlobalFrameTemplateRuntimeProfile } from "@/lib/developer-global-frame-runtime";
import "@/developer-global-frame-runtime.css";
import {
  EXISTING_WORKSPACE_BODY_MARKER_HIT_AREA_ATTRIBUTE,
  EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT,
} from "@/lib/layout-frame-contract";
import { RESPONSIVE_SHELL_FACTORY_DEFAULT } from "@/lib/responsive-shell-contract";
import { PAGE_FACTORY_STANDARD } from "@/page-factory/page-factory";
import {
  resolveSharedLayoutStyleCardRegion,
  resolveSharedLayoutStyleRegionProps,
  SHARED_LAYOUT_STYLE_CARD_REGION_DISCOVERY_MUTATION_ATTRIBUTES,
} from "@/lib/shared-card-region-contract";
import "@/page-factory/page-factory.css";
export type ResponsivePageHostScope = "hq" | "agency-source" | "client-source" | "agency" | "client";

export default function ResponsivePageHostRuntime({
  scope,
  hostElement,
  onShowTitleOneFallbackChange,
}: {
  scope: ResponsivePageHostScope;
  hostElement: HTMLDivElement;
  onShowTitleOneFallbackChange: (show: boolean, label?: string) => void;
}) {
  const location = useLocation();
  const template = resolveGlobalResponsivePageTemplate(location.pathname, location.search);
  const sourceScope = scope === "hq"
    ? "hq"
    : scope === "agency-source" || scope === "agency"
      ? "agency_source"
      : "client_source";
  const frameAdapterResolution = useMemo(
    () => resolveDeveloperGlobalFrameAdapterForRoute(
      location.pathname,
      location.search,
      sourceScope,
    ),
    [location.pathname, location.search, sourceScope],
  );
  const factoryPageRegistration = frameAdapterResolution?.pageRegistration ?? null;
  const requiresTitleOne = Boolean(factoryPageRegistration?.requiredRegions.includes("title-1"));
  useEffect(() => {
    const host = hostElement;
    if (frameAdapterResolution) {
      host.dataset.developerGlobalFrameResolvedPageId = frameAdapterResolution.pageFactoryId;
      host.dataset.developerGlobalFrameResolvedAdapter = frameAdapterResolution.adapterId;
      host.dataset.developerGlobalFrameResolvedStrategy = frameAdapterResolution.strategy;
    } else {
      delete host.dataset.developerGlobalFrameResolvedPageId;
      delete host.dataset.developerGlobalFrameResolvedAdapter;
      delete host.dataset.developerGlobalFrameResolvedStrategy;
    }
    const root = document.documentElement;
    const shell = host.closest<HTMLElement>("[data-responsive-shell]");
    const appMain = host.closest<HTMLElement>(".app-main, .app-main-roomy");
    const markedAdaptiveSurfaces = new Set<HTMLElement>();
    const generatedTitleBands = new Set<HTMLElement>();
    const generatedTitleContents = new Set<HTMLElement>();
    const generatedTitleActions = new Set<HTMLElement>();
    const markedFactoryWorkspaceBoundaries = new Set<HTMLElement>();
    const generatedFactoryBodyMarkerHitAreas = new Set<HTMLElement>();
    const projectedFactoryAttributes = new Map<HTMLElement, Map<string, string | null>>();
    const projectedFactoryValues = new Map<HTMLElement, Map<string, string>>();
    let projectedFactoryRoot: HTMLElement | null = null;
    let scheduled = false;
    let contentReadyTimer: number | null = null;
    let appliedBatchId: string | null = null;
    let cleanupTemplateProfile: (() => void) | null = null;
    const syncLocalBatchContract = () => {
      const release = readDeveloperGlobalLocalBatchRelease(window.localStorage);
      if (release?.id === appliedBatchId) return;
      cleanupTemplateProfile?.();
      cleanupTemplateProfile = null;
      appliedBatchId = release?.id ?? null;
      if (!release || !frameAdapterResolution || !isDeveloperGlobalFrameCompatibleTarget(
        frameAdapterResolution,
        release.compatibleTargetPageIds,
        sourceScope,
      )) {
        delete host.dataset.developerGlobalBatchRelease;
        delete host.dataset.developerGlobalBatchTargetPageId;
        delete host.dataset.developerGlobalBatchAdapter;
        root.removeAttribute("data-developer-global-batch-release");
        root.removeAttribute("data-developer-global-batch-window-contract");
        root.removeAttribute("data-developer-global-batch-target-page-id");
        return;
      }
      cleanupTemplateProfile = applyDeveloperGlobalFrameTemplateRuntimeProfile(release.section, host);
      host.dataset.developerGlobalBatchRelease = release.id;
      host.dataset.developerGlobalBatchTargetPageId = frameAdapterResolution.pageFactoryId;
      host.dataset.developerGlobalBatchAdapter = frameAdapterResolution.adapterId;
      root.setAttribute("data-developer-global-batch-release", release.id);
      root.setAttribute("data-developer-global-batch-window-contract", release.sharedWindowContractVersion);
      root.setAttribute("data-developer-global-batch-target-page-id", frameAdapterResolution.pageFactoryId);
    };
    const markRole = (selector: string, role: AdaptiveStructureRole) => {
      host.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        if (!element.dataset.responsiveStructureRole) element.dataset.responsiveStructureRole = role;
      });
    };
    const setProjectedFactoryAttribute = (element: HTMLElement, name: string, value: string) => {
      if (element.getAttribute(name) === value) {
        const projectedValue = projectedFactoryValues.get(element)?.get(name);
        if (projectedValue !== undefined && projectedValue !== value) {
          const attributes = projectedFactoryAttributes.get(element);
          attributes?.delete(name);
          if (attributes?.size === 0) projectedFactoryAttributes.delete(element);
          const values = projectedFactoryValues.get(element);
          values?.delete(name);
          if (values?.size === 0) projectedFactoryValues.delete(element);
        }
        return;
      }
      let attributes = projectedFactoryAttributes.get(element);
      if (!attributes) {
        attributes = new Map<string, string | null>();
        projectedFactoryAttributes.set(element, attributes);
      }
      if (!attributes.has(name)) attributes.set(name, element.getAttribute(name));
      let values = projectedFactoryValues.get(element);
      if (!values) {
        values = new Map<string, string>();
        projectedFactoryValues.set(element, values);
      }
      values.set(name, value);
      element.setAttribute(name, value);
    };
    const readUnprojectedFactoryAttribute = (element: HTMLElement, name: string) => {
      const attributes = projectedFactoryAttributes.get(element);
      return attributes?.has(name) ? attributes.get(name) ?? null : element.getAttribute(name);
    };
    const restoreRuntimeProjectedFactoryAttribute = (element: HTMLElement, name: string) => {
      const attributes = projectedFactoryAttributes.get(element);
      if (!attributes?.has(name)) return;
      const previous = attributes.get(name) ?? null;
      if (previous === null) element.removeAttribute(name);
      else element.setAttribute(name, previous);
      attributes.delete(name);
      if (attributes.size === 0) projectedFactoryAttributes.delete(element);
      const values = projectedFactoryValues.get(element);
      values?.delete(name);
      if (values?.size === 0) projectedFactoryValues.delete(element);
    };
    const restoreProjectedFactoryAttributes = () => {
      projectedFactoryAttributes.forEach((attributes, element) => {
        attributes.forEach((previous, name) => {
          if (previous === null) element.removeAttribute(name);
          else element.setAttribute(name, previous);
        });
      });
      projectedFactoryAttributes.clear();
      projectedFactoryValues.clear();
      projectedFactoryRoot = null;
    };
    const hasMeaningfulFactoryMutation = (records: MutationRecord[]) => {
      let meaningful = records.some((record) => record.type === "childList" || record.type === "characterData");
      const attributeGroups = new Map<HTMLElement, Map<string, MutationRecord[]>>();
      records.forEach((record) => {
        if (record.type !== "attributes" || !(record.target instanceof HTMLElement) || !record.attributeName) return;
        let byName = attributeGroups.get(record.target);
        if (!byName) {
          byName = new Map<string, MutationRecord[]>();
          attributeGroups.set(record.target, byName);
        }
        const grouped = byName.get(record.attributeName) ?? [];
        grouped.push(record);
        byName.set(record.attributeName, grouped);
      });
      attributeGroups.forEach((byName, element) => {
        byName.forEach((group, name) => {
          const projectedValue = projectedFactoryValues.get(element)?.get(name);
          if (projectedValue === undefined) {
            meaningful = true;
            return;
          }
          const current = element.getAttribute(name);
          if (current !== projectedValue) {
            projectedFactoryAttributes.get(element)?.set(name, current);
            meaningful = true;
            return;
          }
          if (group.every((record) => record.oldValue === projectedValue)) {
            const attributes = projectedFactoryAttributes.get(element);
            attributes?.delete(name);
            if (attributes?.size === 0) projectedFactoryAttributes.delete(element);
            const values = projectedFactoryValues.get(element);
            values?.delete(name);
            if (values?.size === 0) projectedFactoryValues.delete(element);
          }
        });
      });
      return meaningful;
    };
    const projectRuntimeFactoryRegions = (candidate: HTMLElement) => {
      if (!factoryPageRegistration || frameAdapterResolution?.strategy !== "template-projection") return candidate;
      const required = new Set(factoryPageRegistration.requiredRegions);
      const rendered = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const ranked = (selector: string) => {
        const matches = Array.from(candidate.querySelectorAll<HTMLElement>(selector));
        const visible = matches.filter(rendered);
        return [...visible, ...matches.filter((element) => !visible.includes(element))];
      };
      const markerLabel = (region: string) => (
        region === "title-2" ? "标题 2"
          : region === "large-card" ? "大卡片"
            : region === "small-card" ? "小卡片"
              : region === "table-shell" ? "表内"
                : region === "table-header" ? "表头"
                  : region === "content" ? "内容"
                    : region === "footer" ? "尾栏"
                      : region
      );
      const bindSharedRegionStyle = (element: HTMLElement, region: string) => {
        if (region === "large-card") {
          restoreRuntimeProjectedFactoryAttribute(element, "data-shared-small-card-surface");
        } else if (region === "small-card") {
          restoreRuntimeProjectedFactoryAttribute(element, "data-shared-large-card-surface");
        }
        Object.entries(resolveSharedLayoutStyleRegionProps(region)).forEach(([name, value]) => {
          if (element.getAttribute(name) !== value) setProjectedFactoryAttribute(element, name, value);
        });
      };
      const bindCanonicalMarker = (element: HTMLElement, region: string) => {
        const hadMismatchedAlias = element.dataset.developmentStandardFrameRegion !== region;
        if (hadMismatchedAlias) {
          setProjectedFactoryAttribute(element, "data-development-standard-frame-region", region);
        }
        if (hadMismatchedAlias || !element.dataset.developmentStandardFrameLabel) {
          setProjectedFactoryAttribute(element, "data-development-standard-frame-label", markerLabel(region));
        }
        bindSharedRegionStyle(element, region);
      };
      if (required.has("body")) {
        Object.entries(resolveSharedLayoutStyleRegionProps("body")).forEach(([name, value]) => {
          if (candidate.getAttribute(name) !== value) setProjectedFactoryAttribute(candidate, name, value);
        });
      }
      // Annotation ownership is element-local. Bind every canonical element so
      // a responsive/tab transition cannot expose a real Title 2 without its
      // matching Developer region metadata.
      required.forEach((region) => {
        candidate.querySelectorAll<HTMLElement>(`[data-page-factory-region="${region}"]`)
          .forEach((element) => {
            const effectiveRegion = region === "large-card" || region === "small-card"
              ? resolveSharedLayoutStyleCardRegion({
                getAttribute: (name) => readUnprojectedFactoryAttribute(element, name),
              }, 1)
              : region;
            bindCanonicalMarker(element, effectiveRegion);
          });
      });

      // A real FactoryPage using runtime-auto owns region reconciliation. The
      // host only supplies annotation metadata and must not race the factory by
      // taking ownership of those same region attributes.
      if (
        candidate.dataset.pageFactoryRegionStrategy === "runtime-auto"
        && candidate.dataset.pageFactoryRuntimeProjection !== "true"
      ) return candidate;

      const assignRegion = (region: string, candidates: readonly (HTMLElement | null | undefined)[]) => {
        const canonical = Array.from(candidate.querySelectorAll<HTMLElement>(
          `[data-page-factory-region="${region}"]`,
        ));
        const existing = canonical.find(rendered) ?? null;
        const element = existing ?? candidates.find((item): item is HTMLElement => Boolean(
          item && !item.dataset.pageFactoryRegion && item !== candidate && rendered(item),
        )) ?? null;
        if (!element) return null;
        if (!existing) setProjectedFactoryAttribute(element, "data-page-factory-region", region);
        if (!element.dataset.developmentStandardFrameRegion) {
          setProjectedFactoryAttribute(element, "data-development-standard-frame-region", region);
          setProjectedFactoryAttribute(element, "data-development-standard-frame-label", markerLabel(region));
        }
        bindCanonicalMarker(element, region);
        return element;
      };

      const headings = ranked("h1, h2");
      const titleBands = headings.map((heading) => {
        const rootRect = candidate.getBoundingClientRect();
        let band = heading;
        let cursor = heading.parentElement;
        for (let depth = 0; cursor && cursor !== candidate && depth < 4; depth += 1, cursor = cursor.parentElement) {
          const rect = cursor.getBoundingClientRect();
          if (rootRect.width > 0 && rect.width >= rootRect.width * 0.72 && rect.height > 0 && rect.height <= Math.max(176, rootRect.height * 0.28)) {
            band = cursor;
            break;
          }
        }
        return band;
      });
      const title = required.has("title-2") ? assignRegion("title-2", Array.from(new Set(titleBands))) : null;
      const meaningfulChildren = Array.from(candidate.children).filter((element): element is HTMLElement => (
        element instanceof HTMLElement && element !== title && element.getAttribute("aria-hidden") !== "true"
      ));
      const contentCandidates = ranked("main, [role='tabpanel']:not([hidden]), [data-page-list], [data-client-project-content], [data-page-layout-content], [data-page-layout-surface]");
      const content = required.has("content")
        ? assignRegion("content", [...contentCandidates, ...meaningfulChildren])
        : null;
      const cards = ranked(
        "[data-shared-large-card-surface='true'], [data-shared-small-card-surface='true'], [data-page-layout-card], [data-slot='card'], [data-social-content-card], .tradepro-surface-card",
      );
      const loadingItems = ranked(".animate-pulse, [aria-busy='true'], [data-loading='true'], [data-page-route-loading]");
      const loadingGroups = Array.from(new Set(loadingItems
        .map((item) => item.parentElement)
        .filter((element): element is HTMLElement => Boolean(element && element !== candidate))));
      const cardSet = new Set(cards);
      const groupedCardCount = (card: HTMLElement) => {
        const parent = card.parentElement;
        if (!parent) return 1;
        const layout = getComputedStyle(parent).display;
        const isCardGroup = parent.matches(".grid, [data-page-factory-responsive-grid], [data-responsive-capacity-grid]")
          || layout === "grid"
          || layout === "inline-grid"
          || (layout === "flex" && getComputedStyle(parent).flexWrap !== "nowrap");
        if (!isCardGroup) return 1;
        return Array.from(parent.children)
          .filter((sibling): sibling is HTMLElement => sibling instanceof HTMLElement && cardSet.has(sibling))
          .length;
      };
      const resolveCardRegion = (card: HTMLElement, fallbackGroupedCardCount = groupedCardCount(card)) => resolveSharedLayoutStyleCardRegion({
        getAttribute: (name) => readUnprojectedFactoryAttribute(card, name),
      }, fallbackGroupedCardCount);
      const cardArea = (card: HTMLElement) => {
        const rect = card.getBoundingClientRect();
        return rect.width * rect.height;
      };
      const largeCardCandidates = [
        ...cards.filter((card) => resolveCardRegion(card) === "large-card"),
        ...loadingGroups.filter((card) => resolveCardRegion(card, 1) === "large-card"),
      ].sort((left, right) => {
        const groupedDifference = Number(groupedCardCount(left) > 1) - Number(groupedCardCount(right) > 1);
        return groupedDifference || cardArea(right) - cardArea(left);
      });
      const smallCardCandidates = cards.filter((card) => resolveCardRegion(card) === "small-card").sort((left, right) => {
        const groupedDifference = Number(groupedCardCount(right) > 1) - Number(groupedCardCount(left) > 1);
        return groupedDifference || cardArea(left) - cardArea(right);
      });
      if (required.has("large-card")) assignRegion("large-card", largeCardCandidates);
      if (required.has("small-card")) assignRegion("small-card", [
        ...smallCardCandidates,
        ...ranked("[data-slot='card-content'], [data-tradepro-card-content]")
          .filter((card) => resolveCardRegion(card, 2) === "small-card"),
        ...loadingItems.filter((card) => resolveCardRegion(card, 2) === "small-card"),
      ]);
      if (candidate.dataset.pageFactoryRuntimeProjection === "true") {
        cards.forEach((card) => {
          bindSharedRegionStyle(card, resolveCardRegion(card));
        });
      }
      const tables = ranked("table");
      if (required.has("table-shell")) assignRegion("table-shell", [
        ...ranked("[data-page-table-shell], [data-page-list], [role='table'], .responsive-table-wrap, [data-slot='table-container'], [data-client-project-unavailable-frame]"),
        ...tables.map((table) => table.parentElement),
      ]);
      if (required.has("table-header")) assignRegion("table-header", ranked(
        "thead, [data-page-table-header], [role='tablist'], [data-client-project-subnav], nav[aria-label], [data-client-project-unavailable-header]",
      ));
      if (required.has("footer")) assignRegion("footer", ranked(
        "[data-page-layout-footer], [data-client-project-footer-actions], [data-page-footer-actions], [data-responsive-page-footer], footer, [data-page-title-actions]",
      ));
      if (
        frameAdapterResolution.templateRegistration.scrollContract === "content-only"
        && content
        && !candidate.querySelector("[data-page-list-scroll-owner]")
      ) {
        setProjectedFactoryAttribute(content, "data-page-list-scroll-owner", "true");
        setProjectedFactoryAttribute(
          candidate,
          "data-page-factory-scroll-contract",
          frameAdapterResolution.templateRegistration.scrollContract,
        );
      }
      return candidate;
    };
    const ensureFactoryIdentityProjection = () => {
      if (!frameAdapterResolution || !factoryPageRegistration) {
        restoreProjectedFactoryAttributes();
        return null;
      }
      const exactRoots = Array.from(host.querySelectorAll<HTMLElement>(
        `[data-page-factory-page-id="${CSS.escape(frameAdapterResolution.pageFactoryId)}"]`,
      ));
      const authoredExactRoot = exactRoots.find(
        (element) => element.dataset.pageFactoryRuntimeProjection !== "true",
      ) ?? null;
      const staleProjectedRoots = exactRoots.filter(
        (element) => element.dataset.pageFactoryRuntimeProjection === "true" && element !== authoredExactRoot,
      );
      if (authoredExactRoot && staleProjectedRoots.length > 0) {
        if (projectedFactoryRoot) restoreProjectedFactoryAttributes();
        // A lazy route can mount its real FactoryPage after the temporary
        // projection. Remove only the runtime-owned identity from any stale
        // projection so the page has exactly one canonical factory root.
        staleProjectedRoots.forEach((element) => {
          [
            "data-page-factory-contract",
            "data-page-factory-page-id",
            "data-page-factory-template",
            "data-page-factory-source-scope",
            "data-page-factory-region-strategy",
            "data-page-factory-region",
            "data-page-factory-frame-owner",
            "data-page-factory-runtime-projection",
            "data-page-layout-surface",
            "data-page-layout-frame",
          ].forEach((name) => element.removeAttribute(name));
        });
        return projectRuntimeFactoryRegions(authoredExactRoot);
      }
      const realExactRoot = exactRoots.find((element) => element !== projectedFactoryRoot) ?? null;
      if (projectedFactoryRoot && realExactRoot) {
        restoreProjectedFactoryAttributes();
        return projectRuntimeFactoryRegions(realExactRoot);
      }
      const exactRoot = exactRoots[0] ?? null;
      if (exactRoot) return projectRuntimeFactoryRegions(exactRoot);
      // A different declared identity is a real route mismatch and must remain
      // fail-closed.  Projection only covers legacy/unavailable route surfaces
      // that have no FactoryPage identity of their own.
      if (host.querySelector("[data-page-factory-page-id]")) {
        restoreProjectedFactoryAttributes();
        return null;
      }
      const candidate = Array.from(host.children).find((element): element is HTMLElement => {
        if (!(element instanceof HTMLElement) || element.hidden || element.getAttribute("aria-hidden") === "true") return false;
        if (element.matches("[data-responsive-semantic-tools], [data-responsive-page-tools-standalone]")) return false;
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      }) ?? null;
      if (!candidate) return null;
      if (projectedFactoryRoot && projectedFactoryRoot !== candidate) restoreProjectedFactoryAttributes();
      projectedFactoryRoot = candidate;
      setProjectedFactoryAttribute(candidate, "data-page-factory-contract", PAGE_FACTORY_STANDARD.factoryVersion);
      setProjectedFactoryAttribute(candidate, "data-page-factory-page-id", factoryPageRegistration.id);
      setProjectedFactoryAttribute(candidate, "data-page-factory-template", factoryPageRegistration.template);
      setProjectedFactoryAttribute(candidate, "data-page-factory-source-scope", factoryPageRegistration.sourceScope);
      setProjectedFactoryAttribute(candidate, "data-page-factory-region-strategy", "runtime-auto");
      setProjectedFactoryAttribute(candidate, "data-page-factory-region", "body");
      setProjectedFactoryAttribute(candidate, "data-page-factory-frame-owner", "existing-workspace");
      setProjectedFactoryAttribute(candidate, "data-page-factory-runtime-projection", "true");
      setProjectedFactoryAttribute(candidate, "data-page-layout-surface", "true");
      setProjectedFactoryAttribute(candidate, "data-page-layout-frame", "true");
      // A lazy route skeleton is not a trustworthy completed factory surface.
      // Keep the host unready until the authored FactoryPage replaces it; this
      // prevents the 603-case gate from inspecting a temporary identity that
      // has not mounted its real regions yet.
      if (candidate.querySelector(".animate-pulse, [aria-busy='true'], [data-loading='true'], [data-page-route-loading]")) {
        setProjectedFactoryAttribute(candidate, "data-page-route-loading", "true");
      }
      // Identity projection owns only the temporary root identity. Region and
      // annotation ownership stays in one canonical resolver so lazy routes,
      // unavailable states and authored FactoryPages cannot race two copies
      // of the same assignment algorithm.
      return projectRuntimeFactoryRegions(candidate);
    };
    const markAdaptiveStructures = () => {
      markRole("[data-page-layout-surface], [data-page-layout-frame]", "section");
      markRole("[data-page-list]", "list");
      markRole("[data-page-list-item], [data-responsive-capacity-card]", "item");
      markRole("[data-responsive-capacity-primary], [data-responsive-page-actions], [data-responsive-batch-actions]", "action-rail");
      markRole("[data-responsive-capacity-content]", "main");
      markRole("[data-responsive-choice-group], .layout-global-font-option", "choice-group");
      markRole("[data-responsive-choice-grid], .layout-global-font-buttons", "choice-grid");
      markRole("[data-responsive-field-grid], .product-module-detail-grid, [data-shared-expert-identity-summary]", "field-grid");
      markRole("[data-responsive-details]", "details");
    };
    const markFactoryWorkspaceBoundaries = () => {
      markedFactoryWorkspaceBoundaries.forEach((boundary) => {
        delete boundary.dataset.responsiveFactoryWorkspaceBoundary;
      });
      markedFactoryWorkspaceBoundaries.clear();
      host.querySelectorAll<HTMLElement>("[data-page-factory-contract]").forEach((factoryRoot) => {
        // A factory-shell can be nested inside a source shell that already
        // owns the real Title 1 + Body frame.  In that shape the inner
        // FactoryPage is the content contract, not the visible body border.
        // Resolve the nearest semantic body ancestor so the marker follows the
        // same outer line as Operations Market across all three source shells.
        let semanticBody: HTMLElement | null = null;
        if (factoryRoot.dataset.pageFactoryFrameOwner === "factory-shell") {
          let cursor = factoryRoot.parentElement;
          while (cursor && cursor !== host) {
            if (cursor.dataset.developmentStandardFrameRegion === "body") {
              semanticBody = cursor;
              break;
            }
            cursor = cursor.parentElement;
          }
        }
        const externalTitleOne = host.querySelector<HTMLElement>([
          "[data-responsive-semantic-band='page-context']",
          "[data-responsive-semantic-band='title-1']",
          "[data-responsive-shared-surface='title-1']",
          "[data-page-factory-region='title-1']",
        ].join(","));
        const boundary = semanticBody
          ?? (externalTitleOne && !factoryRoot.contains(externalTitleOne) ? host : factoryRoot);
        boundary.dataset.responsiveFactoryWorkspaceBoundary = "true";
        markedFactoryWorkspaceBoundaries.add(boundary);
      });
      const boundary = Array.from(markedFactoryWorkspaceBoundaries).find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const style = getComputedStyle(candidate);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });
      if (!appMain) return;
      const responsiveHitAreaSelector = ":scope > [data-responsive-factory-body-marker-hit-area='true']";
      const removeResponsiveHitAreas = () => {
        appMain.querySelectorAll<HTMLElement>(responsiveHitAreaSelector).forEach((hitArea) => {
          hitArea.remove();
          generatedFactoryBodyMarkerHitAreas.delete(hitArea);
        });
      };
      const existingWorkspaceHitAreaSelector = `:scope > [${EXISTING_WORKSPACE_BODY_MARKER_HIT_AREA_ATTRIBUTE}="${EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.workspaceHitAreaValue}"]`;
      const alignedWorkspaceHitAreaSelector = `${existingWorkspaceHitAreaSelector}[data-responsive-factory-body-marker-geometry="factory-root"]`;
      const resetAlignedWorkspaceHitArea = () => {
        appMain.querySelectorAll<HTMLElement>(alignedWorkspaceHitAreaSelector).forEach((hitArea) => {
          delete hitArea.dataset.responsiveFactoryBodyMarkerGeometry;
          hitArea.style.removeProperty("--responsive-factory-body-hit-left");
          hitArea.style.removeProperty("--responsive-factory-body-hit-top");
          hitArea.style.removeProperty("--responsive-factory-body-hit-width");
          hitArea.style.removeProperty("--responsive-factory-body-hit-height");
        });
      };
      // SharedPageWorkspace owns the canonical outer-gutter pointer target.
      // The responsive marker is only a fallback for factory pages that have
      // not migrated to that contract; keeping both makes two different hover
      // zones expose the same 主体 annotation.
      const existingWorkspaceHitArea = appMain.querySelector<HTMLElement>(existingWorkspaceHitAreaSelector);
      if (!boundary) {
        resetAlignedWorkspaceHitArea();
        removeResponsiveHitAreas();
        return;
      }
      if (existingWorkspaceHitArea) {
        // SharedPageWorkspace already measures the canonical workspace itself.
        // Factory projection must not replace that geometry with an outer title
        // or host boundary; doing so creates two incompatible body owners.
        resetAlignedWorkspaceHitArea();
        removeResponsiveHitAreas();
        return;
      }
      resetAlignedWorkspaceHitArea();
      let hitArea = appMain.querySelector<HTMLElement>(responsiveHitAreaSelector);
      if (!hitArea) {
        hitArea = document.createElement("span");
        hitArea.dataset.responsiveFactoryBodyMarkerHitArea = "true";
        hitArea.setAttribute("aria-hidden", "true");
        appMain.append(hitArea);
      }
      const mainRect = appMain.getBoundingClientRect();
      const boundaryRect = boundary.getBoundingClientRect();
      hitArea.style.setProperty("--responsive-factory-body-hit-left", `${Math.max(0, boundaryRect.left - mainRect.left - 10)}px`);
      hitArea.style.setProperty("--responsive-factory-body-hit-top", `${Math.max(0, boundaryRect.top - mainRect.top)}px`);
      hitArea.style.setProperty("--responsive-factory-body-hit-height", `${Math.max(0, Math.min(mainRect.bottom, boundaryRect.bottom) - Math.max(mainRect.top, boundaryRect.top))}px`);
      generatedFactoryBodyMarkerHitAreas.add(hitArea);
    };
    const markSharedAdaptiveSurface = (element: HTMLElement | null, surface: string) => {
      if (!element) return;
      element.dataset.sharedAdaptiveSurface = surface;
      element.dataset.sharedAdaptiveSurfaceSource = SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.sourceViewport;
      element.dataset.sharedAdaptiveSurfaceContract = SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.version;
      markedAdaptiveSurfaces.add(element);
    };
    const isVisible = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const markGeneratedTitleSurface = () => {
      const authoredTitleCandidates = Array.from(host.querySelectorAll<HTMLElement>([
        "[data-responsive-semantic-band='page-context']:not([data-responsive-factory-title-one-fallback])",
        "[data-responsive-semantic-band='title-1']:not([data-responsive-factory-title-one-fallback])",
        "[data-responsive-shared-surface='title-1']:not([data-responsive-factory-title-one-fallback])",
        "[data-page-factory-region='title-1']:not([data-responsive-factory-title-one-fallback])",
        ":scope > [data-client-project-frame] > [data-client-project-context][data-page-title]",
      ].join(",")));
      const canonicalFactoryRoot = factoryPageRegistration
        ? host.querySelector<HTMLElement>(
          `[data-page-factory-page-id="${CSS.escape(factoryPageRegistration.id)}"]`,
        )
        : null;
      const canonicalFactoryTitleOne = canonicalFactoryRoot?.querySelector<HTMLElement>(
        "[data-page-factory-region='title-1']:not([data-responsive-factory-title-one-fallback])",
      ) ?? null;
      // Compact mode intentionally hides closed semantic bands. Contract
      // discovery must therefore prefer the registered Factory title even
      // while it is not rendered, or the same live node loses its shared
      // identity until the page-context tool is opened.
      const authoredTitleOne = canonicalFactoryTitleOne
        ?? authoredTitleCandidates.find(isVisible)
        ?? null;
      const needsFallback = requiresTitleOne && !authoredTitleOne;
      onShowTitleOneFallbackChange(needsFallback, factoryPageRegistration?.label || "");
      if (authoredTitleOne) {
        // A page-owned Factory Title 1 or ClientSourceLayout project context
        // is authoritative. Promote that one live band into both Developer and
        // Shared Contract instead of inserting a second workspace title above
        // the visible page frame.
        if (requiresTitleOne) {
          const explicitAdapterOwnsDeveloperRegion = frameAdapterResolution?.strategy === "explicit-exception"
            && Boolean(authoredTitleOne.dataset.developmentStandardFrameRegion);
          setProjectedFactoryAttribute(authoredTitleOne, "data-responsive-semantic-band", "page-context");
          setProjectedFactoryAttribute(authoredTitleOne, "data-responsive-shared-surface", "title-1");
          setProjectedFactoryAttribute(authoredTitleOne, "data-responsive-shared-surface-plugin", RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedSurfaces.plugin);
          if (!explicitAdapterOwnsDeveloperRegion) {
            setProjectedFactoryAttribute(authoredTitleOne, "data-development-standard-frame-region", "title-1");
          }
          if (!authoredTitleOne.dataset.developmentStandardFrameLabel) {
            setProjectedFactoryAttribute(authoredTitleOne, "data-development-standard-frame-label", "标题1");
          }
          markSharedAdaptiveSurface(authoredTitleOne, "title-1");
        }
        return;
      }
      if (needsFallback) return;
      // Factory-shell pages own Title 2 inside the page contract. Synthesising
      // another Title 1 from the same H1 gives one element two palette owners.
      // Registered pages receive a distinct React-owned fallback band above
      // the factory root; this legacy inference remains only for unregistered
      // surfaces that do not participate in the 201-page contract.
      if (factoryPageRegistration || host.querySelector("[data-page-factory-frame-owner='factory-shell']")) return;
      const heading = Array.from(host.querySelectorAll<HTMLElement>("h1"))
        .find((candidate) => Boolean(candidate.textContent?.trim()));
      if (!heading) return;
      const content = heading.parentElement;
      if (!content || content === host) return;

      const explicitActionSelector = "[data-page-title-actions], [data-responsive-page-actions]";
      const actionControlSelector = "button, a[href], [role='button']";
      const isTitleActionRail = (candidate: HTMLElement) => {
        if (candidate.matches(explicitActionSelector) || candidate.querySelector(explicitActionSelector)) return true;
        // A direct action control is already a valid one-item title rail. Its
        // icon children must not make the wrapper test reject the button and
        // shrink the generated title surface to the copy column only.
        if (candidate.matches(actionControlSelector)) return true;
        const controls = candidate.matches(actionControlSelector)
          ? [candidate]
          : Array.from(candidate.querySelectorAll<HTMLElement>(actionControlSelector));
        if (!controls.length || controls.length > 6) return false;
        if (candidate.matches("form, table, input, select, textarea") || candidate.querySelector("form, table, input, select, textarea")) return false;
        // An unmarked implicit action rail may contain only controls (or thin
        // wrappers around controls). A card, form or business section beside a
        // heading is page content and must never be moved into Title 1.
        return Array.from(candidate.children).every((child) =>
          child.matches(actionControlSelector) || Boolean(child.querySelector(actionControlSelector)),
        );
      };

      let cursor: HTMLElement | null = content;
      let band: HTMLElement | null = null;
      let actions: HTMLElement | null = null;
      for (let depth = 0; cursor && cursor !== host && depth < 4; depth += 1, cursor = cursor.parentElement) {
        const headingChild = Array.from(cursor.children).find((child) => child.contains(heading)) as HTMLElement | undefined;
        const actionChild = Array.from(cursor.children).find((child): child is HTMLElement =>
          child instanceof HTMLElement && child !== headingChild && isTitleActionRail(child),
        );
        if (headingChild && actionChild) {
          band = cursor;
          actions = actionChild;
          break;
        }
      }
      // Heading-only pages still participate in the shared Title 1 contract.
      // Their business cards remain in Content instead of being inferred as a
      // synthetic action rail.
      band ||= content;

      band.dataset.responsiveGeneratedTitleBand = "true";
      band.dataset.responsiveSemanticBand = "page-context";
      band.dataset.responsiveSharedSurface = "title-1";
      band.dataset.responsiveSharedSurfacePlugin = RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedSurfaces.plugin;
      content.dataset.responsiveGeneratedTitleContent = "true";
      if (actions) {
        actions.dataset.responsiveGeneratedTitleActions = "true";
        const visibleActionItems = Array.from(actions.children)
          .filter((child): child is HTMLElement => child instanceof HTMLElement && isVisible(child));
        const actionGap = Number.parseFloat(getComputedStyle(actions).columnGap) || 0;
        const measuredActionWidth = visibleActionItems.reduce(
          (total, item) => total + item.getBoundingClientRect().width,
          0,
        ) + Math.max(0, visibleActionItems.length - 1) * actionGap;
        if (measuredActionWidth > 0) {
          actions.style.setProperty("--responsive-generated-title-actions-width", `${Math.ceil(measuredActionWidth)}px`);
        }
        if (!actions.matches("button, a[href], input, select, textarea, [role='button']")) {
          actions.dataset.responsiveCapacityRow ||= "generated-title-actions";
        }
      }
      generatedTitleBands.add(band);
      generatedTitleContents.add(content);
      if (actions) generatedTitleActions.add(actions);
      markSharedAdaptiveSurface(band, "title-1");
    };
    const updateContentReadiness = () => {
      const explicitBusy = Array.from(host.querySelectorAll<HTMLElement>(
        "[aria-busy='true'], [data-loading='true'], [data-page-route-loading], [data-preview-loading='true']",
      )).some(isVisible);
      if (explicitBusy) {
        if (contentReadyTimer !== null) {
          window.clearTimeout(contentReadyTimer);
          contentReadyTimer = null;
        }
        host.dataset.responsiveContentReady = "false";
        return;
      }
      if (host.dataset.responsiveContentReady === "true" || contentReadyTimer !== null) return;
      host.dataset.responsiveContentReady = "false";
      contentReadyTimer = window.setTimeout(() => {
        contentReadyTimer = null;
        host.dataset.responsiveContentReady = "true";
      }, 320);
    };
    const markSharedAdaptiveSurfaces = () => {
      markGeneratedTitleSurface();
      markSharedAdaptiveSurface(shell?.querySelector<HTMLElement>("[data-responsive-topbar]") || null, "top");
      host.querySelectorAll<HTMLElement>("[data-responsive-shared-surface]").forEach((surface) => {
        markSharedAdaptiveSurface(surface, surface.dataset.responsiveSharedSurface || "content");
      });
      host.querySelectorAll<HTMLElement>(
        "[data-page-layout-surface], [data-product-market-workspace], [data-page-list], [data-client-project-content], [data-page-list-scroll-owner], [data-product-market-scroll-list]",
      ).forEach((content) => markSharedAdaptiveSurface(content, "content"));
      markSharedAdaptiveSurface(shell?.querySelector<HTMLElement>("[data-page-layout-footer]") || null, "footer");
    };
    const markCapacityLayouts = () => {
      ensureFactoryIdentityProjection();
      markFactoryWorkspaceBoundaries();
      markAdaptiveStructures();
      markSharedAdaptiveSurfaces();
      const actionRows = host.querySelectorAll<HTMLElement>(
        "[data-page-title-actions], [data-client-project-context-actions], [data-responsive-page-actions], [data-responsive-page-toolbar], [data-responsive-batch-actions]",
      );
      actionRows.forEach((row) => {
        if (!row.dataset.responsiveCapacityRow) row.dataset.responsiveCapacityRow = "host-actions";
      });

      const gridSelectors = template === "dashboard" || template === "list"
        ? "[data-page-list] > .grid, [data-client-project-content] > .grid"
        : template === "form"
          ? "[data-responsive-form-grid]"
          : template === "detail"
            ? "[data-responsive-detail-grid]"
            : template === "workflow"
              ? "[data-responsive-workflow-grid]"
              : "[data-responsive-capacity-grid]";
      host.querySelectorAll<HTMLElement>(gridSelectors).forEach((grid) => {
        if (!grid.dataset.responsiveCapacityGrid) grid.dataset.responsiveCapacityGrid = "host-auto";
      });

      host.querySelectorAll<HTMLElement>("[data-responsive-capacity-row]").forEach((row) => {
        const children = Array.from(row.children).filter((child): child is HTMLElement => child instanceof HTMLElement && getComputedStyle(child).display !== "none");
        const rectangles = children.map((child) => child.getBoundingClientRect());
        // Different-height controls can have different top coordinates while
        // still sharing one flex line (for example under align-items:center).
        // A real second line no longer overlaps the first line vertically.
        const latestTop = rectangles.length ? Math.max(...rectangles.map((rect) => rect.top)) : 0;
        const earliestBottom = rectangles.length ? Math.min(...rectangles.map((rect) => rect.bottom)) : 0;
        row.dataset.responsiveCapacityFlow = rectangles.length > 1 && latestTop >= earliestBottom - 1 ? "wrapped" : "inline";
      });
      host.querySelectorAll<HTMLElement>("[data-responsive-capacity-grid]").forEach((grid) => {
        const children = Array.from(grid.children).filter((child): child is HTMLElement => child instanceof HTMLElement && getComputedStyle(child).display !== "none");
        const lefts = new Set(children.map((child) => Math.round(child.getBoundingClientRect().left)));
        grid.dataset.responsiveCapacityColumns = `${Math.max(1, lefts.size)}`;
      });
    };
    const apply = () => {
      scheduled = false;
      const width = Math.round(host.getBoundingClientRect().width || window.innerWidth);
      const stage = resolveGlobalResponsiveContainerStage(width);
      host.dataset.responsivePageContainerStage = stage;
      host.style.setProperty("--responsive-page-container-width", `${width}px`);
      markCapacityLayouts();
      root.setAttribute("data-global-responsive-page-contract", GLOBAL_RESPONSIVE_PAGE_FACTORY_DEFAULT.version);
      root.setAttribute("data-global-responsive-page-strategy", GLOBAL_RESPONSIVE_PAGE_FACTORY_DEFAULT.strategy);
      root.setAttribute("data-responsive-capacity-layout-policy", GLOBAL_RESPONSIVE_PAGE_FACTORY_DEFAULT.capacityLayout.strategy);
      root.setAttribute("data-responsive-adaptive-structure", ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.version);
      root.setAttribute("data-responsive-mobile-architecture", ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.mobileApplication.plugin);
      root.setAttribute("data-shared-adaptive-surface-contract", SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.version);
      root.setAttribute("data-shared-adaptive-surface-strategy", SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.strategy);
      root.setAttribute("data-shared-window-contract", SHARED_WINDOW_FACTORY_DEFAULT.version);
      root.setAttribute("data-shared-window-factory-default", SHARED_WINDOW_FACTORY_DEFAULT.id);
      root.setAttribute("data-shared-window-registry", SHARED_WINDOW_REGISTRY.map((window) => window.id).join(","));
      syncLocalBatchContract();
      root.setAttribute("data-global-responsive-page-template", template);
      root.setAttribute("data-global-responsive-page-container-stage", stage);
      updateContentReadiness();
    };
    const scheduleApply = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(apply);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleApply);
    observer?.observe(host);
    const mutationObserver = new MutationObserver((records) => {
      if (!hasMeaningfulFactoryMutation(records)) return;
      const factoryIdentityChanged = records.some((record) => (
        record.type === "childList"
        || record.attributeName === "data-page-factory-page-id"
        || record.attributeName === "data-page-factory-runtime-projection"
      ));
      if (factoryIdentityChanged) {
        // Lazy routes replace a temporary runtime projection with their authored
        // FactoryPage between animation frames. Reconcile the identity in this
        // mutation microtask so there is never a frame with two canonical roots.
        ensureFactoryIdentityProjection();
      }
      scheduleApply();
    });
    mutationObserver.observe(host, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeOldValue: true,
      // Lazy content and attribute-only card semantics can replace a temporary
      // projection without adding/removing a node. The shared discovery list
      // keeps both projectors aligned; runtime-owned values are filtered above
      // so their idempotent writes cannot create an observer loop.
      attributeFilter: Array.from(new Set([
        ...SHARED_LAYOUT_STYLE_CARD_REGION_DISCOVERY_MUTATION_ATTRIBUTES,
        "data-page-factory-page-id",
        "data-page-factory-region-strategy",
        "data-page-factory-runtime-projection",
        "data-development-standard-frame-label",
      ])),
    });
    if (appMain && appMain !== host) mutationObserver.observe(appMain, { childList: true });
    const handleLocalBatchChange = () => scheduleApply();
    const handleLocalBatchStorage = (event: StorageEvent) => {
      if (event.key === DEVELOPER_GLOBAL_BATCH_RELEASE_STORAGE_KEY) scheduleApply();
    };
    window.addEventListener(DEVELOPER_GLOBAL_BATCH_RELEASE_EVENT, handleLocalBatchChange);
    window.addEventListener("storage", handleLocalBatchStorage);
    apply();
    return () => {
      observer?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener(DEVELOPER_GLOBAL_BATCH_RELEASE_EVENT, handleLocalBatchChange);
      window.removeEventListener("storage", handleLocalBatchStorage);
      if (contentReadyTimer !== null) window.clearTimeout(contentReadyTimer);
      root.removeAttribute("data-global-responsive-page-contract");
      root.removeAttribute("data-global-responsive-page-strategy");
      root.removeAttribute("data-global-responsive-page-template");
      root.removeAttribute("data-global-responsive-page-container-stage");
      root.removeAttribute("data-responsive-capacity-layout-policy");
      root.removeAttribute("data-responsive-adaptive-structure");
      root.removeAttribute("data-responsive-mobile-architecture");
      root.removeAttribute("data-shared-adaptive-surface-contract");
      root.removeAttribute("data-shared-adaptive-surface-strategy");
      root.removeAttribute("data-shared-window-contract");
      root.removeAttribute("data-shared-window-factory-default");
      root.removeAttribute("data-shared-window-registry");
      root.removeAttribute("data-developer-global-batch-release");
      root.removeAttribute("data-developer-global-batch-window-contract");
      root.removeAttribute("data-developer-global-batch-target-page-id");
      delete host.dataset.developerGlobalFrameResolvedPageId;
      delete host.dataset.developerGlobalFrameResolvedAdapter;
      delete host.dataset.developerGlobalFrameResolvedStrategy;
      cleanupTemplateProfile?.();
      delete host.dataset.developerGlobalBatchRelease;
      delete host.dataset.developerGlobalBatchTargetPageId;
      delete host.dataset.developerGlobalBatchAdapter;
      markedAdaptiveSurfaces.forEach((surface) => {
        if (surface.dataset.sharedAdaptiveSurfaceContract === SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.version) {
          delete surface.dataset.sharedAdaptiveSurface;
          delete surface.dataset.sharedAdaptiveSurfaceSource;
          delete surface.dataset.sharedAdaptiveSurfaceContract;
        }
      });
      generatedTitleBands.forEach((band) => {
        delete band.dataset.responsiveGeneratedTitleBand;
        delete band.dataset.responsiveSemanticBand;
        delete band.dataset.responsiveSharedSurface;
        delete band.dataset.responsiveSharedSurfacePlugin;
      });
      generatedTitleContents.forEach((content) => delete content.dataset.responsiveGeneratedTitleContent);
      generatedTitleActions.forEach((actions) => {
        delete actions.dataset.responsiveGeneratedTitleActions;
        actions.style.removeProperty("--responsive-generated-title-actions-width");
        if (actions.dataset.responsiveCapacityRow === "generated-title-actions") delete actions.dataset.responsiveCapacityRow;
      });
      markedFactoryWorkspaceBoundaries.forEach((boundary) => {
        if (boundary.dataset.responsiveFactoryWorkspaceBoundary === "true") {
          delete boundary.dataset.responsiveFactoryWorkspaceBoundary;
        }
      });
      appMain?.querySelectorAll<HTMLElement>(
        ":scope > [data-existing-workspace-body-marker-hit-area='left'][data-responsive-factory-body-marker-geometry='factory-root']",
      ).forEach((hitArea) => {
        delete hitArea.dataset.responsiveFactoryBodyMarkerGeometry;
        hitArea.style.removeProperty("--responsive-factory-body-hit-left");
        hitArea.style.removeProperty("--responsive-factory-body-hit-top");
        hitArea.style.removeProperty("--responsive-factory-body-hit-width");
        hitArea.style.removeProperty("--responsive-factory-body-hit-height");
      });
      generatedFactoryBodyMarkerHitAreas.forEach((hitArea) => hitArea.remove());
      restoreProjectedFactoryAttributes();
    };
  }, [factoryPageRegistration, frameAdapterResolution, hostElement, location.pathname, location.search, onShowTitleOneFallbackChange, requiresTitleOne, scope, sourceScope, template]);

  return null;
}
