import { Crown, Home, Sparkles } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

/**
 * Unified platform switcher shown at the bottom-left of each sidebar.
 * Lets users jump between the three platforms: client / agency / HQ.
 */
export default function PlatformSwitcher({
  variant = "light",
  isCollapsed = false,
}: {
  variant?: "light" | "dark";
  isCollapsed?: boolean;
}) {
  const loc = useLocation();
  const isHQ = loc.pathname.startsWith("/zb");
  const isAgency = loc.pathname.startsWith("/dl");
  const isClient = !isHQ && !isAgency;

  const entries = [
    {
      to: "/kh",
      label: "客户端",
      icon: Home,
      active: isClient,
      gradient: "from-blue-500 to-sky-500",
    },
    {
      to: "/dl",
      label: "代理端",
      icon: Sparkles,
      active: isAgency,
      gradient: "from-violet-500 to-fuchsia-500",
    },
    {
      to: "/zb",
      label: "总部端",
      icon: Crown,
      active: isHQ,
      gradient: "from-cyan-500 via-teal-500 to-emerald-500",
    },
  ];

  const baseBorder = variant === "dark" ? "border-slate-800" : "border-slate-200";
  const labelColor = variant === "dark" ? "text-slate-500" : "text-slate-400";

  return (
    <div className={`space-y-1 border-t p-3 ${baseBorder}`}>
      {!isCollapsed && (
        <div className={`px-1 pb-1 text-[9px] font-semibold uppercase tracking-wider ${labelColor}`}>
          平台切换
        </div>
      )}
      {entries.map((entry) => {
        const Icon = entry.icon;
        if (entry.active) {
          if (isCollapsed) {
            return (
              <div
                key={entry.to}
                className={`flex items-center justify-center rounded-md bg-gradient-to-r p-2 text-white shadow-sm ${entry.gradient}`}
                title={`${entry.label} (当前)`}
              >
                <Icon className="h-4 w-4" />
              </div>
            );
          }
          return (
            <div
              key={entry.to}
              className={`flex items-center gap-2 rounded-md bg-gradient-to-r px-2.5 py-2 text-xs font-semibold text-white shadow-sm ${entry.gradient}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {entry.label}
              <span className="ml-auto text-[9px] opacity-80">当前</span>
            </div>
          );
        }

        const inactiveClassName =
          variant === "dark"
            ? "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900";

        if (isCollapsed) {
          return (
            <NavLink
              key={entry.to}
              to={entry.to}
              className={`flex items-center justify-center rounded-md p-2 ${inactiveClassName}`}
              title={entry.label}
            >
              <Icon className="h-4 w-4" />
            </NavLink>
          );
        }

        return (
          <NavLink
            key={entry.to}
            to={entry.to}
            className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-xs ${inactiveClassName}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {entry.label}
          </NavLink>
        );
      })}
    </div>
  );
}
