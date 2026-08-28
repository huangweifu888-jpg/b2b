import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Code2, RefreshCw, Save } from "lucide-react";

import {
  SourceDeploymentWorkbench,
  type DeploymentWorkspaceInfo,
} from "@/components/deployment/SourceDeploymentWorkbench";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { useParams } from "react-router-dom";

type FileItem = { path: string; size: number };
type FileCategory = { label: string; className: string };

const apiCandidates = ["http://127.0.0.1:8002", "http://127.0.0.1:8000"];

async function localDevFetch(path: string, init?: RequestInit) {
  let lastError: unknown = null;
  for (const base of apiCandidates) {
    try {
      const response = await fetch(`${base}${path}`, init);
      if (response.ok) return response;
      lastError = new Error(`${base}${path} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("本地开发接口暂时不可用");
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function getFileCategory(path: string): FileCategory {
  const lower = path.toLowerCase();
  if (lower.includes("/pages/hq/") || lower.includes("hqsidebar")) {
    return { label: "总部界面", className: "bg-emerald-100 text-emerald-700" };
  }
  if (lower.includes("/pages/agency/") || lower.includes("agencysidebar")) {
    return { label: "代理界面", className: "bg-violet-100 text-violet-700" };
  }
  if (lower.includes("/pages/") || lower.includes("clientprojectnav")) {
    return { label: "客户界面", className: "bg-sky-100 text-sky-700" };
  }
  if (lower.includes("/components/") || lower.includes("/lib/") || lower.includes("app.tsx")) {
    return { label: "前端共享", className: "bg-slate-100 text-slate-700" };
  }
  return { label: "后端服务", className: "bg-amber-100 text-amber-700" };
}

function describeFile(path: string) {
  if (!path) return "请选择文件。这里仅编辑唯一源码，不直接修改部署包、生产数据、密钥或正式备份。";
  const lower = path.toLowerCase();
  const name = path.split("/").pop() || path;
  if (lower.includes("hqcodeeditor")) return "总部源码与部署中心页面：组织开发器、可视化编排和共享契约。";
  if (lower.includes("sourcedeploymentworkbench")) return "源码与部署工作台：统一七个角色、七档部署拓扑和发布边界。";
  if (lower.includes("hqsidebar")) return "总部左侧导航：提供总部功能与源码部署入口。";
  if (lower.includes("path_registry")) return "本地路径注册：统一声明源码、七个角色、本地数据与备份恢复位置。";
  if (lower.includes("local_dev.py")) return "本地开发接口：安全读取源码、保存文本文件并返回部署目录清单。";
  if (lower.includes("tenant_context")) return "租户上下文：校验代理路径、租户、客户和可选计划边界。";
  if (lower.includes("template_snapshot")) return "模板快照：管理源版本、运行实例、覆盖项和回滚版本。";
  if (lower.includes("content_downloads")) return "私有素材下载：管理素材元数据、扫描状态和短时访问票据。";
  if (lower.includes("productmarket")) return "产品市场：维护三端能力、功能配置和受控发布入口。";
  if (lower.includes("clientprojectnav")) return "客户计划导航：在同一客户下切换多个计划实例。";
  if (lower.includes("platformarchitecture")) return "平台架构页：展示组织、数据、发布和部署主轴。";
  if (lower.includes("/pages/hq/")) return `总部页面：${name}`;
  if (lower.includes("/pages/agency/")) return `代理端页面：${name}`;
  if (lower.includes("/pages/")) return `客户端页面：${name}`;
  if (lower.includes("/components/")) return `前端共享组件：${name}`;
  if (lower.includes("/lib/")) return `前端共享逻辑：${name}`;
  if (lower.includes("/routers/")) return `后端接口路由：${name}`;
  if (lower.includes("/services/")) return `后端业务服务：${name}`;
  if (lower.includes("/models/")) return `后端数据模型：${name}`;
  if (lower.endsWith(".css")) return "页面样式文件：负责布局、颜色、字体和响应式规则。";
  if (lower.endsWith(".json") || lower.endsWith(".yaml") || lower.endsWith(".yml")) {
    return "配置或清单文件：修改前必须核对版本、引用方和回滚方式。";
  }
  return `源码文件：${name}`;
}

export default function HQCodeEditor() {
  const { scope } = useParams<{ scope?: string }>();
  const [workspace, setWorkspace] = useState<DeploymentWorkspaceInfo | null>(null);
  const [root, setRoot] = useState<"frontend" | "backend">("frontend");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const selectedDescription = useMemo(() => describeFile(selectedPath), [selectedPath]);
  const selectedCategory = useMemo(() => getFileCategory(selectedPath), [selectedPath]);

  const loadWorkspace = async () => {
    const response = await localDevFetch("/api/v1/local-dev/workspace");
    setWorkspace(await response.json());
  };

  const openPath = async (path?: string) => {
    if (!path) return;
    setStatus("正在打开本地路径…");
    try {
      await localDevFetch(`/api/v1/local-dev/open-path?path=${encodeURIComponent(path)}`, { method: "POST" });
      setStatus(`已打开：${path}`);
    } catch (error) {
      setStatus(`打开路径失败：${String(error)}`);
    }
  };

  const copyPath = async (path?: string) => {
    if (!path) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(path);
      else await localDevFetch(`/api/v1/local-dev/copy-text?text=${encodeURIComponent(path)}`, { method: "POST" });
      setStatus(`已复制路径：${path}`);
    } catch (error) {
      setStatus(`复制路径失败：${String(error)}`);
    }
  };

  const loadFiles = useCallback(async (targetRoot = root) => {
    setLoading(true);
    setStatus("正在读取唯一源码文件列表…");
    try {
      const response = await localDevFetch(`/api/v1/local-dev/files?root=${targetRoot}`);
      const data = await response.json();
      setFiles(data.items || []);
      setStatus("源码文件列表已更新。");
    } catch (error) {
      setStatus(`读取源码列表失败：${String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [root]);

  const loadFile = async (path: string) => {
    if (!path) return;
    setLoading(true);
    setStatus("正在读取源码文件…");
    try {
      const response = await localDevFetch(`/api/v1/local-dev/file?path=${encodeURIComponent(path)}`);
      const data = await response.json();
      setSelectedPath(data.path);
      setContent(data.content || "");
      setEditorOpen(true);
      setStatus(`已打开源码：${data.path}`);
    } catch (error) {
      setStatus(`读取源码失败：${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const saveFile = async () => {
    if (!selectedPath) return;
    setLoading(true);
    setStatus("正在保存源码…");
    try {
      const response = await localDevFetch("/api/v1/local-dev/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedPath, content }),
      });
      const data = await response.json();
      setStatus(`已保存：${data.path}`);
      await loadWorkspace();
    } catch (error) {
      setStatus(`保存失败：${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace().catch((error) => setStatus(`读取工作区失败：${String(error)}`));
  }, []);

  useEffect(() => {
    void loadFiles(root);
  }, [loadFiles, root]);

  const developerEditor = (
    <Card className="border-slate-200" data-unique-source-editor>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 font-semibold text-slate-900"><Code2 className="h-4 w-4 text-cyan-600" />唯一源码编辑器</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">只允许编辑 frontend/backend 文本源码；部署包、数据库、素材、密钥和备份不在这里直接修改。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadFiles()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />刷新源码</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={saveFile} disabled={loading || !selectedPath}><Save className="mr-2 h-4 w-4" />保存源码</Button>
          </div>
        </div>

        <div className="grid min-w-0 gap-3 lg:grid-cols-[190px_minmax(0,1fr)]">
          <select
            value={root}
            onChange={(event) => {
              setRoot(event.target.value as "frontend" | "backend");
              setSelectedPath("");
              setContent("");
              setEditorOpen(false);
            }}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="frontend">frontend 前端源码</option>
            <option value="backend">backend 后端源码</option>
          </select>
          <select
            value={selectedPath}
            onChange={(event) => void loadFile(event.target.value)}
            className="h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-xs font-mono"
          >
            <option value="">选择要查看或编辑的源码文件</option>
            {files.map((file) => (
              <option key={file.path} value={file.path}>{file.path} - {describeFile(file.path)} ({formatSize(file.size)})</option>
            ))}
          </select>
        </div>

        <div className="rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs leading-5 text-cyan-900">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">唯一源码</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selectedCategory.className}`}>{selectedCategory.label}</span>
            <span>后端 Python/FastAPI · 前端 TypeScript/React</span>
          </div>
          <div>{selectedDescription}</div>
        </div>

        <button
          type="button"
          onClick={() => setEditorOpen((value) => !value)}
          className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:bg-slate-100"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">{editorOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}源码内容</div>
            <div className="mt-1 truncate font-mono text-xs text-slate-500">{selectedPath || "请先选择一个文件"}</div>
          </div>
          <div className="shrink-0 text-xs text-slate-400">{content.length.toLocaleString()} 字符</div>
        </button>

        {editorOpen ? (
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            spellCheck={false}
            className="min-h-[58vh] resize-none bg-slate-950 font-mono text-xs leading-5 text-slate-100"
            placeholder="源码内容会显示在这里…"
          />
        ) : (
          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">编辑区域保持干净；选择源码文件后会自动展开。</div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-xs font-semibold text-slate-900">操作状态</div>
          <div className="mt-1 break-words text-xs text-slate-600">{status || "等待操作…"}</div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <FactoryPage pageId={scope ? "hq-code-editor-scope" : "hq-code-editor"} template="dashboard" sourceScope="hq" autoRegions>
      <div data-hq-source-deployment-center>
      <SourceDeploymentWorkbench
        workspace={workspace}
        status={status}
        developerEditor={developerEditor}
        onOpenPath={(path) => void openPath(path)}
        onCopyPath={(path) => void copyPath(path)}
      />
      </div>
    </FactoryPage>
  );
}
