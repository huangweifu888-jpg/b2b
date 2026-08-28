process.env.B2B_PERF_PRODUCT_MARKET_TAB = "layout";
process.env.B2B_PERF_FAST = "true";
process.env.B2B_PERF_SAMPLES = "2";

await import("./measure-product-market-operations-performance.mjs");
