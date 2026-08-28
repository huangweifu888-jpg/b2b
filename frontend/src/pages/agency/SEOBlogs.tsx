import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Eye, Sparkles, Plus } from "lucide-react";

import { loadAgencyLiveSnapshot } from "@/lib/agency-live-data";
import { deriveAgencySeoBlogs } from "@/lib/agency-derived-data";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";
import { FactoryPage } from "@/page-factory/FactoryPage";

const statusMap: Record<string, { label: string; cls: string }> = {
  published: { label: "已发布", cls: "bg-emerald-100 text-emerald-700" },
  review: { label: "待审核", cls: "bg-amber-100 text-amber-700" },
  draft: { label: "草稿", cls: "bg-slate-100 text-slate-700" },
};

export default function SEOBlogs() {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadAgencyLiveSnapshot>> | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadAgencyLiveSnapshot().then((next) => {
      if (mounted) setSnapshot(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const seoBlogs = useMemo(() => (snapshot ? deriveAgencySeoBlogs(snapshot) : []), [snapshot]);
  const orderedBlogs = [...seoBlogs].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id));

  return (
    <FactoryPage pageId="agency-seo-blogs" template="dashboard" sourceScope="agency_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">SEO 博客</h1>
          <p className="mt-1 text-sm text-slate-500">围绕当前客户与计划生成可发布的 SEO 内容</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Sparkles className="mr-2 h-4 w-4" />AI 批量生成</Button>
          <Button className="bg-violet-600 hover:bg-violet-700"><Plus className="mr-2 h-4 w-4" />手动创建</Button>
        </div>
      </div>

      <div data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Card data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">文章总数</div><div className="text-2xl font-bold">{seoBlogs.length}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">已发布</div><div className="text-2xl font-bold text-emerald-600">{seoBlogs.filter((b) => b.status === "published").length}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">总阅读量</div><div className="text-2xl font-bold">{seoBlogs.reduce((s, b) => s + b.views, 0).toLocaleString()}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">AI 占比</div><div className="text-2xl font-bold text-violet-600">60%</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {orderedBlogs.map((blog) => (
          <Card key={blog.id} className="border-slate-200 transition hover:shadow-md">
            <CardContent className="p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
                    <FileText className="h-4 w-4 text-violet-600" />
                  </div>
                  <Badge className={`${statusMap[blog.status].cls} hover:${statusMap[blog.status].cls}`}>
                    {statusMap[blog.status].label}
                  </Badge>
                </div>
                {blog.author.includes("AI") ? (
                  <Badge variant="outline" className="border-violet-200 text-[10px] text-violet-600">
                    <Sparkles className="mr-1 h-2.5 w-2.5" /> AI
                  </Badge>
                ) : null}
              </div>
              <h4 className="mb-2 line-clamp-2 font-semibold text-slate-900">{sanitizeDisplayText(blog.title, "未命名文章")}</h4>
              <div className="mb-2 text-xs text-violet-600">{blog.site}</div>
              <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>{blog.words} 字</span>
                <span>{blog.author}</span>
                <span className="ml-auto flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {blog.views.toLocaleString()}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">{blog.publishedAt !== "-" ? `发布时间：${blog.publishedAt}` : "未发布"}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      </div>
    </FactoryPage>
  );
}
