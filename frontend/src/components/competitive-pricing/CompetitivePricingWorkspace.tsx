import { useEffect, useState } from "react";
import { BadgeDollarSign, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCurrentClientPlanId } from "@/lib/current-client-plan";
import {
  approvePriceRelease,
  createCompetitiveOffer,
  createPriceDecision,
  createPriceWatch,
  listCompetitivePricing,
  preparePriceRelease,
  reviewPriceDecision,
  verifyCompetitiveOffer,
  type CompetitivePricingWorkspace as Workspace,
} from "@/lib/factory-competitive-pricing-api";

const EMPTY: Workspace = {
  watches: [],
  offers: [],
  decisions: [],
  releases: [],
  evidence: [],
  metrics: {
    price_watches: 0,
    verified_offer_percent: 0,
    approved_decisions: 0,
    available_releases: 0,
    latest_price_index: null,
  },
  availability: {
    application_id: "identity.competitive-pricing",
    status: "pilot",
    release_version: null,
    support_until: null,
  },
  contract: {},
};
const STATUS: Record<string, string> = {
  gathering: "采集报价",
  "decision-pending": "价格带待审",
  decided: "决策通过",
  available: "正式可用",
  "pending-verification": "待核验",
  verified: "已核验",
  "pending-review": "待复核",
  approved: "已批准",
  "pending-approval": "待发布审批",
};
export function CompetitivePricingWorkspace() {
  const activePlanId = useCurrentClientPlanId();
  const projectId = activePlanId ?? 0;
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY);
  const [mode, setMode] = useState("loading");
  const [watchDraft, setWatchDraft] = useState({
    product_reference: "ROBOT-CELL",
    product_name: "柔性机器人工作站",
    market_country: "US",
    channel: "distributor",
    currency: "USD",
    own_reference_price: "100",
    scope_note:
      "对比同类公开或授权来源报价，结果仅用于价格情报，不形成客户报价。",
  });
  const [offerDraft, setOfferDraft] = useState({
    competitor_name: "",
    competitor_offer_reference: "",
    offer_price: "100",
    freight_price: "0",
    feature_summary: "可比较的公开配置和交付范围",
    source_reference: "",
  });
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
      setWorkspace(await listCompetitivePricing(projectId));
      setMode("live");
    } catch (error) {
      setMode("error");
      toast.error(error instanceof Error ? error.message : "竞价情报加载失败");
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
      toast.error(error instanceof Error ? error.message : "竞价情报操作失败");
      await load();
    }
  };
  const watch = workspace.watches[0];
  const offers = workspace.offers.filter((x) => x.watch_id === watch?.id);
  const pending = offers.find((x) => x.status === "pending-verification");
  const decision = workspace.decisions.find((x) => x.watch_id === watch?.id);
  const release = workspace.releases.find(
    (x) => x.decision_id === decision?.id,
  );
  const evidenceReady = Object.values(evidence).every(Boolean);
  return (
    <main
      className="space-y-4"
      data-competitive-pricing-page
      data-competitive-pricing-mode={mode}
      data-competitive-pricing-availability={workspace.availability.status}
    >
      <div data-page-factory-responsive-row className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <BadgeDollarSign className="h-5 w-5" />
            竞品价格情报
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            固化可追溯竞品报价快照与价格带建议；不创建客户正式报价，不改写 CPQ
            或财务价目主数据。
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
          ["价格观察", workspace.metrics.price_watches],
          ["快照核验", `${workspace.metrics.verified_offer_percent}%`],
          ["批准决策", workspace.metrics.approved_decisions],
          ["可用发布", workspace.metrics.available_releases],
          ["价格指数", workspace.metrics.latest_price_index ?? "—"],
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
          <CardTitle className="text-base">1. 价格观察与来源快照</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-4 lg:grid-cols-7">
            <Input
              value={watchDraft.product_reference}
              onChange={(e) =>
                setWatchDraft({
                  ...watchDraft,
                  product_reference: e.target.value,
                })
              }
              placeholder="产品引用"
            />
            <Input
              value={watchDraft.product_name}
              onChange={(e) =>
                setWatchDraft({ ...watchDraft, product_name: e.target.value })
              }
              placeholder="产品名称"
            />
            <Input
              value={watchDraft.market_country}
              onChange={(e) =>
                setWatchDraft({ ...watchDraft, market_country: e.target.value })
              }
              placeholder="国家"
            />
            <Input
              value={watchDraft.channel}
              onChange={(e) =>
                setWatchDraft({ ...watchDraft, channel: e.target.value })
              }
              placeholder="渠道"
            />
            <Input
              value={watchDraft.currency}
              onChange={(e) =>
                setWatchDraft({ ...watchDraft, currency: e.target.value })
              }
              placeholder="币种"
            />
            <Input
              type="number"
              value={watchDraft.own_reference_price}
              onChange={(e) =>
                setWatchDraft({
                  ...watchDraft,
                  own_reference_price: e.target.value,
                })
              }
              placeholder="自身参考价"
            />
            <Button
              data-competitive-watch-create
              disabled={!activePlanId || !!watch}
              onClick={() =>
                void run(
                  () =>
                    createPriceWatch(projectId, {
                      ...watchDraft,
                      own_reference_price: Number(
                        watchDraft.own_reference_price,
                      ),
                    }),
                  "价格观察已建立",
                )
              }
            >
              建立观察
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-5">
            <Input
              value={offerDraft.competitor_name}
              onChange={(e) =>
                setOfferDraft({
                  ...offerDraft,
                  competitor_name: e.target.value,
                })
              }
              placeholder="竞品名称"
            />
            <Input
              value={offerDraft.competitor_offer_reference}
              onChange={(e) =>
                setOfferDraft({
                  ...offerDraft,
                  competitor_offer_reference: e.target.value,
                })
              }
              placeholder="竞品型号/报价号"
            />
            <Input
              type="number"
              value={offerDraft.offer_price}
              onChange={(e) =>
                setOfferDraft({ ...offerDraft, offer_price: e.target.value })
              }
              placeholder="报价金额"
            />
            <Input
              value={offerDraft.source_reference}
              onChange={(e) =>
                setOfferDraft({
                  ...offerDraft,
                  source_reference: e.target.value,
                })
              }
              placeholder="来源引用"
            />
            <Button
              data-competitive-offer-create
              disabled={
                !activePlanId ||
                !watch ||
                !offerDraft.competitor_name ||
                !offerDraft.competitor_offer_reference ||
                !offerDraft.source_reference
              }
              onClick={() =>
                watch &&
                void run(
                  () =>
                    createCompetitiveOffer(projectId, watch.id, {
                      ...offerDraft,
                      offer_type: "list",
                      offer_price: Number(offerDraft.offer_price),
                      freight_price: Number(offerDraft.freight_price),
                      source_system: "governed-connector",
                      source_revision: "2026.08",
                      source_observed_at: new Date().toISOString(),
                    }),
                  "竞品快照已固证",
                )
              }
            >
              记录快照
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              data-competitive-offer-verify
              disabled={!activePlanId || !pending}
              onClick={() =>
                pending &&
                void run(
                  () =>
                    verifyCompetitiveOffer(projectId, pending.id, {
                      expected_revision: pending.revision,
                      verification_reference: `PRICE-QA-${Date.now()}`,
                    }),
                  "快照已独立核验",
                )
              }
            >
              独立核验快照
            </Button>
            <Button
              data-competitive-decision-create
              disabled={
                !activePlanId ||
                !watch ||
                !!decision ||
                offers.filter((x) => x.status === "verified").length < 3
              }
              onClick={() =>
                watch &&
                void run(
                  () =>
                    createPriceDecision(projectId, watch.id, {
                      boundary_note:
                        "价格带仅供市场、销售和产品决策参考；任何正式报价必须在 CPQ 的独立审批流程中完成。",
                    }),
                  "价格带决策已生成",
                )
              }
            >
              生成价格带决策
            </Button>
            <Button
              data-competitive-decision-review
              disabled={!activePlanId || !decision || decision.status !== "pending-review"}
              onClick={() =>
                decision &&
                void run(
                  () =>
                    reviewPriceDecision(projectId, decision.id, {
                      expected_revision: decision.revision,
                      decision: "approve",
                      review_reference: `PRICE-OWNER-${Date.now()}`,
                    }),
                  "价格带决策已独立复核",
                )
              }
            >
              独立复核决策
            </Button>
          </div>
          {offers.map((item) => (
            <div
              key={item.id}
              data-competitive-pricing-record
              data-competitive-pricing-status={item.status}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
            >
              <span>
                <b>{item.competitor_name}</b> ·{" "}
                {item.competitor_offer_reference} · 到岸价 {item.landed_price}
              </span>
              <Badge>{STATUS[item.status] ?? item.status}</Badge>
            </div>
          ))}
          {decision ? (
            <div
              data-competitive-pricing-record
              data-competitive-pricing-status={decision.status}
              className="rounded-md border p-3 text-sm"
            >
              <b>{decision.decision_number}</b> · 价格带{" "}
              {decision.low_landed_price}/{decision.median_landed_price}/
              {decision.high_landed_price} · 指数 {decision.price_index} · 建议{" "}
              {decision.recommendation} ·{" "}
              <Badge>{STATUS[decision.status] ?? decision.status}</Badge>
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
              data-competitive-release-prepare
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
                    preparePriceRelease(projectId, decision.id, {
                      release_version: "2026.08.1",
                      support_owner: "growth-ops",
                      support_until: new Date(
                        Date.now() + 180 * 86400000,
                      ).toISOString(),
                      ...evidence,
                    }),
                  "发布证据已固化",
                )
              }
            >
              准备正式发布
            </Button>
            <Button
              data-competitive-release-approve
              disabled={!activePlanId || !release || release.status !== "pending-approval"}
              onClick={() =>
                release &&
                void run(
                  () =>
                    approvePriceRelease(projectId, release.id, {
                      expected_revision: release.revision,
                      approval_reference: `GA-APPROVAL-${Date.now()}`,
                    }),
                  "竞价情报已批准为正式可用",
                )
              }
            >
              独立批准发布
            </Button>
          </div>
          {release ? (
            <div
              data-competitive-pricing-record
              data-competitive-pricing-status={release.status}
              className="rounded-md border p-3 text-sm"
            >
              <b>
                {release.release_number} · {release.release_version}
              </b>
              <Badge className="ml-2">
                <ShieldCheck className="mr-1 h-3 w-3" />
                {release.available
                  ? "正式可用"
                  : (STATUS[release.status] ?? release.status)}
              </Badge>
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
