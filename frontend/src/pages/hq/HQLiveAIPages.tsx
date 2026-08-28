import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { platformApi, type AIProvider, type PlatformNode, type PlatformOverview } from "@/lib/platform-api";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";
import { toast } from "@/hooks/use-toast";
import { FactoryPage } from "@/page-factory/FactoryPage";

function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {sub ? <p className="mt-1 text-sm text-slate-500">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

function StatsRow({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="text-2xl font-bold text-slate-900">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LiveState({
  error,
  loading,
  loadingText,
  children,
}: {
  error: string;
  loading: boolean;
  loadingText: string;
  children: ReactNode;
}) {
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-5 text-sm text-slate-500">{loadingText}</CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}

function flattenPlatformTree(nodes: PlatformNode[]) {
  const items: PlatformNode[] = [];
  const walk = (node: PlatformNode) => {
    items.push(node);
    node.children.forEach(walk);
  };
  nodes.forEach(walk);
  return items;
}

function formatProviderKind(providerKey: string) {
  const value = providerKey.toLowerCase();
  if (value.includes("codex")) return "开发代理";
  if (value.includes("openai")) return "通用文本";
  if (value.includes("google")) return "多模态";
  return "平台接入";
}

function formatSettings(settings?: Record<string, unknown>) {
  if (!settings) return "未附加设置";
  const provider = typeof settings.provider === "string" ? settings.provider : "";
  const managedBy = typeof settings.managedBy === "string" ? settings.managedBy : "";
  const switchable = settings.switchable === true ? "可切换" : "固定";
  return [provider, managedBy, switchable].filter(Boolean).join(" / ") || "未附加设置";
}

function usePlatformAIProviders() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [tree, setTree] = useState<PlatformNode[]>([]);
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [switchingId, setSwitchingId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const [providersResponse, treeResponse, overviewResponse] = await Promise.all([
          platformApi.aiProviders(),
          platformApi.tree(),
          platformApi.overview(),
        ]);
        if (!mounted) return;
        setProviders(providersResponse.items || []);
        setTree(treeResponse.items || []);
        setOverview(overviewResponse);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "加载 AI 供应商数据失败");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const setDefaultProvider = async (providerId: number) => {
    try {
      setSwitchingId(providerId);
      await platformApi.setDefaultAIProvider(providerId);
      setProviders((current) =>
        current.map((provider) => ({
          ...provider,
          is_default: provider.id === providerId,
        }))
      );
      toast({
        title: "默认供应商已更新",
        description: `已将供应商 #${providerId} 设为总部默认 AI 供应商。`,
      });
    } catch (err) {
      toast({
        title: "默认供应商切换失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setSwitchingId(null);
    }
  };

  return { providers, tree, overview, loading, error, switchingId, setDefaultProvider };
}

export function HQAIVendorsLive() {
  const location = useLocation();
  const { providers, tree, overview, loading, error, switchingId, setDefaultProvider } = usePlatformAIProviders();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const nodeMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);

  const cards = useMemo(
    () =>
      providers.map((provider) => {
        const org = provider.org_id ? nodeMap.get(provider.org_id) || null : null;
        return {
          provider,
          org,
        };
      }),
    [nodeMap, providers]
  );

  const stats = useMemo(
    () => [
      { label: "供应商数量", value: overview?.counts.aiProviders ?? providers.length },
      { label: "启用供应商", value: providers.filter((item) => item.is_active).length },
      { label: "默认供应商", value: providers.filter((item) => item.is_default).length },
      { label: "总部归属", value: providers.filter((item) => item.org_id === 1).length },
    ],
    [overview, providers]
  );

  return (
    <FactoryPage
      pageId={location.pathname.endsWith("/ai-keys") ? "hq-ai-keys-live" : "hq-ai-vendors-live"}
      template="dashboard"
      sourceScope="hq"
      autoRegions
    >
      <div className="space-y-6">
      <PageHeader
        title="AI 供应商中心"
        sub="总部统一查看真实 AI 供应商配置，直接读取平台供应商表和总部组织归属。"
        action={<Button className="bg-cyan-600 hover:bg-cyan-700">新增供应商</Button>}
      />
      <StatsRow items={stats} />
      <Card className="border-slate-200">
        <CardContent className="space-y-4 p-5">
          <div>
            <div className="font-semibold text-slate-900">AI 供应商配置</div>
            <p className="mt-1 text-sm text-slate-500">集中管理供应商、默认模型、组织归属与密钥环境变量。</p>
          </div>
          <LiveState error={error ? `AI 供应商加载失败：${error}` : ""} loading={loading} loadingText="正在加载总部 AI 供应商数据...">
        {cards.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ provider, org }) => (
            <Card key={provider.id} className="border-slate-200">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">{sanitizeDisplayText(provider.name, provider.provider_key)}</div>
                    <div className="mt-1 font-mono text-[11px] text-slate-500">{provider.provider_key}</div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {provider.is_default ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">默认</Badge> : null}
                    <Badge className={provider.is_active ? "bg-cyan-100 text-cyan-700 hover:bg-cyan-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>
                      {provider.is_active ? "启用" : "停用"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">供应商类型</div>
                    <div className="mt-1 font-semibold text-slate-900">{formatProviderKind(provider.provider_key)}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">默认模型</div>
                    <div className="mt-1 font-mono text-xs text-slate-900">{sanitizeDisplayText(provider.default_model, "-")}</div>
                  </div>
                </div>

                  <div className="space-y-2 text-sm">
                  <div>
                    <div className="text-xs text-slate-500">归属组织</div>
                    <div className="mt-1 text-slate-900">{org ? sanitizeDisplayText(org.name, org.code) : "平台级配置"}</div>
                    <div className="font-mono text-[11px] text-slate-500">{org?.code || "GLOBAL"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">接口地址</div>
                    <div className="mt-1 break-all text-slate-900">{sanitizeDisplayText(provider.base_url, "未配置")}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">密钥环境变量</div>
                    <div className="mt-1 font-mono text-xs text-slate-900">{sanitizeDisplayText(provider.api_key_env, "未配置")}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">附加设置</div>
                    <div className="mt-1 text-slate-900">{formatSettings(provider.settings)}</div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    variant={provider.is_default ? "outline" : "default"}
                    className={provider.is_default ? "h-8" : "h-8 bg-cyan-600 hover:bg-cyan-700"}
                    disabled={provider.is_default || switchingId === provider.id}
                    onClick={() => void setDefaultProvider(provider.id)}
                  >
                    {provider.is_default ? "当前默认" : switchingId === provider.id ? "切换中..." : "设为默认"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            暂无 AI 供应商配置，请点击“新增供应商”建立第一条配置。
          </div>
        )}
          </LiveState>
        </CardContent>
      </Card>
      </div>
    </FactoryPage>
  );
}
