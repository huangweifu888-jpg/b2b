import { useMemo, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { DEVELOPMENT_STANDARD_TEMPLATE } from "@/lib/development-standard-template";

type ProgressStatus = "todo" | "doing" | "done";

type DevelopmentStandardModule = {
  id: string;
  title: string;
  stage: string;
  painPoint: string;
  action: string;
  acceptance: string;
  hq: string;
  agency: string;
  customer: string;
  status: ProgressStatus;
  collapsed: boolean;
  custom?: boolean;
};

const STATUS_META: Record<ProgressStatus, { label: string; progress: number }> = {
  todo: { label: "未开始", progress: 0 },
  doing: { label: "进行中", progress: 50 },
  done: { label: "已完成", progress: 100 },
};

const INITIAL_MODULES: DevelopmentStandardModule[] = [
  {
    id: "scope",
    stage: "01",
    title: "立项与责任划分",
    painPoint: "项目一开始就把三端职责与可发布范围混在一起。",
    action: "先登记来源端、接收端、负责人和不可下发的数据边界。",
    acceptance: "范围清单已确认；业务数据、上传素材和下游新增内容已排除。",
    hq: "制定通用目标、平台规则与共享验收口径。",
    agency: "确认代理业务需求、代理端接收范围与专属能力。",
    customer: "确认客户场景、客户计划／站点范围和需保留的本地资产。",
    status: "done",
    collapsed: false,
  },
  {
    id: "baseline",
    stage: "02",
    title: "来源基线与方案设计",
    painPoint: "来源基线不清晰，变更后不知道会影响哪些下游。",
    action: "建立页面组合、接口、权限与模板版本的影响地图。",
    acceptance: "来源基线、影响对象和可发布差异均可追溯。",
    hq: "维护共享模板、框架合同、通用组件和总部版本基线。",
    agency: "在总部基线上配置代理能力，并记录代理本地自定义。",
    customer: "登记客户模板、栏目与计划端配置；不反向修改上游。",
    status: "doing",
    collapsed: false,
  },
  {
    id: "quality",
    stage: "03",
    title: "开发、验证与验收",
    painPoint: "只验证单页，框架、编码和下游兼容问题在发布后才暴露。",
    action: "在当前来源端完成开发，并运行类型、构建、编码、截图和差异验证。",
    acceptance: "质量闸门、截图与差异结论均留档，三端验证范围明确。",
    hq: "验证共享框架、公共接口、权限边界与总部回归。",
    agency: "验证代理源端页面、代理流程及代理端兼容性。",
    customer: "验证客户源端、栏目/版面/客服和客户计划／站点呈现。",
    status: "todo",
    collapsed: false,
  },
  {
    id: "release",
    stage: "04",
    title: "预演、审批与单向发布",
    painPoint: "发布直接写入下游，容易误覆盖自定义或沿错误链路同步。",
    action: "先生成无写入预演报告，审批后只沿已确认的模板链路发布。",
    acceptance: "差异、审批、批次与发布范围齐全；无跨链路或逆向同步。",
    hq: "仅向代理源端或客户源端下发已审批的共享模板变更，不得绕过来源端直达运行实例。",
    agency: "仅沿 A 分支向自身代理端发布；不得发布到客户源端，不回写总部端。",
    customer: "仅沿 B 分支向该客户计划／站点发布；不得发布到代理源端，不回写总部端；不覆盖本地新增或自定义。",
    status: "todo",
    collapsed: false,
  },
  {
    id: "operate",
    stage: "05",
    title: "运行审计与定向恢复",
    painPoint: "出现异常时全量回退，误伤下游内容或其他项目。",
    action: "保留审计与快照，只对选定来源、页面或发布批次进行恢复。",
    acceptance: "以“来源基线 + 下游本地变更”合并恢复，新增数据保持不变。",
    hq: "保存总部基线、发布批次与全局审计记录。",
    agency: "保存代理源端本地变更与代理端接收记录。",
    customer: "保存客户源端、客户计划／站点差异及客户本地资产记录。",
    status: "todo",
    collapsed: false,
  },
];

const createCustomModule = (index: number): DevelopmentStandardModule => ({
  id: `custom-${Date.now()}-${index}`,
  stage: String(index + 1).padStart(2, "0"),
  title: "新增开发规范要点",
  painPoint: "待补充当前项目的真实痛点。",
  action: "待补充处理方案、负责人和适用端。",
  acceptance: "待补充可验证的完成条件。",
  hq: "待规划总部端职责。",
  agency: "待规划代理源端职责。",
  customer: "待规划客户源端职责。",
  status: "todo",
  collapsed: false,
  custom: true,
});

function SortableDevelopmentStandardModule({
  module,
  index,
  total,
  onMove,
  onStatus,
  onToggle,
  onRemove,
}: {
  module: DevelopmentStandardModule;
  index: number;
  total: number;
  onMove: (direction: "up" | "down") => void;
  onStatus: (status: ProgressStatus) => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: module.id });
  const status = STATUS_META[module.status];
  const order = String(index + 1).padStart(2, "0");

  return (
    <article
      ref={setNodeRef}
      id={`development-standard-module-${module.id}`}
      data-development-standard-workbench-module={module.id}
      className={`rounded-xl border border-current/20 bg-background/35 p-3 text-xs shadow-sm ${isDragging ? "opacity-55 ring-1 ring-current/50" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition: transition || "transform 180ms ease" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label={`拖拉 ${module.title}`}
            title="拖拉排序"
            className="cursor-grab touch-none rounded border border-current/20 px-2 py-1 font-semibold active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            ⠿
          </button>
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-current/30 px-1 font-semibold">{order}</span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{module.title}</h2>
            <p className="opacity-75">{module.stage} · {status.label}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onMove("up")} disabled={index === 0}>上移</Button>
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onMove("down")} disabled={index === total - 1}>下移</Button>
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onToggle}>{module.collapsed ? "展开" : "收起"}</Button>
          {module.custom ? <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onRemove}>删除</Button> : null}
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-current/15" aria-label={`${module.title} 完成进度 ${status.progress}%`}>
        <div className="h-full rounded-full bg-current transition-all" style={{ width: `${status.progress}%` }} />
      </div>

      {!module.collapsed ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <section className="rounded-lg border border-current/15 p-3" aria-label={`${module.title} 实际效果或逻辑图`}>
            <div className="font-semibold">实际效果／痛点路线</div>
            <p className="mt-2 rounded-md border border-current/15 px-2 py-1.5 opacity-85"><span className="font-medium">痛点：</span>{module.painPoint}</p>
            <div className="my-2 flex flex-wrap items-center gap-1.5 font-medium" aria-label="痛点路线图">
              <span className="rounded-full border border-current/25 px-2 py-1">痛点</span><span aria-hidden="true">→</span>
              <span className="rounded-full border border-current/25 px-2 py-1">来源分析</span><span aria-hidden="true">→</span>
              <span className="rounded-full border border-current/25 px-2 py-1">三端执行</span><span aria-hidden="true">→</span>
              <span className="rounded-full border border-current/25 px-2 py-1">验收留档</span>
            </div>
            <p className="rounded-md border border-current/15 px-2 py-1.5 opacity-85"><span className="font-medium">处理：</span>{module.action}</p>
          </section>
          <section className="rounded-lg border border-current/15 p-3" aria-label={`${module.title} 详细说明`}>
            <div className="font-semibold">三端规划与完成条件</div>
            <dl className="mt-2 grid gap-2 sm:grid-cols-3">
              <div><dt className="font-medium">总部端</dt><dd className="mt-1 opacity-80">{module.hq}</dd></div>
              <div><dt className="font-medium">代理源端</dt><dd className="mt-1 opacity-80">{module.agency}</dd></div>
              <div><dt className="font-medium">客户源端</dt><dd className="mt-1 opacity-80">{module.customer}</dd></div>
            </dl>
            <p className="mt-2 rounded-md border border-current/15 px-2 py-1.5"><span className="font-medium">完成条件：</span>{module.acceptance}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label={`${module.title} 进度状态`}>
              <span className="font-medium">进度：</span>
              {(Object.keys(STATUS_META) as ProgressStatus[]).map((item) => (
                <Button key={item} type="button" size="sm" variant={module.status === item ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => onStatus(item)}>
                  {STATUS_META[item].label} {STATUS_META[item].progress}%
                </Button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </article>
  );
}

export function DevelopmentStandardWorkbench() {
  const [modules, setModules] = useState<DevelopmentStandardModule[]>(INITIAL_MODULES);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const progress = useMemo(() => Math.round(modules.reduce((total, item) => total + STATUS_META[item.status].progress, 0) / Math.max(modules.length, 1)), [modules]);

  const move = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= modules.length) return;
    setModules((current) => arrayMove(current, index, target));
  };
  const update = (id: string, updater: (item: DevelopmentStandardModule) => DevelopmentStandardModule) => setModules((current) => current.map((item) => item.id === id ? updater(item) : item));
  const locate = (id: string) => document.getElementById(`development-standard-module-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setModules((current) => {
      const from = current.findIndex((item) => item.id === String(active.id));
      const to = current.findIndex((item) => item.id === String(over.id));
      return from < 0 || to < 0 ? current : arrayMove(current, from, to);
    });
  };

  return (
    <section data-development-standard-workbench className="border-t border-current/15 p-3">
      <div data-page-table-header className="sticky top-0 z-20 rounded-xl border border-current/20 bg-background/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">开发规范要点模块样板</div>
            <p className="text-xs opacity-80">表头顺序与下方模块实时一致；点击胶囊定位模块，拖拉或上下移动后自动重排。此样板只保存前端演示状态，不触碰业务数据、素材或下游配置。</p>
          </div>
          <Button data-development-standard-add-module type="button" size="sm" onClick={() => setModules((current) => [...current, createCustomModule(current.length)])}>+ 增加要点</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {modules.map((item, index) => (
            <button key={item.id} type="button" data-development-standard-header-module={item.id} className="rounded-full border border-current/25 px-2.5 py-1 text-xs font-medium hover:bg-current/10" onClick={() => locate(item.id)}>
              {String(index + 1).padStart(2, "0")} {item.title}
            </button>
          ))}
          <span className="ml-auto whitespace-nowrap text-xs font-semibold">总体完成 {progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-current/15" aria-label={`开发规范总体完成进度 ${progress}%`}><div className="h-full rounded-full bg-current transition-all" style={{ width: `${progress}%` }} /></div>
      </div>

      <section data-development-standard-template={DEVELOPMENT_STANDARD_TEMPLATE.id} data-development-standard-template-version={DEVELOPMENT_STANDARD_TEMPLATE.version} className="mt-3 rounded-xl border border-current/20 bg-background/35 p-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><div className="text-sm font-semibold">{DEVELOPMENT_STANDARD_TEMPLATE.title}</div><p className="mt-1 opacity-75">所有经营规范共用同一组字段；不同模块只填写业务内容、操作入口、验收和证据，不再复制页面框架。</p></div>
          <span className="rounded-full border border-current/25 px-2.5 py-1 font-semibold">模板 {DEVELOPMENT_STANDARD_TEMPLATE.version}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7" aria-label="统一开发规范模板字段">
          {DEVELOPMENT_STANDARD_TEMPLATE.fields.map((field, index) => <span key={field} data-development-standard-template-field={field} className="rounded-md border border-current/15 bg-current/[0.03] px-2 py-1.5"><b className="mr-1 opacity-60">{String(index + 1).padStart(2, "0")}</b>{field}</span>)}
        </div>
        <p className="mt-3 rounded-md border border-current/15 px-2 py-1.5 font-medium">发布边界：{DEVELOPMENT_STANDARD_TEMPLATE.releaseBoundary}</p>
      </section>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={modules.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <div className="mt-3 grid gap-3">
            {modules.map((item, index) => (
              <SortableDevelopmentStandardModule
                key={item.id}
                module={item}
                index={index}
                total={modules.length}
                onMove={(direction) => move(index, direction)}
                onStatus={(status) => update(item.id, (current) => ({ ...current, status }))}
                onToggle={() => update(item.id, (current) => ({ ...current, collapsed: !current.collapsed }))}
                onRemove={() => setModules((current) => current.filter((candidate) => candidate.id !== item.id))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <p className="mt-3 text-xs font-medium">统一发布边界：A 总部端 → 代理源端 → 代理端；B 总部端 → 客户源端 → 客户计划／站点。总部端不得绕过来源端直达运行实例；代理源端与客户源端互不发布；任何分支均不得反向发布。下游自定义、业务数据、新增内容和上传素材始终不覆盖、不删除、不反向同步。</p>
    </section>
  );
}
