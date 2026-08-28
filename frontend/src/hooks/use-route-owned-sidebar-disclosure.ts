import { useCallback, useState } from "react";
import { RESPONSIVE_SHELL_FACTORY_DEFAULT } from "@/lib/responsive-shell-contract";

export const PRODUCT_MARKET_DISCLOSURE_KEY = "product-market";
export const ROUTE_OWNED_SIDEBAR_DISCLOSURE_STRATEGY = RESPONSIVE_SHELL_FACTORY_DEFAULT.sidebarNavigation.strategy;

type RouteOwnedDisclosureState = {
  routeOwner: string | null;
  openKey: string | null;
};

function normalizeDisclosureKey(value: string | null | undefined) {
  const key = value?.trim();
  return key || null;
}

/**
 * Keeps one sidebar project branch open and derives the first rendered state
 * from the active route. Query-only navigation may remount the shell, so the
 * URL is the recovery source instead of component or local-storage history.
 */
export function useRouteOwnedSidebarDisclosure(activeRouteKey: string | null | undefined) {
  const routeOwner = normalizeDisclosureKey(activeRouteKey);
  const [state, setState] = useState<RouteOwnedDisclosureState>(() => ({
    routeOwner,
    openKey: routeOwner,
  }));

  const openKey = state.routeOwner === routeOwner ? state.openKey : routeOwner;
  const toggleDisclosure = useCallback((key: string) => {
    const disclosureKey = normalizeDisclosureKey(key);
    if (!disclosureKey) return;
    setState((current) => {
      const currentOpenKey = current.routeOwner === routeOwner ? current.openKey : routeOwner;
      return {
        routeOwner,
        openKey: currentOpenKey === disclosureKey ? null : disclosureKey,
      };
    });
  }, [routeOwner]);

  const isDisclosureOpen = useCallback((key: string) => openKey === key, [openKey]);

  return {
    openDisclosureKey: openKey,
    isDisclosureOpen,
    toggleDisclosure,
  } as const;
}
