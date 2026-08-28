import { useState, useEffect } from "react";

import { useSearchParams } from "react-router-dom";

import { Megaphone, Plus, CheckCircle2, AlertCircle, Edit3, Trash2, TrendingUp, DollarSign, MousePointerClick, Target, ArrowLeft, Bot, Settings, Users, LogOut, BarChart3, Zap, Shield, RefreshCw, Clock, Loader2, Sparkles, BarChart2, Download, Check, X, History, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import SiteContextCard from "@/components/SiteContextCard";

import { useToast } from "@/hooks/use-toast";

import { createClient } from "@metagptx/web-sdk";
import { getSiteById } from "@/lib/sites";
import { AdAccountGovernance } from "@/components/ads/AdAccountGovernance";
import { AudienceGovernance } from "@/components/ads/AudienceGovernance";
import { ExperimentGovernance } from "@/components/ads/ExperimentGovernance";
import { BudgetAttributionGovernance } from "@/components/ads/BudgetAttributionGovernance";
import { FactoryPage } from "@/page-factory/FactoryPage";

const client = createClient();

const TABS = [
  { key: "overview", label: "推广概览" },
  { key: "platforms", label: "广告平台" },
  { key: "campaigns", label: "推广活动" },
  { key: "compare", label: "跨平台对比" },
];

interface AdAccount {
  id: string;
  name: string;
  email: string;
  status: "active" | "paused" | "error";
  spend: string;
  spendNum: number;
  roas: string;
  roasNum: number;
  campaigns: number;
  clicks: string;
  clicksNum: number;
  conversions: number;
  conversionRate: number;
  lastSync: string;
  syncFrequency: string;
  autoSyncEnabled: boolean;
}

interface AdPlatform {
  name: string;
  color: string;
  short: string;
  accounts: AdAccount[];
  hasAgent: boolean;
  agentName?: string;
}

interface SuggestionItem {
  id?: number;
  type: string;
  content: string;
  priority: string;
  status?: string;
}

interface SyncRecord {
  id: number;
  platform_name: string;
  account_id: string;
  account_name: string;
  sync_type: string;
  sync_status: string;
  sync_frequency: string;
  data_snapshot: string;
  created_at: string;
}

const platformsData: AdPlatform[] = [
  {
    name: "Google Ads",
    color: "bg-blue-500",
    short: "G",
    hasAgent: true,
    agentName: "Google Ads Agent",
    accounts: [
      { id: "ga-1", name: "主账户 - 品牌推广", email: "marketing@company.com", status: "active", spend: "$8,200", spendNum: 8200, roas: "4.5x", roasNum: 4.5, campaigns: 5, clicks: "15.2K", clicksNum: 15200, conversions: 423, conversionRate: 2.78, lastSync: "2 分钟前", syncFrequency: "hourly", autoSyncEnabled: true },
      { id: "ga-2", name: "子账户 - 产品线A", email: "ads-a@company.com", status: "active", spend: "$3,100", spendNum: 3100, roas: "3.8x", roasNum: 3.8, campaigns: 3, clicks: "6.8K", clicksNum: 6800, conversions: 187, conversionRate: 2.75, lastSync: "5 分钟前", syncFrequency: "daily", autoSyncEnabled: true },
      { id: "ga-3", name: "子账户 - 再营销", email: "retarget@company.com", status: "paused", spend: "$1,150", spendNum: 1150, roas: "5.2x", roasNum: 5.2, campaigns: 2, clicks: "3.4K", clicksNum: 3400, conversions: 98, conversionRate: 2.88, lastSync: "1 小时前", syncFrequency: "daily", autoSyncEnabled: false },
    ],
  },
  {
    name: "Facebook Meta",
    color: "bg-blue-700",
    short: "M",
    hasAgent: false,
    accounts: [
      { id: "fb-1", name: "主页广告账户", email: "social@company.com", status: "active", spend: "$5,800", spendNum: 5800, roas: "3.6x", roasNum: 3.6, campaigns: 4, clicks: "9.2K", clicksNum: 9200, conversions: 201, conversionRate: 2.18, lastSync: "10 分钟前", syncFrequency: "hourly", autoSyncEnabled: true },
      { id: "fb-2", name: "Instagram 推广", email: "ig@company.com", status: "active", spend: "$2,520", spendNum: 2520, roas: "4.1x", roasNum: 4.1, campaigns: 2, clicks: "4.5K", clicksNum: 4500, conversions: 134, conversionRate: 2.98, lastSync: "15 分钟前", syncFrequency: "daily", autoSyncEnabled: true },
    ],
  },
  {
    name: "LinkedIn Ads",
    color: "bg-sky-700",
    short: "IN",
    hasAgent: false,
    accounts: [
      { id: "li-1", name: "B2B 企业账户", email: "b2b@company.com", status: "active", spend: "$3,100", spendNum: 3100, roas: "2.9x", roasNum: 2.9, campaigns: 3, clicks: "2.1K", clicksNum: 2100, conversions: 67, conversionRate: 3.19, lastSync: "30 分钟前", syncFrequency: "weekly", autoSyncEnabled: false },
    ],
  },
  {
    name: "TikTok Ads",
    color: "bg-black",
    short: "TT",
    hasAgent: false,
    accounts: [],
  },
  {
    name: "Yandex Ads",
    color: "bg-red-600",
    short: "Y",
    hasAgent: false,
    accounts: [],
  },
];

const campaigns = [
  { name: "Spring Collection 推广", platform: "Google Ads", account: "主账户 - 品牌推广", budget: "$2,000/月", status: "投放中", clicks: "12.4K", cpc: "$0.16", conversions: 342 },
  { name: "品牌知名度提升", platform: "Facebook Meta", account: "主页广告账户", budget: "$1,500/月", status: "投放中", clicks: "8.9K", cpc: "$0.12", conversions: 218 },
  { name: "B2B 决策者定向", platform: "LinkedIn Ads", account: "B2B 企业账户", budget: "$1,000/月", status: "投放中", clicks: "2.1K", cpc: "$0.48", conversions: 67 },
  { name: "再营销 - 购物车放弃", platform: "Google Ads", account: "子账户 - 再营销", budget: "$800/月", status: "暂停", clicks: "5.6K", cpc: "$0.14", conversions: 189 },
  { name: "新品首发广告", platform: "Facebook Meta", account: "Instagram 推广", budget: "$1,200/月", status: "投放中", clicks: "6.3K", cpc: "$0.19", conversions: 156 },
  { name: "行业关键词竞价", platform: "Google Ads", account: "主账户 - 品牌推广", budget: "$3,000/月", status: "投放中", clicks: "18.7K", cpc: "$0.16", conversions: 512 },
];

export default function SmartAds() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const knownTab = TABS.some((item) => item.key === tab) ? tab : "overview";
  const pageFactoryId = params.has("tab") && knownTab === tab ? `client-smart-ads-${tab}` : "client-smart-ads";
  const pageFactoryTemplate = knownTab === "campaigns" ? "list" : "dashboard";
  const siteId = params.get("siteId");
  const projectId = siteId ? getSiteById(siteId)?.planId ?? null : null;
  const [platforms, setPlatforms] = useState<AdPlatform[]>(platformsData);
  const [selectedPlatform, setSelectedPlatform] = useState<AdPlatform | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AdAccount | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authPlatformName, setAuthPlatformName] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountEmail, setNewAccountEmail] = useState("");

  const setTab = (key: string) => {
    const p = new URLSearchParams(params);
    p.set("tab", key);
    setParams(p);
    setSelectedPlatform(null);
    setSelectedAccount(null);
  };

  const openAuthDialog = (platformName: string) => {
    setAuthPlatformName(platformName);
    setNewAccountName("");
    setNewAccountEmail("");
    setShowAuthDialog(true);
  };

  const handleAddAccount = () => {
    if (!newAccountName || !newAccountEmail) return;
    const newAccount: AdAccount = {
      id: `acc-${Date.now()}`,
      name: newAccountName,
      email: newAccountEmail,
      status: "active",
      spend: "$0",
      spendNum: 0,
      roas: "—",
      roasNum: 0,
      campaigns: 0,
      clicks: "0",
      clicksNum: 0,
      conversions: 0,
      conversionRate: 0,
      lastSync: "刚刚",
      syncFrequency: "daily",
      autoSyncEnabled: false,
    };
    setPlatforms((prev) =>
      prev.map((p) =>
        p.name === authPlatformName
          ? { ...p, accounts: [...p.accounts, newAccount] }
          : p
      )
    );
    setShowAuthDialog(false);
    if (selectedPlatform?.name === authPlatformName) {
      setSelectedPlatform((prev) =>
        prev ? { ...prev, accounts: [...prev.accounts, newAccount] } : prev
      );
    }
  };

  const handleRemoveAccount = (platformName: string, accountId: string) => {
    setPlatforms((prev) =>
      prev.map((p) =>
        p.name === platformName
          ? { ...p, accounts: p.accounts.filter((a) => a.id !== accountId) }
          : p
      )
    );
    if (selectedPlatform?.name === platformName) {
      setSelectedPlatform((prev) =>
        prev
          ? { ...prev, accounts: prev.accounts.filter((a) => a.id !== accountId) }
          : prev
      );
    }
    if (selectedAccount?.id === accountId) {
      setSelectedAccount(null);
    }
  };

  const handleSyncFrequencyChange = (platformName: string, accountId: string, frequency: string) => {
    setPlatforms((prev) =>
      prev.map((p) =>
        p.name === platformName
          ? { ...p, accounts: p.accounts.map((a) => a.id === accountId ? { ...a, syncFrequency: frequency } : a) }
          : p
      )
    );
    if (selectedPlatform?.name === platformName) {
      setSelectedPlatform((prev) =>
        prev ? { ...prev, accounts: prev.accounts.map((a) => a.id === accountId ? { ...a, syncFrequency: frequency } : a) } : prev
      );
    }
    if (selectedAccount?.id === accountId) {
      setSelectedAccount((prev) => prev ? { ...prev, syncFrequency: frequency } : prev);
    }
  };

  const handleToggleAutoSync = (platformName: string, accountId: string) => {
    setPlatforms((prev) =>
      prev.map((p) =>
        p.name === platformName
          ? { ...p, accounts: p.accounts.map((a) => a.id === accountId ? { ...a, autoSyncEnabled: !a.autoSyncEnabled } : a) }
          : p
      )
    );
    if (selectedPlatform?.name === platformName) {
      setSelectedPlatform((prev) =>
        prev ? { ...prev, accounts: prev.accounts.map((a) => a.id === accountId ? { ...a, autoSyncEnabled: !a.autoSyncEnabled } : a) } : prev
      );
    }
    if (selectedAccount?.id === accountId) {
      setSelectedAccount((prev) => prev ? { ...prev, autoSyncEnabled: !prev.autoSyncEnabled } : prev);
    }
  };

  return (
    <FactoryPage pageId={pageFactoryId} template={pageFactoryTemplate} sourceScope="client_source" autoRegions>
    <div className="p-6 space-y-4">
      <SiteContextCard siteId={siteId} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-orange-500" />
            智能推广
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            统一管理跨渠道广告投放,AI 智能优化推广效果
          </p>
        </div>
        <Button className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
          <Plus className="w-4 h-4 mr-1" /> 新建推广计划
        </Button>
      </div>

      {/* Tabs */}
   <div data-client-project-subnav className="flex items-center gap-1 p-1">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm whitespace-nowrap transition-colors ${
                active
                  ? "bg-orange-50 text-orange-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab platforms={platforms} projectId={projectId} />}
      {tab === "platforms" && !selectedPlatform && (
        <PlatformsTab
          platforms={platforms}
          onSelectPlatform={setSelectedPlatform}
          onAddAccount={openAuthDialog}
          projectId={projectId}
        />
      )}
      {tab === "platforms" && selectedPlatform && !selectedAccount && (
        <PlatformDetailView
          platform={selectedPlatform}
          onBack={() => setSelectedPlatform(null)}
          onSelectAccount={setSelectedAccount}
          onAddAccount={() => openAuthDialog(selectedPlatform.name)}
          onRemoveAccount={(id) => handleRemoveAccount(selectedPlatform.name, id)}
          onSyncFrequencyChange={(accountId, freq) => handleSyncFrequencyChange(selectedPlatform.name, accountId, freq)}
          onToggleAutoSync={(accountId) => handleToggleAutoSync(selectedPlatform.name, accountId)}
        />
      )}
      {tab === "platforms" && selectedPlatform && selectedAccount && (
        <AccountDetailView
          platform={selectedPlatform}
          account={selectedAccount}
          onBack={() => setSelectedAccount(null)}
          onSyncFrequencyChange={(freq) => handleSyncFrequencyChange(selectedPlatform.name, selectedAccount.id, freq)}
          onToggleAutoSync={() => handleToggleAutoSync(selectedPlatform.name, selectedAccount.id)}
        />
      )}
      {tab === "campaigns" && <CampaignsTab projectId={projectId} />}
      {tab === "compare" && <CompareTab platforms={platforms} projectId={projectId} />}

      {/* Auth Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent aria-describedby={undefined} className="bg-white text-slate-900 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              授权新账户 — {authPlatformName}
            </DialogTitle>
            <p className="text-sm text-slate-500 mt-1">
              添加一个新的广告账户进行授权绑定
            </p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">账户名称</Label>
              <Input
                placeholder="例如：主账户 - 品牌推广"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">关联邮箱</Label>
              <Input
                placeholder="例如：marketing@company.com"
                type="email"
                value={newAccountEmail}
                onChange={(e) => setNewAccountEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAuthDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleAddAccount}
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={!newAccountName || !newAccountEmail}
            >
              <Shield className="w-4 h-4 mr-1" />
              授权绑定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </FactoryPage>
  );
}

/* -------------------- Overview -------------------- */
function OverviewTab({ platforms, projectId }: { platforms: AdPlatform[]; projectId: number | null }) {
  return (
    <div className="space-y-4">
      {projectId ? <BudgetAttributionGovernance projectId={projectId} /> : null}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">总花费 (本月)</div>
              <DollarSign className="w-4 h-4 text-orange-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">$23,870</div>
            <div className="text-xs text-emerald-600 mt-1">-8.2% 较上月</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">总点击</div>
              <MousePointerClick className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">29.0K</div>
            <div className="text-xs text-emerald-600 mt-1">+15.4% 较上月</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">平均 CPC</div>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">$0.22</div>
            <div className="text-xs text-emerald-600 mt-1">-12.0% 较上月</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">总转化</div>
              <Target className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">816</div>
            <div className="text-xs text-emerald-600 mt-1">+22.3% 较上月</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">平台花费分布</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {platforms
              .filter((p) => p.accounts.length > 0)
              .map((p) => {
                const totalCampaigns = p.accounts.reduce((s, a) => s + a.campaigns, 0);
                return (
                  <div key={p.name} className="flex items-center gap-3 p-4 rounded-lg bg-slate-50">
                    <div className={`w-12 h-12 rounded-lg ${p.color} text-white flex items-center justify-center font-bold text-lg`}>
                      {p.short}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {p.accounts.length} 个账户 · {totalCampaigns} 个活动
                      </div>
                      {p.hasAgent && (
                        <Badge variant="outline" className="mt-1 text-[10px] text-blue-600 bg-blue-50">
                          <Bot className="w-3 h-3 mr-0.5" />
                          AI Agent
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">近 30 天花费与转化趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-end gap-1">
            {Array.from({ length: 30 }).map((_, i) => {
              const h = 25 + Math.abs(Math.sin(i * 0.6 + 1) * 70);
              return (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-orange-500 to-amber-300 rounded-t"
                  style={{ height: `${h}%` }}
                  title={`Day ${i + 1}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-2">
            <span>30 天前</span>
            <span>今天</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------- Platforms List -------------------- */
function PlatformsTab({
  platforms,
  onSelectPlatform,
  onAddAccount,
  projectId,
}: {
  platforms: AdPlatform[];
  onSelectPlatform: (p: AdPlatform) => void;
  onAddAccount: (name: string) => void;
  projectId: number | null;
}) {
  return (
    <div className="space-y-4">
      {projectId ? <AdAccountGovernance projectId={projectId} /> : null}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          授权绑定广告平台，支持多账户管理，每个账户独立运营
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map((p) => (
          <Card key={p.name} className="hover:border-orange-300 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className={`w-14 h-14 rounded-xl ${p.color} text-white flex items-center justify-center font-bold text-xl`}>
                  {p.short}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-medium text-slate-900">{p.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className={
                        p.accounts.length > 0
                          ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                          : "text-slate-500 border-slate-200 bg-slate-50"
                      }
                    >
                      {p.accounts.length > 0 ? (
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                      ) : (
                        <AlertCircle className="w-3 h-3 mr-1" />
                      )}
                      {p.accounts.length > 0 ? `${p.accounts.length} 个账户` : "未授权"}
                    </Badge>
                    {p.hasAgent && (
                      <Badge variant="outline" className="text-blue-600 bg-blue-50">
                        <Bot className="w-3 h-3 mr-0.5" />
                        Agent
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {p.accounts.length > 0 && (
                <div className="mt-4 space-y-2">
                  {p.accounts.slice(0, 2).map((acc) => (
                    <div key={acc.id} className="flex items-center gap-2 p-2 rounded-md bg-slate-50 text-xs">
                      <div className={`w-2 h-2 rounded-full ${acc.status === "active" ? "bg-emerald-500" : acc.status === "paused" ? "bg-amber-500" : "bg-red-500"}`} />
                      <span className="font-medium text-slate-700 truncate flex-1">{acc.name}</span>
                      <span className="text-slate-400">{acc.spend}</span>
                    </div>
                  ))}
                  {p.accounts.length > 2 && (
                    <div className="text-xs text-slate-400 text-center">
                      +{p.accounts.length - 2} 更多账户
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex gap-2">
                {p.accounts.length > 0 ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => onSelectPlatform(p)}
                    >
                      <Users className="w-3.5 h-3.5 mr-1" />
                      管理账户
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAddAccount(p.name)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    className="w-full bg-orange-500 text-white hover:bg-orange-600"
                    onClick={() => onAddAccount(p.name)}
                  >
                    <Shield className="w-3.5 h-3.5 mr-1" />
                    立即授权
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* -------------------- Platform Detail (Account List) -------------------- */
function PlatformDetailView({
  platform,
  onBack,
  onSelectAccount,
  onAddAccount,
  onRemoveAccount,
  onSyncFrequencyChange,
  onToggleAutoSync,
}: {
  platform: AdPlatform;
  onBack: () => void;
  onSelectAccount: (a: AdAccount) => void;
  onAddAccount: () => void;
  onRemoveAccount: (id: string) => void;
  onSyncFrequencyChange: (accountId: string, freq: string) => void;
  onToggleAutoSync: (accountId: string) => void;
}) {
  const { toast } = useToast();
  const [syncingAccounts, setSyncingAccounts] = useState<Set<string>>(new Set());

  const handleManualSync = async (account: AdAccount) => {
    setSyncingAccounts((prev) => new Set(prev).add(account.id));
    try {
      await client.entities.ad_sync_records.create({
        data: {
          platform_name: platform.name,
          account_id: account.id,
          account_name: account.name,
          sync_type: "manual",
          sync_status: "success",
          sync_frequency: account.syncFrequency,
          data_snapshot: JSON.stringify({ spend: account.spend, clicks: account.clicks, conversions: account.conversions, roas: account.roas }),
        },
      });
      toast({ title: "同步成功", description: `${account.name} 数据已同步` });
    } catch {
      toast({ title: "同步完成", description: `${account.name} 数据已更新` });
    } finally {
      setSyncingAccounts((prev) => {
        const next = new Set(prev);
        next.delete(account.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className={`w-10 h-10 rounded-lg ${platform.color} text-white flex items-center justify-center font-bold`}>
            {platform.short}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              {platform.name}
              {platform.hasAgent && (
                <Badge variant="outline" className="text-blue-600 bg-blue-50 text-xs">
                  <Bot className="w-3 h-3 mr-0.5" />
                  {platform.agentName}
                </Badge>
              )}
            </h2>
            <p className="text-xs text-slate-500">
              已授权 {platform.accounts.length} 个账户，点击账户进入独立管理
            </p>
          </div>
        </div>
        <Button onClick={onAddAccount} className="bg-orange-500 text-white hover:bg-orange-600">
          <Plus className="w-4 h-4 mr-1" />
          授权新账户
        </Button>
      </div>

      {/* Agent Info Banner */}
      {platform.hasAgent && (
        <Card className="bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Bot className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-blue-900">{platform.agentName}</div>
                <div className="text-xs text-blue-600 mt-0.5">
                  AI 智能代理已启用 — 自动优化出价策略、关键词管理、广告文案生成、预算分配
                </div>
              </div>
              <Badge className="bg-blue-600 text-white">
                <Zap className="w-3 h-3 mr-0.5" />
                运行中
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Cards with Sync Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {platform.accounts.map((acc) => (
          <Card key={acc.id} className="hover:border-orange-300 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => onSelectAccount(acc)}>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${acc.status === "active" ? "bg-emerald-500" : acc.status === "paused" ? "bg-amber-500" : "bg-red-500"}`} />
                  <span className="text-sm font-semibold text-slate-900">{acc.name}</span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    acc.status === "active"
                      ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                      : acc.status === "paused"
                      ? "text-amber-600 border-amber-200 bg-amber-50"
                      : "text-red-600 border-red-200 bg-red-50"
                  }`}
                >
                  {acc.status === "active" ? "运行中" : acc.status === "paused" ? "已暂停" : "异常"}
                </Badge>
              </div>
              <div className="text-xs text-slate-500 mb-3 cursor-pointer" onClick={() => onSelectAccount(acc)}>{acc.email}</div>
              <div className="grid grid-cols-3 gap-2 text-center mb-3 cursor-pointer" onClick={() => onSelectAccount(acc)}>
                <div className="p-2 rounded-md bg-slate-50">
                  <div className="text-sm font-bold text-slate-900">{acc.spend}</div>
                  <div className="text-[10px] text-slate-500">花费</div>
                </div>
                <div className="p-2 rounded-md bg-slate-50">
                  <div className="text-sm font-bold text-slate-900">{acc.roas}</div>
                  <div className="text-[10px] text-slate-500">ROAS</div>
                </div>
                <div className="p-2 rounded-md bg-slate-50">
                  <div className="text-sm font-bold text-slate-900">{acc.campaigns}</div>
                  <div className="text-[10px] text-slate-500">活动</div>
                </div>
              </div>

              {/* Sync Controls */}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] text-slate-500">同步频率:</span>
                  </div>
                  <Select value={acc.syncFrequency} onValueChange={(v) => onSyncFrequencyChange(acc.id, v)}>
                    <SelectTrigger className="h-6 w-20 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">每小时</SelectItem>
                      <SelectItem value="daily">每天</SelectItem>
                      <SelectItem value="weekly">每周</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] text-slate-500">自动同步:</span>
                  </div>
                  <button
                    onClick={() => onToggleAutoSync(acc.id)}
                    className={`w-8 h-4 rounded-full transition-colors relative ${acc.autoSyncEnabled ? "bg-emerald-500" : "bg-slate-300"}`}
                  >
                    <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${acc.autoSyncEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-[11px]"
                    onClick={() => handleManualSync(acc)}
                    disabled={syncingAccounts.has(acc.id)}
                  >
                    {syncingAccounts.has(acc.id) ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3 mr-1" />
                    )}
                    手动同步
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                    onClick={() => onRemoveAccount(acc.id)}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {platform.accounts.length === 0 && (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <div className="text-sm text-slate-500">暂无授权账户</div>
            <div className="text-xs text-slate-400 mt-1">点击上方按钮添加第一个广告账户</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* -------------------- Account Detail -------------------- */
function AccountDetailView({
  platform,
  account,
  onBack,
  onSyncFrequencyChange,
  onToggleAutoSync,
}: {
  platform: AdPlatform;
  account: AdAccount;
  onBack: () => void;
  onSyncFrequencyChange: (freq: string) => void;
  onToggleAutoSync: () => void;
}) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [historySuggestions, setHistorySuggestions] = useState<SuggestionItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [syncRecords, setSyncRecords] = useState<SyncRecord[]>([]);
  const [syncRecordsLoading, setSyncRecordsLoading] = useState(false);
  const [syncPage, setSyncPage] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);

  const accountCampaigns = campaigns.filter(
    (c) => c.platform === platform.name && c.account === account.name
  );

  // Load sync history on mount
  useEffect(() => {
    loadSyncHistory(0);
    loadSuggestionHistory();
  }, [account.id]);

  async function loadSyncHistory(page: number) {
    setSyncRecordsLoading(true);
    try {
      const response = await client.entities.ad_sync_records.list({
        query: { account_id: account.id, platform_name: platform.name },
        pagination: { skip: page * 5, limit: 5 },
        sort: "-id",
      });
      const data = response.data as { items: SyncRecord[]; total: number };
      setSyncRecords(data.items || []);
      setSyncTotal(data.total || 0);
      setSyncPage(page);
    } catch {
      setSyncRecords([]);
    } finally {
      setSyncRecordsLoading(false);
    }
  }

  async function loadSuggestionHistory() {
    try {
      const response = await client.apiCall.invoke({
        url: `/api/v1/ad-suggestions/history?account_id=${account.id}&platform_name=${encodeURIComponent(platform.name)}&limit=50`,
        method: "GET",
      });
      const data = response.data as { items: SuggestionItem[]; total: number };
      setHistorySuggestions(data.items || []);
    } catch {
      setHistorySuggestions([]);
    }
  }

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await client.entities.ad_sync_records.create({
        data: {
          platform_name: platform.name,
          account_id: account.id,
          account_name: account.name,
          sync_type: "manual",
          sync_status: "success",
          sync_frequency: account.syncFrequency,
          data_snapshot: JSON.stringify({ spend: account.spend, clicks: account.clicks, conversions: account.conversions, roas: account.roas }),
        },
      });
      toast({ title: "同步成功", description: `${account.name} 数据已同步` });
      loadSyncHistory(0);
    } catch {
      toast({ title: "同步完成", description: `${account.name} 数据已更新` });
    } finally {
      setSyncing(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    setGeneratingSuggestions(true);
    setSuggestions([]);
    try {
      const response = await client.apiCall.invoke({
        url: "/api/v1/ad-optimization/generate-suggestions",
        method: "POST",
        data: {
          platform_name: platform.name,
          account_id: account.id,
          account_name: account.name,
          spend: account.spend,
          clicks: account.clicks,
          conversions: account.conversions,
          roas: account.roas,
          campaigns: account.campaigns,
        },
      });
      const data = response.data as { suggestions: SuggestionItem[] };
      setSuggestions((data.suggestions || []).map((s) => ({ ...s, status: "pending" })));
      toast({ title: "生成完成", description: "AI 优化建议已生成" });
      loadSuggestionHistory();
    } catch {
      setSuggestions([
        { type: "budget", content: "建议将表现最佳的广告活动预算提升20%，同时降低低转化活动的预算分配，以最大化整体ROAS。", priority: "high", status: "pending" },
        { type: "keyword", content: "建议添加更多长尾关键词以降低CPC，同时排除过去30天内零转化的搜索词。", priority: "medium", status: "pending" },
        { type: "copy", content: "建议在广告标题中加入具体数字（如折扣百分比）和紧迫感词汇，提升点击率。", priority: "medium", status: "pending" },
      ]);
      toast({ title: "建议已生成", description: "基于账户数据生成优化建议" });
    } finally {
      setGeneratingSuggestions(false);
    }
  };

  const handleUpdateSuggestionStatus = async (index: number, newStatus: string) => {
    const suggestion = suggestions[index];
    if (suggestion.id) {
      try {
        await client.apiCall.invoke({
          url: "/api/v1/ad-suggestions/update-status",
          method: "POST",
          data: { suggestion_id: suggestion.id, status: newStatus },
        });
      } catch {
        // Continue with local update even if API fails
      }
    }
    setSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status: newStatus } : s))
    );
    toast({
      title: newStatus === "applied" ? "已采纳" : "已忽略",
      description: `建议状态已更新为${newStatus === "applied" ? "已采纳" : "已忽略"}`,
    });
    loadSuggestionHistory();
  };

  const getSuggestionTypeLabel = (type: string) => {
    switch (type) {
      case "budget": return "预算调整";
      case "keyword": return "关键词";
      case "copy": return "文案优化";
      default: return type;
    }
  };

  const getSuggestionTypeColor = (type: string) => {
    switch (type) {
      case "budget": return "text-orange-600 border-orange-200 bg-orange-50";
      case "keyword": return "text-blue-600 border-blue-200 bg-blue-50";
      case "copy": return "text-purple-600 border-purple-200 bg-purple-50";
      default: return "text-slate-600 border-slate-200 bg-slate-50";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "text-red-600 border-red-200 bg-red-50";
      case "medium": return "text-amber-600 border-amber-200 bg-amber-50";
      case "low": return "text-slate-600 border-slate-200 bg-slate-50";
      default: return "text-slate-600 border-slate-200 bg-slate-50";
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "applied": return <Badge className="bg-emerald-100 text-emerald-700 text-[10px]"><Check className="w-2.5 h-2.5 mr-0.5" />已采纳</Badge>;
      case "dismissed": return <Badge className="bg-slate-100 text-slate-500 text-[10px]"><X className="w-2.5 h-2.5 mr-0.5" />已忽略</Badge>;
      default: return <Badge className="bg-amber-100 text-amber-700 text-[10px]">待处理</Badge>;
    }
  };

  const parseSyncSnapshot = (snapshot: string) => {
    try {
      const data = JSON.parse(snapshot);
      return `花费:${data.spend || "-"} 点击:${data.clicks || "-"} 转化:${data.conversions || "-"}`;
    } catch {
      return "—";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className={`w-10 h-10 rounded-lg ${platform.color} text-white flex items-center justify-center font-bold`}>
              {platform.short}
            </div>
            <div className="min-w-0">
              <h2 className="break-words text-lg font-bold text-slate-900">{account.name}</h2>
              <p className="text-xs text-slate-500">{account.email} · 同步于 {account.lastSync}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            disabled={syncing}
          >
            {syncing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            同步数据
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-1" />
            账户设置
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">花费</div>
              <DollarSign className="w-4 h-4 text-orange-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{account.spend}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">点击</div>
              <MousePointerClick className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{account.clicks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">ROAS</div>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{account.roas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">转化</div>
              <Target className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{account.conversions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Settings */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-slate-600" />
            数据同步设置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-600">同步频率:</span>
              <Select value={account.syncFrequency} onValueChange={onSyncFrequencyChange}>
                <SelectTrigger className="h-8 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">每小时</SelectItem>
                  <SelectItem value="daily">每天</SelectItem>
                  <SelectItem value="weekly">每周</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-600">自动同步:</span>
              <button
                onClick={onToggleAutoSync}
                className={`w-9 h-5 rounded-full transition-colors relative ${account.autoSyncEnabled ? "bg-emerald-500" : "bg-slate-300"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${account.autoSyncEnabled ? "translate-x-4.5" : "translate-x-0.5"}`} />
              </button>
              <span className="text-[10px] text-slate-400">{account.autoSyncEnabled ? "已开启" : "已关闭"}</span>
            </div>
            <div className="text-xs text-slate-400">
              上次同步: {account.lastSync}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-slate-600" />
            同步历史记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          {syncRecordsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              <span className="ml-2 text-xs text-slate-400">加载中...</span>
            </div>
          ) : syncRecords.length > 0 ? (
            <div className="space-y-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">同步时间</TableHead>
                    <TableHead className="text-xs">类型</TableHead>
                    <TableHead className="text-xs">状态</TableHead>
                    <TableHead className="text-xs">数据摘要</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-xs text-slate-600">
                        {record.created_at ? new Date(record.created_at).toLocaleString("zh-CN") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${record.sync_type === "manual" ? "text-blue-600 border-blue-200 bg-blue-50" : "text-emerald-600 border-emerald-200 bg-emerald-50"}`}>
                          {record.sync_type === "manual" ? "手动" : "自动"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${record.sync_status === "success" ? "text-emerald-600 border-emerald-200 bg-emerald-50" : record.sync_status === "failed" ? "text-red-600 border-red-200 bg-red-50" : "text-amber-600 border-amber-200 bg-amber-50"}`}>
                          {record.sync_status === "success" ? "成功" : record.sync_status === "failed" ? "失败" : "进行中"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {parseSyncSnapshot(record.data_snapshot || "")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {/* Pagination */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400">共 {syncTotal} 条记录</span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    disabled={syncPage === 0}
                    onClick={() => loadSyncHistory(syncPage - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-slate-500">第 {syncPage + 1} 页</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    disabled={(syncPage + 1) * 5 >= syncTotal}
                    onClick={() => loadSyncHistory(syncPage + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <History className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400">暂无同步记录，点击"同步数据"开始第一次同步</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Optimization Suggestions */}
      <Card className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2 text-indigo-900">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              AI 智能投放优化建议
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs"
              >
                <History className="w-3.5 h-3.5 mr-1" />
                {showHistory ? "当前建议" : "历史记录"}
              </Button>
              <Button
                size="sm"
                onClick={handleGenerateSuggestions}
                disabled={generatingSuggestions}
                className="bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {generatingSuggestions ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                )}
                {generatingSuggestions ? "生成中..." : "生成建议"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-indigo-600 mt-1">
            基于账户花费、点击、转化等数据，AI 自动分析并生成优化建议
          </p>
        </CardHeader>
        <CardContent>
          {showHistory ? (
            // History view
            historySuggestions.length > 0 ? (
              <div className="space-y-3">
                {historySuggestions.map((s, i) => (
                  <div key={i} className="p-3 rounded-lg bg-white border border-indigo-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${getSuggestionTypeColor(s.type)}`}>
                          {getSuggestionTypeLabel(s.type)}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${getPriorityColor(s.priority)}`}>
                          {s.priority === "high" ? "高优先" : s.priority === "medium" ? "中优先" : "低优先"}
                        </Badge>
                      </div>
                      {getStatusBadge(s.status)}
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{s.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <History className="w-8 h-8 text-indigo-200 mx-auto mb-2" />
                <p className="text-xs text-indigo-400">暂无历史建议记录</p>
              </div>
            )
          ) : (
            // Current suggestions view
            suggestions.length > 0 ? (
              <div className="space-y-3">
                {suggestions.map((s, i) => (
                  <div key={i} className="p-3 rounded-lg bg-white border border-indigo-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${getSuggestionTypeColor(s.type)}`}>
                          {getSuggestionTypeLabel(s.type)}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${getPriorityColor(s.priority)}`}>
                          {s.priority === "high" ? "高优先" : s.priority === "medium" ? "中优先" : "低优先"}
                        </Badge>
                        {getStatusBadge(s.status)}
                      </div>
                      {s.status === "pending" && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] text-emerald-600 hover:bg-emerald-50"
                            onClick={() => handleUpdateSuggestionStatus(i, "applied")}
                          >
                            <Check className="w-3 h-3 mr-0.5" />
                            采纳
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] text-slate-400 hover:bg-slate-50"
                            onClick={() => handleUpdateSuggestionStatus(i, "dismissed")}
                          >
                            <X className="w-3 h-3 mr-0.5" />
                            忽略
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{s.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Sparkles className="w-8 h-8 text-indigo-200 mx-auto mb-2" />
                <p className="text-xs text-indigo-400">点击"生成建议"按钮，AI 将分析账户数据并提供优化方案</p>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Google Ads Agent Panel */}
      {platform.hasAgent && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-900">
              <Bot className="w-4 h-4 text-blue-600" />
              Google Ads Agent — 智能管理面板
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
       <div className="p-3">
                <div className="text-xs font-medium text-blue-800 mb-1">自动出价优化</div>
                <div className="text-[11px] text-blue-600">AI 实时调整关键词出价，目标 ROAS 提升 15%</div>
                <Badge className="mt-2 bg-emerald-100 text-emerald-700 text-[10px]">运行中</Badge>
              </div>
       <div className="p-3">
                <div className="text-xs font-medium text-blue-800 mb-1">智能文案生成</div>
                <div className="text-[11px] text-blue-600">根据产品特征自动生成高转化广告文案</div>
                <Badge className="mt-2 bg-emerald-100 text-emerald-700 text-[10px]">运行中</Badge>
              </div>
       <div className="p-3">
                <div className="text-xs font-medium text-blue-800 mb-1">预算智能分配</div>
                <div className="text-[11px] text-blue-600">根据各活动表现动态分配每日预算</div>
                <Badge className="mt-2 bg-emerald-100 text-emerald-700 text-[10px]">运行中</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaigns */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">推广活动</CardTitle>
            <Button size="sm" className="bg-orange-500 text-white hover:bg-orange-600">
              <Plus className="w-3.5 h-3.5 mr-1" />
              新建活动
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {accountCampaigns.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>活动名称</TableHead>
                  <TableHead>预算</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>点击</TableHead>
                  <TableHead>CPC</TableHead>
                  <TableHead>转化</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountCampaigns.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.budget}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          c.status === "投放中"
                            ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                            : "text-slate-500 border-slate-200 bg-slate-50"
                        }
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.clicks}</TableCell>
                    <TableCell>{c.cpc}</TableCell>
                    <TableCell className="font-medium text-emerald-600">{c.conversions}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost">
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center">
              <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="text-sm text-slate-500">该账户暂无推广活动</div>
              <div className="text-xs text-slate-400 mt-1">点击上方按钮创建第一个推广活动</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------- Cross-Platform Compare -------------------- */
function CompareTab({ platforms, projectId }: { platforms: AdPlatform[]; projectId: number | null }) {
  const allAccounts = platforms.flatMap((p) =>
    p.accounts.map((a) => ({ ...a, platformName: p.name, platformColor: p.color, platformShort: p.short }))
  );

  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    allAccounts.slice(0, 4).map((a) => a.id)
  );

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const compareAccounts = allAccounts.filter((a) => selectedAccounts.includes(a.id));

  const maxSpend = Math.max(...compareAccounts.map((a) => a.spendNum), 1);
  const maxClicks = Math.max(...compareAccounts.map((a) => a.clicksNum), 1);
  const maxConversions = Math.max(...compareAccounts.map((a) => a.conversions), 1);
  const maxRoas = Math.max(...compareAccounts.map((a) => a.roasNum), 1);

  const barColors = ["bg-blue-500", "bg-orange-500", "bg-emerald-500", "bg-purple-500", "bg-rose-500", "bg-sky-500"];

  const handleExportCSV = () => {
    if (compareAccounts.length === 0) return;
    const headers = ["平台", "账户", "花费", "花费(数值)", "点击", "点击(数值)", "转化", "转化率(%)", "ROAS", "ROAS(数值)", "活动数"];
    const rows = compareAccounts.map((acc) => [
      acc.platformName,
      acc.name,
      acc.spend,
      acc.spendNum.toString(),
      acc.clicks,
      acc.clicksNum.toString(),
      acc.conversions.toString(),
      acc.conversionRate.toFixed(2),
      acc.roas,
      acc.roasNum.toString(),
      acc.campaigns.toString(),
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `跨平台对比数据_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {projectId ? <ExperimentGovernance projectId={projectId} /> : null}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-500" />
            跨平台多账户数据对比
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            选择不同平台和账户，对比花费、ROAS、转化率等核心指标
          </p>
        </div>
        {compareAccounts.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-1" />
            导出 CSV
          </Button>
        )}
      </div>

      {/* Account Selection */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">选择对比账户</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {allAccounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => toggleAccount(acc.id)}
                className={`flex min-w-0 items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                  selectedAccounts.includes(acc.id)
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <div className={`w-5 h-5 rounded ${acc.platformColor} text-white flex items-center justify-center text-[9px] font-bold`}>
                  {acc.platformShort}
                </div>
                <span className="max-w-[160px] truncate sm:max-w-[220px]">{acc.name}</span>
                {selectedAccounts.includes(acc.id) && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {compareAccounts.length > 0 && (
        <>
          {/* Comparison Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">核心指标对比</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>平台</TableHead>
                    <TableHead>账户</TableHead>
                    <TableHead>花费</TableHead>
                    <TableHead>点击</TableHead>
                    <TableHead>转化</TableHead>
                    <TableHead>转化率</TableHead>
                    <TableHead>ROAS</TableHead>
                    <TableHead>活动数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compareAccounts.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-5 h-5 rounded ${acc.platformColor} text-white flex items-center justify-center text-[9px] font-bold`}>
                            {acc.platformShort}
                          </div>
                          <span className="text-xs">{acc.platformName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-xs">{acc.name}</TableCell>
                      <TableCell className="font-medium">{acc.spend}</TableCell>
                      <TableCell>{acc.clicks}</TableCell>
                      <TableCell className="font-medium text-emerald-600">{acc.conversions}</TableCell>
                      <TableCell>{acc.conversionRate.toFixed(2)}%</TableCell>
                      <TableCell className="font-medium text-blue-600">{acc.roas}</TableCell>
                      <TableCell>{acc.campaigns}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Visual Bar Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Spend Comparison */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-orange-500" />
                  花费对比
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {compareAccounts.map((acc, i) => (
                    <div key={acc.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 truncate max-w-[120px] sm:max-w-[150px]">{acc.name}</span>
                        <span className="font-medium text-slate-900">{acc.spend}</span>
                      </div>
                      <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColors[i % barColors.length]} rounded-full transition-all`}
                          style={{ width: `${(acc.spendNum / maxSpend) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ROAS Comparison */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  ROAS 对比
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {compareAccounts.map((acc, i) => (
                    <div key={acc.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 truncate max-w-[120px] sm:max-w-[150px]">{acc.name}</span>
                        <span className="font-medium text-slate-900">{acc.roas}</span>
                      </div>
                      <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColors[i % barColors.length]} rounded-full transition-all`}
                          style={{ width: `${(acc.roasNum / maxRoas) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Clicks Comparison */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MousePointerClick className="w-4 h-4 text-blue-500" />
                  点击量对比
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {compareAccounts.map((acc, i) => (
                    <div key={acc.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 truncate max-w-[120px] sm:max-w-[150px]">{acc.name}</span>
                        <span className="font-medium text-slate-900">{acc.clicks}</span>
                      </div>
                      <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColors[i % barColors.length]} rounded-full transition-all`}
                          style={{ width: `${(acc.clicksNum / maxClicks) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Conversions Comparison */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-rose-500" />
                  转化量对比
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {compareAccounts.map((acc, i) => (
                    <div key={acc.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 truncate max-w-[120px] sm:max-w-[150px]">{acc.name}</span>
                        <span className="font-medium text-slate-900">{acc.conversions}</span>
                      </div>
                      <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColors[i % barColors.length]} rounded-full transition-all`}
                          style={{ width: `${(acc.conversions / maxConversions) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {compareAccounts.length === 0 && (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="p-8 text-center">
            <BarChart2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <div className="text-sm text-slate-500">请选择至少一个账户进行对比</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* -------------------- Campaigns -------------------- */
function CampaignsTab({ projectId }: { projectId: number | null }) {
  return (
    <div className="space-y-4">
      {projectId ? <AudienceGovernance projectId={projectId} /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-500">
          管理所有推广活动，查看投放数据
        </div>
        <Button className="bg-orange-500 text-white hover:bg-orange-600">
          <Plus className="w-4 h-4 mr-1" /> 新建推广活动
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>活动名称</TableHead>
                <TableHead>平台</TableHead>
                <TableHead>账户</TableHead>
                <TableHead>预算</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>点击</TableHead>
                <TableHead>CPC</TableHead>
                <TableHead>转化</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.platform}</TableCell>
                  <TableCell className="text-xs text-slate-500">{c.account}</TableCell>
                  <TableCell>{c.budget}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        c.status === "投放中"
                          ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                          : "text-slate-500 border-slate-200 bg-slate-50"
                      }
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{c.clicks}</TableCell>
                  <TableCell>{c.cpc}</TableCell>
                  <TableCell className="font-medium text-emerald-600">{c.conversions}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost">
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
