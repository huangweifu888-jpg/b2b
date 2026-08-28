import { useEffect } from "react";

const OWNERSHIP_SELECTOR = "[data-shared-ownership-key]";
const HIGHLIGHT_ATTRIBUTE = "data-shared-ownership-highlight";

type OwnershipElement = HTMLElement & {
  dataset: DOMStringMap & {
    sharedOwnershipKey?: string;
    sharedCategoryKey?: string;
  };
};

function findOwnershipElement(target: EventTarget | null): OwnershipElement | null {
  return target instanceof Element
    ? target.closest<OwnershipElement>(OWNERSHIP_SELECTOR)
    : null;
}

function applyOwnershipHighlight(documentRef: Document, origin: OwnershipElement | null) {
  const ownershipKey = origin?.dataset.sharedOwnershipKey || "";
  const categoryKey = origin?.dataset.sharedCategoryKey || "";

  for (const node of documentRef.querySelectorAll<OwnershipElement>(OWNERSHIP_SELECTOR)) {
    let state = "";
    if (origin && node === origin) {
      state = "direct";
    } else if (ownershipKey && node.dataset.sharedOwnershipKey === ownershipKey) {
      state = "linked";
    } else if (
      categoryKey
      && node.dataset.sharedCategoryKey === categoryKey
      && node.hasAttribute("data-shared-ownership-category-target")
    ) {
      state = "category";
    }

    if (state) node.setAttribute(HIGHLIGHT_ATTRIBUTE, state);
    else node.removeAttribute(HIGHLIGHT_ATTRIBUTE);
  }
}

/**
 * Product Market owns the runtime while it is mounted.  Event delegation keeps
 * Sidebar and body projections linked without introducing a second business
 * store or persisting a transient hover state.
 */
export function useSharedOwnershipHighlightRuntime() {
  useEffect(() => {
    const documentRef = document;
    let pointerOwner: OwnershipElement | null = null;
    let focusOwner: OwnershipElement | null = null;

    const render = () => applyOwnershipHighlight(documentRef, pointerOwner || focusOwner);
    const onPointerOver = (event: PointerEvent) => {
      const nextOwner = findOwnershipElement(event.target);
      if (nextOwner === pointerOwner) return;
      pointerOwner = nextOwner;
      render();
    };
    const onPointerOut = (event: PointerEvent) => {
      const currentOwner = findOwnershipElement(event.target);
      const nextOwner = findOwnershipElement(event.relatedTarget);
      if (!currentOwner || currentOwner === nextOwner) return;
      pointerOwner = nextOwner;
      render();
    };
    const onFocusIn = (event: FocusEvent) => {
      focusOwner = findOwnershipElement(event.target);
      render();
    };
    const onFocusOut = (event: FocusEvent) => {
      focusOwner = findOwnershipElement(event.relatedTarget);
      render();
    };

    documentRef.addEventListener("pointerover", onPointerOver, true);
    documentRef.addEventListener("pointerout", onPointerOut, true);
    documentRef.addEventListener("focusin", onFocusIn, true);
    documentRef.addEventListener("focusout", onFocusOut, true);
    return () => {
      documentRef.removeEventListener("pointerover", onPointerOver, true);
      documentRef.removeEventListener("pointerout", onPointerOut, true);
      documentRef.removeEventListener("focusin", onFocusIn, true);
      documentRef.removeEventListener("focusout", onFocusOut, true);
      applyOwnershipHighlight(documentRef, null);
    };
  }, []);
}

export function buildSharedCategoryOwnershipKey(categoryKey: string) {
  return `category:${categoryKey}`;
}

export function buildSharedModuleOwnershipKey(path: string) {
  return `module:${path.trim()}`;
}
