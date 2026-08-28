import { useEffect, useMemo, useState } from "react";
import { CircleHelp, RotateCcw } from "lucide-react";

import {
  buildVersionStorageKey,
  getCurrentProductMarketVersion,
  getLatestProductMarketVersion,
  readProductMarketVersions,
  restoreProductMarketVersion,
  type ProductMarketVersionEntry,
} from "@/lib/product-market-version";
import { useProductMarketStore } from "@/lib/product-market-store";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DraggableDialogContent,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  HQ_SOFTWARE_VERSION,
  HQ_SOFTWARE_UPDATE_SUMMARY,
  HQ_SOFTWARE_UPDATE_TITLE,
  pickNewestVersion,
} from "@/lib/software-version";
import { compareNewestLargeSequenceFirst } from "@/lib/newest-large-sequence-order-contract";

const BUILD_VERSION_KEY = "tradepro.buildVersion";
const DEFAULT_BUILD_VERSION = "H1";
const HISTORY_LIMIT = 10;
const FALLBACK_CREATED_AT = "2026-06-27T08:30:00.000Z";

function formatVersionTime(value: string) {
  try {
    return new Date(value).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function formatEntryLabel(entry: ProductMarketVersionEntry) {
  const title = entry.title?.trim();
  const summary = entry.summary?.trim();
  const createdAt = formatVersionTime(entry.createdAt);
  return {
    title: title || HQ_SOFTWARE_UPDATE_TITLE,
    summary: summary || "暂无更新说明",
    createdAt,
  };
}

function compareVersionIdsDescending(left: string, right: string) {
  const leftMatch = /^([A-Za-z]+)(\d+)$/.exec(left.trim());
  const rightMatch = /^([A-Za-z]+)(\d+)$/.exec(right.trim());
  if (leftMatch && rightMatch && leftMatch[1].toUpperCase() === rightMatch[1].toUpperCase()) {
    return Number(rightMatch[2]) - Number(leftMatch[2]);
  }
  return right.localeCompare(left, undefined, { numeric: true, sensitivity: "base" });
}

function sortHqVersionHistory(entries: ProductMarketVersionEntry[]) {
  return [...entries]
    .sort((left, right) => compareNewestLargeSequenceFirst(
      { sequence: Number(left.id.match(/\d+/)?.[0]) || undefined, createdAt: left.createdAt, stableId: left.id },
      { sequence: Number(right.id.match(/\d+/)?.[0]) || undefined, createdAt: right.createdAt, stableId: right.id },
    ) || compareVersionIdsDescending(left.id, right.id))
    // Each H number is an independently restorable record.  Do not collapse
    // historical releases merely because their generated titles or summaries
    // happen to be the same, and keep legacy entries with blank descriptions.
    .filter((entry) => Boolean(entry.id?.trim()))
    .slice(0, HISTORY_LIMIT);
}

export default function SoftwareVersionBadge({
  tone = "dark",
}: {
  tone?: "dark" | "light";
}) {
  const importConfig = useProductMarketStore((state) => state.importConfig);
  const fallbackEntry: ProductMarketVersionEntry = {
    id: HQ_SOFTWARE_VERSION,
    scope: "hq",
    createdAt: FALLBACK_CREATED_AT,
    config: useProductMarketStore.getState().exportConfig(),
    source: "hq-software-update",
    title: HQ_SOFTWARE_UPDATE_TITLE,
    summary: HQ_SOFTWARE_UPDATE_SUMMARY,
  };

  const getLatestVersion = () => {
    if (typeof window === "undefined") return DEFAULT_BUILD_VERSION;
    return (
      window.localStorage.getItem(buildVersionStorageKey("hq")) ||
      window.localStorage.getItem(BUILD_VERSION_KEY) ||
      HQ_SOFTWARE_VERSION ||
      pickNewestVersion(getLatestProductMarketVersion("hq")?.id) ||
      DEFAULT_BUILD_VERSION
    );
  };

  const [version, setVersion] = useState(() => getLatestVersion());
  const [history, setHistory] = useState<ProductMarketVersionEntry[]>(() => {
    if (typeof window === "undefined") return [];
    const entries = sortHqVersionHistory(readProductMarketVersions("hq"));
    return entries.length ? entries : [fallbackEntry];
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setVersion(getLatestVersion());
      const entries = sortHqVersionHistory(readProductMarketVersions("hq"));
      setHistory(entries.length ? entries : [fallbackEntry]);
    };

    window.addEventListener("product-market-version-updated", refresh);
    window.addEventListener("storage", refresh);
    refresh();

    return () => {
      window.removeEventListener("product-market-version-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const currentVersion = useMemo(() => {
    if (typeof window === "undefined") return history[0] ?? null;
    const pinnedVersionId =
      window.localStorage.getItem(buildVersionStorageKey("hq")) ||
      window.localStorage.getItem(BUILD_VERSION_KEY) ||
      HQ_SOFTWARE_VERSION;
    const pinnedVersion = history.find((entry) => entry.id === pinnedVersionId);
    if (pinnedVersion) return pinnedVersion;
    const current = getCurrentProductMarketVersion("hq");
    if (current) return current;
    return history.find((entry) => entry.id === HQ_SOFTWARE_VERSION) || history[0] || null;
  }, [history, version]);

  const badgeClassName =
    tone === "dark"
      ? "inline-flex items-center rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/90"
      : "inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700";

  const triggerClassName =
    tone === "dark"
      ? "inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/10 p-0 text-white hover:bg-white/15 focus:outline-none"
      : "inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white p-0 text-slate-700 hover:bg-slate-50 focus:outline-none";

  const handleRestore = (targetId: string) => {
    const target = history.find((item) => item.id === targetId);
    if (!target) return;
    if (target.id === currentVersion?.id) return;

    const confirmText = [
      `确定恢复总部版本 ${target.id} 吗？`,
      target.title ? `版本标题：${target.title}` : null,
      target.summary ? `更新说明：${target.summary}` : null,
      "恢复后会切换总部当前程序配置。",
      "程序恢复点：以“源码与部署中心”当前显示的版本存储与备份入口为准。",
    ]
      .filter(Boolean)
      .join("\n");

    if (!window.confirm(confirmText)) return;

    const restored = restoreProductMarketVersion("hq", target.id);
    if (!restored) return;
    importConfig(restored.config);
    setVersion(restored.id);
    setOpen(false);
  };

  const currentLabel = currentVersion ? formatEntryLabel(currentVersion) : null;

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={badgeClassName}
        title={currentVersion ? `${currentVersion.id} · ${currentVersion.title || "总部版本更新"}：${currentVersion.summary || "查看总部版本历史"}` : "总部版本更新"}
      >
        {getLatestVersion()}
      </span>
      <button
        type="button"
        className={triggerClassName}
        aria-label="总部版本历史"
        aria-expanded={open}
        title={currentVersion ? `总部 ${currentVersion.id}：${currentVersion.summary || "查看更新内容与恢复记录"}` : "总部版本更新"}
        onClick={() => setOpen(true)}
      >
        <CircleHelp className="h-3.5 w-3.5 shrink-0 opacity-80" />
      </button>

      <Dialog open={open} modal onOpenChange={setOpen}>
        <DraggableDialogContent
          showCloseButton
          resizable
          minWidth={420}
          minHeight={360}
          data-shared-dialog-contract="hq-version-history"
          data-shared-window-kind="editor"
          data-shared-window-size="editor-wide"
          data-shared-window-spacing-contract="dialog-8px"
          data-hq-version-history-limit={HISTORY_LIMIT}
          data-hq-version-history-count={history.length}
          className="tradepro-version-dialog tradepro-dialog-surface flex max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden border p-0"
        >
          <DialogHeader data-drag-handle className="tradepro-version-titlebar relative cursor-move space-y-1 border-b px-5 py-4 text-left">
            <DialogTitle className="text-base font-semibold leading-6 sm:text-lg">总部 H 版本更新</DialogTitle>
          <DialogDescription data-dialog-optional-description className="text-xs leading-5 sm:text-sm">总部版本按最新、大号优先展示；相同标题与内容只保留最新一条，点击历史版本才会进入恢复确认。</DialogDescription>
          </DialogHeader>
          <div data-shared-window-region="topbar" data-hq-version-history-header className="flex shrink-0 flex-wrap items-center gap-2 p-2">
          <div className="tradepro-version-table-head grid w-full grid-cols-1 overflow-hidden text-center text-xs sm:grid-cols-3">
            <div className="border-b px-3 py-2 sm:border-b-0 sm:border-r"><span className="block text-[10px] opacity-70">版本更新号</span><b className="mt-0.5 block">{currentVersion?.id || getLatestVersion()}</b></div>
            <div className="border-b px-3 py-2 sm:border-b-0 sm:border-r"><span className="block break-words text-[10px] opacity-70">更新标题</span><b className="mt-0.5 block break-words" title={currentLabel?.title}>{currentLabel?.title || "总部版本更新"}</b></div>
            <div className="px-3 py-2"><span className="block text-[10px] opacity-70">更新时间</span><b className="mt-0.5 block">{currentLabel?.createdAt || "--"}</b></div>
          </div>
          </div>
          <div data-shared-window-region="content" className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 py-4">
          <ScrollArea data-hq-version-history-scroll-owner className="min-h-0 flex-1 pr-2">
          <div className="tradepro-version-body space-y-4">
          <div data-shared-large-card-surface="true" className="tradepro-version-content-card p-3">
            <div className="tradepro-version-section-label px-2 py-2 text-xs font-medium">版本更新记录</div>
            <div data-hq-version-history-grid="responsive-ten" data-hq-version-history-order="newest-large-number-first" className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {history.map((entry) => {
              const label = formatEntryLabel(entry);
              const active = entry.id === currentVersion?.id;

              return (
                <div
                  key={entry.id}
                  data-shared-small-card-surface="true"
                  className="tradepro-version-history-row flex h-full min-w-0 flex-col rounded-2xl border p-4 text-left"
                >
                  <div className="min-w-0 flex-1 space-y-1 text-xs leading-5">
                    <div className="tradepro-version-row-title flex min-w-0 items-center gap-2 font-semibold">
                      <span className="shrink-0">版号：{entry.id}</span>
                      {active ? <span className="tradepro-version-current shrink-0 text-[10px] font-normal">当前</span> : null}
                    </div>
                    <div className="flex min-w-0 gap-1">
                      <span className="shrink-0">引用：</span>
                      <span className="min-w-0 truncate" title={label.title}>{label.title}</span>
                    </div>
                    <div className="tradepro-version-row-date truncate" title={entry.createdAt}>时间：{label.createdAt}</div>
                    <div className="tradepro-version-row-copy flex min-w-0 gap-1">
                      <span className="shrink-0">说明：</span>
                      <span className="min-w-0 truncate" title={label.summary}>{label.summary}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={active}
                      onClick={() => handleRestore(entry.id)}
                      className="tradepro-version-action inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-3 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-60"
                      title={active ? `${entry.id} 是当前版本` : `恢复版本 ${entry.id}`}
                    >
                      <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                      {active ? "当前版本" : "恢复版本"}
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
          </div>
          </ScrollArea>
          </div>
          <div data-shared-window-region="footer" data-page-layout-footer data-dialog-resize-safe-area className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-5 py-3">
            <div data-shared-window-footer-leading>
              <span data-shared-window-footer-note>默认保留最近 10 个版本，最新且大号排前；内容区可完整滚动查看。</span>
            </div>
            <span data-shared-window-footer-status>总部版本记录 {history.length}/{HISTORY_LIMIT}</span>
          </div>
        </DraggableDialogContent>
      </Dialog>
    </div>
  );
}
