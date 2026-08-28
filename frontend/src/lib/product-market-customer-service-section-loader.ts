import { loadLazyModule } from "@/lib/lazy-module-recovery";

export type ProductMarketCustomerServiceSectionModule = typeof import(
  "@/components/product-market/ProductMarketCustomerServiceSection"
);

let customerServiceSectionPromise: Promise<ProductMarketCustomerServiceSectionModule> | undefined;

/**
 * ProductMarket's React.lazy boundary and route-intent preloader must share the
 * same request. A failed speculative import is released so the real route can
 * retry through the common lazy-module recovery path.
 */
export function loadProductMarketCustomerServiceSection() {
  if (customerServiceSectionPromise) return customerServiceSectionPromise;
  const pending = loadLazyModule(
    () => import("@/components/product-market/ProductMarketCustomerServiceSection"),
    "product-market-customer-service-section",
  ).catch((error) => {
    customerServiceSectionPromise = undefined;
    throw error;
  });
  customerServiceSectionPromise = pending;
  return pending;
}

export function preloadProductMarketCustomerServiceSection() {
  void loadProductMarketCustomerServiceSection().catch(() => undefined);
}
