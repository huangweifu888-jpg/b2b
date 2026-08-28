import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, LockKeyhole, RefreshCw, RadioTower } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { freezeFactoryContracts, listFactoryContracts, type FactoryContractRegistry } from "@/lib/factory-contract-api";

const CATEGORY_LABELS: Record<string, string> = {
  identity: "蓄势", content: "布场", trust: "营搜", recommend: "占新", deepen: "圈养", portrait: "锁客",
  lead: "精投", convert: "承转", fulfillment: "强链", care: "深养", decision: "驭数", operations: "固本",
};

export function FactoryObjectEventContractDesk() {
  const [registry, setRegistry] = useState<FactoryContractRegistry | null>(null);
  const [mode, setMode] = useState<"loading" | "live" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [freezing, setFreezing] = useState(false);

  const load = useCallback(async () => {
    setMode("loading");
    setError(null);
    try {
      setRegistry(await listFactoryContracts());
      setMode("live");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "契约注册表连接失败");
      setMode("error");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const allFrozen = useMemo(() => Boolean(registry && registry.summary.frozen_object_count === 21 && registry.summary.frozen_event_count === 12), [registry]);

  const freeze = async () => {
    setFreezing(true);
    try {
      const next = await freezeFactoryContracts();
      setRegistry(next);
      setMode("live");
      toast.success("核心对象与事件契约已冻结并写入审计");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "契约冻结失败");
      await load();
    } finally {
      setFreezing(false);
    }
  };

  return (
    <section className="mt-5" data-factory-platform-contract-registry data-contract-registry-mode={mode}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          对象与事件契约注册表
          <Badge variant={mode === "live" ? "default" : "outline"}>{mode === "live" ? "数据库实时" : mode === "loading" ? "连接中" : "连接失败"}</Badge>
          <Badge variant={allFrozen ? "default" : "outline"}>{allFrozen ? "V1 已冻结" : "V1 待冻结"}</Badge>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={mode === "loading"}><RefreshCw className="mr-1 h-3.5 w-3.5" />刷新</Button>
          <Button data-contract-freeze type="button" size="sm" onClick={() => void freeze()} disabled={mode !== "live" || freezing || allFrozen}><LockKeyhole className="mr-1 h-3.5 w-3.5" />{freezing ? "冻结中" : allFrozen ? "已冻结" : "冻结 21+12"}</Button>
        </div>
      </div>
      <p className="mb-3 text-xs opacity-75">总部唯一维护；冻结前校验租户标识、稳定对象ID、事件信封、事实源、生产者、消费者及向后兼容策略。冻结动作不可静默覆盖，后续结构变更必须提升 schemaVersion。</p>
      {error ? <p data-contract-registry-error className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">{error}</p> : null}
      {registry ? (
        <div className="grid gap-3 xl:grid-cols-2">
          <Card className="border-current/20 bg-transparent shadow-none">
            <CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><Database className="h-4 w-4" />21 个核心对象</span><Badge variant="outline">已冻结 {registry.summary.frozen_object_count}/{registry.summary.object_count}</Badge></CardTitle></CardHeader>
            <CardContent className="max-h-[520px] space-y-2 overflow-auto">
              {registry.objects.map((item) => <div key={item.id} data-core-object-contract={item.id} data-contract-status={item.lifecycle_status} className="rounded-md border border-current/15 p-2 text-xs">
                <div className="flex items-center justify-between gap-2"><b>{item.sequence}. {item.label}</b><span><Badge variant={item.lifecycle_status === "frozen" ? "default" : "outline"}>{item.lifecycle_status === "frozen" ? "已冻结" : "草稿"}</Badge> <span className="opacity-60">v{item.schema_version} · r{item.revision}</span></span></div>
                <p className="mt-1"><span className="opacity-60">事实源：</span>{CATEGORY_LABELS[item.system_of_record] || item.system_of_record}</p>
                <p><span className="opacity-60">身份规则：</span>{item.identity_rule}</p>
                <p className="break-all"><span className="opacity-60">最小字段：</span>{item.minimum_fields.join(" · ")}</p>
              </div>)}
            </CardContent>
          </Card>
          <Card className="border-current/20 bg-transparent shadow-none">
            <CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><RadioTower className="h-4 w-4" />12 个关键事件</span><Badge variant="outline">已冻结 {registry.summary.frozen_event_count}/{registry.summary.event_count}</Badge></CardTitle></CardHeader>
            <CardContent className="max-h-[520px] space-y-2 overflow-auto">
              {registry.events.map((item) => <div key={item.id} data-core-event-contract={item.id} data-contract-status={item.lifecycle_status} className="rounded-md border border-current/15 p-2 text-xs">
                <div className="flex items-center justify-between gap-2"><b>{item.sequence}. {item.label}</b><span><Badge variant={item.lifecycle_status === "frozen" ? "default" : "outline"}>{item.lifecycle_status === "frozen" ? "已冻结" : "草稿"}</Badge> <span className="opacity-60">v{item.schema_version} · r{item.revision}</span></span></div>
                <p className="mt-1"><span className="opacity-60">主题：</span>{item.subject_id}{" "}<span className="opacity-60">生产者：</span>{CATEGORY_LABELS[item.producer] || item.producer}</p>
                <p><span className="opacity-60">消费者：</span>{item.consumers.map((key) => CATEGORY_LABELS[key] || key).join(" · ")}</p>
                <p><span className="opacity-60">信封：</span>{item.required_fields.length} 个必填字段{" "}<span className="opacity-60">兼容：</span>{item.compatibility}</p>
              </div>)}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
