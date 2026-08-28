import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, X, Loader2, CheckCircle2, Copy, RefreshCw } from "lucide-react";

interface AIGenerateDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  contentType: string;
  promptPlaceholder?: string;
}

export default function AIGenerateDialog({ open, onClose, title, contentType, promptPlaceholder }: AIGenerateDialogProps) {
  const [step, setStep] = useState<"input" | "generating" | "result">("input");
  const [prompt, setPrompt] = useState("");

  if (!open) return null;

  const handleGenerate = () => {
    setStep("generating");
    setTimeout(() => setStep("result"), 2000);
  };

  const generatedResults = [
    { title: `AI 生成${contentType} #1`, summary: "基于您的关键词和行业特点，AI 已自动生成高质量内容，包含专业术语和SEO优化结构。", quality: 92 },
    { title: `AI 生成${contentType} #2`, summary: "从不同角度切入，突出产品优势和技术参数，适合目标客户群体阅读。", quality: 88 },
    { title: `AI 生成${contentType} #3`, summary: "以问答形式组织内容，提升用户阅读体验和页面停留时间。", quality: 85 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            {title}
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setStep("input"); onClose(); }}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "input" && (
            <>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">主题/关键词</label>
                  <Input
                    className="mt-1"
                    placeholder={promptPlaceholder || `输入${contentType}主题或关键词...`}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700">语言</label>
                    <Input className="mt-1" placeholder="英文" defaultValue="English" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">生成数量</label>
                    <Input className="mt-1" type="number" defaultValue="3" min="1" max="10" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700">内容风格</label>
                    <Input className="mt-1" placeholder="专业/轻松/营销" defaultValue="专业" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">目标字数</label>
                    <Input className="mt-1" placeholder="1500-3000" defaultValue="2000" />
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <h4 className="text-xs font-medium text-blue-700 mb-1">AI 提示</h4>
                <p className="text-xs text-blue-600">系统将根据您的关键词自动分析行业特点，生成符合SEO标准的高质量{contentType}内容。</p>
              </div>
              <Button className="w-full" onClick={handleGenerate} disabled={!prompt.trim()}>
                <Sparkles className="w-4 h-4 mr-2" />开始生成
              </Button>
            </>
          )}
          {step === "generating" && (
            <div className="text-center py-12">
              <Loader2 className="w-10 h-10 text-blue-500 mx-auto mb-4 animate-spin" />
              <h3 className="text-base font-semibold text-slate-900">AI 正在创作中...</h3>
              <p className="text-sm text-slate-500 mt-1">正在分析关键词并生成{contentType}内容</p>
              <div className="mt-4 space-y-2 max-w-xs mx-auto">
                {["分析关键词和行业特点", "构建内容结构", "生成正文内容", "SEO 优化检查"].map((s, i) => (
                  <div key={s} className="flex items-center gap-2 text-xs">
                    {i < 2 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
                    <span className={i < 2 ? "text-slate-600" : "text-slate-400"}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {step === "result" && (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm text-emerald-700">已成功生成 3 篇{contentType}内容</span>
              </div>
              <div className="space-y-3">
                {generatedResults.map((r, i) => (
                  <Card key={i} className="border-slate-200 hover:border-blue-300 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold">{r.title}</h4>
                            <Badge className="bg-emerald-100 text-emerald-700 text-xs">质量 {r.quality}</Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{r.summary}</p>
                        </div>
                        <div className="flex items-center gap-1 ml-3">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Copy className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("input")}>
                  <RefreshCw className="w-4 h-4 mr-2" />重新生成
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setStep("input"); onClose(); }}>稍后使用</Button>
                  <Button onClick={() => { setStep("input"); onClose(); }}>全部采用</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}