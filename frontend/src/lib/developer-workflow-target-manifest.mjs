export const DEVELOPER_WORKFLOW_TARGET_MANIFEST_SCHEMA_VERSION = 1;

const SHA256_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function cleanString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Locale-independent UTF-16 code-unit ordering, identical in browsers and Node. */
export function compareDeveloperWorkflowCodeUnits(left, right) {
  const normalizedLeft = String(left);
  const normalizedRight = String(right);
  return normalizedLeft < normalizedRight ? -1 : normalizedLeft > normalizedRight ? 1 : 0;
}

export function normalizeDeveloperWorkflowRoute(value) {
  const input = cleanString(value);
  if (!input) return "";
  const withoutHash = input.split("#", 1)[0] || "/";
  const separator = withoutHash.indexOf("?");
  const rawPath = separator === -1 ? withoutHash : withoutHash.slice(0, separator);
  const rawSearch = separator === -1 ? "" : withoutHash.slice(separator + 1);
  const path = `/${rawPath}`.replace(/\/{2,}/gu, "/").replace(/\/$/u, "") || "/";
  const params = new URLSearchParams(rawSearch);
  params.sort();
  const search = params.toString();
  return `${path}${search ? `?${search}` : ""}`;
}

export function canonicalizeDeveloperWorkflowValue(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => canonicalizeDeveloperWorkflowValue(item));
  if (!isRecord(value)) return null;
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort(compareDeveloperWorkflowCodeUnits)
      .map((key) => [key, canonicalizeDeveloperWorkflowValue(value[key])]),
  );
}

export function stableDeveloperWorkflowJson(value) {
  return JSON.stringify(canonicalizeDeveloperWorkflowValue(value));
}

function rotateRight(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

/** Dependency-free SHA-256 shared by browsers, Node build evidence and tests. */
export function fingerprintDeveloperWorkflowValue(value) {
  const bytes = new TextEncoder().encode(stableDeveloperWorkflowJson(value));
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15];
      const right = words[index - 2];
      const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3);
      const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choice + SHA256_CONSTANTS[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return Array.from(hash, (part) => part.toString(16).padStart(8, "0")).join("");
}

export function normalizeDeveloperWorkflowTargetEntries(targets) {
  const normalized = (Array.isArray(targets) ? targets : []).map((target) => {
    if (typeof target === "string") return { id: cleanString(target) };
    if (!isRecord(target)) return { id: "" };
    const sourceScope = cleanString(target.sourceScope);
    const normalizedRoute = cleanString(target.normalizedRoute)
      ? normalizeDeveloperWorkflowRoute(target.normalizedRoute)
      : "";
    const version = cleanString(target.version);
    const fingerprint = cleanString(target.fingerprint);
    return {
      id: cleanString(target.id),
      ...(sourceScope ? { sourceScope } : {}),
      ...(normalizedRoute ? { normalizedRoute } : {}),
      ...(version ? { version } : {}),
      ...(fingerprint ? { fingerprint } : {}),
    };
  }).filter((target) => target.id);
  const unique = new Map(normalized.map((target) => [stableDeveloperWorkflowJson(target), target]));
  return [...unique.entries()]
    .sort(([left], [right]) => compareDeveloperWorkflowCodeUnits(left, right))
    .map(([, target]) => target);
}

export function buildDeveloperWorkflowRouteTarget(sourceScopeValue, routeValue, versionValue = "") {
  const sourceScope = cleanString(sourceScopeValue);
  const normalizedRoute = normalizeDeveloperWorkflowRoute(routeValue);
  if (!sourceScope || !normalizedRoute) throw new Error("developer workflow route target requires sourceScope and route");
  const version = cleanString(versionValue);
  return {
    id: `${sourceScope}:${normalizedRoute}`,
    sourceScope,
    normalizedRoute,
    ...(version ? { version } : {}),
  };
}

export function buildDeveloperWorkflowTargetManifestPayload(targets) {
  return {
    schemaVersion: DEVELOPER_WORKFLOW_TARGET_MANIFEST_SCHEMA_VERSION,
    targets: normalizeDeveloperWorkflowTargetEntries(targets),
  };
}

export function fingerprintDeveloperWorkflowTargetManifest(targets) {
  return fingerprintDeveloperWorkflowValue(buildDeveloperWorkflowTargetManifestPayload(targets));
}

export function normalizeDeveloperWorkflowTargetIds(targetIds) {
  return [...new Set((Array.isArray(targetIds) ? targetIds : [])
    .map((targetId) => cleanString(targetId))
    .filter(Boolean))]
    .sort(compareDeveloperWorkflowCodeUnits);
}
