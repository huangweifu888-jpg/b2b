import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const [source, e2e, gateRunner] = await Promise.all([
  readFile(resolve(root, "src/components/ui/alert-dialog.tsx"), "utf8"),
  readFile(resolve(root, "e2e/alert-dialog-shared-window.spec.ts"), "utf8"),
  readFile(resolve(root, "scripts/run-development-standard-gates.mjs"), "utf8"),
]);

function assert(condition, message) {
  if (!condition) throw new Error(`AlertDialog shared-window contract failed: ${message}`);
}

for (const token of [
  'data-shared-dialog-contract="save-confirmation"',
  "data-shared-window-contract={SHARED_WINDOW_CONTRACT_VERSION}",
  "data-shared-window-factory-default={SHARED_WINDOW_FACTORY_DEFAULT.id}",
  'data-shared-window-kind="confirm"',
  'data-shared-window-region="frame"',
  'data-shared-window-theme-projection="active-page"',
  'data-shared-window-title-action-contract={SHARED_WINDOW_TITLE_ACTION_RAIL_CONTRACT}',
]) {
  assert(source.includes(token), `missing central frame registration: ${token}`);
}

const sharedCloseMarkers = source.match(/data-shared-window-close="true"/gu) ?? [];
const sharedCloseMounts = source.match(/<SharedAlertDialogCloseButton\s*\/>/gu) ?? [];
assert(sharedCloseMarkers.length === 1, `expected one shared close marker, received ${sharedCloseMarkers.length}`);
assert(sharedCloseMounts.length === 1, `expected one mounted shared X close control, received ${sharedCloseMounts.length}`);

for (const token of [
  "const SharedAlertDialogCloseButton = () => (",
  "<AlertDialogPrimitive.Cancel",
  "data-dialog-close",
  "data-development-standard-close",
  'data-content-plugin-control="close"',
  'data-shared-window-title-action="close"',
  'className="content-plugin-action-button is-icon absolute right-4 top-4 z-40"',
  'aria-label="关闭"',
  '<X className="h-4 w-4" />',
]) {
  assert(source.includes(token), `shared Cancel/X close control is incomplete: ${token}`);
}

assert(
  /\{children\}\s*<SharedAlertDialogCloseButton\s*\/>\s*<\/AlertDialogPrimitive\.Content>/u.test(source),
  "the unique shared close control must be mounted inside AlertDialog content after its children",
);

for (const token of [
  "AlertDialog shared X closes with Cancel semantics and never confirms",
  'data-shared-dialog-contract="save-confirmation"',
  'data-content-plugin-control="close"',
  "expect(deleteRequests).toBe(0)",
]) {
  assert(e2e.includes(token), `real interaction regression is incomplete: ${token}`);
}
assert(
  gateRunner.includes("run-alert-dialog-shared-window-runtime-contract.mjs"),
  "Development Standard must run the AlertDialog real interaction gate",
);

console.log("AlertDialog shared-window contract passed: one top-right shared X uses AlertDialog.Cancel semantics.");
