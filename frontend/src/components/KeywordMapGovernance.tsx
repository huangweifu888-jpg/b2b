import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { acknowledgeKeywordMapRelease, approveKeywordMapRelease, createKeywordStudy, draftKeywordMap, listKeywordMapWorkspace, prepareKeywordMapRelease, verifyKeywordMap, type KeywordMapWorkspace } from "@/lib/factory-keyword-map-api";

const empty: KeywordMapWorkspace = { studies: [], versions: [], releases: [], availability: { application_id: "trust.keyword-map", status: "pilot", release_version: null } };

export function KeywordMapGovernance() {
  const [workspace, setWorkspace] = useState(empty);
  const [mode, setMode] = useState("loading");
  const [project, setProject] = useState(1);
  const [market, setMarket] = useState("");
  const [source, setSource] = useState("");
  const [observedOn, setObservedOn] = useState("");

  const load = async () => {
    try {
      setMode("loading");
      setWorkspace(await listKeywordMapWorkspace(project));
      setMode("live");
    } catch (error) {
      setMode("error");
      toast({ variant: "destructive", title: error instanceof Error ? error.message : "关键词主题地图加载失败" });
    }
  };

  useEffect(() => { void load(); }, [project]);

  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      toast({ title: message });
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: error instanceof Error ? error.message : "关键词主题地图操作失败" });
      await load();
    }
  };

  const study = workspace.studies[0];
  const draft = workspace.versions.find((item) => item.study_id === study?.id && item.status === "draft");
  const verified = workspace.versions.find((item) => item.study_id === study?.id && item.status === "verified");
  const release = workspace.releases.find((item) => item.study_id === study?.id);
  const reference = (prefix: string, revision: number) => ({ expected_revision: revision, reference: `${prefix}-${Date.now()}` });
  const required = market.trim() && source.trim() && observedOn.trim();

  return <Card data-keyword-map-governance data-keyword-map-mode={mode} data-keyword-map-availability={workspace.availability.status} className="border-primary/20">
    <CardHeader className="gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base">关键词主题地图受控交接</CardTitle>
          <CardDescription>记录来源与观测日期，固化主题和采购意图；经异人核验、批准和内容/SEO/销售消费者回执后交接。不承诺搜索量、难度或排名，也不会自动改写站点。</CardDescription>
        </div>
        <Input className="w-20" aria-label="关键词主题地图项目编号" value={project} onChange={(event) => setProject(Number(event.target.value) || 1)} />
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="grid gap-2 md:grid-cols-3">
        <Input aria-label="关键词市场" value={market} onChange={(event) => setMarket(event.target.value)} placeholder="国家 / 市场" />
        <Input aria-label="关键词数据来源" value={source} onChange={(event) => setSource(event.target.value)} placeholder="搜索数据来源引用" />
        <Input aria-label="关键词观测日期" value={observedOn} onChange={(event) => setObservedOn(event.target.value)} placeholder="YYYY-MM-DD" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" data-keyword-map-create disabled={Boolean(study) || !required} onClick={() => void run(() => createKeywordStudy(project, { market, source_reference: source, observed_on: observedOn }), "关键词来源研究已建立")}>建立研究</Button>
        <Button size="sm" data-keyword-map-draft disabled={!study || Boolean(draft) || Boolean(verified)} onClick={() => study && void run(() => draftKeywordMap(project, study.id, { topic_manifest: { market, source_reference: source, observed_on: observedOn, topics: ["采购意图"], ranking_guaranteed: false } }), "关键词主题版本已固化")}>固化主题</Button>
        <Button size="sm" data-keyword-map-verify disabled={!draft} onClick={() => draft && void run(() => verifyKeywordMap(project, draft.id, reference("KEYWORD-VERIFY", draft.revision)), "关键词主题版本已独立核验")}>独立核验</Button>
        <Button size="sm" data-keyword-map-prepare disabled={!verified || Boolean(release)} onClick={() => verified && void run(() => prepareKeywordMapRelease(project, verified.id, { target: "content-team", activation_manifest: { actions: ["create-brief"], automatic_content_change: false }, rollback_reference: `KEYWORD-ROLLBACK-${Date.now()}` }), "关键词主题交接已准备")}>准备交接</Button>
        <Button size="sm" data-keyword-map-approve disabled={!release || release.status !== "pending-approval"} onClick={() => release && void run(() => approveKeywordMapRelease(project, release.id, reference("KEYWORD-APPROVE", release.revision)), "关键词主题交接已独立批准")}>独立批准</Button>
        <Button size="sm" data-keyword-map-acknowledge disabled={!release || release.status !== "approved"} onClick={() => release && void run(() => acknowledgeKeywordMapRelease(project, release.id, reference("KEYWORD-RECEIPT", release.revision)), "内容消费者回执已登记")}>登记回执</Button>
      </div>
      {study ? <div data-keyword-map-record data-keyword-map-status={study.status} className="rounded border p-2 text-sm"><b>{study.study_number}</b><Badge className="ml-2">{study.status}</Badge></div> : null}
      {[...workspace.versions.filter((item) => item.study_id === study?.id), ...workspace.releases.filter((item) => item.study_id === study?.id)].map((item) => <div key={item.id} data-keyword-map-record data-keyword-map-status={item.status} className="rounded border p-2 text-sm"><b>{"version_number" in item ? item.version_number : item.release_number}</b><Badge className="ml-2">{"available" in item && item.available ? "正式可用" : item.status}</Badge></div>)}
    </CardContent>
  </Card>;
}
