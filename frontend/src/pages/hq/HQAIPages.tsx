import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  KeyRound,
  Loader2,
  Plus,
  Save,
  Search,
  Settings2,
  Store,
  TestTube2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_HQ_AI_ASSIGNMENTS,
  HQAIConfig,
  HQAIModelCatalogItem,
  HQAIModelConfig,
  HQ_AI_APPLICATIONS,
  HQ_AI_MODEL_CATALOG,
  catalogItemToModel,
  readHQAIConfig,
  writeHQAIConfig,
} from "@/lib/hq-ai-config";
import { aiProviderApi } from "@/lib/ai-provider-api";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";
import { formatDisplayOrdinal } from "@/lib/display-number-contract";

const CATALOG_SYNC_KEY = "tradepro.hqAiCatalogSyncedIds";
const SCOPE_OPTIONS = ["总部", "代理商", "客户端"] as const;
const cleanModelText = (value?: string | null, fallback = "未命名模型") => sanitizeDisplayText(value, fallback);
const cleanProviderText = (value?: string | null, fallback = "未命名供应商") => sanitizeDisplayText(value, fallback);
const cleanKeyAliasText = (value?: string | null, fallback = "未配置") => sanitizeDisplayText(value, fallback);

function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {sub && <p className="text-sm text-slate-500 mt-1">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function useHQAIConfigState() {
  const [config, setConfigState] = useState<HQAIConfig>(() => readHQAIConfig());

  useEffect(() => {
    const refresh = () => setConfigState(readHQAIConfig());
    window.addEventListener("hq-ai-config-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("hq-ai-config-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const setConfig = (next: HQAIConfig) => {
    setConfigState(next);
    writeHQAIConfig(next);
  };

  return [config, setConfig] as const;
}

function readSyncedCatalogIds() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CATALOG_SYNC_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeSyncedCatalogIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CATALOG_SYNC_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent("hq-ai-catalog-sync-updated", { detail: ids }));
}

function useSyncedCatalogIds() {
  const [ids, setIds] = useState<string[]>(() => readSyncedCatalogIds());

  useEffect(() => {
    const refresh = () => setIds(readSyncedCatalogIds());
    window.addEventListener("hq-ai-catalog-sync-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("hq-ai-catalog-sync-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const updateIds = (next: string[]) => {
    setIds(next);
    writeSyncedCatalogIds(next);
  };

  return [ids, updateIds] as const;
}

function parseScopes(scope: string) {
  if (scope === "不使用应用") return [] as string[];
  return SCOPE_OPTIONS.filter((item) => scope.includes(item));
}

function formatScopes(scopes: string[]) {
  return scopes.length ? scopes.join(" / ") : "不使用应用";
}

function maskKey(value: string) {
  if (!value) return "未配置";
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}****${value.slice(-4)}`;
}

function isGoogleModel(provider: string, modelName: string) {
  return provider.toLowerCase() === "google" && modelName.toLowerCase().startsWith("gemini");
}

function hasPlausibleKeyFormat(provider: string, value: string) {
  const key = value.trim();
  if (!key) return false;
  const normalizedProvider = provider.toLowerCase();
  if (normalizedProvider === "google") return /^AIza[0-9A-Za-z_-]{20,}$/.test(key);
  if (normalizedProvider === "openai") return /^(sk-|sess-)[0-9A-Za-z_-]{12,}/.test(key);
  return key.length >= 12;
}

function newModel(seed?: HQAIModelCatalogItem): HQAIModelConfig {
  return seed
    ? catalogItemToModel(seed)
    : {
        id: `model-${Date.now()}`,
        provider: "Google",
        name: "gemini-2.5-pro",
        type: "文本/多模态",
        status: "active",
        keyAlias: "prod-gemini",
        apiKey: "",
        monthlyCost: 0,
        monthlyQuota: 0,
        calls: 0,
        description: "用于 AI 应用调用的新模型。",
        tags: ["新增模型"],
      };
}

const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  OpenAI: "GPT、推理模型、图像生成与 Codex 开发代理，适合建站生成、代码开发、客服和复杂工具调用。",
  Google: "Gemini 多模态、长上下文和图像能力，适合 AI 建站、图文理解、长资料分析和高频客服。",
  Anthropic: "Claude 系列擅长长文档、代码、合规内容和复杂需求分析，适合高质量文本与深度推理。",
  DeepSeek: "中文、代码和推理性价比较高，适合高频客服、代码辅助和成本敏感型业务。",
  Alibaba: "通义千问覆盖中文、多语言、视觉和长上下文，适合国内企业与外贸资料处理。",
  Moonshot: "Kimi 系列适合中文长文档、资料抽取、知识库问答和复杂分析。",
  xAI: "Grok 系列适合通用对话、推理和实时信息辅助，可作为运营分析和业务助手模型。",
  Meta: "Llama 开源生态适合私有化部署、多语言内容生成和可控模型应用。",
  Mistral: "Mistral 与 Codestral 适合多语言、欧洲合规、代码补全和轻量客服。",
  Cohere: "Command 系列偏向企业检索、RAG、知识库问答和工具调用。",
  Zhipu: "智谱 GLM 适合中文企业应用、低成本高频问答和业务助手。",
  Baidu: "文心系列适合中文企业应用、多模态理解、复杂推理和百度千帆生态接入。",
};

function ModelEditor({
  value,
  catalogOptions,
  existingModels,
  onCancel,
  onSave,
}: {
  value: HQAIModelConfig;
  catalogOptions: HQAIModelCatalogItem[];
  existingModels: HQAIModelConfig[];
  onCancel: () => void;
  onSave: (model: HQAIModelConfig) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [catalogId, setCatalogId] = useState("");
  const [error, setError] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const setField = <K extends keyof HQAIModelConfig>(key: K, next: HQAIModelConfig[K]) => {
    setError("");
    setTestStatus("idle");
    setTestMessage("");
    setDraft((current) => ({ ...current, [key]: next }));
  };

  const applyCatalog = (id: string) => {
    setCatalogId(id);
    const item = catalogOptions.find((model) => model.id === id);
    if (!item) return;
    const picked = catalogItemToModel(item);
    setDraft((current) => ({
      ...current,
      provider: picked.provider,
      name: picked.name,
      type: picked.type,
      keyAlias: picked.keyAlias,
      monthlyCost: picked.monthlyCost,
      description: picked.description,
      tags: picked.tags,
    }));
  };

  const saveDraft = () => {
    if (!draft.apiKey.trim()) {
      setError("请先绑定真实密钥，绑定后模型才会生效并显示在下方模型中心。");
      return;
    }
    const duplicate = existingModels.find((model) => {
      if (model.id === draft.id) return false;
      return model.provider.trim().toLowerCase() === draft.provider.trim().toLowerCase()
        && model.name.trim().toLowerCase() === draft.name.trim().toLowerCase();
    });
    if (duplicate) {
      setError(`模型中心已存在 ${duplicate.provider} / ${duplicate.name}，为避免覆盖原有模型，本次不会重复添加。`);
      return;
    }
    onSave({ ...draft, apiKey: draft.apiKey.trim(), status: "active" });
  };

  const testApiKey = async () => {
    const key = draft.apiKey.trim();
    setError("");
    setTestMessage("");
    if (!key) {
      setTestStatus("error");
      setTestMessage("请先填写真实密钥，再测试接入。");
      return;
    }
    if (!hasPlausibleKeyFormat(draft.provider, key)) {
      setTestStatus("error");
      setTestMessage("密钥格式看起来不正确，请检查供应商和 Key 是否匹配。");
      return;
    }

    if (!isGoogleModel(draft.provider, draft.name)) {
      setTestStatus("success");
      setTestMessage("密钥格式已通过本地检查。该供应商的正式连通测试需要后端代理接口，保存后可由服务端调用验证。");
      return;
    }

    setTestStatus("testing");
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(draft.name)}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "ping" }] }],
            generationConfig: { maxOutputTokens: 8, temperature: 0 },
          }),
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `测试失败 (${response.status})`);
      }
      setTestStatus("success");
      setTestMessage("密钥测试成功，模型已可接入使用。");
    } catch (event) {
      setTestStatus("error");
      setTestMessage(event instanceof Error ? `密钥测试失败：${event.message}` : "密钥测试失败，请检查 Key 或网络。");
    }
  };

  return (
    <Card className="border-cyan-200 bg-cyan-50">
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-3">
            <Label className="text-xs">从模型市场选择</Label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={catalogId} onChange={(event) => applyCatalog(event.target.value)}>
              <option value="">手动接入 / 保持当前</option>
              {catalogOptions.map((model) => (
                <option key={model.id} value={model.id}>
                  {cleanProviderText(model.provider)} / {cleanModelText(model.name)} / {sanitizeDisplayText(model.type, "通用模型")}
                </option>
              ))}
            </select>
            {catalogOptions.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">模型市场还没有同步候选模型，请先到“模型市场”点击“同步到接入选择”。</p>
            )}
          </div>
          <div>
            <Label className="text-xs">供应商</Label>
            <Input value={draft.provider} onChange={(event) => setField("provider", event.target.value)} className="mt-1" placeholder="例如 OpenAI、Google" />
          </div>
          <div>
            <Label className="text-xs">模型名称</Label>
            <Input value={draft.name} onChange={(event) => setField("name", event.target.value)} className="mt-1 font-mono text-xs" placeholder="请输入模型名称" />
          </div>
          <div>
            <Label className="text-xs">模型类型</Label>
            <Input value={draft.type} onChange={(event) => setField("type", event.target.value)} className="mt-1" placeholder="如 对话 / 推理 / 多模态" />
          </div>
          <div>
            <Label className="text-xs">Key 别名</Label>
            <Input value={draft.keyAlias} onChange={(event) => setField("keyAlias", event.target.value)} className="mt-1" placeholder="用于后台识别的密钥别名" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">真实密钥</Label>
            <div className="mt-1 flex gap-2">
              <Input value={draft.apiKey} onChange={(event) => setField("apiKey", event.target.value)} className="font-mono text-xs" placeholder="sk-... / AIza..." />
              <Button type="button" variant="outline" className="shrink-0" onClick={testApiKey} disabled={testStatus === "testing"}>
                {testStatus === "testing" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <TestTube2 className="w-4 h-4 mr-1.5" />}
                测试密钥
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">月成本</Label>
            <Input type="number" value={draft.monthlyCost} onChange={(event) => setField("monthlyCost", Number(event.target.value || 0))} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">月配额</Label>
            <Input type="number" value={draft.monthlyQuota} onChange={(event) => setField("monthlyQuota", Number(event.target.value || 0))} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">调用次数</Label>
            <Input type="number" value={draft.calls} onChange={(event) => setField("calls", Number(event.target.value || 0))} className="mt-1" />
          </div>
        </div>
        <div>
          <Label className="text-xs">AI 应用说明</Label>
          <Textarea value={draft.description} onChange={(event) => setField("description", event.target.value)} className="mt-1 min-h-20" placeholder="说明该模型适合哪些应用场景、成本特点与能力优势" />
        </div>
        <div>
          <Label className="text-xs">标签优势，逗号分隔</Label>
          <Input value={draft.tags.join(",")} onChange={(event) => setField("tags", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} className="mt-1" placeholder="如：低成本,长上下文,适合建站" />
        </div>
        {testMessage && (
          <div className={testStatus === "success" ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700" : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"}>
            {testStatus === "success" && <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />}
            {testMessage}
          </div>
        )}
        {error && <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>取消</Button>
          <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={saveDraft}>
            <Save className="w-4 h-4 mr-2" />保存生效
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function HQAIVendors() {
  const [config, setConfig] = useHQAIConfigState();
  const [syncedCatalogIds] = useSyncedCatalogIds();
  const [editing, setEditing] = useState<HQAIModelConfig | null>(null);
  const totalCost = config.models.reduce((sum, model) => sum + model.monthlyCost, 0);
  const catalogOptions = useMemo(
    () => HQ_AI_MODEL_CATALOG.filter((item) => syncedCatalogIds.includes(item.id)),
    [syncedCatalogIds]
  );

  const saveModel = (model: HQAIModelConfig) => {
    const exists = config.models.some((item) => item.id === model.id);
    setConfig({
      ...config,
      models: exists ? config.models.map((item) => (item.id === model.id ? model : item)) : [model, ...config.models],
    });
    setEditing(null);
  };

  const toggleModel = (model: HQAIModelConfig) => {
    saveModel({ ...model, status: model.status === "active" ? "disabled" : "active" });
  };

  const moveModel = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= config.models.length) return;
    const next = [...config.models];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setConfig({ ...config, models: next });
  };

  const removeModel = (id: string) => {
    setConfig({
      ...config,
      models: config.models.filter((model) => model.id !== id),
      assignments: config.assignments.map((assignment) => ({
        ...assignment,
        primaryModelId: assignment.primaryModelId === id ? "" : assignment.primaryModelId,
        backupModelId: assignment.backupModelId === id ? "" : assignment.backupModelId,
      })),
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI 模型中心"
        sub="总部统一接入模型、密钥、成本、配额、说明和优势标签；客户端 AI 应用会读取这里的配置。"
        action={<Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => setEditing(newModel())}><Plus className="w-4 h-4 mr-2" />接入模型</Button>}
      />

      {editing && <ModelEditor value={editing} catalogOptions={catalogOptions} existingModels={config.models} onCancel={() => setEditing(null)} onSave={saveModel} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-slate-200"><CardContent className="p-3"><div className="text-xs text-slate-500">接入模型</div><div className="mt-1 text-xl font-bold">{config.models.length}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-3"><div className="text-xs text-slate-500">启用模型</div><div className="mt-1 text-xl font-bold text-emerald-600">{config.models.filter((item) => item.status === "active").length}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-3"><div className="text-xs text-slate-500">本月成本</div><div className="mt-1 text-xl font-bold text-rose-600">¥{totalCost.toLocaleString()}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-3"><div className="text-xs text-slate-500">已配置密钥</div><div className="mt-1 text-xl font-bold text-cyan-600">{config.models.filter((item) => item.apiKey).length}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
        {config.models.map((model, index) => (
          <Card key={model.id} className="border-slate-200">
            <CardContent className="p-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="w-8 h-8 rounded-md bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">{cleanProviderText(model.provider).slice(0, 1)}</div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-slate-900 truncate">{cleanProviderText(model.provider)}</div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">{cleanModelText(model.name)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={index === 0} onClick={() => moveModel(index, -1)} title="上移">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={index === config.models.length - 1} onClick={() => moveModel(index, 1)} title="下移">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                  <Switch checked={model.status === "active"} onCheckedChange={() => toggleModel(model)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md bg-slate-50 p-2"><div className="text-[10px] text-slate-500">类型</div><div className="text-xs font-semibold truncate">{sanitizeDisplayText(model.type, "通用模型")}</div></div>
                <div className="rounded-md bg-slate-50 p-2"><div className="text-[10px] text-slate-500">月成本</div><div className="text-xs font-semibold text-rose-600">¥{model.monthlyCost.toLocaleString()}</div></div>
                <div className="rounded-md bg-slate-50 p-2"><div className="text-[10px] text-slate-500">月配额</div><div className="text-xs font-semibold text-cyan-600">{model.monthlyQuota}%</div></div>
              </div>
              <Progress value={model.monthlyQuota} className="h-1.5" />
              <div className="rounded-md border border-slate-200 p-2">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700"><KeyRound className="w-3 h-3" />密钥</div>
                <div className="mt-1 font-mono text-[11px] text-slate-600 truncate">{cleanKeyAliasText(model.keyAlias)} · {maskKey(model.apiKey)}</div>
              </div>
              <p className="text-[11px] text-slate-600 leading-5 line-clamp-2">{sanitizeDisplayText(model.description, "暂无模型说明")}</p>
              <div className="flex flex-wrap gap-1">
                {model.tags.map((tag) => <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{sanitizeDisplayText(tag, "标签")}</Badge>)}
              </div>
              <div className="flex justify-between gap-2 pt-1">
                <Badge className={model.status === "active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>
                  {model.status === "active" ? "启用" : "关闭"}
                </Badge>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditing(model)}>
                    <Settings2 className="w-3.5 h-3.5 mr-1" />设置
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => removeModel(model.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function HQAIModels() {
  const [config, setConfig] = useHQAIConfigState();
  const [adding, setAdding] = useState(false);
  const enabledModels = useMemo(() => config.models.filter((item) => item.status === "active" && item.apiKey.trim()), [config.models]);
  const [draft, setDraft] = useState(() => {
    const app = HQ_AI_APPLICATIONS[0];
    return {
      id: `app-${Date.now()}`,
      app: app.app,
      appKey: app.appKey,
      category: app.category,
      primaryModelId: "",
      backupModelId: "",
      scope: app.scope,
      enabled: true,
    };
  });

  useEffect(() => {
    setDraft((current) => ({
      ...current,
      primaryModelId: current.primaryModelId || enabledModels[0]?.id || "",
      backupModelId: current.backupModelId || enabledModels[1]?.id || enabledModels[0]?.id || "",
    }));
  }, [enabledModels]);

  const updateAssignment = (id: string, patch: Partial<typeof config.assignments[number]>) => {
    setConfig({
      ...config,
      assignments: config.assignments.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  const applyAppOption = (appKey: string, target: "draft" | string) => {
    const app = HQ_AI_APPLICATIONS.find((item) => item.appKey === appKey);
    if (!app) return;
    const patch = { app: app.app, appKey: app.appKey, category: app.category, scope: app.scope };
    if (target === "draft") setDraft((current) => ({ ...current, ...patch }));
    else updateAssignment(target, patch);
  };

  const addAssignment = () => {
    setConfig({ ...config, assignments: [draft, ...config.assignments.filter((item) => item.appKey !== draft.appKey)] });
    setAdding(false);
  };

  const updateDraftScope = (scopeName: string, checked: boolean) => {
    const current = parseScopes(draft.scope);
    const next = checked ? Array.from(new Set([...current, scopeName])) : current.filter((item) => item !== scopeName);
    setDraft({ ...draft, scope: formatScopes(next), enabled: next.length > 0 });
  };

  const updateAssignmentScope = (assignmentId: string, scopeName: string, checked: boolean) => {
    const assignment = config.assignments.find((item) => item.id === assignmentId);
    if (!assignment) return;
    const current = parseScopes(assignment.scope);
    const next = checked ? Array.from(new Set([...current, scopeName])) : current.filter((item) => item !== scopeName);
    updateAssignment(assignmentId, { scope: formatScopes(next), enabled: next.length > 0 });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI 模型分配"
        sub="按功能应用选择主模型和备用模型；客户端对应功能会读取这里，例如 AI 对话建站会读取 appKey=ai-chat 的分配。"
        action={<Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => setAdding(true)}><Plus className="w-4 h-4 mr-2" />新增分配</Button>}
      />

      {adding && (
        <Card className="border-cyan-200 bg-cyan-50">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">客户端功能应用</Label>
                <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.appKey} onChange={(event) => applyAppOption(event.target.value, "draft")}>
                  {HQ_AI_APPLICATIONS.map((app) => <option key={app.appKey} value={app.appKey}>{sanitizeDisplayText(app.app, "功能应用")}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">分类</Label><Input className="mt-1" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="如 建站、客服、SEO" /></div>
              <div>
                <Label className="text-xs">主模型</Label>
                <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.primaryModelId} onChange={(event) => setDraft({ ...draft, primaryModelId: event.target.value })}>
                  <option value="">未选择可用模型</option>
                  {enabledModels.map((model) => <option key={model.id} value={model.id}>{cleanModelText(model.name)}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">备用模型</Label>
                <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.backupModelId} onChange={(event) => setDraft({ ...draft, backupModelId: event.target.value })}>
                  <option value="">未选择备用模型</option>
                  {enabledModels.map((model) => <option key={model.id} value={model.id}>{cleanModelText(model.name)}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">生效范围</Label>
                <div className="mt-2 flex flex-wrap gap-3 rounded-md border border-cyan-100 bg-white/70 p-2 text-xs">
                  {SCOPE_OPTIONS.map((scopeName) => (
                    <label key={scopeName} className="flex items-center gap-1.5">
                      <input type="checkbox" checked={parseScopes(draft.scope).includes(scopeName)} onChange={(event) => updateDraftScope(scopeName, event.target.checked)} />
                      {scopeName}
                    </label>
                  ))}
                  <label className="flex items-center gap-1.5 text-slate-600">
                    <input type="checkbox" checked={!draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: !event.target.checked, scope: event.target.checked ? "不使用应用" : "客户端" })} />
                    不使用应用
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAdding(false)}>取消</Button>
              <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={addAssignment}>保存分配</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200">
        <CardContent className="p-0">
          <div className="responsive-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>{["功能应用", "分类", "主模型", "备用模型", "Key", "生效范围", "操作"].map((item) => <th key={item} className="text-left py-3 px-4 font-medium whitespace-nowrap">{item}</th>)}</tr>
              </thead>
              <tbody>
                {config.assignments.map((assignment) => {
                  const primary = config.models.find((model) => model.id === assignment.primaryModelId);
                  const backup = config.models.find((model) => model.id === assignment.backupModelId);
                  const keyModel = primary || backup;
                  return (
                    <tr key={assignment.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium">{sanitizeDisplayText(assignment.app, "未命名应用")}</td>
                      <td className="py-3 px-4"><Badge variant="outline" className="text-xs">{sanitizeDisplayText(assignment.category, "未分类")}</Badge></td>
                      <td className="py-3 px-4">
                        <select className="h-8 min-w-40 rounded-md border border-input bg-background px-2 text-xs" value={assignment.primaryModelId} onChange={(event) => updateAssignment(assignment.id, { primaryModelId: event.target.value })}>
                          <option value="">未选择可用模型</option>
                          {enabledModels.map((model) => <option key={model.id} value={model.id}>{cleanModelText(model.name)}</option>)}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <select className="h-8 min-w-40 rounded-md border border-input bg-background px-2 text-xs" value={assignment.backupModelId} onChange={(event) => updateAssignment(assignment.id, { backupModelId: event.target.value })}>
                          <option value="">未选择备用模型</option>
                          {enabledModels.map((model) => <option key={model.id} value={model.id}>{cleanModelText(model.name)}</option>)}
                        </select>
                      </td>
                      <td className="py-3 px-4"><Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">{cleanKeyAliasText(keyModel?.keyAlias, "-")}</Badge></td>
                      <td className="py-3 px-4">
                        <div className="flex min-w-64 flex-wrap gap-2 text-xs">
                          {SCOPE_OPTIONS.map((scopeName) => (
                            <label key={scopeName} className="flex items-center gap-1.5">
                              <input type="checkbox" checked={assignment.enabled && parseScopes(assignment.scope).includes(scopeName)} onChange={(event) => updateAssignmentScope(assignment.id, scopeName, event.target.checked)} />
                              {scopeName}
                            </label>
                          ))}
                          <label className="flex items-center gap-1.5 text-slate-600">
                            <input type="checkbox" checked={!assignment.enabled} onChange={(event) => updateAssignment(assignment.id, { enabled: !event.target.checked, scope: event.target.checked ? "不使用应用" : "客户端" })} />
                            不使用应用
                          </label>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setConfig({ ...config, assignments: config.assignments.filter((item) => item.id !== assignment.id) })}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" onClick={() => setConfig({ ...config, assignments: DEFAULT_HQ_AI_ASSIGNMENTS.map((item) => ({ ...item })) })}>
        恢复默认分配
      </Button>
    </div>
  );
}

export function HQAIModelSquare() {
  const [config, setConfig] = useHQAIConfigState();
  const [syncedCatalogIds, setSyncedCatalogIds] = useSyncedCatalogIds();
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("全部");
  const providers = useMemo(() => ["全部", ...Array.from(new Set(HQ_AI_MODEL_CATALOG.map((item) => item.provider)))], []);
  const filtered = HQ_AI_MODEL_CATALOG.filter((item) => {
    const haystack = `${item.provider} ${item.name} ${item.type} ${item.strengths.join(" ")} ${item.description}`.toLowerCase();
    return (provider === "全部" || item.provider === provider) && haystack.includes(query.toLowerCase());
  });
  const providerGroups = useMemo(() => {
    const grouped = new Map<string, HQAIModelCatalogItem[]>();
    filtered.forEach((item) => {
      grouped.set(item.provider, [...(grouped.get(item.provider) || []), item]);
    });
    return Array.from(grouped.entries()).map(([name, models]) => ({ name, models }));
  }, [filtered]);

  const toggleCatalogSync = (item: HQAIModelCatalogItem) => {
    const exists = syncedCatalogIds.includes(item.id);
    setSyncedCatalogIds(exists ? syncedCatalogIds.filter((id) => id !== item.id) : [item.id, ...syncedCatalogIds]);
  };

  return (
    <FactoryPage pageId="hq-ai-model-square" template="dashboard" sourceScope="hq" autoRegions>
      <div className="space-y-5">
      <PageHeader
        title="AI 模型市场"
        sub="参考主流模型价格表结构，按供应商分组展示模型；同步后只进入模型中心“接入模型”的选择栏，绑定密钥后才会正式生效。"
      />
      <Card className="border-slate-200">
        <CardContent className="p-3 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
            <Search className="w-4 h-4 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索模型、供应商、标签..." className="h-7 border-0 p-0 shadow-none focus-visible:ring-0" />
          </div>
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={provider} onChange={(event) => setProvider(event.target.value)}>
            {providers.map((item) => <option key={item} value={item}>{item === "全部" ? "全部" : cleanProviderText(item)}</option>)}
          </select>
        </CardContent>
      </Card>

      {providerGroups.length === 0 ? (
        <Card className="border-dashed border-slate-300">
          <CardContent className="p-8 text-center text-sm text-slate-500">没有匹配的模型，请换个关键词或供应商。</CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {providerGroups.map((group) => (
            <section key={group.name} className="space-y-3">
              <div className="flex flex-col gap-1 border-b border-slate-200 pb-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-xs font-semibold text-white">
                      {cleanProviderText(group.name).slice(0, 1)}
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">{cleanProviderText(group.name)}</h2>
                    <Badge variant="outline" className="text-[10px]">{group.models.length} 个模型</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{sanitizeDisplayText(PROVIDER_DESCRIPTIONS[group.name], "集中管理该供应商模型，可同步到总部模型中心并分配给客户端功能使用。")}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {group.models.map((item) => {
                  const synced = syncedCatalogIds.includes(item.id);
                  const enabledInCenter = config.models.some((model) => model.provider === item.provider && model.name === item.name);
                  return (
                    <Card key={item.id} className="border-slate-200">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Store className="w-4 h-4 text-cyan-600" />
                              <span className="text-sm font-semibold">{cleanProviderText(item.provider)}</span>
                            </div>
                            <div className="mt-1 font-mono text-xs text-slate-600 truncate">{cleanModelText(item.name)}</div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{sanitizeDisplayText(item.type, "通用模型")}</Badge>
                        </div>
                        <p className="text-xs text-slate-600 leading-5 line-clamp-2">{sanitizeDisplayText(item.description, "暂无模型说明")}</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-md bg-slate-50 p-2"><div className="text-[10px] text-slate-500">上下文</div><div className="font-semibold truncate">{sanitizeDisplayText(item.context, "未说明")}</div></div>
                          <div className="rounded-md bg-slate-50 p-2"><div className="text-[10px] text-slate-500">输入</div><div className="font-semibold truncate">{sanitizeDisplayText(item.inputPrice, "未说明")}</div></div>
                          <div className="rounded-md bg-slate-50 p-2"><div className="text-[10px] text-slate-500">输出</div><div className="font-semibold truncate">{sanitizeDisplayText(item.outputPrice, "未说明")}</div></div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {item.strengths.map((tag) => <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{sanitizeDisplayText(tag, "标签")}</Badge>)}
                        </div>
                        <div className="flex items-center justify-between gap-3 pt-1">
                          <div className="min-w-0">
                            <span className="block text-xs text-slate-500">预估月成本 ¥{item.estimatedMonthlyCost.toLocaleString()}</span>
                            {enabledInCenter && <span className="text-[10px] text-emerald-600">已在模型中心生效</span>}
                          </div>
                          <Button
                            size="sm"
                            variant={synced ? "outline" : "default"}
                            className={synced ? "h-8 shrink-0" : "h-8 shrink-0 bg-cyan-600 hover:bg-cyan-700"}
                            onClick={() => toggleCatalogSync(item)}
                          >
                            {synced ? "收回同步" : "同步到接入选择"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      </div>
    </FactoryPage>
  );
}

export function HQAILogs() {
  const [config] = useHQAIConfigState();
  const rows = config.assignments.flatMap((assignment, index) => {
    const model = config.models.find((item) => item.id === assignment.primaryModelId);
    return model ? [{ assignment, model, index }] : [];
  });

  return (
    <FactoryPage pageId="hq-ai-logs" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader title="AI 调用日志" sub="按客户端、项目、功能应用、模型和 Key 记录全平台 AI 调用明细。" />
      <Card className="border-slate-200">
        <CardContent className="p-0">
          <div className="responsive-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>{["时间", "客户端 / 项目", "功能应用", "模型", "Key", "调用量", "成本", "状态"].map((item) => <th key={item} className="text-left py-3 px-4 font-medium whitespace-nowrap">{item}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(({ assignment, model, index }) => (
                  <tr key={assignment.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-xs">10:{String(32 - index).padStart(2, "0")}:18</td>
                    <td className="py-3 px-4"><div className="text-xs font-medium">默认客户端</div><div className="text-[10px] text-slate-500">项目 {formatDisplayOrdinal(index + 1)}</div></td>
                    <td className="py-3 px-4">{sanitizeDisplayText(assignment.app, "未命名应用")}</td>
                    <td className="py-3 px-4 font-mono text-xs">{cleanModelText(model.name)}</td>
                    <td className="py-3 px-4"><Badge variant="outline" className="text-[10px]">{cleanKeyAliasText(model.keyAlias)}</Badge></td>
                    <td className="py-3 px-4">{model.calls.toLocaleString()}</td>
                    <td className="py-3 px-4 font-semibold text-rose-600">¥{Math.round(model.monthlyCost / 30).toLocaleString()}</td>
                    <td className="py-3 px-4"><Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">正常</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </div>
    </FactoryPage>
  );
}

export function HQAICost() {
  const [config] = useHQAIConfigState();
  const maxCost = Math.max(...config.models.map((model) => model.monthlyCost), 1);
  const total = config.models.reduce((sum, model) => sum + model.monthlyCost, 0);

  return (
    <FactoryPage pageId="hq-ai-cost" template="dashboard" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader title="AI 成本看板" sub="按供应商、模型、客户端项目和功能应用统计成本、配额和毛利。" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">本月成本</div><div className="mt-1 text-2xl font-bold text-rose-600">¥{total.toLocaleString()}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">启用模型</div><div className="mt-1 text-2xl font-bold text-emerald-600">{config.models.filter((item) => item.status === "active").length}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">应用分配</div><div className="mt-1 text-2xl font-bold text-cyan-600">{config.assignments.length}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">已配置 Key</div><div className="mt-1 text-2xl font-bold">{config.models.filter((item) => item.apiKey).length}</div></CardContent></Card>
      </div>
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4">模型成本 TOP</h3>
          <div className="space-y-3">
            {config.models.slice().sort((a, b) => b.monthlyCost - a.monthlyCost).map((model, index) => (
              <div key={model.id} className="flex items-center gap-3">
                <div className="w-6 text-xs text-slate-400 text-center">{formatDisplayOrdinal(index + 1)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium font-mono">{cleanModelText(model.name)}</span>
                    <span className="text-sm font-bold text-rose-600">¥{model.monthlyCost.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-rose-400 to-rose-500" style={{ width: `${(model.monthlyCost / maxCost) * 100}%` }} />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{cleanProviderText(model.provider)} · {model.calls.toLocaleString()} 次调用</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>
    </FactoryPage>
  );
}
