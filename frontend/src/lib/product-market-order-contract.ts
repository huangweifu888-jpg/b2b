/** Preserve the first occurrence so imported catalogue order stays deterministic. */
export function dedupeProductOrderPaths(paths: readonly string[]): string[] {
  const seen = new Set<string>();
  return paths.filter((path) => {
    if (seen.has(path)) return false;
    seen.add(path);
    return true;
  });
}
