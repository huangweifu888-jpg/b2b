import { useLayoutEffect, useState } from "react";

import { RESPONSIVE_SHELL_TOOL_LABELS } from "@/lib/responsive-shell-contract";

function normalizePageLabel(value?: string | null) {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, 24);
}

function readActiveNavigationLabel() {
  const shell = document.querySelector<HTMLElement>("[data-responsive-shell]");
  if (!shell) return "";
  const activeLink = shell.querySelector<HTMLElement>(
    "[data-responsive-desktop-nav] a[aria-current='page'], [data-responsive-drawer] a[aria-current='page']",
  );
  if (!activeLink) return "";
  const explicitLabel = activeLink.querySelector<HTMLElement>(
    "[data-sidebar-nav-label], [data-source-nav-item-label]",
  );
  return normalizePageLabel(explicitLabel?.textContent || activeLink.textContent);
}

export function useResponsiveNavigationLabel({
  routeKey,
  preferredLabel,
}: {
  routeKey: string;
  preferredLabel?: string | null;
}) {
  const preferred = normalizePageLabel(preferredLabel);
  const fallback = RESPONSIVE_SHELL_TOOL_LABELS.navigation;
  const [label, setLabel] = useState(preferred || fallback);

  useLayoutEffect(() => {
    if (preferred) {
      setLabel(preferred);
      return;
    }

    let frame = 0;
    const refresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setLabel(readActiveNavigationLabel() || fallback));
    };
    const shell = document.querySelector<HTMLElement>("[data-responsive-shell]");
    const observer = shell ? new MutationObserver(refresh) : null;
    observer?.observe(shell, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-current"] });
    refresh();
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [fallback, preferred, routeKey]);

  return label;
}
