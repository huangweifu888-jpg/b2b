import { useEffect, useState } from "react";
import { Sparkles, Video } from "lucide-react";
import { InfluenceGovernance } from "@/components/social/InfluenceGovernance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSiteById } from "@/lib/sites";
import { DEFAULT_SOCIAL_PLAN_SETTINGS, readSocialPlanSettings, socialVideoTaskStorageKey, type SocialPlanSettings } from "./social-tab-shared";

type LocalVideoTask = { id: string; title: string; language: string; style: string; avatar: string; status: "script_draft" | "waiting_render"; createdAt: string };

export default function SocialDigitalHumanTab({ siteId }: { siteId?: string | null }) {
  const [selectedAvatar, setSelectedAvatar] = useState("Emma - 商务款");
  const [language, setLanguage] = useState("en");
  const [videoStyle, setVideoStyle] = useState("promo");
  const [script, setScript] = useState("");
  const [localVideos, setLocalVideos] = useState<LocalVideoTask[]>([]);
  const [videoNotice, setVideoNotice] = useState("");
  const [planSettings, setPlanSettings] = useState<SocialPlanSettings>(DEFAULT_SOCIAL_PLAN_SETTINGS);
  const influenceProjectId = siteId ? getSiteById(siteId)?.planId ?? null : null;

  useEffect(() => {
    const nextSettings = readSocialPlanSettings(siteId);
    setPlanSettings(nextSettings);
    setLanguage(nextSettings.primaryLanguage === "zh-CN" ? "zh" : "en");
  }, [siteId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(socialVideoTaskStorageKey(siteId));
      const parsed = raw ? JSON.parse(raw) : [];
      setLocalVideos(Array.isArray(parsed) ? parsed.filter((item): item is LocalVideoTask => Boolean(item && typeof item.id === "string" && typeof item.title === "string" && typeof item.language === "string" && typeof item.style === "string" && typeof item.avatar === "string" && (item.status === "script_draft" || item.status === "waiting_render"))) : []);
    } catch {
      setLocalVideos([]);
    }
  }, [siteId]);

  const saveLocalVideos = (next: LocalVideoTask[]) => {
    setLocalVideos(next);
    try { window.localStorage.setItem(socialVideoTaskStorageKey(siteId), JSON.stringify(next)); } catch { /* keep current-session task visible */ }
  };

  const createVideoTask = () => {
    const title = script.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!title) { setVideoNotice("请先填写脚本，再创建视频渲染任务。"); return; }
    const task = { id: `video-${Date.now()}`, title, language, style: videoStyle, avatar: selectedAvatar, status: "waiting_render" as const, createdAt: new Date().toISOString() };
    saveLocalVideos([task, ...localVideos]);
    setVideoNotice("视频渲染任务已保存到当前计划；云端视频引擎接入前不会生成或上传视频。");
  };

  const avatars = [
    { name: "Emma - 商务款", lang: "英/中/日", style: "专业讲解", thumb: "bg-gradient-to-br from-purple-200 to-pink-200" },
    { name: "Alex - 活力款", lang: "英/西/法", style: "年轻活泼", thumb: "bg-gradient-to-br from-sky-200 to-cyan-200" },
    { name: "Mia - 优雅款", lang: "英/中/韩", style: "时尚优雅", thumb: "bg-gradient-to-br from-rose-200 to-amber-200" },
    { name: "Ken - 技术款", lang: "英/德/中", style: "理性介绍", thumb: "bg-gradient-to-br from-emerald-200 to-teal-200" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">选择数字人形象</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {avatars.map((a) => (
              <button type="button" key={a.name} onClick={() => setSelectedAvatar(a.name)} className={`overflow-hidden rounded-lg border text-left transition-colors ${selectedAvatar === a.name ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-400"}`}>
                <div className={`aspect-square ${a.thumb} flex items-center justify-center`}>
                  <Video className="w-10 h-10 text-slate-600" />
                </div>
                <div className="p-3">
                  <div className="text-sm font-medium text-slate-900">{a.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{a.style}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{a.lang}</div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">脚本生成</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-slate-600">当前计划语言：{planSettings.primaryLanguage === "zh-CN" ? "简体中文" : planSettings.primaryLanguage === "bilingual" ? "中英双语（默认英文，可切换）" : "英文"}。视频生成仅保存渲染任务，云端引擎接入前不会生成文件。</p>
            <div className="grid grid-cols-2 gap-2">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder="语言" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="ko">한국어</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                </SelectContent>
              </Select>
              <Select value={videoStyle} onValueChange={setVideoStyle}>
                <SelectTrigger>
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="promo">产品推广</SelectItem>
                  <SelectItem value="intro">品牌介绍</SelectItem>
                  <SelectItem value="tutorial">使用教程</SelectItem>
                  <SelectItem value="news">企业动态</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              rows={5}
              value={script}
              onChange={(event) => setScript(event.target.value)}
              placeholder="输入产品信息或直接输入脚本..."
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setVideoNotice("AI 脚本服务尚未接入；请先人工填写脚本，保存为当前计划的待渲染视频任务。")}>
                <Sparkles className="w-4 h-4 mr-1" /> AI 生成脚本
              </Button>
              <Button className="flex-1 bg-blue-600 text-white" onClick={createVideoTask}>
                <Video className="w-4 h-4 mr-1" /> 生成视频
              </Button>
            </div>
            {videoNotice ? <p className="text-sm text-blue-700" role="status">{videoNotice}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">视频库</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {localVideos.map((video) => (
                <div key={video.id} className="flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50/40 p-2">
                  <div className="w-14 h-10 rounded bg-blue-700 flex items-center justify-center"><Video className="w-4 h-4 text-white" /></div>
                  <div className="flex-1 min-w-0"><div className="text-sm font-medium text-slate-900 truncate">{video.title}</div><div className="text-xs text-slate-500">{video.language} · {video.avatar}</div></div>
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">待接入渲染服务</Badge>
                </div>
              ))}
              {localVideos.length === 0 ? <div className="rounded-md border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">当前计划还没有视频任务。填写脚本后创建待渲染任务；真实视频文件需要云端渲染服务接入。</div> : null}
            </div>
          </CardContent>
        </Card>
      </div>
      {influenceProjectId ? <InfluenceGovernance projectId={influenceProjectId} /> : null}
    </div>
  );
}
