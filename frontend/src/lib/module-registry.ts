export type B2BModuleDefinition = {
  id: string;
  name: string;
  downloadEnabled: boolean;
  legacyFrontendPage?: string;
  legacyFrontendPages?: string[];
};

export type B2BModuleRegistry = {
  schemaVersion: number;
  moduleOwner: "customer-source";
  modules: B2BModuleDefinition[];
};

/**
 * The registry is served by the Python backend so all shells use one module
 * contract. Callers may cache it, but must not invent module IDs locally.
 */
export async function loadB2BModuleRegistry(): Promise<B2BModuleRegistry> {
  const response = await fetch("/api/v1/modules");
  if (!response.ok) {
    throw new Error(`Unable to load module registry: ${response.status}`);
  }
  return response.json() as Promise<B2BModuleRegistry>;
}

export function supportsPlanDownloads(registry: B2BModuleRegistry): boolean {
  return registry.modules.some((module) => module.id === "02-content" && module.downloadEnabled);
}
