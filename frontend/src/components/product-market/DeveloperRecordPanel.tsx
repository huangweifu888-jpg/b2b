import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DEVELOPER_RECORD_APPS,
  DEVELOPER_RECORD_LOCAL_DISCLAIMER,
  filterDeveloperRecords,
  type DeveloperRecordEntry,
} from "@/lib/developer-record-ledger";

export type DeveloperRecordPanelMode = "projection" | "ledger";

export type DeveloperRecordPanelProps = {
  records: readonly DeveloperRecordEntry[];
  activeAppId?: DeveloperRecordEntry["appId"];
  mode: DeveloperRecordPanelMode;
  onOpenLedger?: () => void;
  sourceRecordsResolved?: boolean;
};

const STATUS_META: Record<DeveloperRecordEntry["status"], { label: string; className: string }> = {
  pending: { label: "待处理", className: "border-sky-500/35 bg-sky-500/10" },
  passed: { label: "已通过", className: "border-emerald-500/35 bg-emerald-500/10" },
  failed: { label: "未通过", className: "border-red-500/35 bg-red-500/10" },
  blocked: { label: "已阻断", className: "border-amber-500/40 bg-amber-500/10" },
  stale: { label: "已过期", className: "border-orange-500/35 bg-orange-500/10" },
  info: { label: "信息", className: "border-current/20 bg-current/[0.04]" },
};

const AUTHORITY_META: Record<DeveloperRecordEntry["authority"], { label: string; detail: string }> = {
  source: { label: "源码正式", detail: "随源码保存的正式记录" },
  server: { label: "服务端状态", detail: "由服务端返回的运行状态" },
  local: { label: "本地便捷", detail: "仅供当前设备辅助查看" },
  session: { label: "会话临时", detail: "仅在当前会话内有效" },
};

const ALL_FILTER = "all";
const LEDGER_PAGE_SIZE = 20;
const RECORDED_AT_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function appLabel(appId: string) {
  const app = DEVELOPER_RECORD_APPS.find((candidate) => candidate.appId === appId);
  return app ? `${app.id} ${app.label}` : appId;
}

function formatRecordedAt(recordedAt: string) {
  const timestamp = Date.parse(recordedAt);
  if (!Number.isFinite(timestamp)) return "时间未记录";
  return RECORDED_AT_FORMATTER.format(timestamp);
}

function versionLabels(record: DeveloperRecordEntry) {
  const labels: string[] = [];
  if (record.hVersion) labels.push(record.hVersion.startsWith("H") ? record.hVersion : `H${record.hVersion}`);
  if (record.factoryVersion) labels.push(`工厂 ${record.factoryVersion}`);
  if (record.contractVersion) labels.push(`契约 ${record.contractVersion}`);
  return labels;
}

function shortenFingerprint(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

function primaryFingerprint(record: DeveloperRecordEntry) {
  const entry = [
    ["源码", record.sourceFingerprint],
    ["目标清单", record.targetManifestFingerprint],
  ].find((candidate): candidate is [string, string] => Boolean(candidate[1]));
  if (!entry) return null;
  return {
    label: entry[0],
    fullValue: entry[1],
    value: shortenFingerprint(entry[1]),
  };
}

function describeStructuredValue(value: unknown) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item)));
  }
  if (typeof value === "string") return value ? [value] : [];
  if (typeof value === "object") {
    return Object.entries(value).map(([key, item]) => `${key}：${typeof item === "string" ? item : JSON.stringify(item)}`);
  }
  return [String(value)];
}

function RecordCard({ record, compact = false }: { record: DeveloperRecordEntry; compact?: boolean }) {
  const status = STATUS_META[record.status];
  const authority = AUTHORITY_META[record.authority];
  const versions = versionLabels(record);
  const fingerprint = primaryFingerprint(record);
  const validations = describeStructuredValue(record.validation);
  const risks = describeStructuredValue(record.risks);
  const artifactRefs = describeStructuredValue(record.artifactRefs);

  return (
    <article
      data-developer-record-entry={record.recordId}
      data-developer-record-app={record.appId}
      data-developer-record-status={record.status}
      data-developer-record-authority={record.authority}
      className={`rounded-lg border p-2.5 text-xs ${status.className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-current/20 px-1.5 py-0.5 text-[9px] font-semibold">
              {appLabel(record.appId)}
            </span>
            <span className="rounded-full border border-current/20 px-1.5 py-0.5 text-[9px]">{status.label}</span>
            <span className="rounded-full border border-current/20 px-1.5 py-0.5 text-[9px]" title={authority.detail}>
              {authority.label}
            </span>
          </div>
          <h4 className="mt-1.5 break-words text-[12px] font-semibold leading-5">{record.title}</h4>
        </div>
        <time dateTime={record.recordedAt} className="shrink-0 text-[9px] opacity-65">
          {formatRecordedAt(record.recordedAt)}
        </time>
      </div>

      <p className={`mt-1 break-words text-[10px] leading-4 opacity-75 ${compact ? "line-clamp-2" : ""}`}>
        {record.summary || "这条记录没有补充摘要。"}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1 text-[9px] opacity-70">
        <span className="rounded border border-current/15 px-1.5 py-0.5">{record.scope === "global" ? "全局" : record.scope === "page" ? "当前页" : "系统"}</span>
        {versions.map((version) => (
          <span key={version} className="rounded border border-current/15 px-1.5 py-0.5">{version}</span>
        ))}
        {fingerprint ? (
          <code className="rounded border border-current/15 px-1.5 py-0.5" title={`${fingerprint.label}：${fingerprint.fullValue}`}>
            {fingerprint.label} {fingerprint.value}
          </code>
        ) : (
          <span className="rounded border border-current/15 px-1.5 py-0.5">无指纹</span>
        )}
      </div>

      {!compact && (validations.length || risks.length || artifactRefs.length) ? (
        <details className="mt-2 border-t border-current/10 pt-2 text-[10px] leading-4">
          <summary className="cursor-pointer font-semibold">查看验证、风险与凭据引用</summary>
          {validations.length ? (
            <div className="mt-2">
              <b>验证</b>
              <ul className="mt-1 space-y-1 opacity-75">{validations.map((item, index) => <li key={`${index}-${item}`}>· {item}</li>)}</ul>
            </div>
          ) : null}
          {risks.length ? (
            <div className="mt-2">
              <b>风险</b>
              <ul className="mt-1 space-y-1 opacity-75">{risks.map((item, index) => <li key={`${index}-${item}`}>· {item}</li>)}</ul>
            </div>
          ) : null}
          {artifactRefs.length ? (
            <div className="mt-2">
              <b>凭据引用</b>
              <ul className="mt-1 space-y-1 font-mono opacity-75">{artifactRefs.map((item, index) => <li key={`${index}-${item}`} className="break-all">· {item}</li>)}</ul>
            </div>
          ) : null}
        </details>
      ) : null}
    </article>
  );
}

export default function DeveloperRecordPanel({
  records,
  activeAppId,
  mode,
  onOpenLedger,
  sourceRecordsResolved = true,
}: DeveloperRecordPanelProps) {
  const [appFilter, setAppFilter] = useState<DeveloperRecordEntry["appId"] | typeof ALL_FILTER>(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState<DeveloperRecordEntry["status"] | typeof ALL_FILTER>(ALL_FILTER);
  const [authorityFilter, setAuthorityFilter] = useState<DeveloperRecordEntry["authority"] | typeof ALL_FILTER>(ALL_FILTER);
  const [query, setQuery] = useState("");
  const [visibleLedgerCount, setVisibleLedgerCount] = useState(LEDGER_PAGE_SIZE);
  const [showAllLedgerRecords, setShowAllLedgerRecords] = useState(false);

  const projectionRecords = useMemo(() => {
    return filterDeveloperRecords(records, activeAppId ? { appIds: [activeAppId] } : undefined);
  }, [activeAppId, records]);

  const ledgerRecords = useMemo(() => {
    return filterDeveloperRecords(records, {
      appIds: appFilter === ALL_FILTER ? undefined : [appFilter],
      statuses: statusFilter === ALL_FILTER ? undefined : [statusFilter],
      authorities: authorityFilter === ALL_FILTER ? undefined : [authorityFilter],
      search: query,
    });
  }, [appFilter, authorityFilter, query, records, statusFilter]);

  useEffect(() => {
    setVisibleLedgerCount(LEDGER_PAGE_SIZE);
    setShowAllLedgerRecords(false);
  }, [appFilter, authorityFilter, query, statusFilter]);

  const visibleLedgerRecords = showAllLedgerRecords
    ? ledgerRecords
    : ledgerRecords.slice(0, visibleLedgerCount);
  const hasMoreLedgerRecords = visibleLedgerRecords.length < ledgerRecords.length;

  if (mode === "projection") {
    const visibleRecords = projectionRecords.slice(0, 3);
    return (
      <section
        data-developer-record-panel="projection"
        data-developer-record-active-app={activeAppId || "all"}
        className="rounded-xl border border-current/20 bg-background/20 p-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">本应用记录</h3>
            <p className="mt-1 text-[10px] leading-4 opacity-65">
              {activeAppId ? appLabel(activeAppId) : "全部应用"} · 共 {projectionRecords.length} 条，显示最近 {Math.min(3, projectionRecords.length)} 条
            </p>
          </div>
          {onOpenLedger ? (
            <Button type="button" size="sm" variant="outline" className="h-8 px-2.5 text-[11px]" onClick={onOpenLedger}>
              查看全部记录
            </Button>
          ) : null}
        </div>

        <div className="mt-3 space-y-2">
          {visibleRecords.map((record) => <RecordCard key={record.recordId} record={record} compact />)}
          {!visibleRecords.length ? (
            <div data-developer-record-empty className="rounded-lg border border-dashed border-current/20 p-4 text-center text-[10px] leading-4 opacity-65">
              {sourceRecordsResolved
                ? "当前应用还没有可显示的记录。完成检查、验证或保存后，最近记录会出现在这里。"
                : "当前会话暂无记录，历史记录将在 07 页面工厂按需加载"}
            </div>
          ) : null}
        </div>

        {projectionRecords.some((record) => record.authority === "local" || record.authority === "session") ? (
          <p className="mt-2 border-t border-current/10 pt-2 text-[9px] leading-4 opacity-60">{DEVELOPER_RECORD_LOCAL_DISCLAIMER}</p>
        ) : null}
      </section>
    );
  }

  return (
    <section data-developer-record-panel="ledger" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-current/20 bg-background/20">
      <div className="shrink-0 border-b border-current/15 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">07 页面工厂记录总账</h3>
            <p className="mt-1 text-[10px] leading-4 opacity-65">汇总 01–06 与 08 页面锁定器记录；07 只负责索引和查阅，不改变原记录的权威级别。</p>
          </div>
          <span className="rounded-full border border-current/20 px-2 py-1 text-[10px]">
            {ledgerRecords.length} / {records.length} 条
          </span>
        </div>

        <div data-developer-record-filters className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(10rem,1fr)_9rem_9rem_9rem]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、摘要、页面、版本、指纹或凭据"
            aria-label="搜索开发记录"
            className="min-w-0 rounded-md border border-current/20 bg-transparent px-2.5 py-1.5 text-[11px] outline-none focus:border-current/50"
          />
          <select
            value={appFilter}
            onChange={(event) => setAppFilter(event.target.value as DeveloperRecordEntry["appId"] | typeof ALL_FILTER)}
            aria-label="按开发器应用筛选"
            className="min-w-0 rounded-md border border-current/20 bg-[var(--background,#fff)] px-2 py-1.5 text-[11px] outline-none focus:border-current/50"
          >
            <option value={ALL_FILTER}>全部应用</option>
            {DEVELOPER_RECORD_APPS.map((app) => <option key={app.appId} value={app.appId}>{app.id} {app.label}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as DeveloperRecordEntry["status"] | typeof ALL_FILTER)}
            aria-label="按记录状态筛选"
            className="min-w-0 rounded-md border border-current/20 bg-[var(--background,#fff)] px-2 py-1.5 text-[11px] outline-none focus:border-current/50"
          >
            <option value={ALL_FILTER}>全部状态</option>
            {Object.entries(STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
          </select>
          <select
            value={authorityFilter}
            onChange={(event) => setAuthorityFilter(event.target.value as DeveloperRecordEntry["authority"] | typeof ALL_FILTER)}
            aria-label="按记录权威级别筛选"
            className="min-w-0 rounded-md border border-current/20 bg-[var(--background,#fff)] px-2 py-1.5 text-[11px] outline-none focus:border-current/50"
          >
            <option value={ALL_FILTER}>全部权威级别</option>
            {Object.entries(AUTHORITY_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
          </select>
        </div>

        <p className="mt-2 text-[9px] leading-4 opacity-60">{DEVELOPER_RECORD_LOCAL_DISCLAIMER}</p>
      </div>

      <div data-developer-record-ledger-list className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {visibleLedgerRecords.map((record) => <RecordCard key={record.recordId} record={record} />)}
        {hasMoreLedgerRecords ? (
          <div
            data-developer-record-pagination
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-current/20 p-3 text-[10px] leading-4"
          >
            <span className="opacity-65">
              已显示 {visibleLedgerRecords.length} / {ledgerRecords.length} 条
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-[11px]"
                onClick={() =>
                  setVisibleLedgerCount((count) => Math.min(count + LEDGER_PAGE_SIZE, ledgerRecords.length))
                }
              >
                加载更多
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-[11px]"
                onClick={() => setShowAllLedgerRecords(true)}
              >
                显示全部
              </Button>
            </div>
          </div>
        ) : null}
        {!ledgerRecords.length ? (
          <div data-developer-record-empty className="rounded-lg border border-dashed border-current/20 p-6 text-center text-[10px] leading-4 opacity-65">
            没有符合当前筛选条件的记录。可清空关键字或切换应用、状态和权威级别后重试。
          </div>
        ) : null}
      </div>
    </section>
  );
}
