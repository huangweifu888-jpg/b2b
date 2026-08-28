import { createPageLayoutContractDraft, findPageLayoutContract, type PageLayoutContract } from "@/lib/page-layout-contract";

export type NewPageLayoutGuide = {
  route: string;
  source: "registered" | "suggested";
  sharedFrame: readonly ["topbar", "workspace", "title", "footer", "scrollbar"];
  header: "tableHeader" | "cardHeader";
  content: "list" | "form" | "dashboard";
  pluginPositions: readonly ["visual", "actions", "status"];
  workflow: readonly ["确认共享框架", "配置页面内容", "配置插件并验证"];
  protection: "content-and-business-data-stay-page-owned";
  registration: "registered" | "needs-registration";
  contractDraft: PageLayoutContract;
};

/** Read-only guidance; business data and downstream custom data always remain page-owned. */
export function buildNewPageLayoutGuide(pathname: string, search = ""): NewPageLayoutGuide {
  const route = `${pathname}${search}`;
  const registered = findPageLayoutContract(route);
  const searchText = route.toLowerCase();
  const content = /domain|site-settings|form|setting/.test(searchText)
    ? "form"
    : /summary|dashboard|report/.test(searchText)
      ? "dashboard"
      : "list";

  return {
    route,
    source: registered ? "registered" : "suggested",
    sharedFrame: registered?.sharedFrame ?? ["topbar", "workspace", "title", "footer", "scrollbar"],
    header: content === "form" ? "cardHeader" : "tableHeader",
    content,
    pluginPositions: registered?.pluginGroups ?? ["visual", "actions", "status"],
    workflow: ["确认共享框架", "配置页面内容", "配置插件并验证"],
    protection: "content-and-business-data-stay-page-owned",
    registration: registered ? "registered" : "needs-registration",
    contractDraft: registered ?? createPageLayoutContractDraft(route),
  };
}

/** A page must be registered before it can become part of a global frame sync. */
export function canSyncRegisteredPageGlobally(pathname: string, search = "") {
  return Boolean(findPageLayoutContract(`${pathname}${search}`));
}
