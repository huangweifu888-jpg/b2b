import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type FactoryBomComponent = {
  line: number;
  material_reference: string;
  material_name: string;
  supplier_reference: string;
  quantity: string;
  unit: string;
  origin_country: string;
};

export type FactoryEngineeringVersion = {
  id: string;
  project_id: number;
  engineering_number: string;
  product_reference: string;
  sku_reference: string;
  product_name: string;
  engineering_version: string;
  specification: Record<string, string>;
  bom_components: FactoryBomComponent[];
  lifecycle_status: "draft" | "released";
  release_reference?: string | null;
  release_note?: string | null;
  emitted_events: Array<Record<string, unknown>>;
  revision: number;
};

export type FactoryPassportCertificate = {
  id: string;
  certificate_type: string;
  certificate_number: string;
  issuer: string;
  jurisdiction: string;
  valid_from: string;
  valid_until: string;
  evidence_reference: string;
  verification_status: string;
  revision: number;
};

export type FactoryProductPassport = {
  id: string;
  project_id: number;
  passport_number: string;
  engineering_version_id: string;
  engineering_number: string;
  product_reference: string;
  sku_reference: string;
  order_id: string;
  order_number: string;
  account_reference: string;
  work_order_reference: string;
  batch_reference: string;
  inspection_reference: string;
  shipment_reference: string;
  delivery_receipt_reference: string;
  target_market: string;
  access_mode: "controlled" | "customer" | "public-summary";
  lifecycle_status: "draft" | "published";
  trace_digest?: string | null;
  qr_payload?: string | null;
  emitted_events: Array<Record<string, unknown>>;
  revision: number;
  certificates: FactoryPassportCertificate[];
  linked_assets: Array<{
    id: string;
    asset_number: string;
    serial_number: string;
    status: string;
    service_count: number;
  }>;
};

export type FactoryPassportEligibleOrder = {
  id: string;
  order_number: string;
  account_reference: string;
  lines: Array<Record<string, unknown>>;
  fulfillment_evidence: Array<Record<string, unknown>>;
};

export type FactoryProductPassportWorkspace = {
  engineering_versions: FactoryEngineeringVersion[];
  passports: FactoryProductPassport[];
  eligible_orders: FactoryPassportEligibleOrder[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken();
  if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `产品护照请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/product-passports`;

export const listFactoryProductPassports = (projectId: number) =>
  request<FactoryProductPassportWorkspace>(base(projectId));

export const createFactoryEngineeringVersion = (
  projectId: number,
  payload: {
    order_id: string;
    product_reference: string;
    sku_reference: string;
    product_name: string;
    engineering_version: string;
    specification: Record<string, string>;
    bom_components: Array<Omit<FactoryBomComponent, "line">>;
  },
) => request<FactoryEngineeringVersion>(`${base(projectId)}/engineering`, {
  method: "POST",
  body: JSON.stringify(payload),
});

export const releaseFactoryEngineeringVersion = (
  projectId: number,
  engineeringId: string,
  payload: { expected_revision: number; release_reference: string; release_note: string },
) => request<FactoryEngineeringVersion>(`${base(projectId)}/engineering/${encodeURIComponent(engineeringId)}/release`, {
  method: "POST",
  body: JSON.stringify(payload),
});

export const createFactoryProductPassport = (
  projectId: number,
  payload: {
    engineering_version_id: string;
    order_id: string;
    target_market: string;
    access_mode: FactoryProductPassport["access_mode"];
  },
) => request<FactoryProductPassport>(`${base(projectId)}/passports`, {
  method: "POST",
  body: JSON.stringify(payload),
});

export const addFactoryProductPassportCertificate = (
  projectId: number,
  passportId: string,
  payload: {
    expected_revision: number;
    certificate_type: string;
    certificate_number: string;
    issuer: string;
    jurisdiction: string;
    valid_from: string;
    valid_until: string;
    evidence_reference: string;
  },
) => request<{ passport: FactoryProductPassport; certificate: FactoryPassportCertificate }>(
  `${base(projectId)}/passports/${encodeURIComponent(passportId)}/certificates`,
  { method: "POST", body: JSON.stringify(payload) },
);

export const publishFactoryProductPassport = (
  projectId: number,
  passportId: string,
  payload: { expected_revision: number },
) => request<FactoryProductPassport>(`${base(projectId)}/passports/${encodeURIComponent(passportId)}/publish`, {
  method: "POST",
  body: JSON.stringify(payload),
});
