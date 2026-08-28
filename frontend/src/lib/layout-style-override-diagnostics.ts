import { SHARED_FRAME_STYLE_CONTRACT } from "@/lib/layout-frame-contract";

export type LayoutStyleOverrideDiagnostic = {
  token: string;
  area: string;
  source: "global" | "page" | "conflict" | "unset";
};

/** Reports the final ownership of fixed-frame tokens without inspecting page-owned content. */
export function diagnoseLayoutStyleOverrides(
  pageVariables: Record<string, string>,
  globalVariables: Record<string, string>,
): readonly LayoutStyleOverrideDiagnostic[] {
  return SHARED_FRAME_STYLE_CONTRACT.flatMap((area) => area.tokens.map((token) => {
    const pageValue = pageVariables[token];
    const globalValue = globalVariables[token];
    const source = pageValue && globalValue && pageValue !== globalValue
      ? "conflict"
      : pageValue
        ? "page"
        : globalValue
          ? "global"
          : "unset";
    return { token, area: area.label, source };
  }));
}
