import type { LocalEnvServiceStatus, LocalEnvStatusResponse } from "@/lib/local-dev";

export type LocalEnvRecoveryAction = "start" | "restart";

export type LocalEnvRecoveryFinding = {
  id: "status-api-unreachable" | "frontend-offline" | "frontend-unhealthy" | "backend-offline" | "backend-unhealthy" | "website-offline" | "website-unhealthy" | "environment-incomplete";
  service: "frontend" | "backend" | "website" | "environment";
  title: string;
  detail: string;
  evidence: string;
  recoveryAction: LocalEnvRecoveryAction | null;
  safety: "safe" | "confirm";
};

type RecoveryHistoryEntry = {
  findingId: LocalEnvRecoveryFinding["id"];
  action: LocalEnvRecoveryAction | "detect";
  success: boolean;
  at: string;
};

export type LocalEnvLearningFactor = {
  id: LocalEnvRecoveryFinding["id"];
  label: string;
  count: number;
  firstAt: string;
  lastAt: string;
  lastAction: RecoveryHistoryEntry["action"];
  lastSuccess: boolean;
};

const HISTORY_KEY = "tradepro.local-env-recovery-history.v1";
const MAX_HISTORY = 200;

const serviceCopy = {
  frontend: { label: "前端预览 3003", offline: "前端预览服务未监听，右侧预览无法载入页面模块。", unhealthy: "前端预览端口存在，但健康状态未通过，可能仍在启动或模块服务异常。" },
  backend: { label: "本地 API 8000", offline: "本地 API 未监听，环境状态与修复接口暂时无法工作。", unhealthy: "本地 API 已监听但未通过健康检查，需要先复检；持续失败时查看启动日志和迁移状态。" },
  website: { label: "静态网站预览 3004", offline: "静态网站预览未监听，站点预览无法打开。", unhealthy: "静态网站预览已监听但未通过健康检查，可能仍在启动。" },
} as const;

function isRecoveryHistoryEntry(value: unknown): value is RecoveryHistoryEntry {
  return Boolean(value && typeof value === "object" && typeof (value as RecoveryHistoryEntry).findingId === "string" && typeof (value as RecoveryHistoryEntry).action === "string" && typeof (value as RecoveryHistoryEntry).success === "boolean" && typeof (value as RecoveryHistoryEntry).at === "string");
}

function readHistory(): RecoveryHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(HISTORY_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter(isRecoveryHistoryEntry).slice(-MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function writeHistory(entry: RecoveryHistoryEntry) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([...readHistory(), entry].slice(-MAX_HISTORY)));
  } catch {
    // Diagnostics stay available when browser storage is disabled.
  }
}

export function recordLocalEnvRecovery(findingId: LocalEnvRecoveryFinding["id"], action: LocalEnvRecoveryAction | "detect", success: boolean) {
  writeHistory({ findingId, action, success, at: new Date().toISOString() });
}

export function getLocalEnvLearningNote(findingId: LocalEnvRecoveryFinding["id"]) {
  const matches = readHistory().filter((entry) => entry.findingId === findingId && entry.action !== "detect");
  const successes = matches.filter((entry) => entry.success).length;
  if (!matches.length) return "首次遇到此类情况，将在本机记录修复结果。";
  if (!successes) return `本机已尝试 ${matches.length} 次，未形成自动修复规则。`;
  return `本机同类修复成功 ${successes}/${matches.length} 次，本次优先推荐已验证动作。`;
}

const factorLabels: Record<LocalEnvRecoveryFinding["id"], string> = {
  "status-api-unreachable": "状态接口",
  "frontend-offline": "前端离线",
  "frontend-unhealthy": "前端未绪",
  "backend-offline": "后端离线",
  "backend-unhealthy": "后端未绪",
  "website-offline": "网站离线",
  "website-unhealthy": "网站未绪",
  "environment-incomplete": "环境未绪",
};

/** Builds an ordered, local-only history of actual environment factors. */
export function listLocalEnvLearningFactors(): LocalEnvLearningFactor[] {
  const grouped = new Map<LocalEnvRecoveryFinding["id"], RecoveryHistoryEntry[]>();
  for (const entry of readHistory()) {
    const group = grouped.get(entry.findingId) || [];
    group.push(entry);
    grouped.set(entry.findingId, group);
  }
  return [...grouped.entries()]
    .map(([id, entries]) => {
      const sorted = [...entries].sort((left, right) => left.at.localeCompare(right.at));
      const latest = sorted[sorted.length - 1];
      return { id, label: factorLabels[id], count: sorted.length, firstAt: sorted[0].at, lastAt: latest.at, lastAction: latest.action, lastSuccess: latest.success };
    })
    .sort((left, right) => left.firstAt.localeCompare(right.firstAt));
}

function findingForService(service: keyof typeof serviceCopy, value: LocalEnvServiceStatus, recoveryAction: LocalEnvRecoveryAction | null): LocalEnvRecoveryFinding | null {
  const copy = serviceCopy[service];
  if (value.status === "stopped" || !value.listening) {
    return { id: `${service}-offline` as LocalEnvRecoveryFinding["id"], service, title: `${copy.label}未启动`, detail: copy.offline, evidence: `端口 ${value.port}：${value.listening ? "已监听" : "未监听"}；状态：${value.status}。`, recoveryAction, safety: "safe" };
  }
  if (!value.healthy) {
    return { id: `${service}-unhealthy` as LocalEnvRecoveryFinding["id"], service, title: `${copy.label}未就绪`, detail: copy.unhealthy, evidence: `端口 ${value.port} 已监听，但健康检查未通过。`, recoveryAction, safety: "safe" };
  }
  return null;
}

export function diagnoseLocalEnv(status: LocalEnvStatusResponse | null, errorMessage: string, recoveryAction: LocalEnvRecoveryAction | null): LocalEnvRecoveryFinding[] {
  if (!status) {
    return [{ id: "status-api-unreachable", service: "environment", title: "无法读取本地环境状态", detail: "检测接口暂时不可访问。通常是本地 API 未启动，或前端与本地 API 的连接已断开。", evidence: errorMessage || "未取得 3003 / 8000 / 3004 的状态快照。", recoveryAction: null, safety: "confirm" }];
  }
  const findings = [
    findingForService("frontend", status.frontend, recoveryAction),
    findingForService("backend", status.backend, recoveryAction),
    findingForService("website", status.website, recoveryAction),
  ].filter((finding): finding is LocalEnvRecoveryFinding => Boolean(finding));
  if (!findings.length && !status.ok) {
    findings.push({ id: "environment-incomplete", service: "environment", title: "本地环境尚未完全就绪", detail: "服务正在切换或重启中。请先重新检测，避免在服务绑定端口期间重复重启。", evidence: "环境总状态未通过，但单项服务尚未给出明确离线原因。", recoveryAction: null, safety: "safe" });
  }
  return findings;
}
