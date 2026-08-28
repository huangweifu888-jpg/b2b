import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Palette, Upload, Globe, Mail, Eye } from "lucide-react";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { useLocation } from "react-router-dom";

export default function OEMSettings() {
  const { pathname } = useLocation();
  return (
    <FactoryPage pageId={pathname.endsWith("/oem") ? "agency-oem" : "agency-oem-settings"} template="form" sourceScope="agency_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">OEM 设置</h1>
          <p className="text-sm text-slate-500 mt-1">白标定制：用自己的品牌为企业客户提供服务</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline"><Eye className="w-4 h-4 mr-2" />预览</Button>
          <Button className="bg-violet-600 hover:bg-violet-700">保存设置</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Palette className="w-4 h-4 text-violet-600" />
                <h3 className="font-semibold">品牌标识</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-sm">品牌名称</Label>
                  <Input defaultValue="代理品牌示例" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">品牌标语</Label>
                  <Input defaultValue="为外贸企业提供一站式独立站解决方案" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">商标图（横版）</Label>
                  <div className="mt-1 h-16 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-slate-50 cursor-pointer hover:border-violet-400">
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <Upload className="w-4 h-4" /> 上传 PNG 或 SVG
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-sm">网站图标</Label>
                  <div className="mt-1 h-16 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-slate-50 cursor-pointer hover:border-violet-400">
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <Upload className="w-4 h-4" /> 上传 32×32 ICO
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">主题配色</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label className="text-sm">主色</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" defaultValue="#8b5cf6" className="w-10 h-9 rounded border border-slate-300" />
                    <Input defaultValue="#8b5cf6" className="h-9 font-mono text-xs" />
                  </div>
                </div>
                <div>
                  <Label className="text-sm">辅助色</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" defaultValue="#ec4899" className="w-10 h-9 rounded border border-slate-300" />
                    <Input defaultValue="#ec4899" className="h-9 font-mono text-xs" />
                  </div>
                </div>
                <div>
                  <Label className="text-sm">强调色</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" defaultValue="#10b981" className="w-10 h-9 rounded border border-slate-300" />
                    <Input defaultValue="#10b981" className="h-9 font-mono text-xs" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-violet-600" />
                <h3 className="font-semibold">自定义域名</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">代理商管理后台域名</Label>
                  <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input defaultValue="agency.yourbrand.com" className="font-mono text-sm" />
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">已解析</Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">请将 CNAME 指向 cname.tradeagency.io</p>
                </div>
                <div>
                  <Label className="text-sm">企业客户端默认域名</Label>
                  <Input defaultValue="client.yourbrand.com" className="font-mono text-sm mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-4 h-4 text-violet-600" />
                <h3 className="font-semibold">邮件白标</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-sm">发件人名称</Label>
                  <Input defaultValue="TradeAgency Pro" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">发件地址</Label>
                  <Input defaultValue="noreply@yourbrand.com" className="mt-1 font-mono text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm">邮件签名</Label>
                  <Textarea
                    defaultValue="—\nTradeAgency Pro 团队\n为全球外贸企业提供一站式独立站服务"
                    className="mt-1 min-h-[70px]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-slate-200">
            <CardContent className="p-5">
              <div className="text-xs text-slate-500 mb-3">品牌预览</div>
              <div className="rounded-lg overflow-hidden border border-slate-200">
                <div className="bg-gradient-to-r from-violet-500 to-fuchsia-500 p-4 text-white">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-white/20 flex items-center justify-center text-xs font-bold">{sanitizeDisplayText("代", "代")}</div>
                    <div className="font-bold text-sm">代理品牌示例</div>
                  </div>
                  <div className="text-[10px] opacity-80 mt-1">为外贸企业提供一站式独立站解决方案</div>
                </div>
                <div className="p-3 bg-slate-50">
                  <div className="h-2 bg-violet-500 rounded w-3/4 mb-2" />
                  <div className="h-2 bg-slate-300 rounded w-1/2" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50">
            <CardContent className="p-5">
              <div className="text-sm font-semibold text-violet-900 mb-2">OEM 功能说明</div>
              <ul className="text-xs text-slate-700 space-y-1.5">
                <li>• 企业客户登录时看到的是你的品牌</li>
                <li>• 客户邮件通知署名为你的品牌</li>
                <li>• 客户发票 / 合同显示你的公司信息</li>
                <li>• 支持二级域名与完全自定义域名</li>
                <li>• 企业版及以上套餐可用</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </FactoryPage>
  );
}
