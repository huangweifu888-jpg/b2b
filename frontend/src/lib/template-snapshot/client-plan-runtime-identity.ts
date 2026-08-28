export type ClientPlanRuntimeIdentity = {
  instanceId: string;
  legacyInstanceId: string | null;
  planCode: string;
  clientId: number | null;
  planId: number | null;
  usesLegacyPlanCode: boolean;
};

type ClientPlanRuntimeIdentityInput = {
  planCode?: string | null;
  clientId?: number | null;
  planId?: number | null;
  allowLegacyPlanCode?: boolean;
};

function normalizePositiveId(value: number | null | undefined, label: string) {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label}必须是正整数。`);
  }
  return value;
}

export function resolveClientPlanRuntimeInstanceIdentity({
  planCode,
  clientId: rawClientId,
  planId: rawPlanId,
  allowLegacyPlanCode = false,
}: ClientPlanRuntimeIdentityInput): ClientPlanRuntimeIdentity {
  const normalizedPlanCode = (planCode || "").trim().toUpperCase();
  if (!normalizedPlanCode) {
    throw new Error("客户端计划运行实例缺少计划编码。");
  }

  const clientId = normalizePositiveId(rawClientId, "客户 ID");
  const planId = normalizePositiveId(rawPlanId, "计划 ID");
  if ((clientId === null) !== (planId === null)) {
    throw new Error("客户端计划运行实例绑定不完整：客户 ID 与计划 ID 必须同时存在。");
  }

  if (clientId !== null && planId !== null) {
    return {
      instanceId: `client-plan:${clientId}:${planId}`,
      legacyInstanceId: `client-plan:${normalizedPlanCode}`,
      planCode: normalizedPlanCode,
      clientId,
      planId,
      usesLegacyPlanCode: false,
    };
  }

  if (!allowLegacyPlanCode) {
    throw new Error("客户端计划缺少数值客户/计划绑定，已阻止使用计划编码猜测运行实例。");
  }

  return {
    instanceId: `client-plan:${normalizedPlanCode}`,
    legacyInstanceId: null,
    planCode: normalizedPlanCode,
    clientId: null,
    planId: null,
    usesLegacyPlanCode: true,
  };
}

export function resolveLegacyClientPlanRuntimeInstanceIdentity(
  identity: ClientPlanRuntimeIdentity,
): ClientPlanRuntimeIdentity | null {
  if (!identity.legacyInstanceId || identity.legacyInstanceId === identity.instanceId) return null;
  return {
    ...identity,
    instanceId: identity.legacyInstanceId,
    legacyInstanceId: null,
    usesLegacyPlanCode: true,
  };
}

function readOptionalPositiveId(record: Record<string, unknown>, camelKey: string, snakeKey: string) {
  const value = record[camelKey] ?? record[snakeKey] ?? null;
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`运行实例返回了无效的 ${camelKey}。`);
  }
  return value;
}

export function assertClientPlanRuntimeInstanceBinding(
  identity: ClientPlanRuntimeIdentity,
  instance: unknown,
) {
  if (!instance || typeof instance !== "object" || Array.isArray(instance)) {
    throw new Error("客户端计划运行实例响应无效。");
  }
  const record = instance as Record<string, unknown>;
  const instanceId = record.instanceId ?? record.instance_id;
  if (instanceId !== identity.instanceId) {
    throw new Error("客户端计划运行实例响应与请求身份不一致。");
  }

  const responseClientId = readOptionalPositiveId(record, "organizationId", "organization_id");
  const responsePlanId = readOptionalPositiveId(record, "projectId", "project_id");
  if ((responseClientId === null) !== (responsePlanId === null)) {
    throw new Error("客户端计划运行实例返回了不完整的客户/计划绑定。");
  }

  if (identity.usesLegacyPlanCode) {
    if (identity.clientId !== null && identity.planId !== null) {
      if (responseClientId !== identity.clientId || responsePlanId !== identity.planId) {
        throw new Error("历史计划编码实例绑定与当前客户、计划不一致，已阻止读取。");
      }
      return;
    }
    if (responseClientId !== null || responsePlanId !== null) {
      throw new Error("历史计划编码实例包含无法从当前站点验证的数值租户绑定，已阻止读取。");
    }
    return;
  }

  if (responseClientId !== identity.clientId || responsePlanId !== identity.planId) {
    throw new Error("客户端计划运行实例绑定与当前客户、计划不一致，已阻止读取。");
  }
}
