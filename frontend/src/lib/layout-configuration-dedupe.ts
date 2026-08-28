import { SHARED_FRAME_STYLE_CONTRACT } from "@/lib/layout-frame-contract";

export type LayoutDedupeSuggestion = {
  id: string;
  label: string;
  tokens: readonly string[];
  state: "equivalent" | "conflict";
  action: string;
};

/**
 * Compare only fixed-frame tokens.  Page-owned header/content tokens are
 * deliberately outside this diagnostic so a report can never suggest deleting
 * a card, a form, business data, or a downstream customization.
 */
export function findLayoutConfigurationDedupeSuggestions(
  pageVariables: Record<string, string>,
  globalVariables: Record<string, string>,
): readonly LayoutDedupeSuggestion[] {
  return SHARED_FRAME_STYLE_CONTRACT.flatMap((group) => {
    const localTokens = group.tokens.filter((token) => Boolean(pageVariables[token]));
    const overlap = localTokens.filter((token) => Boolean(globalVariables[token]));
    if (!overlap.length) return [];
    const equivalent = overlap.filter((token) => pageVariables[token] === globalVariables[token]);
    if (equivalent.length === overlap.length) {
      return [{
        id: group.id,
        label: group.label,
        tokens: overlap,
        state: "equivalent" as const,
        action: "本页值与全局完全相同；可在确认恢复点后移除这份重复的本页固定框架配置。",
      }];
    }
    return [{
      id: group.id,
      label: group.label,
      tokens: overlap,
      state: "conflict" as const,
      action: "本页与全局存在不同值；保留当前页并回到共享变量或内容设计确认归属，绝不自动覆盖。",
    }];
  });
}
