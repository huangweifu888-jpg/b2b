export type PlatformLevel = "hq" | "agency" | "sub_agency" | "client" | "project";

export interface PlatformLevelDefinition {
  key: PlatformLevel;
  label: string;
  description: string;
  canCreate: PlatformLevel[];
}

export interface PlatformRoleBlueprint {
  scope: PlatformLevel;
  key: string;
  label: string;
  permissions: string[];
}

export interface PlatformLanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
  region: string;
}

export const PLATFORM_LEVELS: PlatformLevelDefinition[] = [
  {
    key: "hq",
    label: "\u603B\u90E8\u540E\u53F0",
    description: "\u7EDF\u4E00\u7BA1\u7406\u4EE3\u7406\u4F53\u7CFB\u3001AI \u670D\u52A1\u3001\u652F\u4ED8\u3001OEM\u3001\u5957\u9910\u3001\u6743\u9650\u4E0E\u5168\u5C40\u98CE\u63A7\u3002",
    canCreate: ["agency"],
  },
  {
    key: "agency",
    label: "\u4E00\u7EA7\u4EE3\u7406",
    description: "\u7BA1\u7406\u4E0B\u7EA7\u4EE3\u7406\u3001\u5BA2\u6237\u3001\u6298\u6263\u3001\u5206\u4F63\u3001\u4E13\u5C5E\u6CE8\u518C\u94FE\u63A5\u4E0E OEM \u54C1\u724C\u3002",
    canCreate: ["sub_agency", "client"],
  },
  {
    key: "sub_agency",
    label: "\u4E8C\u7EA7/\u4E09\u7EA7\u4EE3\u7406",
    description: "\u627F\u63A5\u4E0A\u7EA7\u6388\u6743\u540E\u7EE7\u7EED\u53D1\u5C55\u5BA2\u6237\uFF0C\u5E76\u8FD0\u8425\u5404\u81EA\u8D1F\u8D23\u7684\u7AD9\u70B9\u9879\u76EE\u3002",
    canCreate: ["sub_agency", "client"],
  },
  {
    key: "client",
    label: "\u5BA2\u6237\u7AEF",
    description: "\u7BA1\u7406\u4F01\u4E1A\u81EA\u5DF1\u7684\u591A\u4E2A\u7F51\u7AD9\u9879\u76EE\u3001\u6210\u5458\u3001\u5185\u5BB9\u3001\u8BE2\u76D8\u4E0E\u8425\u9500\u6570\u636E\u3002",
    canCreate: ["project"],
  },
  {
    key: "project",
    label: "\u9879\u76EE\u8BA1\u5212",
    description: "\u6BCF\u4E2A\u72EC\u7ACB\u7AD9\u9879\u76EE\u90FD\u6709\u81EA\u5DF1\u7684\u5185\u5BB9\u3001\u7248\u672C\u3001\u6A21\u677F\u3001\u53D1\u5E03\u4E0E\u8FD0\u8425\u6570\u636E\u3002",
    canCreate: [],
  },
];

export const PLATFORM_ROLE_BLUEPRINTS: PlatformRoleBlueprint[] = [
  {
    scope: "hq",
    key: "hq_super_admin",
    label: "\u603B\u90E8\u8D85\u7EA7\u7BA1\u7406\u5458",
    permissions: [
      "hq.manage.tenants",
      "hq.manage.features",
      "hq.manage.ai",
      "hq.manage.payments",
      "hq.manage.security",
      "hq.view.all_reports",
    ],
  },
  {
    scope: "agency",
    key: "agency_admin",
    label: "\u4EE3\u7406\u7BA1\u7406\u5458",
    permissions: [
      "agency.manage.sub_agencies",
      "agency.manage.clients",
      "agency.manage.oem",
      "agency.manage.pricing",
      "agency.view.reports",
    ],
  },
  {
    scope: "sub_agency",
    key: "sub_agency_admin",
    label: "\u4E0B\u7EA7\u4EE3\u7406\u7BA1\u7406\u5458",
    permissions: [
      "sub_agency.manage.clients",
      "sub_agency.manage.invites",
      "sub_agency.view.reports",
    ],
  },
  {
    scope: "client",
    key: "client_admin",
    label: "\u5BA2\u6237\u7AEF\u7BA1\u7406\u5458",
    permissions: [
      "client.manage.projects",
      "client.manage.members",
      "client.manage.site_settings",
      "client.view.multi_project_dashboard",
    ],
  },
  {
    scope: "project",
    key: "project_operator",
    label: "\u9879\u76EE\u8FD0\u8425\u4EBA\u5458",
    permissions: [
      "project.edit.content",
      "project.use.ai_tools",
      "project.manage.inquiries",
      "project.publish.site",
    ],
  },
];

export const PLATFORM_UI_LANGUAGES: PlatformLanguageOption[] = [
  { code: "zh-CN", label: "\u7B80\u4F53\u4E2D\u6587", nativeLabel: "\u7B80\u4F53\u4E2D\u6587", region: "CN" },
  { code: "en-US", label: "\u82F1\u8BED", nativeLabel: "English", region: "US" },
  { code: "zh-TW", label: "\u7E41\u4F53\u4E2D\u6587", nativeLabel: "\u7E41\u9AD4\u4E2D\u6587", region: "TW" },
  { code: "ja-JP", label: "\u65E5\u8BED", nativeLabel: "\u65E5\u672C\u8A9E", region: "JP" },
  { code: "ko-KR", label: "\u97E9\u8BED", nativeLabel: "\uD55C\uAD6D\uC5B4", region: "KR" },
];

export const B2B_SITE_LANGUAGES: PlatformLanguageOption[] = [
  { code: "en", label: "\u82F1\u8BED", nativeLabel: "English", region: "US" },
  { code: "ru", label: "\u4FC4\u8BED", nativeLabel: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439", region: "RU" },
  { code: "de", label: "\u5FB7\u8BED", nativeLabel: "Deutsch", region: "DE" },
  { code: "fr", label: "\u6CD5\u8BED", nativeLabel: "Fran\u00E7ais", region: "FR" },
  { code: "es", label: "\u897F\u73ED\u7259\u8BED", nativeLabel: "Espa\u00F1ol", region: "ES" },
  { code: "pt", label: "\u8461\u8404\u7259\u8BED", nativeLabel: "Portugu\u00EAs", region: "PT" },
  { code: "it", label: "\u610F\u5927\u5229\u8BED", nativeLabel: "Italiano", region: "IT" },
  { code: "ar", label: "\u963F\u62C9\u4F2F\u8BED", nativeLabel: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629", region: "SA" },
  { code: "ja", label: "\u65E5\u8BED", nativeLabel: "\u65E5\u672C\u8A9E", region: "JP" },
  { code: "ko", label: "\u97E9\u8BED", nativeLabel: "\uD55C\uAD6D\uC5B4", region: "KR" },
  { code: "zh-CN", label: "\u7B80\u4F53\u4E2D\u6587", nativeLabel: "\u7B80\u4F53\u4E2D\u6587", region: "CN" },
  { code: "zh-TW", label: "\u7E41\u4F53\u4E2D\u6587", nativeLabel: "\u7E41\u9AD4\u4E2D\u6587", region: "TW" },
];

export const PLATFORM_REBUILD_PRINCIPLES = [
  "主开发语言固定为两种：Python 负责后端，TypeScript 负责前端，减少长期维护的人力分散。",
  "后端统一使用 FastAPI，承接接口、数据、权限、AI 调用、数据库与多租户逻辑。",
  "前端统一使用 React + Vite + TypeScript，承接总部、代理商、客户端三端界面、交互与响应式页面。",
  "线上主数据库优先采用 PostgreSQL，并通过 Python ORM 管理结构迁移、审计字段与租户隔离。",
  "缓存、队列、会话优先采用 Redis，并通过 Python 服务与 TypeScript 前端协同使用。",
  "部署优先采用 Python + TypeScript 可直接支持的组合，例如 Nginx + Uvicorn + Node 构建产物 + PostgreSQL + Redis。",
  "所有页面默认按全局响应式规则开发，避免小屏、窄屏和复杂表单错位，降低后续重复返工。",
  "后台平台与已发布网站建议分离部署，避免后台异常直接影响线上网站访问。",
  "全部核心业务按组织树与项目树建模，避免总部、代理商、客户端之间内容串用。",
  "AI 供应商、模型、密钥、配额全部走统一配置中心，不把密钥硬编码进仓库。",
];
