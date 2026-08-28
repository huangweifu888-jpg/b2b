import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { client } from "@/lib/api";

type AIGenerateButtonProps = {
  label?: string;
  systemPrompt: string;
  placeholder?: string;
  onApply?: (text: string) => void;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  model?: string;
};

const AI_MODELS = [
  { value: "deepseek-v3.2", label: "DeepSeek V3.2 (快速)" },
  { value: "gpt-5.4", label: "GPT-5.4 (高质量)" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
];

export default function AIGenerateButton({
  label = "AI 生成",
  systemPrompt,
  placeholder = "描述您的需求...",
  onApply,
  variant = "outline",
  size = "sm",
  className = "",
  model: defaultModel = "deepseek-v3.2",
}: AIGenerateButtonProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult("");

    try {
      await client.ai.gentxt({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        model: selectedModel,
        stream: true,
        onChunk: (chunk: { content: string }) => {
          setResult((prev) => prev + chunk.content);
        },
        onComplete: () => {
          setLoading(false);
        },
        onError: (error: { message: string }) => {
          setResult(`生成失败：${error.message}`);
          setLoading(false);
        },
        timeout: 60000,
      });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "请求失败";
      setResult(`生成失败：${errMsg}`);
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (onApply && result) {
      onApply(result);
      setOpen(false);
      setPrompt("");
      setResult("");
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              AI 智能生成
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">选择模型</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm">输入需求</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={placeholder}
                className="mt-1 min-h-[80px]"
              />
            </div>

            <Button
              onClick={generate}
              disabled={loading || !prompt.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {loading ? "生成中..." : "开始生成"}
            </Button>

            {result && (
              <div className="relative">
                <Label className="text-sm">生成结果</Label>
                <div className="mt-1 bg-slate-50 rounded-lg p-3 border border-slate-200 max-h-[200px] overflow-y-auto">
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">
                    {result}
                  </pre>
                </div>
                <button
                  onClick={handleCopy}
                  className="absolute top-7 right-2 p-1.5 rounded-md hover:bg-slate-200 text-slate-400"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              关闭
            </Button>
            {onApply && result && (
              <Button
                onClick={handleApply}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Check className="w-4 h-4 mr-1.5" /> 应用结果
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
