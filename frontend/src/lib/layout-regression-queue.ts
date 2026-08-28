import { LAYOUT_QUALITY_BASELINES, PRODUCT_MARKET_FRAME_ACCEPTANCE } from "@/lib/layout-quality-baselines";

export type LayoutRegressionQueueItem = {
  id: string;
  label: string;
  route: string;
  focus: string;
  source: "business" | "product-market";
};

/** Produces the read-only regression queue used to expand coverage when pages are added. */
export function buildLayoutRegressionQueue(): readonly LayoutRegressionQueueItem[] {
  const items = [
    ...LAYOUT_QUALITY_BASELINES.map((item) => ({ ...item, source: "business" as const })),
    ...PRODUCT_MARKET_FRAME_ACCEPTANCE.map((item) => ({ ...item, source: "product-market" as const })),
  ];
  return items.filter((item, index) => items.findIndex((candidate) => candidate.route === item.route) === index);
}
