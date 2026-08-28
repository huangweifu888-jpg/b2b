import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ICON_OPTIONS, type CustomProductItem } from "@/lib/product-market-store";

type ProductMarketModuleEditorDialogProps = {
  onOpenChange: (open: boolean) => void;
  onAddProduct: (product: CustomProductItem) => void;
};

/** Interaction-only custom module editor; kept out of the modules tab startup chunk. */
export function ProductMarketModuleEditorDialog({
  onOpenChange,
  onAddProduct,
}: ProductMarketModuleEditorDialogProps) {
  const [label, setLabel] = useState("");
  const [path, setPath] = useState("");
  const [iconName, setIconName] = useState("Package");
  const [children, setChildren] = useState<CustomProductItem["children"]>([]);
  const canSubmit = Boolean(label.trim() && path.trim());

  const close = () => onOpenChange(false);
  const submit = () => {
    if (!canSubmit) return;
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const normalizedChildren = children.filter((child) => child.label.trim() && child.path.trim());
    onAddProduct({
      label: label.trim(),
      path: normalizedPath,
      iconName,
      children: normalizedChildren,
    });
    toast.success(`产品「${label.trim()}」已添加`);
    close();
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
            <Plus className="h-5 w-5 text-emerald-400" />
            新增产品功能
          </DialogTitle>
          <DialogDescription data-dialog-optional-description className="mt-1 text-sm text-slate-300">
            添加自定义产品模块，并同步到产品卡片和侧边栏。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-1 block text-xs text-slate-400">产品名称 *</Label>
            <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="例如：客户评价" className="h-9 bg-slate-800 text-sm text-slate-200" />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-slate-400">路由路径 *</Label>
            <Input value={path} onChange={(event) => setPath(event.target.value)} placeholder="例如：reviews" className="h-9 bg-slate-800 text-sm text-slate-200" />
            <p className="mt-1 text-[10px] text-slate-500">以 / 开头的唯一路径</p>
          </div>
          <div>
            <Label className="mb-1 block text-xs text-slate-400">图标</Label>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
              {ICON_OPTIONS.slice(0, 18).map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.name}
                    type="button"
                    onClick={() => setIconName(option.name)}
                    title={option.name}
                    aria-pressed={iconName === option.name}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
                      iconName === option.name
                        ? "border-emerald-500 bg-emerald-600/30 text-emerald-400"
                        : "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-xs text-slate-400">子栏目（可选）</Label>
            {children.map((child, index) => (
              <div key={index} className="mb-1.5 flex gap-2">
                <Input
                  value={child.label}
                  onChange={(event) => setChildren((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))}
                  placeholder="子栏目名称"
                  className="h-7 flex-1 bg-slate-800 text-xs text-slate-200"
                />
                <Input
                  value={child.path}
                  onChange={(event) => setChildren((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, path: event.target.value } : item))}
                  placeholder="路径 ?tab=xxx"
                  className="h-7 flex-1 bg-slate-800 text-xs text-slate-200"
                />
                <button type="button" onClick={() => setChildren((current) => current.filter((_, itemIndex) => itemIndex !== index))} title="删除子栏目" aria-label="删除子栏目" className="p-1 text-red-400 hover:text-red-300">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => setChildren((current) => [...current, { label: "", path: "" }])} className="mt-1 h-7 text-xs text-slate-400 hover:text-slate-200">
              <Plus className="mr-1 h-3 w-3" /> 添加子栏目
            </Button>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={close} className="text-slate-300 hover:bg-slate-800">取消</Button>
          <Button type="button" onClick={submit} disabled={!canSubmit} className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">
            添加产品
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ProductMarketModuleEditorDialog;
