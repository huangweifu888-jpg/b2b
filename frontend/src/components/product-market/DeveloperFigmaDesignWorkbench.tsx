import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, FileCode2, Layers3, Link2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEVELOPER_DESIGN_INTEGRATION_CONTRACT,
  DEVELOPER_DESIGN_SESSION_EVENT,
  computeDeveloperPageDnaFingerprint,
  inspectDeveloperDesignMappingCoverage,
  parseFigmaDesignReference,
  parseFigmaSnapshotJson,
  readDeveloperDesignSession,
  saveDeveloperDesignSession,
  type DeveloperPageDna,
  type DeveloperDesignScope,
} from "@/lib/developer-design-integration";
import type { UpdateDeveloperWorkflowArtifactInput } from "@/lib/developer-workflow-run";

const FIGMA_SNAPSHOT_TEMPLATE = JSON.stringify({
  components: DEVELOPER_DESIGN_INTEGRATION_CONTRACT.componentMappings.map((mapping) => mapping.figmaName),
  variables: ["Color/Surface/Workspace", "Color/Action/Primary", "Space/Content/Gap", "Radius/Card"],
  frames: ["Desktop/1440", "Tablet/768", "Mobile/390"],
  fileKey: "",
  nodeId: null,
  revision: "",
  pageDnaFingerprint: "",
  sharedContractVersion: DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version,
  capturedAt: new Date(0).toISOString(),
}, null, 2);

export default function DeveloperFigmaDesignWorkbench({
  readOnly,
  workflowScope,
  workflowPageDna,
  onWorkflowScopeChange,
  onWorkflowArtifact,
}: {
  readOnly: boolean;
  workflowScope: DeveloperDesignScope;
  workflowPageDna: DeveloperPageDna;
  onWorkflowScopeChange: (scope: DeveloperDesignScope) => void;
  onWorkflowArtifact?: (input: UpdateDeveloperWorkflowArtifactInput<"03">) => void;
}) {
  const designScope = workflowScope;
  const pageDna = workflowPageDna;
  const selectDesignScope = onWorkflowScopeChange;
  const [session, setSession] = useState(() => readDeveloperDesignSession(pageDna));
  const [figmaUrl, setFigmaUrl] = useState(session.figma?.fileUrl ?? "");
  const [revision, setRevision] = useState(session.figma?.revision ?? "");
  const [snapshotJson, setSnapshotJson] = useState("");
  const [workflowFailure, setWorkflowFailure] = useState("");
  const workflowArtifactCallbackRef = useRef(onWorkflowArtifact);
  const hasWorkflowArtifactCallback = Boolean(onWorkflowArtifact);

  useEffect(() => {
    workflowArtifactCallbackRef.current = onWorkflowArtifact;
  }, [onWorkflowArtifact]);

  useEffect(() => {
    const next = readDeveloperDesignSession(pageDna);
    setSession(next);
    setFigmaUrl(next.figma?.fileUrl ?? "");
    setRevision(next.figma?.revision ?? "");
    setSnapshotJson("");
    setWorkflowFailure("");
  }, [pageDna]);

  useEffect(() => {
    const refresh = () => setSession(readDeveloperDesignSession(pageDna));
    window.addEventListener(DEVELOPER_DESIGN_SESSION_EVENT, refresh);
    return () => window.removeEventListener(DEVELOPER_DESIGN_SESSION_EVENT, refresh);
  }, [pageDna]);

  const coverage = useMemo(
    () => inspectDeveloperDesignMappingCoverage(session.snapshot),
    [session.snapshot],
  );

  useEffect(() => {
    if (!hasWorkflowArtifactCallback
      || session.identityKey !== pageDna.identityKey
      || session.scope !== designScope) return;
    let active = true;
    void computeDeveloperPageDnaFingerprint(pageDna).then((pageDnaFingerprint) => {
      if (!active) return;
      const contractStale = session.contractVersion !== DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version;
      const snapshotMetadataComplete = Boolean(
        session.snapshot?.fileKey
        && session.snapshot.revision
        && session.snapshot.pageDnaFingerprint
        && session.snapshot.sharedContractVersion,
      );
      const snapshotMetadataStale = Boolean(session.snapshot && (
        session.snapshot.pageDnaFingerprint && session.snapshot.pageDnaFingerprint !== pageDnaFingerprint
        || session.snapshot.sharedContractVersion && session.snapshot.sharedContractVersion !== DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version
        || session.snapshot.fileKey && session.figma?.fileKey && session.snapshot.fileKey !== session.figma.fileKey
        || session.snapshot.revision && session.figma?.revision && session.snapshot.revision !== session.figma.revision
      ));
      const mappingFailed = coverage.status === "incomplete";
      const complete = Boolean(
        session.figma?.fileKey
        && session.figma.revision
        && snapshotMetadataComplete
        && !snapshotMetadataStale
        && coverage.status === "mapped",
      );
      const status = contractStale || snapshotMetadataStale
        ? "stale"
        : workflowFailure
          ? "failed"
          : mappingFailed
            ? "failed"
            : complete
              ? "passed"
              : "pending";
      const message = contractStale || snapshotMetadataStale
        ? "Figma 设计会话或快照使用了旧页面 DNA、契约、文件或 revision，请重新读取并导入。"
        : workflowFailure
          || (mappingFailed
            ? `组件映射不完整：缺失 ${coverage.missing.length} 项，未登记 ${coverage.unmapped.length} 项。`
            : complete
              ? "Figma 引用、固定 revision 与共享组件映射均已就绪。"
              : "等待 Figma Design 引用、固定 revision，以及绑定 Page DNA 与契约版本的标准设计快照。 ");
      workflowArtifactCallbackRef.current?.({
        status,
        payload: {
          pageDnaFingerprint,
          fileKey: session.figma?.fileKey ?? null,
          nodeId: session.figma?.nodeId ?? null,
          revision: session.figma?.revision ?? null,
          componentMappings: coverage.mapped,
          scope: designScope,
          contractVersion: session.contractVersion,
          mappingStatus: coverage.status,
          mappingPercent: coverage.percent,
          missingMappings: coverage.missing,
          unmappedComponents: coverage.unmapped,
          snapshotCapturedAt: session.snapshot?.capturedAt ?? null,
        },
        artifactRefs: session.figma?.fileUrl ? [session.figma.fileUrl] : [],
        message,
      });
    }).catch((error) => {
      if (!active) return;
      workflowArtifactCallbackRef.current?.({
        status: "failed",
        payload: {
          pageDnaFingerprint: "unavailable",
          fileKey: session.figma?.fileKey ?? null,
          nodeId: session.figma?.nodeId ?? null,
          revision: session.figma?.revision ?? null,
          componentMappings: coverage.mapped,
          scope: designScope,
        },
        artifactRefs: session.figma?.fileUrl ? [session.figma.fileUrl] : [],
        message: error instanceof Error ? error.message : "无法计算页面 DNA 指纹。",
      });
    });
    return () => { active = false; };
  }, [coverage, designScope, hasWorkflowArtifactCallback, pageDna, session, workflowFailure]);

  const saveFigmaReference = () => {
    if (readOnly) return;
    try {
      const figma = parseFigmaDesignReference(figmaUrl, revision);
      const next = saveDeveloperDesignSession({ ...session, figma });
      setSession(next);
      setFigmaUrl(figma.fileUrl);
      setWorkflowFailure("");
      toast.success("已登记 Figma Design 引用；未保存任何账号凭证。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Figma Design 链接无效。";
      setWorkflowFailure(message);
      toast.error(message);
    }
  };

  const importSnapshot = () => {
    if (readOnly) return;
    try {
      const snapshot = parseFigmaSnapshotJson(snapshotJson);
      const next = saveDeveloperDesignSession({ ...session, snapshot });
      setSession(next);
      setWorkflowFailure("");
      toast.success("设计快照已进入页面 DNA；源码仍未被修改。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "无法读取设计快照。";
      setWorkflowFailure(message);
      toast.error(message);
    }
  };

  const copyConnectorPrompt = async () => {
    const prompt = `@Figma\n请只读检查这个 Figma Design 文件，并返回标准 JSON 快照，字段为 components、variables、frames。组件名称优先使用：${DEVELOPER_DESIGN_INTEGRATION_CONTRACT.componentMappings.map((item) => item.figmaName).join("、")}。\n${figmaUrl || "请先粘贴 /design/ 文件链接"}`;
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("已复制 @Figma 只读快照指令。");
    } catch {
      toast.error("浏览器未允许复制，请手动选择文本。");
    }
  };

  return (
    <section
      data-developer-figma-design-workbench
      data-developer-workflow-scope={designScope}
      data-design-contract-version={DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version}
      data-figma-runtime-network="on-explicit-connector-action-only"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden p-4"
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-current/15 pb-3">
        <div>
          <div className="flex items-center gap-2"><FileCode2 className="size-4" /><strong className="text-sm">Figma 设计桥</strong><Badge variant="outline">非对称同步</Badge></div>
          <p className="mt-1 text-[11px] leading-5 opacity-70">Codex @Figma 负责读取画布；开发器只保存文件引用和标准快照，不保存令牌，也不直接覆盖源码。</p>
        </div>
        <div data-figma-design-scope className="flex items-center gap-1 rounded-md border border-current/20 p-1">
          {(["page", "global"] as const).map((scope) => (
            <Button key={scope} data-developer-workflow-scope-option={scope} type="button" size="sm" variant={designScope === scope ? "default" : "ghost"} aria-pressed={designScope === scope} className="h-7 px-2 text-[11px]" onClick={() => selectDesignScope(scope)}>
              {scope === "page" ? "当前页面" : "全局"}
            </Button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pt-3">
        <div data-figma-page-dna className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["页面身份", pageDna.pageFactoryId || "未登记"],
            ["来源与路由", `${pageDna.sourceScope} · ${pageDna.normalizedRoute}`],
            ["模板与生命周期", `${pageDna.template || "—"} · ${pageDna.lifecycle}`],
            ["影响范围", `${pageDna.impactTargetCount} 个登记页面`],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-lg border border-current/15 bg-current/[0.03] p-3">
              <div className="text-[10px] opacity-60">{label}</div>
              <div className="mt-1 truncate text-xs font-semibold" title={value}>{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]">
          <section data-figma-design-reference className="rounded-lg border border-current/15 p-3">
            <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-semibold"><Link2 className="size-3.5" />Design 文件引用</div><p className="mt-1 text-[10px] leading-4 opacity-65">只接受 figma.com/design 链接；连接凭证仍由 Codex Figma 插件保管。</p></div>{session.figma ? <Badge variant="outline">已登记</Badge> : <Badge variant="outline">待连接</Badge>}</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
              <Input aria-label="Figma Design 文件链接" value={figmaUrl} onChange={(event) => setFigmaUrl(event.target.value)} placeholder="https://www.figma.com/design/..." disabled={readOnly} />
              <Input aria-label="Figma 设计版本" value={revision} onChange={(event) => setRevision(event.target.value)} placeholder="版本/修订号" disabled={readOnly} />
              <Button type="button" size="sm" disabled={readOnly || !figmaUrl.trim()} onClick={saveFigmaReference}>登记引用</Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
              <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => void copyConnectorPrompt()}>复制 @Figma 读取指令</Button>
              {session.figma ? <a className="inline-flex items-center gap-1 underline underline-offset-2" href={session.figma.fileUrl} target="_blank" rel="noreferrer">打开 Design <ExternalLink className="size-3" /></a> : null}
              <span className="opacity-60">fileKey：{session.figma?.fileKey || "—"} · node：{session.figma?.nodeId || "整个文件"}</span>
            </div>
          </section>

          <section data-figma-mapping-coverage className="rounded-lg border border-current/15 p-3">
            <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck className="size-3.5" />组件映射覆盖</div><p className="mt-1 text-[10px] leading-4 opacity-65">设计组件必须映射共享语义；未映射组件不能进入发布证据。</p></div><Badge variant="outline">{coverage.percent === null ? "待快照" : `${coverage.percent}%`}</Badge></div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]"><div className="rounded border border-current/10 p-2"><b className="block text-sm">{coverage.mapped.length}</b>已映射</div><div className="rounded border border-current/10 p-2"><b className="block text-sm">{coverage.missing.length}</b>缺失</div><div className="rounded border border-current/10 p-2"><b className="block text-sm">{coverage.unmapped.length}</b>未登记</div></div>
          </section>
        </div>

        <section data-figma-snapshot-import className="mt-3 rounded-lg border border-current/15 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-semibold"><RefreshCw className="size-3.5" />标准设计快照</div><p className="mt-1 text-[10px] leading-4 opacity-65">将 @Figma 返回的 components、variables、frames 及 fileKey、revision、pageDnaFingerprint、sharedContractVersion 粘贴到这里；原始画布和业务数据不会进入本地存储。</p></div><Button type="button" size="sm" variant="outline" className="h-7" disabled={readOnly} onClick={() => setSnapshotJson(FIGMA_SNAPSHOT_TEMPLATE)}>填入标准模板</Button></div>
          <textarea aria-label="Figma 标准设计快照 JSON" value={snapshotJson} onChange={(event) => setSnapshotJson(event.target.value)} disabled={readOnly} className="mt-3 min-h-32 w-full resize-y rounded-md border border-current/20 bg-transparent p-2 font-mono text-[10px] leading-5 outline-none" placeholder={FIGMA_SNAPSHOT_TEMPLATE} />
          <div className="mt-2 flex items-center justify-between gap-3"><span className="text-[10px] opacity-60">最近快照：{session.snapshot ? new Date(session.snapshot.capturedAt).toLocaleString("zh-CN") : "尚未导入"}</span><Button type="button" size="sm" disabled={readOnly || !snapshotJson.trim()} onClick={importSnapshot}>导入快照并生成映射</Button></div>
        </section>

        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          <section data-figma-component-mappings className="rounded-lg border border-current/15 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold"><Layers3 className="size-3.5" />Figma → 共享契约</div>
            <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[34rem] text-left text-[10px]"><thead className="border-b border-current/15 opacity-60"><tr><th className="p-2">Figma</th><th className="p-2">共享区域</th><th className="p-2">所有者</th><th className="p-2">默认加载</th></tr></thead><tbody>{DEVELOPER_DESIGN_INTEGRATION_CONTRACT.componentMappings.map((mapping) => <tr key={mapping.figmaName} className="border-b border-current/10"><td className="p-2 font-semibold">{mapping.figmaName}</td><td className="p-2">{mapping.region}</td><td className="p-2">共享契约</td><td className="p-2">{mapping.defaultLoadPriority}</td></tr>)}</tbody></table></div>
          </section>

          <section data-figma-load-intents className="rounded-lg border border-current/15 p-3">
            <div className="text-xs font-semibold">设计携带加载意图</div>
            <div className="mt-2 space-y-1">{DEVELOPER_DESIGN_INTEGRATION_CONTRACT.loadPriorities.map((priority) => <div key={priority.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 rounded border border-current/10 p-2 text-[10px]"><b>{priority.label}</b><span className="opacity-70">{priority.description}</span></div>)}</div>
          </section>
        </div>
      </div>
    </section>
  );
}
