/**
 * Canonical Agency Source routes must resolve to the same default tenant that
 * the AgencySourceLayout uses when no explicit `agency` query is supplied.
 * Legacy deep links may still override this value with their real agency code.
 */
export const DEFAULT_AGENCY_SOURCE_AGENCY_CODE = "D002";

export function resolveAgencySourceAgencyCode(search: string) {
  return new URLSearchParams(search).get("agency")?.trim()
    || DEFAULT_AGENCY_SOURCE_AGENCY_CODE;
}
