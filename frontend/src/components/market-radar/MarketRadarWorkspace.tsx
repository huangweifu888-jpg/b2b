import { useEffect, useState } from "react";
import { Globe2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCurrentClientPlanId } from "@/lib/current-client-plan";
import {
  approveMarketRelease,
  createMarketDecision,
  createMarketScan,
  createMarketSignal,
  listMarketRadar,
  prepareMarketRelease,
  reviewMarketDecision,
  verifyMarketSignal,
  type MarketRadarWorkspace as Workspace,
} from "@/lib/factory-market-radar-api";

const EMPTY: Workspace = {
  scans: [],
  signals: [],
  decisions: [],
  releases: [],
  evidence: [],
  metrics: {
    market_scans: 0,
    verified_signal_percent: 0,
    approved_decisions: 0,
    available_releases: 0,
    latest_opportunity_score: null,
  },
  availability: {
    application_id: "identity.market-radar",
    status: "pilot",
    release_version: null,
    support_until: null,
  },
  contract: {},
};
const TYPES = [
  "demand",
  "growth",
  "competition",
  "entry-barrier",
  "channel-fit",
] as const;
const LABELS: Record<string, string> = {
  demand: "需求容量",
  growth: "增长趋势",
  competition: "竞争有利度",
  "entry-barrier": "准入可行度",
  "channel-fit": "渠道匹配",
};
const STATUS: Record<string, string> = {
  gathering: "采集信号",
  "decision-pending": "决策待审",
  decided: "决策通过",
  available: "正式可用",
  "pending-verification": "待核验",
  verified: "已核验",
  "pending-review": "待复核",
  approved: "已批准",
  "pending-approval": "待发布审批",
};

export function MarketRadarWorkspace() {
  const activePlanId = useCurrentClientPlanId();
  const projectId = activePlanId ?? 0;
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY);
  const [mode, setMode] = useState("loading");
  const [draft, setDraft] = useState({
    product_reference: "ROBOT-CELL",
    product_name: "柔性机器人工作站",
    target_country: "US",
    target_channel: "distributor",
    objective: "验证目标国家的真实需求、准入门槛、渠道匹配与可盈利进入顺序",
  });
  const [source, setSource] = useState("");
  const [score, setScore] = useState("80");
  const [evidence, setEvidence] = useState({
    customer_trial_reference: "",
    role_training_reference: "",
    issue_closure_reference: "",
    monitoring_reference: "",
    rollback_reference: "",
  });
  const load = async () => {
    if (!activePlanId) {
      setWorkspace(EMPTY);
      setMode("waiting-plan");
      return;
    }
    try {
      setMode("loading");
      setWorkspace(await listMarketRadar(projectId));
      setMode("live");
    } catch (error) {
      setMode("error");
      toast.error(error instanceof Error ? error.message : "市场雷达加载失败");
    }
  };
  useEffect(() => {
    void load();
  }, [activePlanId]);
  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      toast.success(message);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "市场雷达操作失败");
      await load();
    }
  };
  const scan = workspace.scans[0];
  const signals = workspace.signals.filter((x) => x.scan_id === scan?.id);
  const nextType = TYPES.find(
    (type) => !signals.some((x) => x.signal_type === type),
  );
  const pending = signals.find((x) => x.status === "pending-verification");
  const decision = workspace.decisions.find((x) => x.scan_id === scan?.id);
  const release = workspace.releases.find(
    (x) => x.decision_id === decision?.id,
  );
  const evidenceReady = Object.values(evidence).every(Boolean);
  return (
    <main
      className="space-y-4"
      data-market-radar-page
      data-market-radar-mode={mode}
      data-market-radar-availability={workspace.availability.status}
    >
      <div data-page-factory-responsive-row className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Globe2 className="h-5 w-5" />
            全球市场机会雷达
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            按国家、产品和渠道固化五类来源证据，经异人核验与进入决策后发布；不复制来源库数据，也不保存连接器密钥。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            aria-label="项目编号"
            className="w-20"
            type="number"
            min={1}
            value={activePlanId ?? ""}
            placeholder="加载中"
            readOnly
            aria-readonly="true"
          />
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-1 h-4 w-4" />
            刷新
          </Button>
          <Badge
            variant={
              workspace.availability.status === "available"
                ? "default"
                : "outline"
            }
          >
            {workspace.availability.status === "available"
              ? "正式可用"
              : "试点"}
          </Badge>
        </div>
      </div>
      <div data-page-factory-responsive-grid className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["市场扫描", workspace.metrics.market_scans],
          ["信号核验", `${workspace.metrics.verified_signal_percent}%`],
          ["批准决策", workspace.metrics.approved_decisions],
          ["可用发布", workspace.metrics.available_releases],
          ["机会评分", workspace.metrics.latest_opportunity_score ?? "—"],
        ].map(([label, value]) => (
          <Card key={label} data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" data-shared-small-card-surface="true">
            <CardContent className="py-4">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" data-shared-large-card-surface="true">
        <CardHeader>
          <CardTitle className="text-base">1. 建立国家市场扫描</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
            <Input
              value={draft.product_reference}
              onChange={(e) =>
                setDraft({ ...draft, product_reference: e.target.value })
              }
              placeholder="产品引用"
            />
            <Input
              value={draft.product_name}
              onChange={(e) =>
                setDraft({ ...draft, product_name: e.target.value })
              }
              placeholder="产品名称"
            />
            <Input
              value={draft.target_country}
              onChange={(e) =>
                setDraft({ ...draft, target_country: e.target.value })
              }
              placeholder="ISO 国家"
            />
            <Input
              value={draft.target_channel}
              onChange={(e) =>
                setDraft({ ...draft, target_channel: e.target.value })
              }
              placeholder="目标渠道"
            />
            <Input
              value={draft.objective}
              onChange={(e) =>
                setDraft({ ...draft, objective: e.target.value })
              }
              placeholder="进入目标"
            />
            <Button
              data-market-scan-create
              disabled={!activePlanId || !!scan}
              onClick={() =>
                void run(
                  () => createMarketScan(projectId, draft),
                  "市场扫描已建立",
                )
              }
            >
              建立扫描
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <Input
              value={nextType ? LABELS[nextType] : "五类信号已齐"}
              disabled
            />
            <Input
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="标准分"
            />
            <Input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="来源证据引用"
            />
            <Button
              data-market-signal-create
              disabled={!activePlanId || !scan || !nextType || !source.trim()}
              onClick={() =>
                scan &&
                nextType &&
                void run(
                  () =>
                    createMarketSignal(projectId, scan.id, {
                      signal_type: nextType,
                      normalized_score: Number(score),
                      raw_value: Number(score),
                      measurement_unit: "index",
                      source_system: "governed-connector",
                      source_reference: source,
                      source_revision: "2026.08",
                      source_observed_at: new Date().toISOString(),
                    }),
                  "市场信号已固证",
                )
              }
            >
              记录信号
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              data-market-signal-verify
              disabled={!activePlanId || !pending}
              onClick={() =>
                pending &&
                void run(
                  () =>
                    verifyMarketSignal(projectId, pending.id, {
                      expected_revision: pending.revision,
                      verification_reference: `SOURCE-QA-${Date.now()}`,
                    }),
                  "信号已独立核验",
                )
              }
            >
              独立核验信号
            </Button>
            <Button
              data-market-decision-create
              disabled={
                !activePlanId ||
                !scan ||
                !!decision ||
                signals.filter((x) => x.status === "verified").length !== 5
              }
              onClick={() =>
                scan &&
                void run(
                  () =>
                    createMarketDecision(projectId, scan.id, {
                      entry_gate_note:
                        "关税、认证、交付、售后与渠道责任已经形成可执行门槛清单",
                    }),
                  "市场进入决策已生成",
                )
              }
            >
              生成进入决策
            </Button>
            <Button
              data-market-decision-review
              disabled={!activePlanId || !decision || decision.status !== "pending-review"}
              onClick={() =>
                decision &&
                void run(
                  () =>
                    reviewMarketDecision(projectId, decision.id, {
                      expected_revision: decision.revision,
                      decision: "approve",
                      review_reference: `MARKET-QA-${Date.now()}`,
                    }),
                  "进入决策已独立复核",
                )
              }
            >
              独立复核决策
            </Button>
          </div>
          {signals.map((item) => (
            <div
              key={item.id}
              data-market-radar-record
              data-market-radar-status={item.status}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
            >
              <span>
                <b>{LABELS[item.signal_type]}</b> · {item.source_system}/
                {item.source_revision}
              </span>
              <span className="flex items-center gap-2">
                <span>{item.normalized_score} 分</span>
                <Badge>{STATUS[item.status] ?? item.status}</Badge>
              </span>
            </div>
          ))}
          {decision ? (
            <div
              data-market-radar-record
              data-market-radar-status={decision.status}
              className="rounded-md border p-3 text-sm"
            >
              <b>{decision.decision_number}</b> · 机会评分{" "}
              {decision.opportunity_score} · 建议{" "}
              {decision.entry_recommendation} ·{" "}
              <Badge>{STATUS[decision.status] ?? decision.status}</Badge>
              <p className="mt-1 break-all text-xs text-slate-500">
                输入哈希 {decision.input_hash}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" data-shared-large-card-surface="true">
        <CardHeader>
          <CardTitle className="text-base">2. 当前版本商业可用证据</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            {Object.keys(evidence).map((key) => (
              <Input
                key={key}
                value={evidence[key as keyof typeof evidence]}
                onChange={(e) =>
                  setEvidence({ ...evidence, [key]: e.target.value })
                }
                placeholder={
                  {
                    customer_trial_reference: "客户试用证据",
                    role_training_reference: "角色培训证据",
                    issue_closure_reference: "问题闭环证据",
                    monitoring_reference: "运行监控证据",
                    rollback_reference: "回滚演练证据",
                  }[key]
                }
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              data-market-release-prepare
              disabled={
                !activePlanId ||
                !decision ||
                decision.status !== "approved" ||
                !!release ||
                !evidenceReady
              }
              onClick={() =>
                decision &&
                void run(
                  () =>
                    prepareMarketRelease(projectId, decision.id, {
                      release_version: "2026.08.1",
                      support_owner: "growth-ops",
                      support_until: new Date(
                        Date.now() + 180 * 86400000,
                      ).toISOString(),
                      ...evidence,
                    }),
                  "市场雷达发布证据已固化",
                )
              }
            >
              准备正式发布
            </Button>
            <Button
              data-market-release-approve
              disabled={!activePlanId || !release || release.status !== "pending-approval"}
              onClick={() =>
                release &&
                void run(
                  () =>
                    approveMarketRelease(projectId, release.id, {
                      expected_revision: release.revision,
                      approval_reference: `GA-APPROVAL-${Date.now()}`,
                    }),
                  "市场雷达已批准为正式可用",
                )
              }
            >
              独立批准发布
            </Button>
          </div>
          {release ? (
            <div
              data-market-radar-record
              data-market-radar-status={release.status}
              className="rounded-md border p-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <b>
                  {release.release_number} · {release.release_version}
                </b>
                <Badge>
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  {release.available
                    ? "正式可用"
                    : (STATUS[release.status] ?? release.status)}
                </Badge>
              </div>
              <p className="mt-1 break-all text-xs text-slate-500">
                清单哈希 {release.manifest_hash} · 支持至{" "}
                {new Date(release.support_until).toLocaleDateString()}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
