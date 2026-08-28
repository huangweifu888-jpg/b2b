import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { socialAuthorizationApi, type SocialOAuthApplicationRecord } from "@/lib/social-authorization-api";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";

const INITIAL_PROVIDERS = ["facebook", "instagram", "linkedin", "youtube", "tiktok", "x / twitter", "whatsapp", "微信公众号", "微信视频号", "微博", "抖音", "快手", "小红书", "哔哩哔哩", "知乎"];

const STATUS_LABEL: Record<SocialOAuthApplicationRecord["status"], string> = {
  draft: "草稿",
  review: "待审核",
  active: "已启用",
  suspended: "已停用",
};

export default function HQSocialAuthorization() {
  const [items, setItems] = useState<SocialOAuthApplicationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("未读取到总部端配置；登录总部管理员并完成数据库迁移后可保存正式配置。");
  const [provider, setProvider] = useState(INITIAL_PROVIDERS[0]);
  const [status, setStatus] = useState<SocialOAuthApplicationRecord["status"]>("draft");
  const [clientReference, setClientReference] = useState("");
  const [secretReference, setSecretReference] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [scopes, setScopes] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response = await socialAuthorizationApi.listApplications();
      setItems(response.items);
      setNotice(response.items.length ? "已读取总部端平台应用状态。" : "尚未配置平台应用；先创建草稿并提交各平台审核。");
    } catch {
      setNotice("无法读取总部端配置：请确认总部管理员登录、后端服务和数据库迁移均已就绪。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    const normalizedProvider = provider.trim();
    if (!normalizedProvider) return;
    setLoading(true);
    try {
      const saved = await socialAuthorizationApi.saveApplication(normalizedProvider, {
        status,
        client_id_reference: clientReference.trim() || undefined,
        secret_reference: secretReference.trim() || undefined,
        redirect_uri: redirectUri.trim() || undefined,
        approved_scopes: scopes.split(/[\s,，]+/).map((item) => item.trim()).filter(Boolean),
      });
      setItems((current) => [saved, ...current.filter((item) => item.provider !== saved.provider)]);
      setNotice(`${saved.provider} 已保存为${STATUS_LABEL[saved.status]}。页面仅保存密钥引用，不保存密钥内容。`);
      setClientReference("");
      setSecretReference("");
      setRedirectUri("");
      setScopes("");
    } catch {
      setNotice("保存失败：当前操作需要总部管理员会话，以及已完成的数据库迁移。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FactoryPage pageId="hq-social-authorization" template="form" sourceScope="hq" autoRegions>
      <div className="space-y-4 p-6" data-social-oauth-headquarters>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">社交平台授权中心</h1>
          <p className="mt-1 text-sm text-slate-600">总部端统一维护平台应用；代理端继承可用渠道，客户计划仅创建和查看自己的授权申请。</p>
        </div>
        <Button variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />刷新状态</Button>
      </div>

      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="flex gap-3 p-4 text-sm leading-6 text-amber-950"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />密钥、Token、Cookie 和账号密码不进入此页面或客户端。这里只保留密钥库引用、回调地址、审核范围与启用状态；官方 OAuth 回调由后端连接器验证后处理。</CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">配置总部端平台应用</CardTitle></CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          <Select value={provider} onValueChange={setProvider}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{INITIAL_PROVIDERS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
          <Select value={status} onValueChange={(value) => setStatus(value as SocialOAuthApplicationRecord["status"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">草稿</SelectItem><SelectItem value="review">待审核</SelectItem><SelectItem value="active">已启用</SelectItem><SelectItem value="suspended">已停用</SelectItem></SelectContent></Select>
          <Input value={clientReference} onChange={(event) => setClientReference(event.target.value)} placeholder="App ID 的密钥库引用（不是 App ID 内容）" />
          <Input value={secretReference} onChange={(event) => setSecretReference(event.target.value)} placeholder="Client Secret 的密钥库引用，例如 vault://..." />
          <Input className="lg:col-span-2" value={redirectUri} onChange={(event) => setRedirectUri(event.target.value)} placeholder="官方 OAuth 回调地址（HTTPS，上线域名）" />
          <Input className="lg:col-span-2" value={scopes} onChange={(event) => setScopes(event.target.value)} placeholder="获批权限，使用逗号分隔，例如 pages_manage_posts, instagram_basic" />
          <div className="flex flex-wrap items-center justify-between gap-2 lg:col-span-2"><span className="text-xs text-slate-500">只有填写密钥引用与回调地址后，才能把应用设为“已启用”。</span><Button disabled={loading || !provider.trim()} onClick={() => void save()}>保存平台应用</Button></div>
        </CardContent>
      </Card>

      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{notice}</div>

      <Card>
        <CardHeader><CardTitle className="text-base">平台应用状态</CardTitle></CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-2">{items.length ? items.map((item) => <div key={item.provider} className="rounded-lg border border-slate-200 p-4"><div className="flex items-center justify-between gap-2"><b className="text-slate-900">{item.provider}</b><Badge variant="outline" className={item.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>{item.status === "active" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}{STATUS_LABEL[item.status]}</Badge></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600"><span>回调地址：{item.redirect_configured ? "已配置" : "未配置"}</span><span>密钥引用：{item.secret_configured ? "已配置" : "未配置"}</span></div><p className="mt-2 text-xs text-slate-500">权限：{item.approved_scopes.length ? item.approved_scopes.join("、") : "尚未登记"}</p></div>) : <div className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-500">尚无正式平台应用记录。</div>}</CardContent>
      </Card>
      </div>
    </FactoryPage>
  );
}
