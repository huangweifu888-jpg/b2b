import { useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { Link, useLocation } from "react-router-dom";

import {
  resolveSharedLayoutStyleCardRegion,
  resolveSharedLayoutStyleRegionProps,
  SHARED_LAYOUT_STYLE_CARD_REGION_DISCOVERY_MUTATION_ATTRIBUTES,
} from "@/lib/shared-card-region-contract";
import type { PageFactoryFrameOwner, PageFactoryScope, PageFactoryTemplate } from "./page-factory";
import { PAGE_FACTORY_STANDARD } from "./page-factory";
import "./page-factory.css";

type FactoryPageProps = Omit<ComponentPropsWithoutRef<"section">, "children"> & {
  pageId: string;
  template: PageFactoryTemplate;
  sourceScope: PageFactoryScope;
  autoRegions?: boolean;
  /**
   * Opt into the shared one-scrollport workspace contract. The page's content
   * region becomes the only vertical scroll owner; outer shells remain fixed.
   */
  scrollContract?: "table-inner-60" | "content-only";
  children: ReactNode;
} & (
  | { asChild?: false; frameOwner?: Extract<PageFactoryFrameOwner, "factory-shell"> }
  | { asChild: true; frameOwner: Extract<PageFactoryFrameOwner, "existing-workspace"> }
);

const AUTO_REGION_TEMPLATES: Record<PageFactoryTemplate, readonly string[]> = {
  reference: [],
  dashboard: ["title-2", "content", "large-card", "small-card"],
  list: ["title-2", "content", "table-shell", "table-header", "scrollbar"],
  form: ["title-2", "content"],
  detail: ["title-2", "content", "large-card", "small-card"],
  editor: ["title-2", "content", "large-card", "small-card", "scrollbar"],
  workflow: ["title-2", "content", "large-card", "small-card", "table-shell", "table-header", "scrollbar"],
};

const DEVELOPMENT_STANDARD_REGION_LABELS: Record<string, string> = {
  body: "主体",
  "title-1": "标题",
  "title-2": "标题二",
  "table-shell": "表内",
  "table-header": "表头",
  content: "内容",
  "large-card": "大卡片",
  "small-card": "小卡片",
  footer: "尾栏",
  scrollbar: "滚动条",
};

type FactoryFallbackNavigationItem = {
  href: string;
  label: string;
  current: boolean;
};

function readFactoryFallbackNavigation(root: HTMLElement): FactoryFallbackNavigationItem[] {
  const shell = root.closest<HTMLElement>("[data-responsive-shell]");
  const navigation = shell?.querySelector<HTMLElement>(
    "nav.sidebar-scroll-surface, [data-responsive-sidebar] nav, aside nav, nav[aria-label]",
  );
  const currentUrl = new URL(window.location.href);
  const links = navigation
    ? Array.from(navigation.querySelectorAll<HTMLAnchorElement>("a[href]"))
    : [];
  const currentPath = currentUrl.pathname.replace(/\/$/u, "") || "/";
  const routeLinks = links.filter((link) => {
    const url = new URL(link.getAttribute("href") || "", window.location.origin);
    return (url.pathname.replace(/\/$/u, "") || "/") === currentPath;
  });
  const activeLinks = links.filter((link) => link.getAttribute("aria-current") === "page");
  const candidates = (routeLinks.length > 0 ? routeLinks : activeLinks).map((link) => {
    const href = link.getAttribute("href") || "";
    const url = new URL(href, window.location.origin);
    return {
      href: `${url.pathname}${url.search}`,
      label: (link.textContent || "").replace(/\s+/g, " ").trim(),
      current: url.pathname === currentUrl.pathname && (url.search === currentUrl.search || !url.search),
      hasSearch: Boolean(url.search),
    };
  }).filter((item) => item.href && item.label);
  const queriedCandidates = candidates.filter((item) => item.hasSearch);
  const scopedCandidates = queriedCandidates.length > 1 ? queriedCandidates : candidates;
  const unique = new Map<string, FactoryFallbackNavigationItem>();
  scopedCandidates.forEach(({ href, label, current }) => {
    if (!unique.has(href)) unique.set(href, { href, label, current });
  });
  return Array.from(unique.values()).slice(0, 12);
}

function rankedElements(root: HTMLElement, selector: string) {
  const elements = Array.from(root.querySelectorAll<HTMLElement>(selector));
  const visible = elements.filter(isRenderedElement);
  return [...visible, ...elements.filter((element) => !visible.includes(element))];
}

function isRenderedElement(element: HTMLElement) {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

function resolveAutoTitleRegion(root: HTMLElement, heading: HTMLElement) {
  const rootRect = root.getBoundingClientRect();
  let candidate = heading;
  let cursor = heading.parentElement;
  for (let depth = 0; cursor && cursor !== root && depth < 4; depth += 1, cursor = cursor.parentElement) {
    const rect = cursor.getBoundingClientRect();
    const isPageWidthBand = rootRect.width > 0 && rect.width >= rootRect.width * 0.72;
    const isBoundedTitleHeight = rect.height > 0 && rect.height <= Math.max(176, rootRect.height * 0.28);
    if (isPageWidthBand && isBoundedTitleHeight) {
      candidate = cursor;
      break;
    }
  }
  return candidate;
}

export function FactoryPage({
  pageId,
  template,
  sourceScope,
  autoRegions = false,
  scrollContract,
  asChild = false,
  frameOwner,
  children,
  className,
  ...props
}: FactoryPageProps) {
  const rootRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const [fallbackTableHeader, setFallbackTableHeader] = useState<{
    visible: boolean;
    items: FactoryFallbackNavigationItem[];
    signature: string;
  }>({ visible: false, items: [], signature: "" });
  const resolvedFrameOwner: PageFactoryFrameOwner = asChild ? "existing-workspace" : frameOwner ?? "factory-shell";
  const resolvedScrollContract = scrollContract
    ?? (resolvedFrameOwner === "factory-shell" && template !== "reference" ? "content-only" : undefined);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!autoRegions || asChild || !root) {
      setFallbackTableHeader((current) => current.visible ? { visible: false, items: [], signature: "" } : current);
      return;
    }
    let frame = 0;
    const refresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const realHeader = Array.from(root.querySelectorAll<HTMLElement>([
          "thead",
          "[data-page-table-header]:not([data-page-factory-fallback-table-header])",
          "[data-product-market-table-header]",
          "[data-development-standard-frame-region='table-header']:not([data-page-factory-fallback-table-header])",
        ].join(","))).find(isRenderedElement) ?? null;
        const items = realHeader ? [] : readFactoryFallbackNavigation(root);
        const signature = `${realHeader ? "real" : "fallback"}:${items.map((item) => `${item.href}:${item.label}:${item.current}`).join("|")}`;
        setFallbackTableHeader((current) => current.signature === signature
          ? current
          : { visible: !realHeader && items.length > 0, items, signature });
      });
    };
    const observer = new MutationObserver(refresh);
    observer.observe(root, { childList: true, subtree: true });
    refresh();
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [asChild, autoRegions, location.pathname, location.search, pageId]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    let assigned: Array<{ element: HTMLElement; region: string }> = [];
    let markerAssignments: Array<{ element: HTMLElement; region: string }> = [];
    const projectedRegionAttributes = new Map<HTMLElement, Map<string, string | null>>();
    const projectedRegionValues = new Map<HTMLElement, Map<string, string>>();
    const generatedScrollOwners = new Set<HTMLElement>();
    const demotedHorizontalScrollOwners = new Set<HTMLElement>();

    const clearAssigned = () => {
      projectedRegionAttributes.forEach((attributes, element) => {
        attributes.forEach((previous, name) => {
          if (previous === null) element.removeAttribute(name);
          else element.setAttribute(name, previous);
        });
      });
      projectedRegionAttributes.clear();
      projectedRegionValues.clear();
      for (const { element, region } of assigned) {
        if (element.dataset.pageFactoryRegion === region) delete element.dataset.pageFactoryRegion;
      }
      assigned = [];
      for (const { element, region } of markerAssignments) {
        if (element.dataset.developmentStandardFrameRegion === region) {
          delete element.dataset.developmentStandardFrameRegion;
          delete element.dataset.developmentStandardFrameLabel;
        }
      }
      markerAssignments = [];
      generatedScrollOwners.forEach((element) => {
        if (element.dataset.pageFactoryGeneratedScrollOwner === "true") {
          delete element.dataset.pageFactoryGeneratedScrollOwner;
          element.removeAttribute("data-page-list-scroll-owner");
        }
      });
      generatedScrollOwners.clear();
      demotedHorizontalScrollOwners.forEach((element) => {
        if (element.dataset.pageFactoryHorizontalScrollOwner === "true") {
          delete element.dataset.pageFactoryHorizontalScrollOwner;
          element.setAttribute("data-page-list-scroll-owner", "");
        }
      });
      demotedHorizontalScrollOwners.clear();
    };
    const assignMarker = (element: HTMLElement, region: string) => {
      if (element.dataset.developmentStandardFrameRegion) return;
      element.dataset.developmentStandardFrameRegion = region;
      element.dataset.developmentStandardFrameLabel = DEVELOPMENT_STANDARD_REGION_LABELS[region] || region;
      markerAssignments.push({ element, region });
    };
    const restoreRuntimeProjectedRegionAttribute = (element: HTMLElement, name: string) => {
      const attributes = projectedRegionAttributes.get(element);
      if (!attributes?.has(name)) return;
      const previous = attributes.get(name) ?? null;
      if (previous === null) element.removeAttribute(name);
      else element.setAttribute(name, previous);
      attributes.delete(name);
      if (attributes.size === 0) projectedRegionAttributes.delete(element);
      const values = projectedRegionValues.get(element);
      values?.delete(name);
      if (values?.size === 0) projectedRegionValues.delete(element);
    };
    const projectSharedRegion = (element: HTMLElement, region: string) => {
      if (region === "large-card") {
        restoreRuntimeProjectedRegionAttribute(element, "data-shared-small-card-surface");
      } else if (region === "small-card") {
        restoreRuntimeProjectedRegionAttribute(element, "data-shared-large-card-surface");
      }
      Object.entries(resolveSharedLayoutStyleRegionProps(region)).forEach(([name, value]) => {
        if (element.getAttribute(name) === value) {
          const projectedValue = projectedRegionValues.get(element)?.get(name);
          if (projectedValue !== undefined && projectedValue !== value) {
            const attributes = projectedRegionAttributes.get(element);
            attributes?.delete(name);
            if (attributes?.size === 0) projectedRegionAttributes.delete(element);
            const values = projectedRegionValues.get(element);
            values?.delete(name);
            if (values?.size === 0) projectedRegionValues.delete(element);
          }
          return;
        }
        let attributes = projectedRegionAttributes.get(element);
        if (!attributes) {
          attributes = new Map<string, string | null>();
          projectedRegionAttributes.set(element, attributes);
        }
        if (!attributes.has(name)) attributes.set(name, element.getAttribute(name));
        let values = projectedRegionValues.get(element);
        if (!values) {
          values = new Map<string, string>();
          projectedRegionValues.set(element, values);
        }
        values.set(name, value);
        element.setAttribute(name, value);
      });
    };
    const hasMeaningfulRegionMutation = (records: MutationRecord[]) => {
      let meaningful = records.some((record) => record.type === "childList");
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
          const projectedValue = projectedRegionValues.get(element)?.get(name)
            ?? (name === "data-page-factory-region"
              ? assigned.find((item) => item.element === element)?.region
              : name === "data-development-standard-frame-region"
                ? markerAssignments.find((item) => item.element === element)?.region
                : undefined);
          if (projectedValue === undefined) {
            meaningful = true;
            return;
          }
          const current = element.getAttribute(name);
          if (current !== projectedValue) {
            const attributes = projectedRegionAttributes.get(element);
            if (attributes?.has(name)) attributes.set(name, current);
            meaningful = true;
            return;
          }
          // Runtime projection writes always include a transition from the
          // authored value. A same-value write is an authored claim and must
          // stop being cleaned up as runtime-owned on a later refresh.
          if (group.every((record) => record.oldValue === projectedValue)) {
            const attributes = projectedRegionAttributes.get(element);
            attributes?.delete(name);
            if (attributes?.size === 0) projectedRegionAttributes.delete(element);
            const values = projectedRegionValues.get(element);
            values?.delete(name);
            if (values?.size === 0) projectedRegionValues.delete(element);
            if (name === "data-page-factory-region") {
              assigned = assigned.filter((item) => item.element !== element);
            } else if (name === "data-development-standard-frame-region") {
              markerAssignments = markerAssignments.filter((item) => item.element !== element);
            }
          }
        });
      });
      return meaningful;
    };
    const assign = (region: string, candidates: Array<HTMLElement | null | undefined>) => {
      const canonical = Array.from(root.querySelectorAll<HTMLElement>(`[data-page-factory-region="${region}"]`));
      const renderedCanonical = canonical.find(isRenderedElement);
      if (renderedCanonical) {
        projectSharedRegion(renderedCanonical, region);
        return;
      }
      const unassigned = candidates.filter((candidate): candidate is HTMLElement => Boolean(
        candidate && !candidate.dataset.pageFactoryRegion,
      ));
      // A hidden inactive tab must not reserve the only canonical region for
      // the active page. Prefer a rendered business surface; retain a hidden
      // fallback only when no authored canonical node exists yet.
      const element = unassigned.find(isRenderedElement)
        ?? (canonical.length === 0 ? unassigned[0] : null);
      if (!element) return;
      element.dataset.pageFactoryRegion = region;
      assigned.push({ element, region });
      assignMarker(element, region);
      projectSharedRegion(element, region);
    };
    const markCanonicalFactoryRegions = () => {
      const regionElements = Array.from(root.querySelectorAll<HTMLElement>("[data-page-factory-region]"));
      for (const element of regionElements) {
        const region = element.dataset.pageFactoryRegion;
        // Marker ownership is element-local. A hidden node carrying the same
        // region must never prevent the visible canonical node from receiving
        // its matching Developer annotation.
        if (!region) continue;
        const effectiveRegion = region === "large-card" || region === "small-card"
          ? resolveSharedLayoutStyleCardRegion(element, 1)
          : region;
        projectSharedRegion(element, effectiveRegion);
        if (!element.dataset.developmentStandardFrameRegion) assignMarker(element, effectiveRegion);
      }
      // A dedicated page footer is already a real authored shell surface, even
      // though footer ownership normally lives outside FactoryPage. Annotate it
      // here so every viewport resolves the same canonical footer instead of
      // depending on responsive CSS to expose an outer fallback.
      root.querySelectorAll<HTMLElement>("[data-page-layout-footer]")
        .forEach((element) => assignMarker(element, "footer"));
    };
    const ensureContentScrollOwner = () => {
      if (!resolvedScrollContract) return;
      let content = root.querySelector<HTMLElement>('[data-page-factory-region="content"]');
      if (!content) {
        const candidate = Array.from(root.children).find((element): element is HTMLElement => (
          element instanceof HTMLElement
          && !element.hasAttribute("data-page-factory-fallback-table-header")
          && element.getAttribute("aria-hidden") !== "true"
        ));
        if (candidate && candidate !== root && !candidate.dataset.pageFactoryRegion) {
          candidate.dataset.pageFactoryRegion = "content";
          assigned.push({ element: candidate, region: "content" });
          assignMarker(candidate, "content");
          projectSharedRegion(candidate, "content");
          content = candidate;
        }
      }
      if (!content || content === root) return;
      if (resolvedScrollContract === "content-only") {
        root.querySelectorAll<HTMLElement>("[data-page-list-scroll-owner]").forEach((owner) => {
          if (owner === content || !content.contains(owner)) return;
          owner.removeAttribute("data-page-list-scroll-owner");
          owner.dataset.pageFactoryHorizontalScrollOwner = "true";
          demotedHorizontalScrollOwners.add(owner);
        });
      }
      if (root.querySelector("[data-page-list-scroll-owner]")) return;
      content.dataset.pageListScrollOwner = "true";
      content.dataset.pageFactoryGeneratedScrollOwner = "true";
      generatedScrollOwners.add(content);
    };
    const refresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        clearAssigned();
        const cards = rankedElements(root, ".tradepro-surface-card, [data-social-content-card], [data-shared-large-card-surface='true'], [data-page-layout-card], [data-slot='card']");
        const cardContents = rankedElements(root, "[data-tradepro-card-content], [data-shared-small-card-surface='true'], [data-slot='card-content']");
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
        const resolveCardRegion = (card: HTMLElement, fallbackGroupedCardCount = groupedCardCount(card)) => (
          resolveSharedLayoutStyleCardRegion(card, fallbackGroupedCardCount)
        );
        if (autoRegions) {
          const required = new Set(AUTO_REGION_TEMPLATES[template]);
          const headings = rankedElements(root, "h1, h2");
          const loadingItems = rankedElements(root, ".animate-pulse, [aria-busy='true'], [data-loading='true'], [data-page-route-loading]");
          const loadingGroups = Array.from(new Set(loadingItems
            .map((item) => item.parentElement)
            .filter((element): element is HTMLElement => Boolean(element && element !== root))));
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
          const tables = rankedElements(root, "table");
          const tableHeads = rankedElements(root, "thead, [data-page-table-header]");
          const visibleTableHeads = tableHeads.filter(isRenderedElement);
          const tableContextHeaders = tables.flatMap((table) => {
            const wrapper = table.parentElement;
            const adjacent = wrapper?.previousElementSibling;
            return adjacent instanceof HTMLElement && isRenderedElement(adjacent) ? [adjacent] : [];
          });
          const tableShells = rankedElements(
            root,
            "[data-page-table-shell], [data-page-list], [role='table'], .responsive-table-wrap, [data-slot='table-container'], .tradepro-surface-card:has(table)",
          );
          // Async and empty list routes still have a real content-state surface
          // before their table mounts. Bind that last page-owned surface as the
          // table shell so the canonical region remains stable through loading,
          // empty, error and populated states; the next refresh upgrades it to
          // the real table wrapper without inventing a parallel placeholder.
          const contentStateSurfaces = rankedElements(root, ":scope > :last-child, :scope > * > :last-child");
          const scrollOwners = rankedElements(root, "[data-page-list-scroll-owner], .overflow-auto, .overflow-x-auto, .overflow-y-auto");
          const explicitContent = rankedElements(
            root,
            '[data-development-standard-frame-region="content"], [data-page-list-scroll-owner]',
          );
          const contentSurfaces = rankedElements(
            root,
            "main, [role='tabpanel']:not([hidden]), [data-page-list], [data-client-project-content], [data-page-layout-content], [data-page-layout-surface]",
          );
          // A deep panel or editor column is evidence for where page content
          // lives, but it is not automatically the page's vertical viewport.
          // Promote every discovered surface to the shallow page-owned boundary
          // below FactoryPage. This keeps one bounded scroll owner for wrapped
          // pages (tabs, dashboards and editors) without rewriting business DOM.
          const contentBoundaries = Array.from(new Set(contentSurfaces.map((surface) => {
            let boundary = surface;
            while (boundary.parentElement && boundary.parentElement !== root) {
              boundary = boundary.parentElement;
            }
            return boundary.parentElement === root ? boundary : null;
          }).filter((boundary): boundary is HTMLElement => Boolean(boundary))));
          const firstMeaningfulChild = Array.from(root.children).find((element): element is HTMLElement => (
            element instanceof HTMLElement && !element.hasAttribute("data-page-factory-fallback-table-header")
          ));
          if (required.has("content")) assign("content", [
            ...explicitContent,
            ...contentBoundaries,
            ...contentSurfaces,
            firstMeaningfulChild,
          ]);
          if (required.has("title-2")) assign("title-2", Array.from(new Set([
            ...headings.map((heading) => resolveAutoTitleRegion(root, heading)),
            // Content assignment may already own a shared page-width title
            // wrapper. Keep the real heading as the canonical title fallback
            // instead of leaving the required region undiscoverable.
            ...headings,
          ])));
          if (required.has("large-card")) assign("large-card", largeCardCandidates);
          if (required.has("small-card")) assign("small-card", [
            ...smallCardCandidates,
            ...cardContents.filter((card) => resolveCardRegion(card, 2) === "small-card"),
            ...loadingItems.filter((card) => resolveCardRegion(card, 2) === "small-card"),
          ]);
          if (required.has("table-shell")) assign("table-shell", [
            ...tableShells,
            ...tables.map((table) => table.parentElement),
            ...contentStateSurfaces,
          ]);
          if (required.has("table-header")) assign("table-header", [
            ...visibleTableHeads,
            ...tableContextHeaders,
            ...tableHeads,
          ]);
          if (required.has("scrollbar")) assign("scrollbar", [...scrollOwners, ...tables]);
        }
        // Canonical regions remain unique for inspection, while every peer
        // card receives the same shared palette and element-local annotation.
        // This keeps explicit and runtime-auto pages visually identical and
        // lets one Global Frame change reach all three source shells.
        cards.forEach((card) => {
          const region = resolveCardRegion(card);
          projectSharedRegion(card, region);
          assignMarker(card, region);
        });
        markCanonicalFactoryRegions();
        ensureContentScrollOwner();
      });
    };
    const observer = new MutationObserver((records) => {
      if (hasMeaningfulRegionMutation(records)) refresh();
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: [...SHARED_LAYOUT_STYLE_CARD_REGION_DISCOVERY_MUTATION_ATTRIBUTES],
    });
    refresh();
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      clearAssigned();
    };
  }, [autoRegions, resolvedScrollContract, template]);

  if (asChild) {
    return (
      <Slot
        ref={rootRef}
        {...props}
        data-page-factory-contract={PAGE_FACTORY_STANDARD.factoryVersion}
        data-page-factory-page-id={pageId}
        data-page-factory-template={template}
        data-page-factory-source-scope={sourceScope}
        data-page-factory-region-strategy={autoRegions ? "runtime-auto" : "explicit"}
        data-page-factory-scroll-contract={resolvedScrollContract}
        data-page-factory-region="body"
        data-shared-region-token-source="layout-style"
        data-page-factory-frame-owner={resolvedFrameOwner}
        className={className}
      >
        {children}
      </Slot>
    );
  }

  return (
    <section
      ref={rootRef}
      {...props}
      data-page-factory-contract={PAGE_FACTORY_STANDARD.factoryVersion}
      data-page-factory-page-id={pageId}
      data-page-factory-template={template}
      data-page-factory-source-scope={sourceScope}
      data-page-factory-region-strategy={autoRegions ? "runtime-auto" : "explicit"}
      data-page-factory-scroll-contract={resolvedScrollContract}
      data-page-factory-region="body"
      data-shared-region-token-source="layout-style"
      data-page-factory-frame-owner={resolvedFrameOwner}
      data-page-layout-surface
      data-page-layout-frame
      className={`page-factory-shell ${className || ""}`.trim()}
    >
      {fallbackTableHeader.visible ? (
        <nav
          aria-label="页面导航表头"
          data-page-table-header
          data-page-factory-fallback-table-header
          data-page-factory-table-header-contract="operations-market-navigation-fallback"
          data-page-factory-region="table-header"
          data-shared-layout-section="tableHeader"
          data-development-standard-frame-region="table-header"
          data-development-standard-frame-label="表头"
          className="page-factory-fallback-table-header"
        >
          <div className="page-factory-fallback-table-header__track">
            {fallbackTableHeader.items.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                aria-current={item.current ? "page" : undefined}
                className="page-factory-fallback-table-header__item"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
      {children}
    </section>
  );
}
