import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { platformApi, type AIAssignmentResolution } from "@/lib/platform-api";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";

type Props = {
  siteId?: string | null;
  compact?: boolean;
};

function toneByType(type: string) {
  if (type === "client") return "bg-sky-100 text-sky-700 hover:bg-sky-100";
  if (type === "agency" || type === "sub_agency") return "bg-violet-100 text-violet-700 hover:bg-violet-100";
  if (type === "hq") return "bg-amber-100 text-amber-700 hover:bg-amber-100";
  return "bg-slate-100 text-slate-700 hover:bg-slate-100";
}

function shortScopeLabel(data: AIAssignmentResolution | null, fallback: string) {
  if (!data?.resolved) return fallback;
  const type =
    data.matched_org_type === "client"
      ? "客户"
      : data.matched_org_type === "agency" || data.matched_org_type === "sub_agency"
        ? "代理"
        : data.matched_org_type === "hq"
          ? "总部"
          : "全局";
  const code = sanitizeDisplayText(data.matched_org_code, "");
  return `${type}${code ? ` ${code}` : ""}`;
}

export default function SiteAIAssignmentBadges({ siteId, compact = false }: Props) {
  const [chatScope, setChatScope] = useState<AIAssignmentResolution | null>(null);
  const [serviceScope, setServiceScope] = useState<AIAssignmentResolution | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!siteId) {
      setChatScope(null);
      setServiceScope(null);
      return;
    }

    async function load() {
      try {
        const [chat, service] = await Promise.all([
          platformApi.resolveAIAssignment({ appKey: "ai-chat", siteId }),
          platformApi.resolveAIAssignment({ appKey: "ai-customer-service", siteId }),
        ]);
        if (!mounted) return;
        setChatScope(chat);
        setServiceScope(service);
      } catch {
        if (!mounted) return;
        setChatScope(null);
        setServiceScope(null);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [siteId]);

  const wrapperClass = compact ? "mt-2 flex flex-wrap gap-2" : "mt-3 flex flex-wrap gap-2";

  return (
    <div className={wrapperClass}>
      <Badge className={toneByType(chatScope?.matched_org_type || "")}>
        AI 建站 {shortScopeLabel(chatScope, "未解析")}
      </Badge>
      <Badge className={toneByType(serviceScope?.matched_org_type || "")}>
        智能客服 {shortScopeLabel(serviceScope, "未解析")}
      </Badge>
    </div>
  );
}
