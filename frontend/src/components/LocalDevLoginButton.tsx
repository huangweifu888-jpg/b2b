import { Loader2, LogIn, LogOut } from "lucide-react";
import { useState, type CSSProperties } from "react";

import { authApi, isLocalDemoAuthEnabled } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

type LocalDemoScope = "hq" | "agency" | "client";

type LocalDemoLoginResponse = {
  token: string;
  expires_at?: number | null;
};

const scopeLabels: Record<LocalDemoScope, string> = {
  hq: "总部端",
  agency: "代理端",
  client: "客户端",
};

type LocalDevLoginButtonProps = {
  scope: LocalDemoScope;
  className?: string;
  style?: CSSProperties;
};

/**
 * Temporary account-free login for localhost development.  The corresponding
 * backend route is unavailable in production and only accepts loopback calls.
 */
export default function LocalDevLoginButton({ scope, className, style }: LocalDevLoginButtonProps) {
  const [working, setWorking] = useState(false);
  const [signedIn, setSignedIn] = useState(() => Boolean(authApi.getStoredToken()));

  if (!isLocalDemoAuthEnabled()) return null;

  const handleClick = async () => {
    if (signedIn) {
      authApi.clearSession();
      window.location.reload();
      return;
    }

    setWorking(true);
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/v1/auth/local/demo-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      if (!response.ok) {
        throw new Error(response.status === 404 ? "本地空登录只在本机开发环境开放" : "空登录暂时不可用");
      }

      const session = (await response.json()) as LocalDemoLoginResponse;
      if (!session.token) throw new Error("空登录未返回会话令牌");

      authApi.persistSession(session.token, session.expires_at);
      setSignedIn(true);
      window.location.reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "空登录暂时不可用");
    } finally {
      setWorking(false);
    }
  };

  const label = working ? "正在进入..." : signedIn ? "退出空登录" : `${scopeLabels[scope]}空登录`;

  return (
    <button
      type="button"
      className={className || "app-toolbar-chip h-9 shrink-0 gap-1.5 px-3 py-1.5"}
      style={style}
      title={signedIn ? "清除当前本地演示会话" : "无需账号，仅限本机开发环境"}
      onClick={() => void handleClick()}
      disabled={working}
    >
      {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : signedIn ? <LogOut className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
      <span className="whitespace-nowrap text-xs font-medium">{label}</span>
    </button>
  );
}
