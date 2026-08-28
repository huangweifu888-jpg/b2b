export type PageCompositionEditMode = "configure" | "preview";

export type PageCompositionEditModeContract = {
  mode: PageCompositionEditMode;
  allows: readonly string[];
  blocks: readonly ["business-data-write", "downstream-data-write", "global-style-write-from-preview"];
};

/**
 * Configuration changes only draft composition contracts. Preview consumes the
 * same contract read-only, so looking at a page can never become a route for
 * writing shared styles, business data, or downstream customizations.
 */
export function getPageCompositionEditModeContract(mode: PageCompositionEditMode): PageCompositionEditModeContract {
  return {
    mode,
    allows: mode === "configure"
      ? ["register-local-frame-draft", "inspect-impact", "choose-draft-composition"]
      : ["render-registered-composition", "inspect-impact"],
    blocks: ["business-data-write", "downstream-data-write", "global-style-write-from-preview"],
  };
}
