// Oxc raw transfer reserves a ~6 GiB contiguous ArrayBuffer on supported runtimes.
// Node 24 on Windows can reject that allocation before Knip starts its analysis.
// Knip exposes this compatibility switch; the regular parser remains deterministic.
process.env.KNIP_DISABLE_RAW_TRANSFER ??= "1";

await import("../node_modules/knip/bin/knip.js");
