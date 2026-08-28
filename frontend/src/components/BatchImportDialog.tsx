import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X } from "lucide-react";

interface BatchImportDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  templateFields: string[];
}

export default function BatchImportDialog({ open, onClose, title, templateFields }: BatchImportDialogProps) {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [dragOver, setDragOver] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "upload" && (
            <>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragOver ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-300"}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); setStep("preview"); }}
              >
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">拖拽文件到此处，或点击上传</p>
                <p className="text-xs text-slate-500 mt-1">支持 .xlsx, .xls, .csv 格式，单次最多 500 条</p>
                <Button variant="outline" className="mt-4" onClick={() => setStep("preview")}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />选择文件
                </Button>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-700 mb-2">模板字段说明</h4>
                <div className="flex flex-wrap gap-2">
                  {templateFields.map((f) => (
                    <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                  ))}
                </div>
                <Button variant="link" className="text-xs p-0 h-auto mt-2 text-blue-600">下载导入模板</Button>
              </div>
            </>
          )}
          {step === "preview" && (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm text-emerald-700">文件解析成功，共识别 12 条数据</span>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      {templateFields.slice(0, 4).map((f) => (
                        <th key={f} className="text-left py-2 px-3 font-medium text-slate-600">{f}</th>
                      ))}
                      <th className="text-left py-2 px-3 font-medium text-slate-600">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((i) => (
                      <tr key={i} className="border-b border-slate-50">
                        {templateFields.slice(0, 4).map((f) => (
                          <td key={f} className="py-2 px-3 text-slate-600">示例数据 {i}</td>
                        ))}
                        <td className="py-2 px-3">
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs">有效</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>有效: 10 条 | 重复: 1 条 | 错误: 1 条</span>
                <div className="flex items-center gap-1 text-amber-600">
                  <AlertCircle className="w-3 h-3" />
                  <span>第 8 行: 缺少必填字段</span>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep("upload")}>重新上传</Button>
                <Button onClick={() => setStep("result")}>确认导入 (10条)</Button>
              </div>
            </>
          )}
          {step === "result" && (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-900">导入完成</h3>
              <p className="text-sm text-slate-500 mt-1">成功导入 10 条数据，1 条跳过</p>
              <div className="flex justify-center gap-2 mt-4">
                <Button variant="outline" onClick={() => { setStep("upload"); onClose(); }}>关闭</Button>
                <Button onClick={() => { setStep("upload"); onClose(); }}>查看数据</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}