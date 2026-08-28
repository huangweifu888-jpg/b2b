import { type ReactNode, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Boxes,
  CheckCircle2,
  Code2,
  Copy,
  Database,
  ExternalLink,
  FileCode2,
  GitBranch,
  HardDriveDownload,
  Layers3,
  LockKeyhole,
  Network,
  Server,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDisplayOrdinal } from "@/lib/display-number-contract";
import "./source-deployment-workbench.css";

export type DeploymentRoleDirectory = {
  id: string;
  name: string;
  label: string;
  path: string;
  summary: string;
  contains: string[];
  excludes: string[];
};

export type DeploymentServerAssignment = {
  server: string;
  roles: string[];
  summary: string;
};

export type DeploymentProfile = {
  serverCount: number;
  label: string;
  recommendedFor: string;
  assignments: DeploymentServerAssignment[];
  externalBackupRequired: boolean;
};

type DeploymentFlowValue = string | string[];

export type DeploymentHealthCheck = string | {
  name?: string;
  type?: string;
  target?: string;
  expected?: string;
};

export type DeploymentRollbackPolicy = string | {
  strategy?: string;
  retainVersions?: number;
  requireHealthCheck?: boolean;
  restoreData?: boolean;
};

export type DeploymentRoleDefinition = {
  id: string;
  name: string;
  label: string;
  purpose?: string;
  rulePath?: string;
  definitionFile?: string;
  sourceIncludes?: string[];
  include?: string[];
  sourceExcludes?: string[];
  exclude?: string[];
  dependencies?: string[];
  dependsOn?: string[];
  artifactRoot?: string;
  artifactPath?: string;
  environmentTemplate?: string;
  healthChecks?: DeploymentHealthCheck[];
  deployOrder?: number;
  rollbackPolicy?: DeploymentRollbackPolicy;
};

export type DeploymentReleaseFlowStep = {
  id: string;
  order: number;
  title: string;
  description: string;
  input?: DeploymentFlowValue;
  actions?: DeploymentFlowValue;
  output?: DeploymentFlowValue;
  gate?: DeploymentFlowValue;
  rollback?: DeploymentFlowValue;
};

export type DeploymentGlobalReleaseFlow = {
  version?: string;
  title?: string;
  description?: string;
  sourceFile?: string;
  steps: DeploymentReleaseFlowStep[];
};

export type ModuleArchitectureStrategy = {
  id?: string;
  repositoryModel?: string;
  migrationRule?: string;
  applicationDirectoryRule?: string;
};

export type ModuleArchitectureProductSource = {
  file?: string;
  authority?: string;
  categoryCount?: number;
  applicationCount?: number;
  owns?: string[];
};

export type ModuleArchitectureMigrationPhase = {
  id?: string;
  implementationMovesAllowed?: boolean;
  legacyAdaptersRequired?: boolean;
  nextGate?: string;
};

export type ModuleArchitectureCategory = {
  id?: string;
  order?: string | number;
  directory?: string;
  physicalState?: string;
};

export type ModuleArchitectureLegacyMapping = {
  legacyModuleId?: string;
  targetKind?: string;
  targetId?: string;
  migrationState?: string;
};

export type ModuleArchitecturePilotApplication = {
  id?: string;
  categoryId?: string;
  directory?: string;
  manifest?: string;
  legacyModuleId?: string;
  migrationState?: string;
  implementationMoved?: boolean;
};

export type ModuleArchitectureComposition = {
  id?: string;
  file?: string;
  mode?: string;
};

export type ModuleArchitectureDeploymentBoundary = {
  moduleMeaning?: string;
  shellMeaning?: string;
  roleMeaning?: string;
  roleIds?: string[];
  artifactPolicy?: string;
  serverScalingPolicy?: string;
};

export type ModuleArchitecturePrinciple = {
  id?: string;
  rule?: string;
};

export type ModuleArchitectureResolvedPaths = {
  contractFile?: string;
  productSourceOfTruth?: string;
  technicalCatalog?: string;
  categoriesRoot?: string;
  shellCompositionsRoot?: Record<string, string> | string;
  compositionsById?: Record<string, string>;
  pilotManifestById?: Record<string, string>;
};

export type DeploymentModuleArchitecture = {
  available?: boolean;
  sourceFile?: string;
  contractVersion?: string;
  strategy?: ModuleArchitectureStrategy | string;
  productSourceOfTruth?: ModuleArchitectureProductSource | string;
  technicalCatalogFile?: string;
  categoriesRoot?: string;
  shellCompositionsRoot?: Record<string, string> | string;
  migrationPhase?: ModuleArchitectureMigrationPhase | string;
  categories?: ModuleArchitectureCategory[];
  legacyMappings?: ModuleArchitectureLegacyMapping[];
  pilotApplications?: ModuleArchitecturePilotApplication[];
  compositions?: ModuleArchitectureComposition[];
  deploymentBoundary?: ModuleArchitectureDeploymentBoundary | string;
  principles?: Array<ModuleArchitecturePrinciple | string>;
  resolvedPaths?: ModuleArchitectureResolvedPaths;
  errors?: string[];
};

export type DeploymentWorkspaceInfo = {
  softwareRoot: string;
  sourceRoot: string;
  frontendRoot: string;
  backendRoot: string;
  localRuntimeRoot: string;
  localDataRoot: string;
  deploymentProfilesRoot: string;
  activeDatabaseFile?: string;
  assetResourceRoot?: string;
  websiteRoot?: string;
  backupRoot?: string;
  pathConfigFile?: string;
  deploymentRoleDefinitionsRoot?: string;
  globalReleaseFlowFile?: string;
  roleDefinitions?: DeploymentRoleDefinition[];
  globalReleaseFlow?: DeploymentGlobalReleaseFlow;
  moduleArchitecture?: DeploymentModuleArchitecture | null;
  module_architecture?: DeploymentModuleArchitecture | null;
  roleDirectories: DeploymentRoleDirectory[];
  deploymentProfiles: DeploymentProfile[];
};

type WorkbenchMode = "developer" | "visual" | "contract";

type SourceDeploymentWorkbenchProps = {
  workspace: DeploymentWorkspaceInfo | null;
  status: string;
  developerEditor: ReactNode;
  onOpenPath: (path?: string) => void;
  onCopyPath: (path?: string) => void;
};

type CoreWorkspaceItem = {
  id: string;
  name: string;
  role: string;
  path?: string;
  summary: string;
  usage: string;
  deployment: string;
  cleanup: string;
  icon: typeof FileCode2;
  tone: string;
};

type WorkbenchRole = DeploymentRoleDirectory & {
  rulePath?: string;
  sourceIncludes: string[];
  sourceExcludes: string[];
  dependencies: string[];
  artifactRoot?: string;
  environmentTemplate?: string;
  healthChecks: DeploymentHealthCheck[];
  deployOrder?: number;
  rollbackPolicy?: DeploymentRollbackPolicy;
};

type DeploymentHandbookChapterId =
  | "directory"
  | "roles"
  | "package"
  | "flow"
  | "profiles"
  | "principles";

const HANDBOOK_CHAPTERS: Array<{
  id: DeploymentHandbookChapterId;
  number: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: typeof BookOpen;
}> = [
  {
    id: "directory",
    number: "一",
    title: "目录规则",
    shortTitle: "目录规则",
    description: "区分唯一源码、角色交付区、本地数据、本地运行时和总说明。",
    icon: BookOpen,
  },
  {
    id: "roles",
    number: "二",
    title: "七个角色规则",
    shortTitle: "七角色",
    description: "固定每个角色的职责、规则文件、依赖和发布产物目录。",
    icon: Layers3,
  },
  {
    id: "package",
    number: "三",
    title: "发布包结构",
    shortTitle: "发布包",
    description: "说明版本成品的目标目录、必要内容、禁止内容和不可变原则。",
    icon: Boxes,
  },
  {
    id: "flow",
    number: "四",
    title: "完整发布流程",
    shortTitle: "发布流程",
    description: "以唯一六步流程完成预检、构建、审核、部署、验收和回滚。",
    icon: Workflow,
  },
  {
    id: "profiles",
    number: "五",
    title: "1–7 台服务器组合",
    shortTitle: "服务器组合",
    description: "服务器数量只改变角色放置方式，不改变源码和租户数据边界。",
    icon: Network,
  },
  {
    id: "principles",
    number: "六",
    title: "必须固定的管理原则",
    shortTitle: "管理原则",
    description: "固化源码、版本、密钥、数据、租户、备份、路径和回滚红线。",
    icon: ShieldCheck,
  },
];

const RELEASE_PACKAGE_CONTENTS = [
  "按角色白名单编译的运行产物",
  "外部环境变量模板与启动说明",
  "角色依赖、部署顺序和健康检查说明",
  "数据库迁移说明（仅在本版本需要时）",
  "回滚策略与上一版本切换说明",
  "manifest、源码版本和 SHA256 校验值",
];

const RELEASE_PACKAGE_EXCLUDES = [
  "local-data 与 local-runtime",
  "node_modules、测试结果、日志和 PID",
  ".env、密钥、生产地址和真实凭据",
  "数据库文件、客户上传素材和备份载荷",
];

const FIXED_MANAGEMENT_PRINCIPLES = [
  ["唯一源码", "只在 00-platform-source 开发；外部 01—07 不是第二套源码。"],
  ["角色固定、组合可变", "七个角色职责保持固定；1—7 台方案只改变角色落在哪台服务器。"],
  ["配方与成品分离", "deployment 保存角色和组合规则，外部 releases/<version> 只保存生成成品。"],
  ["发布包白名单", "只收集 sourceIncludes，并强制执行 sourceExcludes；不允许整目录复制。"],
  ["版本不可变", "成品生成并校验后禁止手工修改；修复必须回到 00 重新生成新版本。"],
  ["配置与密钥外置", "服务器地址、数据库连接和密钥只由部署环境注入，不写入源码、镜像或说明。"],
  ["租户数据隔离", "代理链、客户和计划必须携带完整租户上下文，数据库统一治理但逻辑隔离。"],
  ["素材与备份分层", "素材扫描后进入私有库；正式备份必须使用独立凭据和不同故障域。"],
  ["只部署所选角色", "服务器只接收当前方案需要的角色版本包，禁止上传整个 00、local-data 或 local-runtime。"],
  ["路径必须可迁移", "页面和脚本从 PathRegistry 与工作区接口读取路径，禁止在源码内写死电脑盘符。"],
  ["先验收后生效", "健康检查、业务冒烟和恢复证据未通过时立即回滚，禁止在服务器直接修源码。"],
  ["dry-run 不是发布", "发布计划生成器只输出只读计划；未正式构建、审核和部署前，不代表角色包已经生成或上传。"],
] as const;

const MODULE_ARCHITECTURE_MODE_GUIDANCE: Record<WorkbenchMode, {
  title: string;
  description: string;
}> = {
  developer: {
    title: "开发器：一个应用只有一个实现归属",
    description: "新增和迁移代码按“前端、后端、契约、测试、说明”完整垂直切片推进；总部端、代理源、客户源只引用稳定应用 ID，不复制实现。",
  },
  visual: {
    title: "可视化：业务目录、端侧组合、服务器角色分层编排",
    description: "12 类技术目录负责业务归属，三端 composition 负责功能与权限组合，01—07 只负责把选中的运行制品放到服务器。",
  },
  contract: {
    title: "共享契约：先固定边界，再逐步迁移实现",
    description: "模块之间只通过共享契约、API 或事件协作；旧入口在迁移期保留兼容适配器，通过门禁后才允许移动真实实现。",
  },
};

const MODULE_BOUNDARY_GUIDANCE = [
  {
    id: "module",
    number: "01",
    title: "modules · 开发边界",
    description: "独立负责人、业务实现、数据归属、契约与测试；一个可复用能力只保留一份源码。",
    icon: Boxes,
  },
  {
    id: "shell",
    number: "02",
    title: "三端 composition · 组合边界",
    description: "总部端、代理源、客户源以及运行端只声明启用应用、使用模式、顺序和权限，不复制模块实现。",
    icon: Layers3,
  },
  {
    id: "role",
    number: "03",
    title: "01—07 · 部署边界",
    description: "根据服务器组合生成不可变角色制品；服务器接收角色包，不接收可编辑源码目录或手工模块副本。",
    icon: Server,
  },
] as const;

const PROGRESSIVE_MODULE_MIGRATION_STAGES = [
  ["01", "冻结事实源", "固定 12 类、应用 ID、路由和旧 11 模块映射，禁止边搬边改口径。"],
  ["02", "契约与清单", "先建立机器目录、应用 manifest、端侧 composition 和验证门禁，不制造空项目文件夹。"],
  ["03", "单应用试点", "只选一个边界清晰的应用建立垂直切片；先保留旧入口和兼容适配器。"],
  ["04", "通过迁移门禁", "前端、API、权限、数据、测试、回滚和三端组合全部通过后，才移动实现。"],
  ["05", "按分类渐进迁移", "一次只迁一个真实应用，旧引用归零后再清理兼容层，不做 72 应用一次性搬家。"],
  ["06", "收紧角色发布包", "构建器按 composition 和 01—07 角色白名单生成制品，只上传目标服务器需要的角色包。"],
] as const;

const INDEPENDENT_APPLICATION_CRITERIA = [
  "稳定应用 ID 与明确负责人",
  "独立页面、API 或事件入口",
  "独立权限与租户上下文规则",
  "明确的数据表或数据所有权",
  "独立测试、验收和回滚证据",
  "可以独立启用、升级或停用",
] as const;

const MODULE_CATEGORY_LABELS: Record<string, string> = {
  identity: "身份",
  content: "内容",
  trust: "信任",
  recommend: "推荐",
  deepen: "深耕",
  portrait: "画像",
  lead: "截流",
  convert: "转化",
  fulfillment: "履约",
  care: "伴护",
  decision: "决策",
  operations: "经营",
};

const MODULE_COMPOSITION_LABELS: Record<string, string> = {
  "zbcx.headquarters": "总部端",
  "zbcx.agency-source": "代理源",
  "zbcx.client-source": "客户源",
  "dlcx.agency-runtime": "代理端",
  "khcs.client-runtime": "客户端/计划",
};

const MODULE_COMPOSITION_MODE_LABELS: Record<string, string> = {
  govern: "治理",
  publish: "发布",
  configure: "配置",
  operate: "运营",
  use: "使用",
};

const MODULE_STATE_LABELS: Record<string, string> = {
  "catalog-only": "仅技术清单",
  "pilot-manifest": "试点契约",
  "manifest-only": "仅建立契约",
  "compatibility-only": "兼容映射",
};

const MODES: Array<{
  id: WorkbenchMode;
  label: string;
  eyebrow: string;
  description: string;
  icon: typeof Code2;
}> = [
  {
    id: "developer",
    label: "开发器",
    eyebrow: "SOURCE DEVELOPER",
    description: "管理唯一源码、七个角色和部署配置",
    icon: Code2,
  },
  {
    id: "visual",
    label: "可视化",
    eyebrow: "VISUAL ORCHESTRATION",
    description: "编排 1—7 台服务器和运行链路",
    icon: Workflow,
  },
  {
    id: "contract",
    label: "共享契约",
    eyebrow: "SHARED CONTRACT",
    description: "固化发布、租户、数据与恢复边界",
    icon: ShieldCheck,
  },
];

const CONTRACTS = [
  {
    id: "source",
    title: "唯一源码契约",
    icon: FileCode2,
    tone: "cyan",
    summary: "所有角色包和服务器组合引用同一份平台源码，不复制第二套业务代码。",
    rules: ["frontend/backend 是唯一可编辑源", "角色目录只保存配置、清单、脚本和说明", "运行数据、密钥、素材、备份不进入程序镜像"],
  },
  {
    id: "release",
    title: "双分支发布契约",
    icon: GitBranch,
    tone: "violet",
    summary: "总部基线分别流向代理链和客户计划链，运行端不得反向覆盖总部模板源。",
    rules: ["总部源 → 代理源 → 代理端", "总部源 → 客户源 → 客户端 → 客户端计划", "发布前记录版本、影响范围和回滚点"],
  },
  {
    id: "tenant",
    title: "多租户隔离契约",
    icon: LockKeyhole,
    tone: "emerald",
    summary: "多代理、多级代理、多客户和多计划共用平台能力，但所有请求必须带完整租户上下文。",
    rules: ["代理链：agency_path", "客户边界：client_id", "计划边界：plan_id；跨租户访问默认拒绝"],
  },
  {
    id: "data",
    title: "数据与素材契约",
    icon: Database,
    tone: "blue",
    summary: "数据库统一治理、逻辑隔离；素材按隔离区、私有库、公开派生物分层保存。",
    rules: ["生产数据库通过 DATABASE_URL 接入", "普通代理、客户、计划不各复制一套数据库", "上传素材扫描通过后才进入私有素材库"],
  },
  {
    id: "recovery",
    title: "备份恢复契约",
    icon: HardDriveDownload,
    tone: "rose",
    summary: "备份可以统一调度，但必须独立存储，并按租户和计划维度验证恢复。",
    rules: ["数据库、素材、配置分别备份", "正式备份必须跨故障域保存", "每次大版本发布前执行可恢复性检查"],
  },
] as const;

const TONE_CLASSES = {
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
  violet: "border-violet-200 bg-violet-50 text-violet-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  blue: "border-blue-200 bg-blue-50 text-blue-800",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
};

const FALLBACK_GLOBAL_RELEASE_STEPS: DeploymentReleaseFlowStep[] = [
  {
    id: "preflight",
    order: 1,
    title: "发布预检",
    description: "检查源码锁、类型、共享契约、租户边界、数据库迁移与恢复点。",
    output: "可发布或明确阻断原因",
    gate: "所有强制检查通过",
  },
  {
    id: "profile",
    order: 2,
    title: "选择服务器方案",
    description: "按当前规模选择 1—7 台服务器档位，只改变角色组合，不复制源码。",
    input: "部署规模与容量需求",
    output: "服务器—角色分配表",
  },
  {
    id: "build",
    order: 3,
    title: "生成角色包",
    description: "从 00 唯一源码读取角色规则，分别生成 01—07 的版本化发布成品。",
    output: "角色发布包、清单和校验值",
    gate: "敏感文件与本机数据不得进入成品",
  },
  {
    id: "impact",
    order: 4,
    title: "查看影响",
    description: "确认版本、角色、依赖、数据库迁移、环境变量以及上一版回滚位置。",
    input: "本次角色包与变更清单",
    output: "可审核的发布影响报告",
  },
  {
    id: "deploy",
    order: 5,
    title: "发布部署",
    description: "只把目标服务器需要的角色版本包上传，注入生产配置后按依赖顺序启动。",
    gate: "版本、校验值和目标角色完全匹配",
    rollback: "保留上一版本，不覆盖历史成品",
  },
  {
    id: "verify",
    order: 6,
    title: "健康检查与回滚",
    description: "验证总部、代理、客户计划、任务、入口、数据与灾备链路；失败立即回滚。",
    output: "发布验收记录或回滚记录",
    rollback: "恢复上一程序版本，并按迁移说明恢复数据",
  },
];

function roleTone(roleId: string) {
  const tones: Record<string, string> = {
    "01": "border-emerald-200 bg-emerald-50 text-emerald-800",
    "02": "border-violet-200 bg-violet-50 text-violet-800",
    "03": "border-sky-200 bg-sky-50 text-sky-800",
    "04": "border-amber-200 bg-amber-50 text-amber-800",
    "05": "border-cyan-200 bg-cyan-50 text-cyan-800",
    "06": "border-blue-200 bg-blue-50 text-blue-800",
    "07": "border-rose-200 bg-rose-50 text-rose-800",
  };
  return tones[roleId] || tones["01"];
}

function normalizeRoleId(value: string | undefined, index: number) {
  const match = value?.match(/(?:^|\D)(0[1-7])(?:\D|$)/u);
  return match?.[1] || String(index + 1).padStart(2, "0");
}

function getWorkbenchRoles(workspace: DeploymentWorkspaceInfo | null): WorkbenchRole[] {
  const directories = workspace?.roleDirectories || [];
  const definitions = workspace?.roleDefinitions || [];

  if (!definitions.length) {
    return directories.map((directory) => ({
      ...directory,
      sourceIncludes: directory.contains || [],
      sourceExcludes: directory.excludes || [],
      dependencies: [],
      artifactRoot: directory.path,
      healthChecks: [],
    }));
  }

  return definitions.map((definition, index) => {
    const id = normalizeRoleId(definition.id || definition.name, index);
    const directory = directories.find((item) => item.id === id);
    const rulePath = definition.definitionFile || definition.rulePath;
    const sourceIncludes = definition.sourceIncludes ?? definition.include ?? directory?.contains ?? [];
    const sourceExcludes = definition.sourceExcludes ?? definition.exclude ?? directory?.excludes ?? [];

    return {
      id,
      name: definition.name || directory?.name || `role-${id}`,
      label: definition.label || directory?.label || `部署角色 ${id}`,
      path: directory?.path || rulePath || "",
      summary: definition.purpose || directory?.summary || "该角色的发布规则已由工作区载入。",
      contains: sourceIncludes,
      excludes: sourceExcludes,
      rulePath,
      sourceIncludes,
      sourceExcludes,
      dependencies: definition.dependencies ?? definition.dependsOn ?? [],
      artifactRoot: definition.artifactPath || definition.artifactRoot || directory?.path,
      environmentTemplate: definition.environmentTemplate,
      healthChecks: definition.healthChecks || [],
      deployOrder: definition.deployOrder,
      rollbackPolicy: definition.rollbackPolicy,
    };
  });
}

function flowValueItems(value?: DeploymentFlowValue) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function formatRollbackPolicy(policy?: DeploymentRollbackPolicy) {
  if (!policy) return "工作区待读取";
  if (typeof policy === "string") return policy;
  return [
    policy.strategy,
    policy.retainVersions == null ? undefined : `保留 ${policy.retainVersions} 个版本`,
    policy.requireHealthCheck == null ? undefined : policy.requireHealthCheck ? "回切后必须健康检查" : "不强制健康检查",
    policy.restoreData == null ? undefined : policy.restoreData ? "需要恢复数据" : "不自动恢复数据",
  ].filter(Boolean).join(" · ") || "工作区待读取";
}

function formatHealthCheck(check: DeploymentHealthCheck) {
  if (typeof check === "string") return check;
  return [
    check.name,
    check.type ? `[${check.type}]` : undefined,
    check.target,
    check.expected ? `期望：${check.expected}` : undefined,
  ].filter(Boolean).join(" · ") || "未命名健康检查";
}

function findAssignmentRole(
  assignmentRole: string,
  roleDirectories: DeploymentRoleDirectory[],
) {
  const normalized = assignmentRole.toLowerCase();
  return roleDirectories.find((role) =>
    normalized.startsWith(role.id) ||
    normalized.includes(role.name.toLowerCase()) ||
    normalized.includes(role.label.toLowerCase()),
  );
}

function getCoreWorkspaceItems(workspace: DeploymentWorkspaceInfo | null): CoreWorkspaceItem[] {
  const softwareRoot = workspace?.softwareRoot?.replace(/[\\/]+$/u, "");
  const separator = softwareRoot?.includes("\\") ? "\\" : "/";
  const readmePath = softwareRoot ? `${softwareRoot}${separator}README.md` : undefined;

  return [
    {
      id: "platform-source",
      name: "00-platform-source",
      role: "唯一可编辑源码",
      path: workspace?.sourceRoot,
      summary: "总部端、代理源、客户源共用的前后端代码、测试、迁移、蓝图与部署配置唯一来源。",
      usage: "日常开发、可视化保存、共享契约更新、测试与构建只在这里完成。",
      deployment: "不直接整目录复制到服务器；由它构建出 01–07 角色所需的受控发布包。",
      cleanup: "必须保留；只清理经验证可重建的构建缓存，不能删除源码、迁移或部署配置。",
      icon: FileCode2,
      tone: "border-cyan-200 bg-cyan-50 text-cyan-900",
    },
    {
      id: "local-data",
      name: "local-data",
      role: "本地沙盘数据",
      path: workspace?.localDataRoot,
      summary: "保存本机 SQLite 沙盘库、私有上传素材、站点预览、迁移暂存与本地恢复演练数据。",
      usage: "仅供开发、测试、上传素材验证和恢复演练；按租户、客户与计划边界使用。",
      deployment: "不进入程序镜像，也不能作为生产数据库或正式备份直接上线。",
      cleanup: "可按测试批次清理可再生暂存；数据库、素材和恢复点必须先核对归属并备份。",
      icon: Database,
      tone: "border-blue-200 bg-blue-50 text-blue-900",
    },
    {
      id: "local-runtime",
      name: "local-runtime",
      role: "可重建本地运行环境",
      path: workspace?.localRuntimeRoot,
      summary: "保存 Node/Python 运行时、依赖、启动日志、进程 PID 与仅限本机的开发密钥。",
      usage: "通过 Start-LocalSandbox.ps1 启动 3003 前端、8000 后端和 3004 网站预览。",
      deployment: "不进入服务器镜像；目标服务器按角色部署清单独立安装运行时、依赖和环境变量。",
      cleanup: "可重建；不要手动删除正在使用的依赖、日志或 PID，先停止本地沙盘后再维护。",
      icon: Server,
      tone: "border-amber-200 bg-amber-50 text-amber-900",
    },
    {
      id: "workspace-readme",
      name: "README.md",
      role: "本地目录总说明",
      path: readmePath,
      summary: "记录本机目录总图、1–7 台服务器职责、启动入口、发布边界与备份原则。",
      usage: "换电脑、交接、恢复沙盘或准备部署前，先按此文件确认目录和操作入口。",
      deployment: "作为运维说明随源码和发布清单留存，不作为运行程序或业务数据处理。",
      cleanup: "必须保留并随目录规划更新；禁止把密码、密钥、生产地址或真实备份写入其中。",
      icon: BookOpen,
      tone: "border-violet-200 bg-violet-50 text-violet-900",
    },
  ];
}

type JsonRecord = Record<string, unknown>;

type NormalizedModuleArchitecture = {
  available: boolean;
  sourceFile?: string;
  contractVersion?: string;
  strategy: {
    id?: string;
    repositoryModel?: string;
    migrationRule?: string;
    applicationDirectoryRule?: string;
  };
  productSource: {
    file?: string;
    authority?: string;
    categoryCount?: number;
    applicationCount?: number;
    owns: string[];
  };
  technicalCatalogFile?: string;
  categoriesRoot?: string;
  shellCompositionRoots: Array<{ id: string; path: string }>;
  migrationPhase: {
    id?: string;
    implementationMovesAllowed?: boolean;
    legacyAdaptersRequired?: boolean;
    nextGate?: string;
  };
  categories: Array<{
    id: string;
    order: string;
    directory?: string;
    physicalState?: string;
  }>;
  legacyMappings: Array<{
    legacyModuleId: string;
    targetKind?: string;
    targetId?: string;
    migrationState?: string;
  }>;
  pilotApplications: Array<{
    id: string;
    categoryId?: string;
    directory?: string;
    manifest?: string;
    legacyModuleId?: string;
    migrationState?: string;
    implementationMoved?: boolean;
  }>;
  compositions: Array<{
    id: string;
    file?: string;
    mode?: string;
  }>;
  deploymentBoundary: {
    moduleMeaning?: string;
    shellMeaning?: string;
    roleMeaning?: string;
    roleIds: string[];
    artifactPolicy?: string;
    serverScalingPolicy?: string;
  };
  principles: Array<{ id: string; rule: string }>;
  resolvedPaths: {
    contractFile?: string;
    productSourceOfTruth?: string;
    technicalCatalog?: string;
    categoriesRoot?: string;
    shellCompositionsRoot: Record<string, string>;
    compositionsById: Record<string, string>;
    pilotManifestById: Record<string, string>;
  };
  errors: string[];
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function textValue(record: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function booleanValue(record: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    if (typeof record[key] === "boolean") return record[key] as boolean;
  }
  return undefined;
}

function numberValue(record: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function stringItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) return [item.trim()];
    if (typeof item === "number" && Number.isFinite(item)) return [String(item)];
    return [];
  });
}

function recordItems(value: unknown) {
  return Array.isArray(value) ? value.map(asRecord).filter((item) => Object.keys(item).length > 0) : [];
}

function stringMap(value: unknown) {
  const record = asRecord(value);
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, item]) =>
      typeof item === "string" && item.trim() ? [[key, item.trim()]] : [],
    ),
  );
}

function normalizeModuleArchitecture(workspace: DeploymentWorkspaceInfo | null): NormalizedModuleArchitecture {
  const raw = asRecord(workspace?.moduleArchitecture ?? workspace?.module_architecture);
  const strategyValue = raw.strategy;
  const strategy = asRecord(strategyValue);
  const productValue = raw.productSourceOfTruth ?? raw.product_source_of_truth;
  const productSource = asRecord(productValue);
  const phaseValue = raw.migrationPhase ?? raw.migration_phase;
  const migrationPhase = asRecord(phaseValue);
  const deploymentValue = raw.deploymentBoundary ?? raw.deployment_boundary;
  const deploymentBoundary = asRecord(deploymentValue);
  const resolvedPaths = asRecord(raw.resolvedPaths ?? raw.resolved_paths);
  const categories = recordItems(raw.categories).map((category, index) => ({
    id: textValue(category, "id", "key", "categoryId", "category_id") || `category-${index + 1}`,
    order: textValue(category, "order", "sequence") || formatDisplayOrdinal(index + 1),
    directory: textValue(category, "directory", "technicalDirectory", "technical_directory", "folder"),
    physicalState: textValue(category, "physicalState", "physical_state", "status"),
  })).sort((left, right) => left.order.localeCompare(right.order));
  const legacyMappings = recordItems(raw.legacyMappings ?? raw.legacy_mappings).map((mapping, index) => ({
    legacyModuleId: textValue(mapping, "legacyModuleId", "legacy_module_id", "legacy", "source") || `legacy-${index + 1}`,
    targetKind: textValue(mapping, "targetKind", "target_kind", "kind"),
    targetId: textValue(mapping, "targetId", "target_id", "target"),
    migrationState: textValue(mapping, "migrationState", "migration_state", "status"),
  }));
  const pilotApplications = recordItems(raw.pilotApplications ?? raw.pilot_applications).map((pilot, index) => ({
    id: textValue(pilot, "id", "applicationId", "application_id") || `pilot-${index + 1}`,
    categoryId: textValue(pilot, "categoryId", "category_id", "category"),
    directory: textValue(pilot, "directory", "path"),
    manifest: textValue(pilot, "manifest", "manifestFile", "manifest_file"),
    legacyModuleId: textValue(pilot, "legacyModuleId", "legacy_module_id"),
    migrationState: textValue(pilot, "migrationState", "migration_state", "status"),
    implementationMoved: booleanValue(pilot, "implementationMoved", "implementation_moved"),
  }));
  const compositions = recordItems(raw.compositions).map((composition, index) => ({
    id: textValue(composition, "id", "key", "shell") || `composition-${index + 1}`,
    file: textValue(composition, "file", "path", "configFile", "config_file"),
    mode: textValue(composition, "mode", "role"),
  }));
  const principles = Array.isArray(raw.principles)
    ? raw.principles.flatMap((principle, index) => {
      if (typeof principle === "string" && principle.trim()) {
        return [{ id: `principle-${index + 1}`, rule: principle.trim() }];
      }
      const item = asRecord(principle);
      const rule = textValue(item, "rule", "description", "summary");
      return rule ? [{ id: textValue(item, "id", "key") || `principle-${index + 1}`, rule }] : [];
    })
    : [];
  const shellRootsValue = raw.shellCompositionsRoot ?? raw.shell_compositions_root;
  const shellRoots = typeof shellRootsValue === "string"
    ? [{ id: "shellCompositionsRoot", path: shellRootsValue }]
    : Object.entries(stringMap(shellRootsValue)).map(([id, path]) => ({ id, path }));
  const sourceFile = textValue(raw, "sourceFile", "source_file");
  const contractVersion = textValue(raw, "contractVersion", "contract_version");
  const explicitAvailability = booleanValue(raw, "available");

  return {
    available: explicitAvailability ?? Boolean(sourceFile || contractVersion || categories.length || compositions.length),
    sourceFile,
    contractVersion,
    strategy: {
      id: typeof strategyValue === "string" ? strategyValue : textValue(strategy, "id", "name"),
      repositoryModel: textValue(strategy, "repositoryModel", "repository_model"),
      migrationRule: textValue(strategy, "migrationRule", "migration_rule"),
      applicationDirectoryRule: textValue(strategy, "applicationDirectoryRule", "application_directory_rule"),
    },
    productSource: {
      file: typeof productValue === "string" ? productValue : textValue(productSource, "file", "path"),
      authority: textValue(productSource, "authority"),
      categoryCount: numberValue(productSource, "categoryCount", "category_count"),
      applicationCount: numberValue(productSource, "applicationCount", "application_count"),
      owns: stringItems(productSource.owns),
    },
    technicalCatalogFile: textValue(raw, "technicalCatalogFile", "technical_catalog_file"),
    categoriesRoot: textValue(raw, "categoriesRoot", "categories_root"),
    shellCompositionRoots: shellRoots,
    migrationPhase: {
      id: typeof phaseValue === "string" ? phaseValue : textValue(migrationPhase, "id", "name"),
      implementationMovesAllowed: booleanValue(migrationPhase, "implementationMovesAllowed", "implementation_moves_allowed"),
      legacyAdaptersRequired: booleanValue(migrationPhase, "legacyAdaptersRequired", "legacy_adapters_required"),
      nextGate: textValue(migrationPhase, "nextGate", "next_gate"),
    },
    categories,
    legacyMappings,
    pilotApplications,
    compositions,
    deploymentBoundary: {
      moduleMeaning: typeof deploymentValue === "string" ? deploymentValue : textValue(deploymentBoundary, "moduleMeaning", "module_meaning"),
      shellMeaning: textValue(deploymentBoundary, "shellMeaning", "shell_meaning"),
      roleMeaning: textValue(deploymentBoundary, "roleMeaning", "role_meaning"),
      roleIds: stringItems(deploymentBoundary.roleIds ?? deploymentBoundary.role_ids),
      artifactPolicy: textValue(deploymentBoundary, "artifactPolicy", "artifact_policy"),
      serverScalingPolicy: textValue(deploymentBoundary, "serverScalingPolicy", "server_scaling_policy"),
    },
    principles,
    resolvedPaths: {
      contractFile: textValue(resolvedPaths, "contractFile", "contract_file") || sourceFile,
      productSourceOfTruth: textValue(resolvedPaths, "productSourceOfTruth", "product_source_of_truth"),
      technicalCatalog: textValue(resolvedPaths, "technicalCatalog", "technical_catalog"),
      categoriesRoot: textValue(resolvedPaths, "categoriesRoot", "categories_root"),
      shellCompositionsRoot: stringMap(resolvedPaths.shellCompositionsRoot ?? resolvedPaths.shell_compositions_root),
      compositionsById: stringMap(resolvedPaths.compositionsById ?? resolvedPaths.compositions_by_id),
      pilotManifestById: stringMap(resolvedPaths.pilotManifestById ?? resolvedPaths.pilot_manifest_by_id),
    },
    errors: stringItems(raw.errors),
  };
}

function moduleStateLabel(value?: string) {
  if (!value) return "状态未提供";
  return MODULE_STATE_LABELS[value] || value.replace(/[-_]+/gu, " ");
}

function PathActions({
  path,
  onCopyPath,
  onOpenPath,
}: {
  path?: string;
  onCopyPath: (path?: string) => void;
  onOpenPath: (path?: string) => void;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 px-2 text-xs"
        onClick={() => onCopyPath(path)}
        disabled={!path}
      >
        <Copy className="mr-1 h-3.5 w-3.5" />复制
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-8 bg-cyan-600 px-2 text-xs hover:bg-cyan-700"
        onClick={() => onOpenPath(path)}
        disabled={!path}
      >
        <ExternalLink className="mr-1 h-3.5 w-3.5" />打开
      </Button>
    </div>
  );
}

function ArchitecturePathCard({
  id,
  label,
  path,
  resolvedPath,
  onCopyPath,
  onOpenPath,
}: {
  id: string;
  label: string;
  path?: string;
  resolvedPath?: string;
  onCopyPath: (path?: string) => void;
  onOpenPath: (path?: string) => void;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5" data-module-architecture-path={id}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold text-slate-500">{label}</div>
          <div className="mt-1 break-all font-mono text-[10px] leading-4 text-slate-700">{path || "工作区契约暂未提供"}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onCopyPath(path)}
            disabled={!path}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:text-slate-300"
            title={`复制${label}`}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onOpenPath(resolvedPath)}
            disabled={!resolvedPath}
            className="rounded p-1 text-cyan-700 hover:bg-cyan-50 disabled:text-slate-300"
            title={resolvedPath ? `打开${label}` : `${label}的已解析路径暂未提供`}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function SourceDeploymentWorkbench({
  workspace,
  status,
  developerEditor,
  onOpenPath,
  onCopyPath,
}: SourceDeploymentWorkbenchProps) {
  const [mode, setMode] = useState<WorkbenchMode>("developer");
  const [selectedRoleId, setSelectedRoleId] = useState("01");
  const [selectedServerCount, setSelectedServerCount] = useState(5);
  const [handbookChapterId, setHandbookChapterId] = useState<DeploymentHandbookChapterId>("directory");

  const roles = useMemo(() => getWorkbenchRoles(workspace), [workspace]);
  const profiles = useMemo(
    () => workspace?.deploymentProfiles || [],
    [workspace?.deploymentProfiles],
  );
  const globalReleaseFlow = workspace?.globalReleaseFlow;
  const releaseFlowSteps = useMemo(() => {
    const steps = globalReleaseFlow?.steps?.length
      ? globalReleaseFlow.steps
      : FALLBACK_GLOBAL_RELEASE_STEPS;
    return [...steps].sort((left, right) => left.order - right.order);
  }, [globalReleaseFlow]);
  const globalReleaseFlowFile = globalReleaseFlow?.sourceFile || workspace?.globalReleaseFlowFile;
  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) || roles[0],
    [roles, selectedRoleId],
  );
  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.serverCount === selectedServerCount) || profiles[0],
    [profiles, selectedServerCount],
  );
  const coreWorkspaceItems = useMemo(() => getCoreWorkspaceItems(workspace), [workspace]);
  const moduleArchitecture = useMemo(() => normalizeModuleArchitecture(workspace), [workspace]);
  const moduleArchitectureStatus = !moduleArchitecture.available
    ? "legacy-fallback"
    : moduleArchitecture.errors.length
      ? "degraded"
      : "ready";
  const architectureModeGuidance = MODULE_ARCHITECTURE_MODE_GUIDANCE[mode];
  const architecturePaths = useMemo(() => [
    {
      id: "contract",
      label: "模块架构机器契约",
      path: moduleArchitecture.sourceFile,
      resolvedPath: moduleArchitecture.resolvedPaths.contractFile,
    },
    {
      id: "product-source",
      label: "产品事实源",
      path: moduleArchitecture.productSource.file,
      resolvedPath: moduleArchitecture.resolvedPaths.productSourceOfTruth,
    },
    {
      id: "technical-catalog",
      label: "12 类技术目录清单",
      path: moduleArchitecture.technicalCatalogFile,
      resolvedPath: moduleArchitecture.resolvedPaths.technicalCatalog,
    },
    {
      id: "categories-root",
      label: "真实模块迁移根目录",
      path: moduleArchitecture.categoriesRoot,
      resolvedPath: moduleArchitecture.resolvedPaths.categoriesRoot,
    },
    ...moduleArchitecture.shellCompositionRoots.map((item) => ({
      id: `composition-root-${item.id}`,
      label: `端侧组合根 · ${item.id}`,
      path: item.path,
      resolvedPath: moduleArchitecture.resolvedPaths.shellCompositionsRoot[item.id],
    })),
  ], [moduleArchitecture]);
  const handbookChapter = HANDBOOK_CHAPTERS.find((chapter) => chapter.id === handbookChapterId) || HANDBOOK_CHAPTERS[0];
  const artifactSeparator = selectedRole?.artifactRoot?.includes("\\") ? "\\" : "/";
  const selectedVersionArtifactRoot = selectedRole?.artifactRoot
    ? `${selectedRole.artifactRoot.replace(/[\\/]+$/u, "")}${artifactSeparator}<version>`
    : "../<role-directory>/releases/<version>";

  const openRoleInDeveloper = (roleId: string) => {
    setSelectedRoleId(roleId);
    setMode("developer");
  };

  return (
    <div className="space-y-5" data-development-workbench data-workbench-mode={mode}>
      <section
        id="source-deployment-hero"
        className="w-full overflow-hidden rounded-2xl border border-slate-800 text-white shadow-xl shadow-slate-200/50"
        data-responsive-semantic-band="page-context"
      >
        <div
          className="source-deployment-hero__intro border-b border-white/10 px-5 py-5 sm:px-6"
        >
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
                <Layers3 className="h-4 w-4" />Headquarters source & deployment
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">源码与部署中心</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                一份平台源码、七个固定部署角色、七档服务器组合。开发、编排与治理使用同一份共享契约。
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["1", "唯一源码"],
                [String(roles.length || 7), "固定角色"],
                [String(profiles.length || 7), "部署档位"],
              ].map(([value, label]) => (
                <div key={label} className="min-w-[82px] rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                  <div className="text-lg font-bold text-cyan-300">{value}</div>
                  <div className="mt-0.5 text-[10px] text-slate-400">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          id="source-deployment-mode-grid"
          className="grid gap-2 p-2 md:grid-cols-3"
          aria-label="源码与部署工作模式"
        >
          {MODES.map((item) => {
            const Icon = item.icon;
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                data-workbench-mode-tab={item.id}
                onClick={() => setMode(item.id)}
                className={cn(
                  "group flex min-w-0 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                  active
                    ? "border-cyan-400/50 bg-cyan-400/10 shadow-inner"
                    : "border-transparent bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.06]",
                )}
              >
                <span className={cn("rounded-lg p-2", active ? "bg-cyan-400 text-slate-950" : "bg-white/10 text-slate-300")}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-semibold", active ? "text-white" : "text-slate-200")}>{item.label}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-400">{item.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        data-module-architecture
        data-module-architecture-status={moduleArchitectureStatus}
        data-module-architecture-mode={mode}
      >
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-950">
              <GitBranch className="h-4 w-4 text-cyan-600" />
              渐进模块化实施看板
              <span className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                moduleArchitectureStatus === "ready"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : moduleArchitectureStatus === "degraded"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-amber-200 bg-amber-50 text-amber-700",
              )} data-module-architecture-availability>
                {moduleArchitectureStatus === "ready" ? "机器契约已载入" : moduleArchitectureStatus === "degraded" ? "契约部分异常" : "兼容旧接口"}
              </span>
              {moduleArchitecture.contractVersion ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-500">
                  v{moduleArchitecture.contractVersion}
                </span>
              ) : null}
            </div>
            <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-600">
              推荐结构已经采用：单一源码仓库、独立业务模块、三端组合配置、01—07 角色发布包。当前采用兼容适配器渐进迁移，绝不把总部端、代理源、客户源复制成三套实现。
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2 text-[10px] font-semibold">
            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-cyan-800" data-module-category-count>
              技术分类 {moduleArchitecture.categories.length || moduleArchitecture.productSource.categoryCount || "待读取"}
            </span>
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-violet-800" data-module-application-count>
              产品应用 {moduleArchitecture.productSource.applicationCount ?? "待读取"}
            </span>
            <span className="max-w-full break-all rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800" data-module-migration-phase>
              当前阶段 {moduleArchitecture.migrationPhase.id || "工作区契约待读取"}
            </span>
          </div>
        </div>

        {!moduleArchitecture.available ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800" data-module-architecture-fallback>
            当前本地接口尚未返回 moduleArchitecture；页面继续使用原有源码与部署功能，不伪造目录、路径或迁移状态。后端契约可用后会自动显示真实清单。
          </div>
        ) : null}

        {moduleArchitecture.errors.length ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] leading-5 text-rose-800" data-module-architecture-errors>
            <div className="font-bold">机器契约载入异常</div>
            <ul className="mt-1 space-y-1">
              {moduleArchitecture.errors.map((error) => <li key={error} className="break-words">· {error}</li>)}
            </ul>
          </div>
        ) : null}

        <div
          className="mt-4 min-w-0 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-cyan-950"
          data-module-architecture-mode-guidance={mode}
        >
          <div className="text-xs font-bold">{architectureModeGuidance.title}</div>
          <p className="mt-1 text-[11px] leading-5 text-cyan-800">{architectureModeGuidance.description}</p>
        </div>

        <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-3" data-module-boundaries>
          {MODULE_BOUNDARY_GUIDANCE.map((boundary) => {
            const Icon = boundary.icon;
            const contractMeaning = boundary.id === "module"
              ? moduleArchitecture.deploymentBoundary.moduleMeaning
              : boundary.id === "shell"
                ? moduleArchitecture.deploymentBoundary.shellMeaning
                : moduleArchitecture.deploymentBoundary.roleMeaning;
            return (
              <article key={boundary.id} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5" data-module-boundary={boundary.id}>
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-[10px] font-bold text-cyan-300">{boundary.number}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-950"><Icon className="h-3.5 w-3.5 text-cyan-600" />{boundary.title}</div>
                    <p className="mt-1 text-[10px] leading-5 text-slate-600">{boundary.description}</p>
                  </div>
                </div>
                <div className="mt-3 break-words rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-[9px] leading-4 text-slate-500">
                  {contractMeaning || "机器契约暂未提供此边界代码"}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] leading-5 text-rose-900" data-no-source-copy-rule>
          <strong>禁止三端复制：</strong>总部端、代理源、客户源是组合和权限投影，不是三套源码；代理、客户和计划只保存隔离数据、配置、模板与覆盖层，不生成源码分叉。
        </div>

        <div className="mt-4 grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
          <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5" data-module-technical-catalog>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-950"><Boxes className="h-4 w-4 text-cyan-600" />12 类技术目录</div>
                <p className="mt-1 text-[10px] leading-5 text-slate-500">目录名用于排序和代码归属；只有出现真实负责人、契约、测试和迁移工作时才创建物理目录。</p>
              </div>
              <span className="w-fit shrink-0 rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-500">不创建空目录</span>
            </div>
            {moduleArchitecture.categories.length ? (
              <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {moduleArchitecture.categories.map((category) => (
                  <article key={category.id} className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5" data-module-category={category.id} data-module-category-state={category.physicalState || "unknown"}>
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold text-slate-400">{category.order} · {MODULE_CATEGORY_LABELS[category.id] || category.id}</div>
                        <div className="mt-1 break-all font-mono text-[11px] font-bold text-slate-800">{category.directory || category.id}</div>
                      </div>
                      <span className={cn(
                        "shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-bold",
                        category.physicalState === "pilot-manifest"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500",
                      )}>{moduleStateLabel(category.physicalState)}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-5 text-center text-[11px] text-slate-500" data-module-category-empty>
                旧接口未返回技术分类清单；不在前端伪造12个目录。
              </div>
            )}
          </div>

          <aside className="min-w-0 space-y-3">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5" data-module-architecture-paths>
              <div className="text-xs font-bold text-slate-950">机器契约与真实路径</div>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">显示契约返回的可移植路径；“打开”只使用后端已校验的解析路径，不在前端拼接盘符。</p>
              <div className="mt-3 space-y-2">
                {architecturePaths.map((item) => (
                  <ArchitecturePathCard
                    key={item.id}
                    {...item}
                    onCopyPath={onCopyPath}
                    onOpenPath={onOpenPath}
                  />
                ))}
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-950 p-3.5 text-white" data-module-deployment-policy>
              <div className="flex items-center gap-2 text-xs font-bold"><Server className="h-4 w-4 text-cyan-300" />服务器上传边界</div>
              <p className="mt-2 text-[10px] leading-5 text-slate-300">上线时由 00 构建角色制品，只上传目标服务器需要的 01—07 版本包；不上传整个可编辑源码、不手工复制模块目录。</p>
              {moduleArchitecture.deploymentBoundary.artifactPolicy ? <div className="mt-3 break-words rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 font-mono text-[9px] leading-4 text-cyan-100">{moduleArchitecture.deploymentBoundary.artifactPolicy}</div> : null}
              {moduleArchitecture.deploymentBoundary.serverScalingPolicy ? <div className="mt-2 break-words rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 font-mono text-[9px] leading-4 text-slate-300">{moduleArchitecture.deploymentBoundary.serverScalingPolicy}</div> : null}
            </div>
          </aside>
        </div>

        <div className="mt-4 grid min-w-0 gap-3 xl:grid-cols-2">
          <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5" data-module-compositions>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-950"><Layers3 className="h-4 w-4 text-violet-600" />三端与运行端组合清单</div>
            <p className="mt-1 text-[10px] leading-5 text-slate-500">这些文件只引用稳定分类/应用 ID 和使用模式，不能包含业务实现副本。</p>
            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
              {moduleArchitecture.compositions.map((composition) => {
                const resolvedPath = moduleArchitecture.resolvedPaths.compositionsById[composition.id];
                return (
                  <article key={composition.id} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5" data-module-composition={composition.id}>
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold text-slate-800">{MODULE_COMPOSITION_LABELS[composition.id] || composition.id}</div>
                        <div className="mt-0.5 break-all font-mono text-[9px] text-slate-500">{composition.file || "组合文件待读取"}</div>
                      </div>
                      <button type="button" disabled={!resolvedPath} onClick={() => onOpenPath(resolvedPath)} className="shrink-0 rounded p-1 text-cyan-700 hover:bg-cyan-50 disabled:text-slate-300" title={resolvedPath ? "打开组合文件" : "已解析路径暂未提供"}><ArrowUpRight className="h-3.5 w-3.5" /></button>
                    </div>
                    <span className="mt-2 inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[9px] font-bold text-violet-700" data-module-composition-mode={composition.mode || "unknown"}>{composition.mode ? MODULE_COMPOSITION_MODE_LABELS[composition.mode] || composition.mode : "模式待读取"}</span>
                  </article>
                );
              })}
              {!moduleArchitecture.compositions.length ? <div className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-[10px] text-slate-500 sm:col-span-2">组合清单待读取</div> : null}
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5" data-module-pilots>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-950"><CheckCircle2 className="h-4 w-4" />试点应用与当前门禁</div>
            <div className="mt-3 space-y-2">
              {moduleArchitecture.pilotApplications.map((pilot) => {
                const resolvedManifest = moduleArchitecture.resolvedPaths.pilotManifestById[pilot.id];
                return (
                  <article key={pilot.id} className="min-w-0 rounded-lg border border-emerald-200 bg-white/80 p-3" data-module-pilot={pilot.id} data-module-implementation-moved={String(pilot.implementationMoved ?? false)}>
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="break-all font-mono text-[11px] font-bold text-emerald-950">{pilot.id}</div>
                        <div className="mt-1 text-[10px] leading-4 text-emerald-800">旧模块 {pilot.legacyModuleId || "待读取"} · {moduleStateLabel(pilot.migrationState)}</div>
                      </div>
                      <button type="button" disabled={!resolvedManifest} onClick={() => onOpenPath(resolvedManifest)} className="shrink-0 rounded p-1 text-emerald-700 hover:bg-emerald-100 disabled:text-emerald-200" title={resolvedManifest ? "打开试点 manifest" : "已解析路径暂未提供"}><ArrowUpRight className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="mt-2 break-all rounded-lg border border-emerald-100 bg-emerald-50/70 px-2 py-1.5 font-mono text-[9px] leading-4 text-emerald-800">{pilot.manifest || pilot.directory || "试点路径待读取"}</div>
                    <div className="mt-2 text-[10px] font-semibold text-emerald-900">真实实现：{pilot.implementationMoved ? "已移动" : "尚未移动，继续通过旧实现兼容运行"}</div>
                  </article>
                );
              })}
              {!moduleArchitecture.pilotApplications.length ? <div className="rounded-lg border border-dashed border-emerald-300 bg-white/60 px-3 py-4 text-center text-[10px] text-emerald-700">试点应用待读取</div> : null}
            </div>
            <dl className="mt-3 grid gap-2 text-[10px] sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-200 bg-white/70 p-2"><dt className="font-bold text-emerald-700">允许移动实现</dt><dd className="mt-1 text-emerald-950" data-module-implementation-moves-allowed>{moduleArchitecture.migrationPhase.implementationMovesAllowed === true ? "是" : moduleArchitecture.migrationPhase.implementationMovesAllowed === false ? "否" : "待读取"}</dd></div>
              <div className="rounded-lg border border-emerald-200 bg-white/70 p-2"><dt className="font-bold text-emerald-700">兼容适配器</dt><dd className="mt-1 text-emerald-950" data-module-legacy-adapters-required>{moduleArchitecture.migrationPhase.legacyAdaptersRequired === true ? "必须保留" : moduleArchitecture.migrationPhase.legacyAdaptersRequired === false ? "不要求" : "待读取"}</dd></div>
              <div className="rounded-lg border border-emerald-200 bg-white/70 p-2"><dt className="font-bold text-emerald-700">下一门禁</dt><dd className="mt-1 break-all font-mono text-emerald-950" data-module-next-gate>{moduleArchitecture.migrationPhase.nextGate || "待读取"}</dd></div>
            </dl>
          </div>
        </div>

        <div className="mt-4 min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5" data-module-legacy-mappings>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-950"><GitBranch className="h-4 w-4 text-amber-600" />旧 11 模块兼容映射</div>
              <p className="mt-1 text-[10px] leading-5 text-slate-500">旧清单继续作为兼容入口；映射不是复制，也不代表实现已经移动。产品市场属于控制平面，不强行塞入12个业务分类。</p>
            </div>
            <span className="w-fit shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700">{moduleArchitecture.legacyMappings.length || "—"} 条真实映射</span>
          </div>
          {moduleArchitecture.legacyMappings.length ? (
            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {moduleArchitecture.legacyMappings.map((mapping) => (
                <article key={mapping.legacyModuleId} className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5" data-module-legacy-mapping={mapping.legacyModuleId}>
                  <div className="flex min-w-0 items-center gap-2 font-mono text-[10px] font-bold text-slate-800">
                    <span className="min-w-0 break-all">{mapping.legacyModuleId}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span className="min-w-0 break-all text-cyan-700">{mapping.targetId || "目标待读取"}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[8px] font-bold">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-500">{mapping.targetKind || "kind unknown"}</span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-700">{moduleStateLabel(mapping.migrationState)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-5 text-center text-[10px] text-slate-500">旧接口未返回映射；页面不会自行猜测。</div>}
        </div>

        <div className="mt-4 grid min-w-0 gap-3 xl:grid-cols-2">
          <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5" data-module-migration-stages>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-950"><Workflow className="h-4 w-4 text-cyan-600" />六阶段渐进迁移</div>
            <div className="mt-3 space-y-2">
              {PROGRESSIVE_MODULE_MIGRATION_STAGES.map(([number, title, detail]) => (
                <article key={number} className="flex min-w-0 items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5" data-module-migration-stage={number}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-950 text-[9px] font-bold text-cyan-300">{number}</span>
                  <div className="min-w-0"><div className="text-[10px] font-bold text-slate-900">{title}</div><p className="mt-0.5 text-[10px] leading-4 text-slate-600">{detail}</p></div>
                </article>
              ))}
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5" data-independent-application-criteria>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-950"><ShieldCheck className="h-4 w-4 text-violet-600" />何时才建立独立应用目录</div>
            <p className="mt-1 text-[10px] leading-5 text-slate-500">满足多数边界条件再建目录；单个表格、弹窗和通用组件继续归属于现有应用。</p>
            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
              {INDEPENDENT_APPLICATION_CRITERIA.map((criterion, index) => (
                <div key={criterion} className="flex min-w-0 items-start gap-2 rounded-lg border border-violet-100 bg-violet-50/70 px-2.5 py-2 text-[10px] leading-4 text-violet-900" data-independent-application-criterion={index + 1}>
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" />{criterion}
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-5 text-amber-900">
              独立目录不等于独立服务器。只有性能、合规、故障隔离或独立发布周期形成真实证据后，才进一步拆进程、数据库或代码仓库。
            </div>
          </div>
        </div>

        {moduleArchitecture.principles.length ? (
          <div className="mt-4 min-w-0 rounded-xl border border-slate-200 bg-slate-950 p-3.5 text-white" data-module-contract-principles>
            <div className="flex items-center gap-2 text-xs font-bold"><LockKeyhole className="h-4 w-4 text-cyan-300" />机器契约固定原则</div>
            <div className="mt-3 grid min-w-0 gap-2 md:grid-cols-2">
              {moduleArchitecture.principles.map((principle) => (
                <article key={principle.id} className="min-w-0 rounded-lg border border-white/10 bg-white/5 p-2.5" data-module-principle={principle.id}>
                  <div className="break-all font-mono text-[9px] font-bold text-cyan-300">{principle.id}</div>
                  <p className="mt-1 break-words text-[10px] leading-5 text-slate-300">{principle.rule}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section
        className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        data-deployment-handbook
      >
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
              <BookOpen className="h-4 w-4 text-cyan-600" />
              部署规划长期说明书
              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-bold text-cyan-800">6 个固定章节</span>
            </div>
            <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">
              用于换电脑、交接、扩容和正式上线前核对。角色、服务器组合、流程与路径从当前工作区实时读取；规则文件变化后本页同步显示。
            </p>
          </div>
          <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[10px] leading-4 text-slate-600">
            当前软件根：<span className="break-all font-semibold text-slate-800" data-guide-path="software-root">{workspace?.softwareRoot || "工作区待读取"}</span>
          </div>
        </div>

        <div
          className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3"
          aria-label="部署规划说明目录"
          data-handbook-index
        >
          {HANDBOOK_CHAPTERS.map((chapter, chapterIndex) => {
            const Icon = chapter.icon;
            const active = chapter.id === handbookChapter.id;
            return (
              <button
                key={chapter.id}
                type="button"
                aria-pressed={active}
                data-handbook-tab={chapter.id}
                onClick={() => setHandbookChapterId(chapter.id)}
                className={cn(
                  "flex min-w-0 items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  active
                    ? "border-cyan-300 bg-cyan-50 text-cyan-950"
                    : "border-slate-200 bg-slate-50/70 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/50",
                )}
              >
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold", active ? "border-cyan-300 bg-cyan-600 text-white" : "border-slate-200 bg-white text-slate-600")}>{String(chapterIndex + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs font-bold"><Icon className="h-3.5 w-3.5" />{chapter.number}、{chapter.title}</span>
                  <span className="mt-1 block text-[10px] leading-4 opacity-75">{chapter.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="mt-4 min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4"
          data-handbook-section={handbookChapter.id}
        >
          <div className="flex min-w-0 items-start gap-3 border-b border-slate-200 pb-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-cyan-300">{handbookChapter.number}</span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-950">{handbookChapter.number}、{handbookChapter.title}</h2>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">{handbookChapter.description}</p>
            </div>
          </div>

          {handbookChapter.id === "directory" ? (
            <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" data-handbook-directory-rules data-deployment-guide-section="directory-rules">
              <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="text-xs font-bold text-slate-900">根目录固定为 11 项</div>
                <ol className="mt-3 space-y-2 text-[11px] leading-5 text-slate-600">
                  <li><strong className="text-slate-900">1 个源码：</strong>00-platform-source 是唯一开发位置，也保存角色、组合和流程“配方”。</li>
                  <li><strong className="text-slate-900">7 个角色：</strong>外部 01—07 是交付工作区，只保存规则、说明和 releases/&lt;version&gt; 成品。</li>
                  <li><strong className="text-slate-900">2 个本地区：</strong>local-data 保存本机数据，local-runtime 保存可重建运行环境，二者都不上服务器。</li>
                  <li><strong className="text-slate-900">1 份总说明：</strong>README.md 记录目录、启动、发布和备份边界，必须随规划更新。</li>
                </ol>
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-5 text-amber-800">
                  日常开发只改 00；正式发布只上传经审核的角色版本包；数据库、素材、日志、密钥和真实备份永远不混入源码包。
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    ["role-definitions-root", "七角色规则", workspace?.deploymentRoleDefinitionsRoot],
                    ["deployment-profiles-root", "1—7 台组合", workspace?.deploymentProfilesRoot],
                    ["global-release-flow-file", "六步流程", globalReleaseFlowFile],
                  ].map(([pathId, label, path]) => (
                    <div key={pathId} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                      <div className="text-[10px] font-bold text-slate-500">{label}</div>
                      <div className="mt-1 break-all font-mono text-[10px] leading-4 text-slate-700" data-guide-path={pathId}>{path || "工作区待读取"}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                {coreWorkspaceItems.map((item) => (
                  <div key={item.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3" data-handbook-directory={item.id}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs font-bold text-slate-900">{item.name}</div>
                        <div className="mt-0.5 text-[10px] font-semibold text-slate-500">{item.role}</div>
                      </div>
                      <button type="button" onClick={() => onOpenPath(item.path)} disabled={!item.path} className="shrink-0 rounded p-1 text-cyan-700 hover:bg-cyan-50 disabled:text-slate-300" title={`打开 ${item.name}`}><ArrowUpRight className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="mt-2 break-all rounded-lg bg-slate-50 px-2 py-1.5 font-mono text-[10px] leading-4 text-slate-600" data-guide-path={`directory-${item.id}`}>{item.path || "路径读取中…"}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {handbookChapter.id === "roles" ? (
            <div className="mt-4" data-handbook-role-rules data-deployment-guide-section="role-rules">
              <p className="text-[11px] leading-5 text-slate-600">七个角色编号和职责永久固定；包含/排除清单、依赖、健康检查和回滚策略以对应 YAML 为准，可在下方开发器的角色浏览器查看完整明细。</p>
              <div className="mt-3 grid min-w-0 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {roles.map((role) => (
                  <article key={role.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3" data-handbook-role={role.id}>
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold", roleTone(role.id))}>{role.id}</span>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-slate-950">{role.label}</h3>
                        <p className="mt-1 text-[10px] leading-4 text-slate-500">{role.summary}</p>
                      </div>
                    </div>
                    <dl className="mt-3 grid gap-2 text-[10px] leading-4 sm:grid-cols-2">
                      <div><dt className="font-bold text-slate-400">规则文件</dt><dd className="mt-0.5 break-all font-mono text-slate-700" data-guide-path={`role-${role.id}-rule`}>{role.rulePath || "工作区待读取"}</dd></div>
                      <div><dt className="font-bold text-slate-400">版本成品目录</dt><dd className="mt-0.5 break-all font-mono text-slate-700" data-guide-path={`role-${role.id}-artifact`}>{role.artifactRoot || "工作区待读取"}</dd></div>
                      <div><dt className="font-bold text-slate-400">依赖角色</dt><dd className="mt-0.5 break-all font-mono text-slate-700">{role.dependencies.length ? role.dependencies.join("、") : "无前置角色"}</dd></div>
                      <div><dt className="font-bold text-slate-400">部署顺序</dt><dd className="mt-0.5 font-mono text-slate-700">{role.deployOrder == null ? "工作区待读取" : role.deployOrder}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {handbookChapter.id === "package" ? (
            <div className="mt-4 grid min-w-0 gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" data-handbook-package-structure data-deployment-guide-section="release-package">
              <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-950 p-4 text-white">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">版本化发布包示例 · 角色 {selectedRole?.id || "01"}</div>
                <div className="mt-3 break-all font-mono text-[11px] leading-5 text-slate-200" data-handbook-version-artifact-root data-guide-path="selected-version-artifact-root">{selectedVersionArtifactRoot}</div>
                <div className="mt-3 space-y-1.5 border-l border-slate-700 pl-3 font-mono text-[10px] leading-4 text-slate-300">
                  {RELEASE_PACKAGE_CONTENTS.map((item, index) => <div key={item}>{index === RELEASE_PACKAGE_CONTENTS.length - 1 ? "└─" : "├─"} {item}</div>)}
                </div>
                <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[10px] leading-5 text-amber-100">这里记录正式构建后才产生的目标结构；当前 generate-release-plan.py 只是 dry-run 计划器，不创建目录、不复制文件、也不上传服务器。</div>
                <div className="mt-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[10px] leading-5 text-emerald-200">正式成品生成后不可变、禁止手工修改；修复必须回到 00 生成新版本，并保留上一版本用于原子回切。</div>
              </div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
                  <div className="text-xs font-bold text-emerald-900">发布包必须包含</div>
                  <ul className="mt-3 space-y-2 text-[10px] leading-5 text-emerald-800">
                    {RELEASE_PACKAGE_CONTENTS.map((item) => <li key={item}>· {item}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5">
                  <div className="text-xs font-bold text-rose-900">发布包禁止混入</div>
                  <ul className="mt-3 space-y-2 text-[10px] leading-5 text-rose-800">
                    {RELEASE_PACKAGE_EXCLUDES.map((item) => <li key={item}>· {item}</li>)}
                  </ul>
                </div>
              </div>
              <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 xl:col-span-2">
                <div className="text-xs font-bold text-slate-900">七个角色的正式构建目标</div>
                <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {roles.map((role) => {
                    const separator = role.artifactRoot?.includes("\\") ? "\\" : "/";
                    const versionRoot = role.artifactRoot
                      ? `${role.artifactRoot.replace(/[\\/]+$/u, "")}${separator}<version>`
                      : `../${role.name}/releases/<version>`;
                    return (
                      <div key={role.id} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5" data-handbook-package-role={role.id}>
                        <div className="text-[10px] font-bold text-slate-500">角色 {role.id} · {role.label}</div>
                        <div className="mt-1 break-all font-mono text-[10px] leading-4 text-slate-700" data-guide-path={`package-role-${role.id}`}>{versionRoot}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {handbookChapter.id === "flow" ? (
            <div className="mt-4" data-handbook-release-flow data-deployment-guide-section="release-flow">
              <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] leading-5 text-slate-600">正式发布只允许按以下六步推进；任一步门禁失败都停止，不跳步、不在服务器现场修改。</p>
                <div className="break-all font-mono text-[10px] leading-4 text-slate-500" data-guide-path="release-flow-source">{globalReleaseFlowFile || "流程路径读取中…"}</div>
              </div>
              <div className="mt-3 grid min-w-0 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {releaseFlowSteps.map((step) => {
                  const details: Array<[string, DeploymentFlowValue | undefined, string]> = [
                    ["输入", step.input, "border-slate-200 bg-slate-50 text-slate-700"],
                    ["执行", step.actions, "border-cyan-200 bg-cyan-50 text-cyan-800"],
                    ["产出", step.output, "border-emerald-200 bg-emerald-50 text-emerald-800"],
                    ["门禁", step.gate, "border-amber-200 bg-amber-50 text-amber-800"],
                    ["回滚", step.rollback, "border-rose-200 bg-rose-50 text-rose-800"],
                  ];
                  return (
                    <article key={step.id || step.order} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3" data-handbook-flow-step={step.order}>
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-[10px] font-bold text-cyan-300">{String(step.order).padStart(2, "0")}</span>
                        <div className="min-w-0"><h3 className="text-xs font-bold text-slate-950">{step.title}</h3><p className="mt-1 text-[10px] leading-4 text-slate-500">{step.description}</p></div>
                      </div>
                      <dl className="mt-3 space-y-1.5">
                        {details.map(([label, value, tone]) => {
                          const items = flowValueItems(value);
                          return items.length ? (
                            <div key={label} className={cn("min-w-0 rounded-lg border px-2.5 py-2", tone)}>
                              <dt className="text-[9px] font-bold">{label}</dt>
                              <dd className="mt-1 space-y-1 text-[10px] leading-4">{items.map((item) => <div key={item} className="break-words">{item}</div>)}</dd>
                            </div>
                          ) : null;
                        })}
                      </dl>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}

          {handbookChapter.id === "profiles" ? (
            <div className="mt-4" data-handbook-server-profiles data-deployment-guide-section="server-profiles">
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] leading-5 text-blue-800">1—6 台方案仍必须配置主服务器之外的独立备份目标；只有 7 台方案把 07 灾备角色作为专用服务器计入数量。</div>
              <div className="mt-3 grid min-w-0 gap-2 lg:grid-cols-2">
                {profiles.map((profile) => (
                  <article key={profile.serverCount} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3" data-handbook-profile={profile.serverCount}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0"><h3 className="text-xs font-bold text-slate-950">{profile.label}</h3><p className="mt-1 text-[10px] leading-4 text-slate-500">{profile.recommendedFor}</p></div>
                      <button type="button" onClick={() => { setSelectedServerCount(profile.serverCount); setMode("visual"); }} className="shrink-0 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-bold text-cyan-800 hover:bg-cyan-100">查看可视化</button>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {profile.assignments.map((assignment) => (
                        <div key={assignment.server} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[10px] leading-4 text-slate-600">
                          <span className="break-all font-mono font-bold text-slate-800">{assignment.server}</span>
                          <span className="mx-1.5 text-slate-300">→</span>
                          <span className="break-words">{assignment.roles.join(" + ")}</span>
                        </div>
                      ))}
                    </div>
                    <div className={cn("mt-2 text-[10px] font-semibold", profile.externalBackupRequired ? "text-amber-700" : "text-emerald-700")}>{profile.externalBackupRequired ? "必须另配独立异地备份" : "本方案已包含专用 07 灾备节点"}</div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {handbookChapter.id === "principles" ? (
            <div className="mt-4 grid min-w-0 gap-2 md:grid-cols-2" data-handbook-management-principles data-deployment-guide-section="management-principles">
              {FIXED_MANAGEMENT_PRINCIPLES.map(([title, detail], index) => (
                <article key={title} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3" data-management-principle={formatDisplayOrdinal(index + 1)}>
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-[10px] font-bold text-rose-700">{formatDisplayOrdinal(index + 1)}</span>
                    <div className="min-w-0"><h3 className="text-xs font-bold text-slate-950">{title}</h3><p className="mt-1 text-[10px] leading-5 text-slate-600">{detail}</p></div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {mode === "developer" ? (
        <div className="space-y-4" data-source-developer>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" data-core-workspace-map>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><Boxes className="h-4 w-4 text-cyan-600" />四个本地总入口</div>
                <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">源码、数据、运行环境与说明文档必须分开管理。这里明确每项的用途、部署边界和清理规则，防止把本地数据或运行时误打包到服务器。</p>
              </div>
              <span className="inline-flex w-fit shrink-0 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-bold text-cyan-800">4 项已整理</span>
            </div>
            <div className="mt-4 grid min-w-0 gap-3 xl:grid-cols-2">
              {coreWorkspaceItems.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.id} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5" data-core-workspace-item={item.id}>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={cn("rounded-lg border p-2", item.tone)}><Icon className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-mono text-sm font-bold text-slate-950">{item.name}</h2>
                          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", item.tone)}>{item.role}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{item.summary}</p>
                      </div>
                      <PathActions path={item.path} onCopyPath={onCopyPath} onOpenPath={onOpenPath} />
                    </div>
                    <div className="mt-3 break-all rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-[10px] leading-4 text-slate-600">{item.path || "路径读取中…"}</div>
                    <dl className="mt-3 grid gap-2 text-[11px] leading-5 sm:grid-cols-3">
                      {[
                        ["怎么用", item.usage],
                        ["怎么部署", item.deployment],
                        ["怎么清理", item.cleanup],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-slate-200 bg-white p-2.5">
                          <dt className="font-bold text-slate-500">{label}</dt>
                          <dd className="mt-1 text-slate-700">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                );
              })}
            </div>
          </section>

          <section
            className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            data-global-release-flow
          >
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
                  <Workflow className="h-4 w-4 text-cyan-600" />
                  {globalReleaseFlow?.title || "六步全局发布流程"}
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    {releaseFlowSteps.length} 步
                  </span>
                  {globalReleaseFlow?.version ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-500">
                      {globalReleaseFlow.version}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">
                  {globalReleaseFlow?.description || "00 保存唯一源码和发布规则；流程按规则生成外层 01—07 版本成品，再把目标服务器需要的角色包上线。页面路径全部来自当前工作区清单。"}
                </p>
              </div>
              <PathActions path={globalReleaseFlowFile} onCopyPath={onCopyPath} onOpenPath={onOpenPath} />
            </div>

            <div className="mt-4 grid min-w-0 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
              {[
                ["七角色规则目录", workspace?.deploymentRoleDefinitionsRoot],
                ["全局流程规则文件", globalReleaseFlowFile],
              ].map(([label, path], index) => (
                <div
                  key={label}
                  className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5"
                  data-workspace-rule-path={index === 0 ? "role-definitions-root" : "global-release-flow-file"}
                >
                  <div className="text-[10px] font-bold text-slate-500">{label}</div>
                  <div className="mt-1 break-all font-mono text-[10px] leading-4 text-slate-700">{path || "工作区暂未返回此路径"}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3" data-global-release-flow-steps>
              {releaseFlowSteps.map((step) => {
                const details: Array<[string, DeploymentFlowValue | undefined, string]> = [
                  ["输入", step.input, "border-slate-200 bg-slate-50 text-slate-700"],
                  ["执行", step.actions, "border-cyan-200 bg-cyan-50 text-cyan-800"],
                  ["产出", step.output, "border-emerald-200 bg-emerald-50 text-emerald-800"],
                  ["门禁", step.gate, "border-amber-200 bg-amber-50 text-amber-800"],
                  ["回滚", step.rollback, "border-rose-200 bg-rose-50 text-rose-800"],
                ];
                return (
                  <article
                    key={step.id || step.order}
                    className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm"
                    data-global-release-step={step.order}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-xs font-bold text-cyan-300">
                        {String(step.order).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-950">{step.title}</h3>
                        <p className="mt-1 text-[11px] leading-5 text-slate-500">{step.description}</p>
                      </div>
                    </div>
                    <dl className="mt-3 space-y-2">
                      {details.map(([label, value, tone]) => {
                        const items = flowValueItems(value);
                        return items.length ? (
                          <div key={label} className={cn("min-w-0 rounded-lg border px-2.5 py-2", tone)}>
                            <dt className="text-[10px] font-bold">{label}</dt>
                            <dd className="mt-1 space-y-1 text-[10px] leading-4">
                              {items.map((item) => <div key={item} className="break-words">{item}</div>)}
                            </dd>
                          </div>
                        ) : null;
                      })}
                    </dl>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="grid min-w-0 gap-4 xl:grid-cols-[250px_minmax(0,1fr)_300px]">
            <aside className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="px-2 pb-3">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">角色浏览器</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">选择角色查看目录职责和镜像边界</div>
              </div>
              <div className="space-y-1">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    data-deployment-role={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={cn(
                      "flex w-full min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      selectedRole?.id === role.id
                        ? "border-cyan-200 bg-cyan-50"
                        : "border-transparent hover:border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold", roleTone(role.id))}>{role.id}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-slate-900">{role.label}</span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-400">{role.name}</span>
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <main className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              {selectedRole ? (
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold", roleTone(selectedRole.id))}>角色 {selectedRole.id}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">DEPLOYMENT ROLE</span>
                      </div>
                      <h2 className="mt-3 text-xl font-bold text-slate-950">{selectedRole.label}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{selectedRole.summary}</p>
                    </div>
                    <PathActions path={selectedRole.rulePath || selectedRole.path} onCopyPath={onCopyPath} onOpenPath={onOpenPath} />
                  </div>

                  <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-950 px-3 py-2.5 text-cyan-200" data-selected-role-rule-path>
                    <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">角色规则文件</div>
                    <div className="mt-1 break-all font-mono text-[11px] leading-5">
                      {selectedRole.rulePath || selectedRole.path || "工作区暂未返回规则文件路径"}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-900"><CheckCircle2 className="h-4 w-4" />应包含</div>
                      {selectedRole.sourceIncludes.length ? (
                        <ul className="mt-3 space-y-2 font-mono text-[11px] leading-5 text-emerald-800">
                          {selectedRole.sourceIncludes.map((item) => <li key={item} className="break-all">· {item}</li>)}
                        </ul>
                      ) : <div className="mt-3 text-[11px] text-emerald-700">规则暂未声明包含项。</div>}
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-rose-900"><LockKeyhole className="h-4 w-4" />禁止混入</div>
                      {selectedRole.sourceExcludes.length ? (
                        <ul className="mt-3 space-y-2 font-mono text-[11px] leading-5 text-rose-800">
                          {selectedRole.sourceExcludes.map((item) => <li key={item} className="break-all">· {item}</li>)}
                        </ul>
                      ) : <div className="mt-3 text-[11px] text-rose-700">规则暂未声明排除项。</div>}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ["源码根目录", workspace?.sourceRoot || "工作区待读取"],
                      ["部署顺序", selectedRole.deployOrder == null ? "工作区待读取" : String(selectedRole.deployOrder)],
                      ["回滚策略", formatRollbackPolicy(selectedRole.rollbackPolicy)],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
                        <div className="mt-1 break-all text-xs font-semibold text-slate-800">{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid min-w-0 gap-3 md:grid-cols-2">
                    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">真实发布路径</div>
                      <div className="mt-3 space-y-3">
                        {[
                          ["发布产物目录", selectedRole.artifactRoot],
                          ["环境变量模板", selectedRole.environmentTemplate],
                        ].map(([label, path], index) => (
                          <div
                            key={label}
                            className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5"
                            data-selected-role-output-path={index === 0 ? "artifact-root" : "environment-template"}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="text-[10px] font-bold text-slate-500">{label}</div>
                                <div className="mt-1 break-all font-mono text-[10px] leading-4 text-slate-700">{path || "工作区暂未返回此路径"}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => onOpenPath(path)}
                                disabled={!path}
                                className="shrink-0 rounded p-1 text-cyan-700 hover:bg-cyan-50 disabled:text-slate-300"
                                title={`打开${label}`}
                              >
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">依赖与健康检查</div>
                      <div className="mt-3">
                        <div className="text-[10px] font-bold text-slate-500">依赖角色</div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {selectedRole.dependencies.length
                            ? selectedRole.dependencies.map((dependency) => (
                                <span key={dependency} className="max-w-full break-all rounded-md border border-violet-200 bg-violet-50 px-2 py-1 font-mono text-[10px] text-violet-800">{dependency}</span>
                              ))
                            : <span className="text-[11px] text-slate-500">无前置角色或工作区暂未声明。</span>}
                        </div>
                      </div>
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <div className="text-[10px] font-bold text-slate-500">健康检查</div>
                        {selectedRole.healthChecks.length ? (
                          <ul className="mt-1.5 space-y-1.5 font-mono text-[10px] leading-4 text-slate-700">
                            {selectedRole.healthChecks.map((check, index) => {
                              const formatted = formatHealthCheck(check);
                              return <li key={`${formatted}-${index}`} className="break-all">· {formatted}</li>;
                            })}
                          </ul>
                        ) : <div className="mt-1.5 text-[11px] text-slate-500">工作区暂未返回健康检查。</div>}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center text-sm text-slate-500">正在读取七个部署角色…</div>
              )}
            </main>

            <aside className="min-w-0 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><BookOpen className="h-4 w-4 text-cyan-600" />规则来源</div>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">路径由工作区实时返回；本地文件迁移后，这里随接口自动同步。</p>
                <div className="mt-4 space-y-2.5">
                  {[
                    ["角色定义目录", workspace?.deploymentRoleDefinitionsRoot],
                    ["六步流程文件", globalReleaseFlowFile],
                    ["服务器方案目录", workspace?.deploymentProfilesRoot],
                  ].map(([label, path]) => (
                    <div key={label} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-bold text-slate-500">{label}</div>
                          <div className="mt-1 break-all font-mono text-[10px] leading-4 text-slate-700">{path || "工作区待读取"}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenPath(path)}
                          disabled={!path}
                          className="shrink-0 rounded p-1 text-cyan-700 hover:bg-cyan-50 disabled:text-slate-300"
                          title={`打开${label}`}
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                <div className="text-xs font-bold text-cyan-900">当前操作状态</div>
                <div className="mt-2 break-words text-[11px] leading-5 text-cyan-800">{status || "工作区已就绪，等待操作。"}</div>
              </div>
            </aside>
          </section>

          {developerEditor}
        </div>
      ) : null}

      {mode === "visual" ? (
        <div className="space-y-4" data-visual-deployment-canvas>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><Network className="h-4 w-4 text-cyan-600" />1—7 台部署可视化</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">增加服务器只改变角色组合，不改变源码、租户归属和数据边界。</p>
              </div>
              <div className="flex flex-wrap gap-1.5" aria-label="服务器数量">
                {profiles.map((profile) => (
                  <button
                    key={profile.serverCount}
                    type="button"
                    data-server-profile={profile.serverCount}
                    onClick={() => setSelectedServerCount(profile.serverCount)}
                    className={cn(
                      "h-9 min-w-9 rounded-lg border px-3 text-xs font-bold transition-colors",
                      selectedProfile?.serverCount === profile.serverCount
                        ? "border-cyan-600 bg-cyan-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-700",
                    )}
                  >
                    {profile.serverCount} 台
                  </button>
                ))}
              </div>
            </div>
          </section>

          {selectedProfile ? (
            <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]" data-selected-server-profile={selectedProfile.serverCount}>
              <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold text-slate-950">{selectedProfile.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{selectedProfile.recommendedFor}</div>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">共享契约已接入</span>
                </div>

                <div className="grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {selectedProfile.assignments.map((assignment, index) => (
                    <article key={assignment.server} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-server-assignment={assignment.server}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white"><Server className="h-4 w-4" /></span>
                          <div className="min-w-0">
                            <div className="truncate font-mono text-xs font-bold text-slate-900">{assignment.server}</div>
                            <div className="text-[10px] text-slate-400">节点 {String(index + 1).padStart(2, "0")}</div>
                          </div>
                        </div>
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
                      </div>
                      <p className="mt-3 min-h-10 text-[11px] leading-5 text-slate-500">{assignment.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {assignment.roles.map((assignmentRole) => {
                          const matchedRole = findAssignmentRole(assignmentRole, roles);
                          return (
                            <button
                              key={assignmentRole}
                              type="button"
                              onClick={() => matchedRole && openRoleInDeveloper(matchedRole.id)}
                              className={cn(
                                "rounded-md border px-2 py-1 text-[10px] font-semibold",
                                matchedRole ? roleTone(matchedRole.id) : "border-slate-200 bg-slate-50 text-slate-600",
                              )}
                              title={matchedRole ? "进入该角色开发器" : assignmentRole}
                            >
                              {assignmentRole}
                            </button>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-900 p-4 text-white">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Runtime data flow</div>
                  <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
                    {["公网入口", "总部/代理/客户运行", "内容 Worker", "数据与素材", "异地灾备"].map((item, index, items) => (
                      <div key={item} className="contents">
                        <div className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-[11px] font-semibold text-slate-200">{item}</div>
                        {index < items.length - 1 ? <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-cyan-400 lg:rotate-0" /> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="min-w-0 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">组合检查</div>
                  <div className="mt-4 space-y-3">
                    {[
                      ["服务器节点", `${selectedProfile.assignments.length} 个`],
                      ["角色目录", `${roles.length || 7} 个固定角色`],
                      ["源码副本", "1 份唯一源码"],
                      ["异地备份", selectedProfile.externalBackupRequired ? "本阶段必须独立配置" : "随规模准备独立配置"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                        <span className="text-xs text-slate-500">{label}</span>
                        <span className="text-right text-xs font-semibold text-slate-900">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900"><ShieldCheck className="h-4 w-4" />部署前置门禁</div>
                  <ul className="mt-3 space-y-2 text-[11px] leading-5 text-amber-800">
                    <li>· 数据库迁移必须可回滚</li>
                    <li>· 租户上下文检查必须通过</li>
                    <li>· 密钥由环境注入，禁止写入镜像</li>
                    <li>· 备份恢复演练必须有记录</li>
                  </ul>
                </div>
              </aside>
            </section>
          ) : null}
        </div>
      ) : null}

      {mode === "contract" ? (
        <div className="space-y-4" data-shared-deployment-contract>
          <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900" data-shared-title-heading><ShieldCheck className="h-4 w-4 text-emerald-600" />共享部署契约</div>
                  <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">开发器和可视化编排共同遵守这些边界；任何新代理、新客户、新计划或新服务器都不能绕开。</p>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />5 项契约已建立</span>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {CONTRACTS.map((contract, index) => {
                  const Icon = contract.icon;
                  return (
                    <article key={contract.id} className={cn("rounded-xl border p-4", TONE_CLASSES[contract.tone], index === 0 ? "lg:col-span-2" : "")} data-contract={contract.id}>
                      <div className="flex items-start gap-3">
                        <span className="rounded-lg border border-current/10 bg-white/60 p-2"><Icon className="h-4 w-4" /></span>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold">{contract.title}</h3>
                          <p className="mt-1 text-xs leading-5 opacity-80">{contract.summary}</p>
                        </div>
                      </div>
                      <ul className="mt-3 grid gap-1.5 text-[11px] leading-5 opacity-90 sm:grid-cols-3">
                        {contract.rules.map((rule) => <li key={rule} className="rounded-lg border border-current/10 bg-white/50 px-2.5 py-2">{rule}</li>)}
                      </ul>
                    </article>
                  );
                })}
              </div>
            </div>

            <aside className="min-w-0 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-950 p-4 text-white shadow-sm">
                <div className="flex items-center gap-2 text-sm font-bold"><GitBranch className="h-4 w-4 text-cyan-300" />两条受控发布链</div>
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">代理链</div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                      {[
                        "总部源",
                        "代理源",
                        "代理端",
                      ].map((item, index, items) => (
                        <div key={item} className="contents"><span className="rounded bg-white/10 px-2 py-1.5">{item}</span>{index < items.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-violet-300" /> : null}</div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">客户计划链</div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                      {["总部源", "客户源", "客户端", "客户端计划"].map((item, index, items) => (
                        <div key={item} className="contents"><span className="rounded bg-white/10 px-2 py-1.5">{item}</span>{index < items.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-cyan-300" /> : null}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-bold text-slate-900">关键存放位置</div>
                <div className="mt-3 space-y-3">
                  {[
                    ["唯一源码", workspace?.sourceRoot],
                    ["本地数据", workspace?.localDataRoot],
                    ["素材资源", workspace?.assetResourceRoot],
                    ["备份恢复", workspace?.backupRoot],
                  ].map(([label, path]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-slate-500">{label}</span>
                        <button type="button" onClick={() => onOpenPath(path)} disabled={!path} className="text-cyan-700 disabled:text-slate-300" title="打开路径"><ArrowUpRight className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="mt-1 break-all font-mono text-[10px] leading-4 text-slate-700">{path || "读取中…"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </section>
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm" data-contract-status-strip>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 rounded-lg bg-emerald-100 p-2 text-emerald-700"><ShieldCheck className="h-4 w-4" /></span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900">共享契约贯穿三个工作模式</div>
              <div className="mt-1 text-[11px] leading-5 text-slate-500">开发器修改唯一源码，可视化组合服务器，发布门禁验证租户隔离、数据迁移与备份恢复。</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["唯一源码", "七角色", "租户隔离", "数据分层", "异地灾备"].map((item) => (
              <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{item}</span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
