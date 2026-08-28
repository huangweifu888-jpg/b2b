/**
 * Shared request event for the client-source page "keep settings" action.
 *
 * Page headers and the footer must open the same confirmation flow. Keeping
 * the trigger in one place prevents a header action from accidentally taking
 * the template-draft persistence path instead of the page save/sync path.
 */
export const CLIENT_PROJECT_KEEP_SETTINGS_EVENT = "tradepro:client-project-keep-settings";

export function requestClientProjectKeepSettings() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CLIENT_PROJECT_KEEP_SETTINGS_EVENT));
}
