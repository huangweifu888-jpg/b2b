import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(path), "utf8");
const assertContains = (source, value, message) => {
  if (!source.includes(value)) throw new Error(message);
};

const styles = read("src/index.css");
const frameContract = read("src/lib/layout-frame-contract.ts");

assertContains(styles, "--tradepro-a11y-focus-ring", "Shared CSS must provide a theme-derived keyboard focus token.");
assertContains(styles, "):focus-visible", "Shared CSS must keep keyboard focus visible.");
assertContains(styles, "@media (forced-colors: active)", "Shared CSS must support forced-colors focus rendering.");
assertContains(styles, "@media (prefers-reduced-motion: reduce)", "Shared CSS must honour reduced-motion preferences.");
assertContains(frameContract, 'owner: "shared"', "Frame contract must continue to distinguish shared ownership.");

console.log("Accessibility baseline contract verified.");
